process.env.NODE_ENV = 'test';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let app: any;
let pool: any;
let DEFAULT_ORGANIZATION_ID: string;

let server: http.Server;
let baseUrl: string;

const ownerHeaders = {
  'Content-Type': 'application/json',
  'x-user-uid': 'user-owner',
};

const viewerHeaders = {
  'Content-Type': 'application/json',
  'x-user-uid': 'user-viewer',
};

before(async () => {
  const mod = await import('../src/server.js');
  app = mod.app;
  pool = mod.pool;
  DEFAULT_ORGANIZATION_ID = mod.DEFAULT_ORGANIZATION_ID;
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  // Ensure workspace_settings row exists for default organization
  await pool!.query(
    `INSERT INTO workspace_settings (tenant_id, org_name, enforce_mfa_privileged)
     VALUES (?, 'Karnataka Legal Partners LLP', 1)
     ON DUPLICATE KEY UPDATE enforce_mfa_privileged=1`,
    [DEFAULT_ORGANIZATION_ID]
  );
});

after(async () => {
  // Reset enforce_mfa_privileged to 1 (default secure)
  try {
    await pool!.query(
      'UPDATE workspace_settings SET enforce_mfa_privileged=1 WHERE tenant_id=?',
      [DEFAULT_ORGANIZATION_ID]
    );
  } catch {}
  server?.close();
  if (pool) await pool.end();
});

test('Database Schema: workspace_settings has enforce_mfa_privileged column', async () => {
  const columns = await pool!.query(
    "SHOW COLUMNS FROM workspace_settings LIKE 'enforce_mfa_privileged'"
  );
  assert.equal(columns.rowCount, 1, 'Column enforce_mfa_privileged must exist in workspace_settings');
  assert.match(
    String(columns.rows[0].Type).toLowerCase(),
    /tinyint|bool/,
    'enforce_mfa_privileged must be a boolean/tinyint column'
  );
});

test('RBAC: Non-admin role cannot modify enforce_mfa_privileged setting', async () => {
  const res = await fetch(`${baseUrl}/api/settings`, {
    method: 'POST',
    headers: viewerHeaders,
    body: JSON.stringify({ enforce_mfa_privileged: false }),
  });
  assert.equal(res.status, 403, 'Non-admin/non-owner must receive 403 Forbidden');
  const body = await res.json();
  assert.match(body.error, /Administrator or Owner privileges required/);
});

test('Workspace Owner Settings: Owner can view and update enforce_mfa_privileged toggle', async () => {
  // Read initial settings
  const getRes = await fetch(`${baseUrl}/api/settings`, { headers: ownerHeaders });
  assert.equal(getRes.status, 200);
  const initialData = await getRes.json();
  assert.equal(typeof initialData.settings.enforce_mfa_privileged, 'boolean');

  // Toggle MFA enforcement OFF
  const postOffRes = await fetch(`${baseUrl}/api/settings`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ ...initialData.settings, enforce_mfa_privileged: false }),
  });
  assert.equal(postOffRes.status, 200);
  const postOffData = await postOffRes.json();
  assert.equal(postOffData.settings.enforce_mfa_privileged, false);

  // Verify persistence in MariaDB
  const dbCheck = await pool!.query(
    'SELECT enforce_mfa_privileged FROM workspace_settings WHERE tenant_id=?',
    [DEFAULT_ORGANIZATION_ID]
  );
  assert.equal(Boolean(dbCheck.rows[0].enforce_mfa_privileged), false);

  // Toggle MFA enforcement back ON
  const postOnRes = await fetch(`${baseUrl}/api/settings`, {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ ...initialData.settings, enforce_mfa_privileged: true }),
  });
  assert.equal(postOnRes.status, 200);
  const postOnData = await postOnRes.json();
  assert.equal(postOnData.settings.enforce_mfa_privileged, true);

  // Verify persistence in MariaDB
  const dbCheckOn = await pool!.query(
    'SELECT enforce_mfa_privileged FROM workspace_settings WHERE tenant_id=?',
    [DEFAULT_ORGANIZATION_ID]
  );
  assert.equal(Boolean(dbCheckOn.rows[0].enforce_mfa_privileged), true);
});

test('Enforce MFA = ON: Privileged role is blocked from direct login and challenged for OTP', async () => {
  // Ensure MFA is enforced
  await pool!.query(
    'UPDATE workspace_settings SET enforce_mfa_privileged=1 WHERE tenant_id=?',
    [DEFAULT_ORGANIZATION_ID]
  );

  // 1. Calling /api/auth/login (direct password endpoint) must be blocked with 403
  const directLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'keerthana1234p@gmail.com',
      password: 'Owner@3126',
      expectedRole: 'owner',
    }),
  });
  assert.equal(directLoginRes.status, 403, 'Privileged direct password login must be blocked when MFA enforced');
  const directLoginBody = await directLoginRes.json();
  assert.equal(directLoginBody.mfaRequired, true);
  assert.match(directLoginBody.error, /mandates Multi-Factor Authentication/i);

  // 2. Calling /api/auth/login/request-otp must issue an OTP challenge, NOT a session token
  const requestOtpRes = await fetch(`${baseUrl}/api/auth/login/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'keerthana1234p@gmail.com',
      password: 'Owner@3126',
      expectedRole: 'owner',
    }),
  });
  assert.equal(requestOtpRes.status, 201, 'Must return 201 Created with OTP challenge');
  const requestOtpBody = await requestOtpRes.json();
  assert.ok(requestOtpBody.challengeId, 'Must return challengeId');
  assert.ok(!requestOtpBody.token, 'Must NOT return session token when MFA is required');
});

test('Enforce MFA = OFF: Privileged role can sign in directly without OTP challenge', async () => {
  // Workspace Owner relaxes MFA enforcement
  await pool!.query(
    'UPDATE workspace_settings SET enforce_mfa_privileged=0 WHERE tenant_id=?',
    [DEFAULT_ORGANIZATION_ID]
  );

  // 1. Calling /api/auth/login/request-otp directly returns session token (no OTP prompt needed)
  const loginRes = await fetch(`${baseUrl}/api/auth/login/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'keerthana1234p@gmail.com',
      password: 'Owner@3126',
      expectedRole: 'owner',
    }),
  });
  assert.equal(loginRes.status, 200, 'Must return 200 OK directly when MFA is relaxed');
  const loginBody = await loginRes.json();
  assert.ok(loginBody.token, 'Must return valid session token');
  assert.equal(loginBody.mfaRequired, false);
  assert.equal(loginBody.user.role, 'owner');
  assert.match(loginBody.token, /^ojix-/);

  // 2. Calling /api/auth/login (direct password endpoint) succeeds with 200
  const directLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'keerthana1234p@gmail.com',
      password: 'Owner@3126',
      expectedRole: 'owner',
    }),
  });
  assert.equal(directLoginRes.status, 200, 'Direct password endpoint must succeed when MFA is relaxed');
  const directBody = await directLoginRes.json();
  assert.ok(directBody.token, 'Must return valid session token');
  assert.equal(directBody.user.role, 'owner');

  // 3. Verify audit log captures login
  const auditRes = await pool!.query(
    "SELECT action, details FROM audit_events WHERE action='auth.login_password_direct' ORDER BY created_at DESC LIMIT 1"
  );
  assert.equal(auditRes.rowCount, 1, 'Audit log must record auth.login_password_direct');
});
