import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export type MigrationStatus = 'started' | 'applied' | 'failed';

export interface MigrationFile {
  id: number;
  filename: string;
  checksum: string;
  sql: string;
}

export interface MigrationConnection {
  query(sql: string, values?: unknown[]): Promise<unknown>;
}

export interface MigrationOptions {
  database: string;
  baseline?: 'canonical-v1';
  apply: boolean;
  confirmation?: string;
  migrationsDirectory: string;
  lockTimeoutSeconds?: number;
}

export interface MigrationPlanItem {
  id: number;
  filename: string;
  checksum: string;
  status: 'pending' | 'applied' | 'blocked' | 'failed' | 'unknown';
  reason?: string;
}

export interface MigrationPlan {
  database: string;
  baseline: string | null;
  items: MigrationPlanItem[];
  warnings: string[];
  canApply: boolean;
}

const LEDGER_TABLE = 'ojix_schema_migrations';
const BASELINE_TABLE = 'ojix_migration_metadata';
const NEVER_AUTOMATICALLY_REPLAY = new Set([26, 34]);

function toResult(value: unknown): { rows: any[]; result?: any } {
  if (Array.isArray(value) && value.length === 2) {
    return Array.isArray(value[0]) ? { rows: value[0] as any[] } : { rows: [], result: value[0] };
  }
  if (Array.isArray(value)) return { rows: value as any[] };
  return { rows: [], result: value };
}

function quoteIdentifier(identifier: string): string {
  if (!identifier || identifier.includes('\0')) throw new Error('Database identifier is invalid.');
  return `\`${identifier.replace(/`/g, '``')}\``;
}

function migrationId(filename: string): number {
  const match = /^(\d{3})_[a-z0-9][a-z0-9_-]*\.sql$/i.exec(filename);
  if (!match) throw new Error(`Invalid migration filename: ${filename}`);
  return Number(match[1]);
}

export async function readMigrations(directory: string): Promise<MigrationFile[]> {
  const filenames = (await fs.readdir(directory)).filter(name => name.endsWith('.sql'));
  const files = await Promise.all(filenames.map(async filename => {
    const id = migrationId(filename);
    const sql = await fs.readFile(path.join(directory, filename), 'utf8');
    return { id, filename, checksum: crypto.createHash('sha256').update(sql).digest('hex'), sql };
  }));
  files.sort((a, b) => a.id - b.id);
  for (let i = 1; i < files.length; i++) {
    if (files[i].id === files[i - 1].id) throw new Error(`Duplicate migration ID ${files[i].id}: ${files[i - 1].filename}, ${files[i].filename}`);
    if (files[i].id !== files[i - 1].id + 1) throw new Error(`Migration sequence gap between ${files[i - 1].filename} and ${files[i].filename}.`);
  }
  return files;
}

/** Split a mysql-client script into statements without sending DELIMITER directives to mysql2. */
export function splitMysqlScript(script: string): string[] {
  const statements: string[] = [];
  let delimiter = ';';
  let buffer = '';
  let quote: "'" | '"' | '`' | null = null;
  let lineComment = false;
  let blockComment = false;
  let i = 0;

  while (i < script.length) {
    if (!quote && !lineComment && !blockComment && (i === 0 || script[i - 1] === '\n')) {
      const rest = script.slice(i);
      const directive = /^[\t ]*DELIMITER[\t ]+(\S+)[\t ]*(?:\r?\n|$)/i.exec(rest);
      if (directive) {
        delimiter = directive[1];
        i += directive[0].length;
        continue;
      }
    }

    const ch = script[i];
    const next = script[i + 1];
    if (lineComment) {
      buffer += ch;
      i++;
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      buffer += ch;
      i++;
      if (ch === '*' && next === '/') { buffer += next; i++; blockComment = false; }
      continue;
    }
    if (quote) {
      buffer += ch;
      i++;
      if (ch === '\\' && quote !== '`' && i < script.length) { buffer += script[i]; i++; continue; }
      if (ch === quote) {
        if (script[i] === quote) { buffer += script[i]; i++; }
        else quote = null;
      }
      continue;
    }
    if (ch === '-' && next === '-' && (script[i + 2] === ' ' || script[i + 2] === '\t' || script[i + 2] === '\n' || script[i + 2] === '\r')) {
      buffer += ch + next; i += 2; lineComment = true; continue;
    }
    if (ch === '#') { buffer += ch; i++; lineComment = true; continue; }
    if (ch === '/' && next === '*') { buffer += ch + next; i += 2; blockComment = true; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; buffer += ch; i++; continue; }
    if (script.startsWith(delimiter, i)) {
      const statement = buffer.trim();
      if (statement) statements.push(statement);
      buffer = '';
      i += delimiter.length;
      continue;
    }
    buffer += ch;
    i++;
  }
  if (quote) throw new Error('SQL script ended inside a quoted string or identifier.');
  if (blockComment) throw new Error('SQL script ended inside a block comment.');
  const tail = buffer.trim();
  if (delimiter !== ';' && tail) throw new Error(`SQL script ended before custom delimiter '${delimiter}'.`);
  if (tail) statements.push(tail);
  return statements;
}

/** Route legacy USE statements to the database selected by DATABASE_URL. */
export function targetStatements(sql: string, database: string): string[] {
  const target = `USE ${quoteIdentifier(database)}`;
  return splitMysqlScript(sql).map(statement => {
    const match = /^(\s*(?:(?:--[^\n]*(?:\n|$)|#[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/\s*))*)(USE\s+(?:`[^`]+`|[a-z0-9_$-]+))\s*$/i.exec(statement);
    return match ? `${match[1]}${target}` : statement;
  });
}

function lockName(database: string): string {
  const digest = crypto.createHash('sha256').update(database).digest('hex').slice(0, 12);
  return `ojix:migrate:${database.slice(0, 42)}:${digest}`.slice(0, 64);
}

async function queryRows(connection: MigrationConnection, sql: string, values: unknown[] = []): Promise<any[]> {
  return toResult(await connection.query(sql, values)).rows;
}

async function tableExists(connection: MigrationConnection, database: string, table: string): Promise<boolean> {
  const rows = await queryRows(connection,
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?', [database, table]);
  return rows.length > 0;
}

async function ensureMetadataTables(connection: MigrationConnection): Promise<void> {
  await connection.query(`CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
    migration_id INT UNSIGNED NOT NULL,
    filename VARCHAR(255) NOT NULL,
    checksum CHAR(64) NOT NULL,
    status ENUM('started','applied','failed') NOT NULL,
    started_at DATETIME(6) NOT NULL,
    completed_at DATETIME(6) NULL,
    failure_message TEXT NULL,
    PRIMARY KEY (migration_id),
    UNIQUE KEY ojix_migration_filename_key (filename)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await connection.query(`CREATE TABLE IF NOT EXISTS ${BASELINE_TABLE} (
    metadata_key VARCHAR(80) NOT NULL,
    metadata_value VARCHAR(255) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (metadata_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

async function readLedger(connection: MigrationConnection): Promise<Map<number, any>> {
  const rows = await queryRows(connection, `SELECT migration_id,filename,checksum,status,started_at,completed_at FROM ${LEDGER_TABLE} ORDER BY migration_id`);
  return new Map(rows.map(row => [Number(row.migration_id), row]));
}

async function readBaseline(connection: MigrationConnection): Promise<string | null> {
  const rows = await queryRows(connection, `SELECT metadata_value FROM ${BASELINE_TABLE} WHERE metadata_key='baseline'`);
  return rows[0]?.metadata_value ? String(rows[0].metadata_value) : null;
}

async function readBaselineThroughId(connection: MigrationConnection): Promise<number | null> {
  const rows = await queryRows(connection, `SELECT metadata_value FROM ${BASELINE_TABLE} WHERE metadata_key='baseline_through_id'`);
  if (!rows[0]?.metadata_value) return null;
  const value = Number(rows[0].metadata_value);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export async function buildMigrationPlan(connection: MigrationConnection, migrations: MigrationFile[], options: MigrationOptions): Promise<MigrationPlan> {
  const warnings: string[] = [];
  const hasLedger = await tableExists(connection, options.database, LEDGER_TABLE);
  const hasMetadata = await tableExists(connection, options.database, BASELINE_TABLE);
  if (hasLedger !== hasMetadata) throw new Error('Migration metadata is partially initialized; manual recovery is required.');

  if (!hasLedger) {
    if (options.baseline !== 'canonical-v1') {
      return { database: options.database, baseline: null, items: migrations.map(m => ({ id: m.id, filename: m.filename, checksum: m.checksum, status: 'unknown' as const, reason: 'No ledger. Explicit --baseline=canonical-v1 is required for a fresh canonical install.' })), warnings, canApply: false };
    }
    warnings.push('Canonical baseline must already exist and match the approved schema; the runner does not create or validate the full schema.');
    warnings.push('Fresh canonical baseline records every migration file as baseline-applied; historical files, including 026 and 034, will not execute.');
    return { database: options.database, baseline: options.baseline, items: migrations.map(m => ({ id: m.id, filename: m.filename, checksum: m.checksum, status: 'applied' as const, reason: 'Baseline registration; SQL will not execute.' })), warnings, canApply: true };
  }

  if (options.baseline) throw new Error('A baseline may only be supplied when no migration ledger exists.');
  const [baseline, ledger] = await Promise.all([readBaseline(connection), readLedger(connection)]);
  if (!baseline) throw new Error('Migration ledger exists without a baseline marker; manual recovery is required.');
  if (baseline === 'canonical-v1') {
    const throughId = await readBaselineThroughId(connection);
    if (throughId === null) throw new Error('Canonical baseline marker is missing baseline_through_id; manual recovery is required.');
    const missingBaselineEntries = migrations.filter(migration => migration.id <= throughId && !ledger.has(migration.id));
    if (missingBaselineEntries.length) {
      throw new Error(`Canonical baseline ledger is incomplete through migration ${throughId}; missing ${missingBaselineEntries.map(item => item.id).join(', ')}.`);
    }
  }
  for (const [id, row] of ledger) {
    if (!migrations.some(migration => migration.id === id)) {
      throw new Error(`Migration ${id} is recorded in the ledger but missing from the repository; restore the immutable migration file.`);
    }
  }
  const items = migrations.map(migration => {
    const row = ledger.get(migration.id);
    if (!row) return { id: migration.id, filename: migration.filename, checksum: migration.checksum, status: NEVER_AUTOMATICALLY_REPLAY.has(migration.id) ? 'blocked' as const : 'pending' as const,
      ...(NEVER_AUTOMATICALLY_REPLAY.has(migration.id) ? { reason: `Migration ${migration.id} requires explicit manual history reconciliation and is never auto-replayed.` } : {}) };
    if (row.filename !== migration.filename) throw new Error(`Migration ID ${migration.id} filename mismatch: ledger=${row.filename}, repository=${migration.filename}.`);
    if (row.checksum !== migration.checksum) throw new Error(`Migration ${migration.id} checksum mismatch; already-recorded migration files are immutable.`);
    if (row.status !== 'applied' || !row.completed_at) return { id: migration.id, filename: migration.filename, checksum: migration.checksum, status: 'failed' as const, reason: `Ledger status is ${row.status}; incomplete DDL requires manual inspection and recovery.` };
    return { id: migration.id, filename: migration.filename, checksum: migration.checksum, status: 'applied' as const };
  });

  const firstPending = items.findIndex(item => item.status === 'pending');
  if (items.some(item => item.status === 'blocked' || item.status === 'failed')) {
    warnings.push('Blocked or incomplete migrations require manual schema/history reconciliation; no automatic continuation is allowed.');
  }
  if (firstPending >= 0 && items.slice(firstPending).some(item => item.status === 'applied')) {
    throw new Error('Migration ledger is out of order: a later migration is applied after a pending migration.');
  }
  return { database: options.database, baseline, items, warnings, canApply: !items.some(item => item.status === 'blocked' || item.status === 'failed') };
}

async function superAdminPreflight(connection: MigrationConnection, database: string, allowKnown026Repair: boolean): Promise<{ ok: boolean; message: string }> {
  if (!await tableExists(connection, database, 'org_memberships')) {
    return { ok: false, message: 'org_memberships table was not found in the selected schema.' };
  }
  const rows = await queryRows(connection,
    `SELECT role,status FROM ${quoteIdentifier(database)}.org_memberships WHERE organization_id=? AND user_uid=?`,
    ['11111111-1111-4111-8111-111111111111', 'user-super-admin']);
  if (rows.length === 1 && rows[0].role === 'super_admin' && rows[0].status === 'active') {
    return { ok: true, message: 'Reserved Super Admin membership is present and active.' };
  }
  if (allowKnown026Repair && rows.length === 1 && rows[0].role === 'owner' && rows[0].status === 'active') {
    return { ok: true, message: 'Reserved membership has the known 026 Owner regression; pending migration 035 will repair this exact row.' };
  }
  return { ok: false, message: 'Reserved Super Admin preflight failed: expected exactly one active super_admin membership.' };
}

async function initializeCanonicalBaseline(connection: MigrationConnection, migrations: MigrationFile[]): Promise<void> {
  await ensureMetadataTables(connection);
  await connection.query('START TRANSACTION');
  try {
    await connection.query(`INSERT INTO ${BASELINE_TABLE} (metadata_key,metadata_value) VALUES ('baseline','canonical-v1')`);
    const throughId = migrations.reduce((maximum, migration) => Math.max(maximum, migration.id), 0);
    await connection.query(`INSERT INTO ${BASELINE_TABLE} (metadata_key,metadata_value) VALUES ('baseline_through_id',?)`, [String(throughId)]);
    for (const migration of migrations) {
      await connection.query(
        `INSERT INTO ${LEDGER_TABLE} (migration_id,filename,checksum,status,started_at,completed_at) VALUES (?,?,?,'applied',NOW(6),NOW(6))`,
        [migration.id, migration.filename, migration.checksum]);
    }
    await connection.query('COMMIT');
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  }
}

export async function runMigrationPlan(connection: MigrationConnection, migrations: MigrationFile[], options: MigrationOptions): Promise<MigrationPlan> {
  if (options.apply && options.confirmation !== options.database) {
    throw new Error('Applying migrations requires --apply and --confirm-target=<exact database name>.');
  }
  const selectedDatabase = await queryRows(connection, 'SELECT DATABASE() AS selected_database');
  if (String(selectedDatabase[0]?.selected_database || '') !== options.database) {
    throw new Error(`Connected schema does not match requested target '${options.database}'.`);
  }
  const lock = lockName(options.database);
  const lockRows = await queryRows(connection, 'SELECT GET_LOCK(?,?) AS acquired', [lock, options.lockTimeoutSeconds ?? 0]);
  if (Number(lockRows[0]?.acquired) !== 1) throw new Error('Could not acquire the migration advisory lock. Another migration or session may hold it.');
  try {
    const hasExistingLedger = await tableExists(connection, options.database, LEDGER_TABLE);
    let plan = await buildMigrationPlan(connection, migrations, options);
    const hasApplied035 = plan.items.some(item => item.id === 35 && item.status === 'applied');
    const hasPending035 = plan.items.some(item => item.id === 35 && item.status === 'pending');
    const identityCheck = await superAdminPreflight(connection, options.database, hasPending035);
    plan.warnings.push(identityCheck.message);
    if (!identityCheck.ok) plan.canApply = false;
    if (!options.apply) return plan;
    if (!plan.canApply) throw new Error('Migration plan contains blocked or failed entries; no SQL was applied.');
    if (hasApplied035 && !identityCheck.ok) throw new Error('Super Admin preflight failed after migration 035 is already marked applied.');

    if (!hasExistingLedger && plan.baseline === 'canonical-v1') {
      await initializeCanonicalBaseline(connection, migrations);
      return { ...plan, warnings: [...plan.warnings, 'Canonical baseline registered; no migration SQL was executed.'] };
    }

    const pending = plan.items.filter(item => item.status === 'pending');
    await ensureMetadataTables(connection);
    for (const item of pending) {
      const migration = migrations.find(entry => entry.id === item.id)!;
      await connection.query(
        `INSERT INTO ${LEDGER_TABLE} (migration_id,filename,checksum,status,started_at,completed_at) VALUES (?,?,?,'started',NOW(6),NULL)`,
        [migration.id, migration.filename, migration.checksum]);
      try {
        for (const statement of targetStatements(migration.sql, options.database)) await connection.query(statement);
        const updateResult = toResult(await connection.query(
          `UPDATE ${LEDGER_TABLE} SET status='applied',completed_at=NOW(6) WHERE migration_id=? AND checksum=? AND status='started'`,
          [migration.id, migration.checksum])).result;
        if (updateResult?.affectedRows !== undefined && Number(updateResult.affectedRows) !== 1) {
          throw new Error(`Could not record migration ${migration.id} completion; ledger remains incomplete.`);
        }
      } catch (error) {
        await connection.query(
          `UPDATE ${LEDGER_TABLE} SET status='failed',completed_at=NULL,failure_message=? WHERE migration_id=? AND status='started'`,
          [String(error).slice(0, 4000), migration.id]);
        throw new Error(`Migration ${migration.id} failed or may be partially applied. Ledger is failed; inspect schema and recover manually. ${String(error)}`);
      }
    }
    plan = await buildMigrationPlan(connection, migrations, { ...options, baseline: undefined });
    return plan;
  } finally {
    await connection.query('SELECT RELEASE_LOCK(?)', [lock]);
  }
}
