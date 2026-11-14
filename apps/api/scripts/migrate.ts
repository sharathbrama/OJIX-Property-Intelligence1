import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { readMigrations, runMigrationPlan, type MigrationOptions } from '../src/migration-runner.js';

function usage(): string {
  return [
    'OJIX database migration runner',
    '',
    'Dry run (default): npm run db:migrate -w apps/api',
    'Fresh canonical baseline: npm run db:migrate -w apps/api -- --baseline=canonical-v1 --apply --confirm-target=<database>',
    'Apply pending migrations: npm run db:migrate -w apps/api -- --apply --confirm-target=<database>',
    '',
    'DATABASE_URL is required. Pending migrations 026 and 034 are blocked and are never automatically replayed.',
  ].join('\n');
}

function parseArgs(args: string[]): { apply: boolean; baseline?: 'canonical-v1'; confirmation?: string } {
  let apply = false;
  let baseline: 'canonical-v1' | undefined;
  let confirmation: string | undefined;
  for (const argument of args) {
    if (argument === '--apply') apply = true;
    else if (argument === '--baseline=canonical-v1') baseline = 'canonical-v1';
    else if (argument.startsWith('--confirm-target=')) confirmation = argument.slice('--confirm-target='.length);
    else if (argument === '--help' || argument === '-h') { process.stdout.write(`${usage()}\n`); process.exit(0); }
    else throw new Error(`Unknown argument: ${argument}\n\n${usage()}`);
  }
  if (apply && !confirmation) throw new Error(`Apply mode requires --confirm-target=<exact database name>.\n\n${usage()}`);
  if (!apply && confirmation) throw new Error('--confirm-target is accepted only together with --apply.');
  return { apply, baseline, confirmation };
}

function databaseFromUrl(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!database || database.includes('/')) throw new Error('DATABASE_URL must select exactly one database/schema.');
  return database;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required; no fallback or hard-coded database is used.');
  const database = databaseFromUrl(databaseUrl);
  const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../database/migrations');
  const migrations = await readMigrations(migrationsDirectory);
  const tls = process.env.DATABASE_SSL?.toLowerCase() === 'true';
  const pool = mysql.createPool({
    uri: databaseUrl,
    ssl: tls ? {
      rejectUnauthorized: true,
      ...(process.env.DATABASE_SSL_CA ? { ca: fs.readFileSync(process.env.DATABASE_SSL_CA, 'utf8') } : {}),
    } : undefined,
    connectionLimit: 1,
    waitForConnections: true,
    queueLimit: 0,
  });
  const connection = await pool.getConnection();
  try {
    const options: MigrationOptions = {
      ...args,
      database,
      migrationsDirectory,
      lockTimeoutSeconds: 0,
    };
    const plan = await runMigrationPlan(connection, migrations, options);
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch(error => {
  process.stderr.write(`Migration runner stopped: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
