import { test } from 'node:test';
import assert from 'node:assert/strict';
import { provisionOrganizationOwner } from '../src/organization-onboarding.js';

test('verified registration provisions an isolated organization and its first Owner with audit history', async () => {
  const calls: Array<{ sql: string; params: any[] }> = [];
  const connection = {
    async query(sql: string, params: any[] = []) {
      calls.push({ sql, params });
      return { rows: [], rowCount: 1 };
    },
  };
  const organizationId = await provisionOrganizationOwner(connection, {
    name: 'Example Law Group',
    email: 'owner@example.test',
    userUid: 'user-a',
  });

  assert.match(organizationId, /^[0-9a-f-]{36}$/i);
  assert.match(calls[0].sql, /INSERT INTO organizations/);
  assert.equal(calls[0].params[0], organizationId);
  assert.equal(calls[0].params[1], 'Example Law Group');
  assert.match(String(calls[0].params[2]), /^example-law-group-[0-9a-f]{8}$/);
  assert.match(calls[1].sql, /INSERT INTO org_memberships/);
  assert.deepEqual(calls[1].params.slice(1), [organizationId, 'user-a', 'owner@example.test']);
  assert.match(calls[1].sql, /'owner','active'/);
  assert.match(calls[2].sql, /INSERT INTO audit_events/);
  assert.equal(calls[2].params[2], organizationId);
  assert.equal(calls[2].params[3], 'auth.organization_created');
  assert.equal(JSON.parse(calls[2].params[6]).ownerUid, 'user-a');
});

test('organization onboarding rejects blank or overlong names before writing', async () => {
  let writes = 0;
  const connection = { async query() { writes++; return { rows: [], rowCount: 1 }; } };
  await assert.rejects(provisionOrganizationOwner(connection, { name: ' ', email: 'x@example.test', userUid: 'u' }));
  await assert.rejects(provisionOrganizationOwner(connection, { name: 'x'.repeat(161), email: 'x@example.test', userUid: 'u' }));
  assert.equal(writes, 0);
});
