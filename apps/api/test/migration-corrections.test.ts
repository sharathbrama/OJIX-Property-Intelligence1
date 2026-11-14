import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasPermission } from '../src/rbac.js';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const migrationDirectory = path.join(repositoryRoot, 'database/migrations');
const read = (relativePath: string) => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

test('forward correction preserves the reserved Super Admin and scopes the role repair narrowly', () => {
  const original026 = read('database/migrations/026_demo_login_account_binding.sql');
  const seed = read('infra/db/seed.sql');
  const correction = read('database/migrations/035_correct_platform_role_and_viewer_index.sql');

  // Historical 026 remains immutable and its unsafe upsert is documented as
  // the reason the forward correction is required.
  assert.match(original026, /ON DUPLICATE KEY UPDATE[\s\S]*role\s*=\s*'owner'/i);
  assert.match(seed, /'user-super-admin',[^\n]*'super_admin'/);
  assert.match(seed, /ON DUPLICATE KEY UPDATE id=id/);
  assert.match(correction, /SET role\s*=\s*'super_admin'/i);
  assert.match(correction, /WHERE organization_id\s*=\s*'11111111-1111-4111-8111-111111111111'[\s\S]*AND user_uid\s*=\s*'user-super-admin'/i);
  assert.doesNotMatch(correction, /UPDATE\s+org_memberships\s+SET\s+role\s*=\s*'super_admin'\s*;/i);
  assert.doesNotMatch(correction, /SET\s+(?:email|status)\s*=/i);
});

test('role baselines remain separated after the data correction', () => {
  assert.equal(hasPermission('super_admin', 'super_admin', 'manage'), true);
  assert.equal(hasPermission('super_admin', 'properties', 'view'), false);
  assert.equal(hasPermission('owner', 'members', 'manage'), true);
  assert.equal(hasPermission('owner', 'super_admin', 'view'), false);
  assert.equal(hasPermission('admin', 'admin', 'manage'), true);
  assert.equal(hasPermission('admin', 'super_admin', 'view'), false);
  assert.equal(hasPermission('lawyer', 'documents', 'approve'), true);
  assert.equal(hasPermission('lawyer', 'properties', 'delete'), false);
  assert.equal(hasPermission('analyst', 'documents', 'review'), true);
  assert.equal(hasPermission('analyst', 'documents', 'approve'), false);
  assert.equal(hasPermission('viewer', 'properties', 'view'), true);
  assert.equal(hasPermission('viewer', 'properties', 'edit'), false);
});

test('forward correction checks and preserves existing viewer indexes and data', () => {
  const canonical = read('database/mysql-schema.sql');
  const migration034 = read('database/migrations/034_viewer_matter_assignment.sql');
  const correction = read('database/migrations/035_correct_platform_role_and_viewer_index.sql');

  assert.match(canonical, /assigned_viewer_uid\s+VARCHAR\(191\)\s+NOT NULL\s+DEFAULT\s+''/i);
  assert.match(canonical, /KEY\s+property_viewer_assignment_idx\s*\(tenant_id,\s*assigned_viewer_uid,\s*status,\s*updated_at\)/i);
  assert.match(migration034, /CREATE INDEX property_viewer_assignment_idx\s+ON properties\s*\(tenant_id,\s*assigned_viewer_uid,\s*status,\s*updated_at\)/i);
  assert.match(correction, /information_schema\.COLUMNS/i);
  assert.match(correction, /information_schema\.STATISTICS/i);
  assert.match(correction, /property_viewer_assignment_idx/i);
  assert.match(correction, /tenant_id,assigned_viewer_uid,status,updated_at/i);
  assert.match(correction, /IF viewer_column_count = 0 THEN[\s\S]*ALTER TABLE properties ADD COLUMN assigned_viewer_uid/i);
  assert.doesNotMatch(correction, /DROP\s+(?:TABLE|INDEX|COLUMN)|TRUNCATE\s+TABLE|DELETE\s+FROM/i);
});

test('migration numbering is unique and post-onboarding settings follow the role/index correction', () => {
  const migrationFiles = fs.readdirSync(migrationDirectory).filter(file => /^\d{3}_.*\.sql$/.test(file));
  const ids = migrationFiles.map(file => Number(file.slice(0, 3)));
  assert.equal(new Set(ids).size, ids.length, 'migration IDs must be unique');
  assert.ok(migrationFiles.includes('034_viewer_matter_assignment.sql'));
  assert.ok(migrationFiles.includes('035_correct_platform_role_and_viewer_index.sql'));
  assert.ok(migrationFiles.includes('036_organization_onboarding.sql'));
  assert.ok(migrationFiles.includes('037_workspace_firm_branding.sql'));
  assert.ok(migrationFiles.includes('038_legal_sign_off_separation.sql'));
  assert.equal(Math.max(...ids), 38, '038 is the current final migration');
});

test('registration onboarding stores an organization name and no longer assigns a shared demo tenant', () => {
  const canonical = read('database/mysql-schema.sql');
  const server = read('apps/api/src/server.ts');
  const migration = read('database/migrations/036_organization_onboarding.sql');
  assert.match(canonical, /onboarding_organization_name\s+VARCHAR\(160\)\s+NULL/i);
  assert.match(migration, /information_schema\.COLUMNS/i);
  assert.match(server, /organizationName:\s*z\.string\(\)\.trim\(\)\.min\(2/);
  assert.match(server, /provisionOrganizationOwner\(connection/);
  assert.doesNotMatch(server, /INSERT IGNORE INTO org_memberships[^\n]*DEFAULT_ORGANIZATION_ID/);
  assert.match(server, /assignedRole:'owner'/);
});
