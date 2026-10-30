import dotenv from 'dotenv';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { hashPassword } from '../src/auth-security.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env'), override: false });

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo password seeding is disabled in production.');
}

const demoPasswordInputs = [
  ['user-super-admin', 'DEMO_SUPER_ADMIN_PASSWORD'],
  ['user-owner', 'DEMO_OWNER_PASSWORD'],
  ['user-admin', 'DEMO_ADMIN_PASSWORD'],
  ['user-lawyer', 'DEMO_LAWYER_PASSWORD'],
  ['user-analyst', 'DEMO_ANALYST_PASSWORD'],
  ['user-operations', 'DEMO_OPERATIONS_PASSWORD'],
  ['user-consultant', 'DEMO_CONSULTANT_PASSWORD'],
  ['user-support', 'DEMO_SUPPORT_PASSWORD'],
  ['user-data-steward', 'DEMO_DATA_STEWARD_PASSWORD'],
  ['user-viewer', 'DEMO_VIEWER_PASSWORD'],
] as const;

const missing = demoPasswordInputs.filter(([, envKey]) => !process.env[envKey]?.trim()).map(([, envKey]) => envKey);
if (missing.length) throw new Error(`Set all demo password variables in .env before seeding: ${missing.join(', ')}`);

const passwords = demoPasswordInputs.map(([, envKey]) => process.env[envKey]!.trim());
if (new Set(passwords).size !== passwords.length) {
  throw new Error('Each local demo role must have a distinct password.');
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required to seed demo password hashes.');

const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.beginTransaction();
  for (const [userUid, envKey] of demoPasswordInputs) {
    const password = process.env[envKey]!.trim();
    await connection.query(
      `INSERT INTO account_password_overrides (user_uid, password_hash, changed_at, changed_by_uid)
       VALUES (?, ?, NOW(6), 'local-demo-seed')
       ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), changed_at=NOW(6), changed_by_uid='local-demo-seed'`,
      [userUid, hashPassword(password)],
    );
  }
  await connection.commit();
  console.log(`Seeded password hashes for ${demoPasswordInputs.length} local demo accounts.`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
