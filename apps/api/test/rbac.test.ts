import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ROLE_PERMISSIONS, hasPermission, permissionForRequest, RBAC_ACTIONS, RBAC_ROLES } from '../src/rbac.js';

describe('workspace RBAC policy',()=>{
  it('defines all ten roles and all requested actions',()=>{
    assert.deepEqual([...RBAC_ROLES],['super_admin','owner','admin','lawyer','analyst','operations','consultant','support','data_steward','viewer']);
    assert.deepEqual([...RBAC_ACTIONS],['view','create','upload','edit','delete','review','approve','reject','export','manage','retry_ocr','configure']);
    for(const role of RBAC_ROLES) assert.ok(DEFAULT_ROLE_PERMISSIONS[role] instanceof Set,`${role} has a server policy`);
  });
  it('keeps Viewer strictly read-only',()=>{
    for(const action of ['create','upload','edit','delete','review','approve','reject','manage','retry_ocr','configure']){
      assert.equal(hasPermission('viewer','properties',action),false,`viewer ${action}`);
      assert.equal(hasPermission('viewer','documents',action),false,`viewer ${action}`);
    }
    assert.equal(hasPermission('viewer','properties','view'),true);
    assert.equal(hasPermission('viewer','documents','view'),true);
  });
  it('isolates Super Admin from workspace Owner permissions',()=>{
    assert.equal(hasPermission('super_admin','super_admin','manage'),true);
    for(const resource of ['dashboard','properties','documents','findings','legal','admin']) assert.equal(hasPermission('super_admin',resource,'view'),false,resource);
  });
  it('separates intake, OCR review, legal approval, support retry and steward configuration',()=>{
    assert.equal(hasPermission('operations','documents','upload'),true);
    assert.equal(hasPermission('operations','documents','approve'),false);
    assert.equal(hasPermission('analyst','documents','review'),true);
    assert.equal(hasPermission('analyst','documents','approve'),false);
    assert.equal(hasPermission('lawyer','documents','approve'),true);
    assert.equal(hasPermission('support','support','retry_ocr'),true);
    assert.equal(hasPermission('support','documents','retry_ocr'),false);
    assert.equal(hasPermission('data_steward','ocr','configure'),true);
    assert.equal(hasPermission('lawyer','sources','view'),true);
  });
  it('maps protected API operations to fine-grained permissions',()=>{
    assert.deepEqual(permissionForRequest('POST','/api/properties/123/documents'),{resource:'documents',action:'upload'});
    assert.deepEqual(permissionForRequest('POST','/api/ocr/jobs/123/retry'),{resource:'ocr',action:'retry_ocr'});
    assert.deepEqual(permissionForRequest('POST','/api/properties/123/documents/456/review',{decision:'approve'}),{resource:'documents',action:'approve'});
    assert.deepEqual(permissionForRequest('PUT','/api/admin/permissions'),{resource:'permissions',action:'configure'});
    assert.deepEqual(permissionForRequest('GET','/api/consultant/reports/123/export'),{resource:'reports',action:'export'});
    assert.deepEqual(permissionForRequest('GET','/api/super-admin/overview'),{resource:'super_admin',action:'view'});
    assert.deepEqual(permissionForRequest('GET','/api/future/unknown'),{resource:'api',action:'view'});
    assert.equal(permissionForRequest('GET','/api/auth/me'),null);
  });
  it('permission overrides can restrict but never grant outside the role baseline',()=>{
    assert.equal(hasPermission('lawyer','documents','approve',false),false);
    assert.equal(hasPermission('analyst','legal','approve',true),false);
    assert.equal(hasPermission('lawyer','documents','approve',true),true);
    assert.equal(hasPermission('owner','api','view'),false);
  });
});
