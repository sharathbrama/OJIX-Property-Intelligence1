import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildMigrationPlan,
  readMigrations,
  runMigrationPlan,
  splitMysqlScript,
  targetStatements,
  type MigrationConnection,
  type MigrationFile,
  type MigrationOptions,
} from '../src/migration-runner.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const migrationDir = path.join(repoRoot, 'database/migrations');

class MockConnection implements MigrationConnection {
  database = 'ojix_mock';
  tables = new Set<string>();
  ledger = new Map<number, any>();
  baseline: string | null = null;
  baselineThroughId: number | null = null;
  role = 'super_admin';
  status = 'active';
  reservedMembershipExists = true;
  lockHeld = false;
  failOnSql: string | null = null;
  executed: string[] = [];

  async query(sql: string, values: unknown[] = []): Promise<unknown> {
    const normalized = sql.trim();
    if (normalized === 'SELECT DATABASE() AS selected_database') return [[{ selected_database: this.database }], []];
    if (normalized.startsWith('SELECT GET_LOCK')) {
      if (this.lockHeld) return [[{ acquired: 0 }], []];
      this.lockHeld = true;
      return [[{ acquired: 1 }], []];
    }
    if (normalized.startsWith('SELECT RELEASE_LOCK')) { this.lockHeld = false; return [[{ released: 1 }], []]; }
    if (['START TRANSACTION', 'COMMIT', 'ROLLBACK'].includes(normalized)) return [{ affectedRows: 0 }, []];
    if (normalized.includes('information_schema.TABLES')) {
      return [[...(this.tables.has(String(values[1])) ? [{ TABLE_NAME: values[1] }] : [])], []];
    }
    if (normalized.startsWith('SELECT role,status FROM')) return [[...(this.reservedMembershipExists ? [{ role: this.role, status: this.status }] : [])], []];
    if (normalized.includes("metadata_key='baseline_through_id'")) return [[...(this.baselineThroughId !== null ? [{ metadata_value: String(this.baselineThroughId) }] : [])], []];
    if (normalized.includes("metadata_key='baseline'")) return [[...(this.baseline ? [{ metadata_value: this.baseline }] : [])], []];
    if (normalized.startsWith('SELECT migration_id,filename,checksum,status')) return [[...this.ledger.values()], []];
    if (normalized.startsWith('CREATE TABLE IF NOT EXISTS ojix_schema_migrations')) { this.tables.add('ojix_schema_migrations'); return [{ affectedRows: 0 }, []]; }
    if (normalized.startsWith('CREATE TABLE IF NOT EXISTS ojix_migration_metadata')) { this.tables.add('ojix_migration_metadata'); return [{ affectedRows: 0 }, []]; }
    if (normalized.startsWith('INSERT INTO ojix_migration_metadata')) {
      if (normalized.includes("VALUES ('baseline','canonical-v1')")) this.baseline = 'canonical-v1';
      else this.baselineThroughId = Number(values[0]);
      return [{ affectedRows: 1 }, []];
    }
    if (normalized.startsWith('INSERT INTO ojix_schema_migrations')) {
      const id = Number(values[0]);
      const applied = normalized.includes("'applied'");
      this.ledger.set(id, { migration_id: id, filename: values[1], checksum: values[2], status: applied ? 'applied' : 'started', started_at: new Date(), completed_at: applied ? new Date() : null });
      return [{ affectedRows: 1 }, []];
    }
    if (normalized.startsWith("UPDATE ojix_schema_migrations SET status='applied'")) {
      const row = this.ledger.get(Number(values[0]));
      if (!row || row.checksum !== values[1] || row.status !== 'started') return [{ affectedRows: 0 }, []];
      row.status = 'applied'; row.completed_at = new Date(); return [{ affectedRows: 1 }, []];
    }
    if (normalized.startsWith("UPDATE ojix_schema_migrations SET status='failed'")) {
      const row = this.ledger.get(Number(values[1]));
      if (row?.status === 'started') { row.status = 'failed'; row.completed_at = null; row.failure_message = values[0]; }
      return [{ affectedRows: 1 }, []];
    }
    if (this.failOnSql && normalized.includes(this.failOnSql)) throw new Error('mock statement failure');
    this.executed.push(normalized);
    return [{ affectedRows: 1 }, []];
  }
}

function migration(id: number, sql = 'SELECT 1'): MigrationFile {
  const filename = `${String(id).padStart(3, '0')}_test.sql`;
  return { id, filename, checksum: `${String(id).padStart(2, '0')}`.padEnd(64, 'a'), sql };
}

function options(overrides: Partial<MigrationOptions> = {}): MigrationOptions {
  return { database: 'ojix_mock', apply: false, migrationsDirectory: migrationDir, ...overrides };
}

test('migration ordering rejects duplicate IDs and numeric gaps', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ojix-migrations-'));
  try {
    await fs.writeFile(path.join(directory, '004_alpha.sql'), 'SELECT 1;');
    await fs.writeFile(path.join(directory, '004_beta.sql'), 'SELECT 2;');
    await assert.rejects(readMigrations(directory), /Duplicate migration ID 4/);
    await fs.rm(path.join(directory, '004_beta.sql'));
    await fs.writeFile(path.join(directory, '006_gamma.sql'), 'SELECT 3;');
    await assert.rejects(readMigrations(directory), /sequence gap/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('checksum changes for an already applied migration are rejected', async () => {
  const db = new MockConnection();
  db.tables.add('ojix_schema_migrations'); db.tables.add('ojix_migration_metadata'); db.baseline = 'legacy-reviewed';
  db.ledger.set(35, { migration_id: 35, filename: '035_test.sql', checksum: 'old'.padEnd(64, 'x'), status: 'applied', completed_at: new Date() });
  await assert.rejects(buildMigrationPlan(db, [migration(35)], options()), /checksum mismatch/);
});

test('fresh canonical baseline requires explicit baseline and records files without executing them', async () => {
  const db = new MockConnection();
  db.tables.add('org_memberships');
  const noBaseline = await runMigrationPlan(db, [migration(35)], options());
  assert.equal(noBaseline.canApply, false);
  assert.equal(db.executed.length, 0);

  const baseline = await runMigrationPlan(db, [migration(35)], options({ apply: true, baseline: 'canonical-v1', confirmation: 'ojix_mock' }));
  assert.equal(baseline.baseline, 'canonical-v1');
  assert.equal(db.ledger.get(35)?.status, 'applied');
  assert.equal(db.executed.length, 0, 'baseline registration must not execute migration SQL');
  assert.equal(db.baselineThroughId, 35);
});

test('existing canonical baseline applies later migrations without re-registering baseline metadata', async () => {
  const db = new MockConnection();
  db.tables.add('ojix_schema_migrations');
  db.tables.add('ojix_migration_metadata');
  db.tables.add('org_memberships');
  db.baseline = 'canonical-v1';
  db.baselineThroughId = 36;
  db.ledger.set(36, { migration_id: 36, filename: '036_test.sql', checksum: migration(36).checksum, status: 'applied', completed_at: new Date() });
  assert.equal((await buildMigrationPlan(db, [migration(36), migration(37)], options())).canApply, true);

  const plan = await runMigrationPlan(db, [migration(36), migration(37)], options({ apply: true, confirmation: 'ojix_mock' }));
  assert.equal(plan.items.find(item => item.id === 37)?.status, 'applied');
  assert.equal(db.baseline, 'canonical-v1');
  assert.equal(db.baselineThroughId, 36);
  assert.ok(db.executed.includes('SELECT 1'));
});

test('canonical baseline blocks missing ledger rows instead of replaying historical SQL', async () => {
  const db = new MockConnection();
  db.tables.add('ojix_schema_migrations'); db.tables.add('ojix_migration_metadata'); db.baseline = 'canonical-v1'; db.baselineThroughId = 35;
  await assert.rejects(buildMigrationPlan(db, [migration(34), migration(35)], options()), /baseline ledger is incomplete/);
});

test('applied migrations are detected and pending 026/034 are blocked', async () => {
  const db = new MockConnection();
  db.tables.add('ojix_schema_migrations'); db.tables.add('ojix_migration_metadata'); db.tables.add('org_memberships'); db.baseline = 'legacy-reviewed';
  db.ledger.set(25, { migration_id: 25, filename: '025_test.sql', checksum: migration(25).checksum, status: 'applied', completed_at: new Date() });
  const plan = await buildMigrationPlan(db, [migration(25), migration(26), migration(27), migration(34)], options());
  assert.equal(plan.items[0].status, 'applied');
  assert.equal(plan.items[1].status, 'blocked');
  assert.equal(plan.items[2].status, 'pending');
  assert.equal(plan.items[3].status, 'blocked');
  assert.equal(plan.canApply, false);
});

test('Super Admin preflight permits the known 026 regression only when 035 is pending', async () => {
  const db = new MockConnection();
  db.tables.add('ojix_schema_migrations'); db.tables.add('ojix_migration_metadata'); db.tables.add('org_memberships'); db.baseline = 'legacy-reviewed';
  db.role = 'owner';
  const applied034 = migration(34);
  db.ledger.set(34, { migration_id: 34, filename: applied034.filename, checksum: applied034.checksum, status: 'applied', completed_at: new Date() });
  const repair035 = migration(35);
  const repairPlan = await runMigrationPlan(db, [applied034, repair035], options({ apply: true, confirmation: 'ojix_mock' }));
  assert.equal(repairPlan.items[1].status, 'applied');

  const afterRepair = new MockConnection();
  afterRepair.tables.add('ojix_schema_migrations'); afterRepair.tables.add('ojix_migration_metadata'); afterRepair.tables.add('org_memberships'); afterRepair.baseline = 'legacy-reviewed';
  afterRepair.role = 'owner';
  const applied035 = migration(35);
  afterRepair.ledger.set(35, { migration_id: 35, filename: applied035.filename, checksum: applied035.checksum, status: 'applied', completed_at: new Date() });
  await assert.rejects(runMigrationPlan(afterRepair, [applied035, migration(36)], options({ apply: true, confirmation: 'ojix_mock' })), /preflight failed|plan contains blocked/);
});

test('missing reserved Super Admin blocks apply before migration SQL starts', async () => {
  const db = new MockConnection();
  db.tables.add('org_memberships');
  db.reservedMembershipExists = false;
  await assert.rejects(runMigrationPlan(db, [migration(35)], options({ apply: true, baseline: 'canonical-v1', confirmation: 'ojix_mock' })), /preflight failed|plan contains blocked/);
  assert.equal(db.ledger.size, 0);
  assert.equal(db.executed.length, 0);
});

test('migration 035 SQL is split for mysql2 without sending DELIMITER and routes USE to target schema', async () => {
  const sql = await fs.readFile(path.join(migrationDir, '035_correct_platform_role_and_viewer_index.sql'), 'utf8');
  const statements = targetStatements(sql, 'selected_staging_db');
  assert.equal(statements.some(statement => /^DELIMITER\b/i.test(statement)), false);
  assert.equal(statements[0], 'USE `selected_staging_db`');
  const createRoutine = statements.find(statement => /^CREATE PROCEDURE ensure_viewer_assignment_schema/i.test(statement));
  assert.ok(createRoutine);
  assert.match(createRoutine!, /PREPARE ojix_viewer_column_stmt/);
  assert.match(createRoutine!, /END$/);
  assert.equal((createRoutine!.match(/;/g) || []).length > 1, true, 'procedure body remains one complete statement');
  assert.throws(() => splitMysqlScript('DELIMITER //\nCREATE PROCEDURE broken() BEGIN SELECT 1; END;'), /before custom delimiter/);
  assert.equal(splitMysqlScript('SELECT \'a;b\'; SELECT 2;').length, 2);
});

test('failed DDL is recorded failed and subsequent preflight refuses automatic recovery', async () => {
  const db = new MockConnection();
  db.tables.add('ojix_schema_migrations'); db.tables.add('ojix_migration_metadata'); db.tables.add('org_memberships'); db.baseline = 'reviewed';
  db.failOnSql = 'BROKEN';
  const item = migration(36, 'ALTER TABLE properties ADD COLUMN x INT; BROKEN;');
  await assert.rejects(runMigrationPlan(db, [item], options({ apply: true, confirmation: 'ojix_mock' })), /failed or may be partially applied/);
  assert.equal(db.ledger.get(36)?.status, 'failed');
  assert.equal(db.ledger.get(36)?.completed_at, null);
  db.failOnSql = null;
  const recovery = await buildMigrationPlan(db, [item], options());
  assert.equal(recovery.items[0].status, 'failed');
  assert.equal(recovery.canApply, false);
});

test('concurrent runner is rejected by the advisory lock', async () => {
  const db = new MockConnection();
  const results = await Promise.allSettled([
    runMigrationPlan(db, [migration(35)], options()),
    runMigrationPlan(db, [migration(35)], options()),
  ]);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
  assert.match(String(rejected.reason), /advisory lock/);
});

test('apply mode requires exact target confirmation', async () => {
  const db = new MockConnection();
  await assert.rejects(runMigrationPlan(db, [migration(35)], options({ apply: true })), /confirm-target/);
});

test('connected schema must exactly match the selected target', async () => {
  const db = new MockConnection();
  await assert.rejects(runMigrationPlan(db, [migration(35)], options({ database: 'another_db' })), /does not match requested target/);
});
