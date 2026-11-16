import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DEMO_SESSION_TTL_MS,
  demoSessionExpiresAt,
  demoSessionIsActive,
  isDemoAuthRouteAllowed,
  isDemoExternalShareAllowed,
  isDemoReadPermissionAllowed,
  isDedicatedDemoDatabase,
  isDemoTenantRequest,
  resolveDemoSessionTtlMs,
  resolveDemoWorkspaceRole,
} from '../src/demo-access.js';
import { hasPermission } from '../src/rbac.js';

test('demo session defaults to eight hours and supports a bounded configuration', () => {
  assert.equal(resolveDemoSessionTtlMs(undefined), 8 * 60 * 60 * 1000);
  assert.equal(DEFAULT_DEMO_SESSION_TTL_MS, 8 * 60 * 60 * 1000);
  assert.equal(resolveDemoSessionTtlMs('1'), 60 * 60 * 1000);
  assert.equal(resolveDemoSessionTtlMs('8'), DEFAULT_DEMO_SESSION_TTL_MS);
  for (const invalid of ['0', '9', '1.5', '-1', 'not-a-number']) {
    assert.throws(() => resolveDemoSessionTtlMs(invalid), /whole number from 1 to 8/);
  }
});

test('demo session lifetime is absolute and cannot slide on activity', () => {
  const startedAt = 1_000_000;
  const expiresAt = demoSessionExpiresAt(startedAt, DEFAULT_DEMO_SESSION_TTL_MS);
  assert.equal(expiresAt, startedAt + 8 * 60 * 60 * 1000);
  assert.equal(demoSessionIsActive(expiresAt, expiresAt - 1), true);
  assert.equal(demoSessionIsActive(expiresAt, expiresAt), false);
  assert.equal(demoSessionIsActive(expiresAt, expiresAt + 60_000), false);
  assert.throws(() => demoSessionExpiresAt(startedAt, DEFAULT_DEMO_SESSION_TTL_MS + 1), /no longer than eight hours/);
});

test('demo database must be an explicitly named, separate demo database', () => {
  assert.equal(isDedicatedDemoDatabase('mysql://demo:secret@db.example/ojix_property_demo', 'ojix_property_demo'), true);
  assert.equal(isDedicatedDemoDatabase('mysql://demo:secret@db.example/ojix_property_mysql', 'ojix_property_demo'), false);
  assert.equal(isDedicatedDemoDatabase('mysql://demo:secret@db.example/ojix_property_demo', 'ojix_property_mysql'), false);
  assert.equal(isDedicatedDemoDatabase('postgres://demo:secret@db.example/ojix_property_demo', 'ojix_property_demo'), false);
  assert.equal(isDedicatedDemoDatabase(undefined, 'ojix_property_demo'), false);
});

test('demo request stays pinned to its session tenant', () => {
  assert.equal(isDemoTenantRequest(true, 'synthetic-tenant', 'synthetic-tenant'), true);
  assert.equal(isDemoTenantRequest(true, 'synthetic-tenant', 'customer-tenant'), false);
  assert.equal(isDemoTenantRequest(false, 'customer-tenant', 'another-authorized-tenant'), true);
});

test('demo API disables account registration, password recovery, and OTP routes', () => {
  for (const path of ['/register/request-otp', '/register/verify-otp', '/forgot-password/request-otp', '/forgot-password/reset', '/login/request-otp', '/login/verify-otp', '/change-password']) {
    assert.equal(isDemoAuthRouteAllowed(path), false, path);
  }
  for (const path of ['/demo/status', '/demo/login', '/me', '/logout']) assert.equal(isDemoAuthRouteAllowed(path), true, path);
});

test('demo mode blocks external report sharing', () => {
  assert.equal(isDemoExternalShareAllowed(true), false);
  assert.equal(isDemoExternalShareAllowed(false), true);
});

test('public demo receives read-only Viewer access with selected exploration pages', () => {
  assert.equal(resolveDemoWorkspaceRole(true, 'viewer'), 'viewer');
  assert.equal(resolveDemoWorkspaceRole(true, 'super_admin'), 'viewer');
  assert.equal(resolveDemoWorkspaceRole(false, 'viewer'), 'viewer');
  for (const [resource, action] of [
    ['properties', 'create'], ['properties', 'edit'], ['properties', 'delete'],
    ['documents', 'upload'], ['documents', 'review'], ['documents', 'delete'],
    ['findings', 'create'], ['findings', 'edit'], ['findings', 'delete'],
    ['reports', 'create'], ['reports', 'delete'], ['members', 'manage'], ['admin', 'manage'],
  ]) {
    assert.equal(hasPermission('viewer', resource, action), false, `${resource}.${action}`);
    assert.equal(isDemoReadPermissionAllowed(true, resource, action), false, `demo ${resource}.${action}`);
  }
  for (const [resource, action] of [
    ['dashboard', 'view'], ['properties', 'view'], ['documents', 'view'],
    ['findings', 'view'], ['legal', 'view'], ['reports', 'view'], ['maps', 'view'],
  ]) assert.equal(isDemoReadPermissionAllowed(true, resource, action), true, `${resource}.${action}`);
  assert.equal(isDemoReadPermissionAllowed(false, 'legal', 'view'), false);
  for (const action of ['view', 'manage', 'configure']) assert.equal(hasPermission('owner', 'super_admin', action), false);
});
