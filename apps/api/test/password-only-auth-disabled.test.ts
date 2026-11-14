process.env.NODE_ENV = 'test';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.TEST_API_URL || 'http://127.0.0.1:4000';

test('password-only sign-in remains disabled and never returns a session token', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'not-a-real-password', enforce_mfa_privileged: false }),
  });
  assert.equal(response.status, 410);
  const body = await response.json();
  assert.match(body.error, /Password-only sign-in is disabled/);
  assert.equal(body.token, undefined);
});
