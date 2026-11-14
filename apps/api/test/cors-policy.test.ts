import assert from 'node:assert/strict';
import test from 'node:test';
import { isCorsOriginAllowed } from '../src/cors-policy.js';

test('CORS accepts exact configured origins and non-browser requests only', () => {
  const allowlist = ['https://ojix-property-intelligence.web.app', 'https://ojix-property-intelligence.firebaseapp.com'];
  assert.equal(isCorsOriginAllowed(undefined, allowlist), true);
  assert.equal(isCorsOriginAllowed(allowlist[0], allowlist), true);
  assert.equal(isCorsOriginAllowed('https://evil.example', allowlist), false);
  assert.equal(isCorsOriginAllowed('https://ojix-property-intelligence.web.app.attacker.example', allowlist), false);
  assert.equal(isCorsOriginAllowed('*', allowlist), false);
});
