import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bootstrapSuperAdmin,
  configuredSuperAdminEmails,
  isConfiguredSuperAdminEmail,
  validateSuperAdminBootstrapEnvironment,
  type BootstrapConnection,
} from '../src/super-admin-bootstrap.js';

const credentials = {
  SUPER_ADMIN_EMAIL: 'owner@example.test',
  SUPER_ADMIN_PASSWORD: 'Strong!Admin2026',
};

class BootstrapStore implements BootstrapConnection {
  account: { id: string; status: string; email_verified: boolean; passwordHash?: string } | null = null;
  membership: { role: string; status: string } | null = null;
  orgExists = false;
  begins = 0;
  commits = 0;
  rollbacks = 0;
  releases = 0;
  accountInsertCount = 0;

  async beginTransaction() { this.begins++; }
  async commit() { this.commits++; }
  async rollback() { this.rollbacks++; }
  release() { this.releases++; }

  async query(sql: string, params: any[] = []) {
    if (sql.includes('INSERT IGNORE INTO organizations')) {
      this.orgExists = true;
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('SELECT id FROM organizations')) {
      return { rows: this.orgExists ? [{ id: '11111111-1111-4111-8111-111111111111' }] : [], rowCount: this.orgExists ? 1 : 0 };
    }
    if (sql.includes('SELECT id,status,email_verified FROM user_accounts')) {
      return { rows: this.account ? [this.account] : [], rowCount: this.account ? 1 : 0 };
    }
    if (sql.includes('INSERT IGNORE INTO user_accounts')) {
      this.accountInsertCount++;
      if (!this.account) this.account = { id: params[0], email_verified: true, status: 'active', passwordHash: params[3] };
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO org_memberships')) {
      this.membership = { role: 'super_admin', status: 'active' };
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected SQL in bootstrap test: ${sql}`);
  }
}

const makePool = (connection: BootstrapStore) => ({ getConnection: async () => connection });

test('production bootstrap requires a strong email/password pair', () => {
  assert.throws(() => validateSuperAdminBootstrapEnvironment({ NODE_ENV: 'production' }), /required in production/);
  assert.throws(() => validateSuperAdminBootstrapEnvironment({ ...credentials, SUPER_ADMIN_PASSWORD: '' }), /configured together/);
  assert.throws(() => validateSuperAdminBootstrapEnvironment({ ...credentials, SUPER_ADMIN_PASSWORD: 'weak' }), /12 to 128/);
  assert.equal(validateSuperAdminBootstrapEnvironment(credentials, true)?.email, 'owner@example.test');
});

test('Super Admin email matching is normalized and supports the legacy allowlist', () => {
  const emails = configuredSuperAdminEmails({ SUPER_ADMIN_EMAIL: 'Owner@Example.test', SUPER_ADMIN_EMAILS: 'other@example.test, THIRD@example.test ' });
  assert.equal(emails.size, 3);
  assert.equal(isConfiguredSuperAdminEmail('OWNER@example.test', { SUPER_ADMIN_EMAIL: 'Owner@Example.test' }), true);
  assert.equal(isConfiguredSuperAdminEmail('unlisted@example.test', { SUPER_ADMIN_EMAIL: 'Owner@Example.test' }), false);
});

test('bootstrap inserts one hashed admin and is idempotent across redeploys', async () => {
  const db = new BootstrapStore();
  const result = await bootstrapSuperAdmin(makePool(db), credentials, {
    newId: (() => { let id = 0; return () => `generated-${++id}`; })(),
    hash: password => `scrypt-hash:${password}`,
  });
  assert.equal(result.created, true);
  assert.equal(db.accountInsertCount, 1);
  assert.equal(db.account?.passwordHash, `scrypt-hash:${credentials.SUPER_ADMIN_PASSWORD}`);
  assert.notEqual(db.account?.passwordHash, credentials.SUPER_ADMIN_PASSWORD);
  assert.deepEqual(db.membership, { role: 'super_admin', status: 'active' });
  assert.equal(db.commits, 1);

  const redeploy = await bootstrapSuperAdmin(makePool(db), credentials, {
    hash: () => { throw new Error('A redeploy must not hash or replace an existing password.'); },
  });
  assert.equal(redeploy.created, false);
  assert.equal(db.accountInsertCount, 1);
  assert.equal(db.commits, 2);
});

test('bootstrap refuses disabled or unverified pre-existing accounts', async () => {
  const disabled = new BootstrapStore();
  disabled.orgExists = true;
  disabled.account = { id: 'disabled', status: 'disabled', email_verified: true };
  await assert.rejects(() => bootstrapSuperAdmin(makePool(disabled), credentials), /already exists but is disabled/);
  assert.equal(disabled.rollbacks, 1);

  const unverified = new BootstrapStore();
  unverified.orgExists = true;
  unverified.account = { id: 'unverified', status: 'active', email_verified: false };
  await assert.rejects(() => bootstrapSuperAdmin(makePool(unverified), credentials), /email is not verified/);
  assert.equal(unverified.rollbacks, 1);
});
