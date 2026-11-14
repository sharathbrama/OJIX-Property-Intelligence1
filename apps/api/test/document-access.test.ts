import assert from 'node:assert/strict';
import test from 'node:test';
import { documentFileAccess } from '../src/document-access.js';

test('only consultants and viewers require released properties and approved documents', () => {
  for (const role of ['consultant', 'viewer']) {
    assert.equal(documentFileAccess({ role, propertyStatus: 'approved', reviewStatus: 'approved' }), 'allow');
    assert.equal(documentFileAccess({ role, propertyStatus: 'complete', reviewStatus: 'approved' }), 'allow');
    assert.equal(documentFileAccess({ role, propertyStatus: 'in_review', reviewStatus: 'approved' }), 'not_found');
    assert.equal(documentFileAccess({ role, propertyStatus: 'approved', reviewStatus: 'pending' }), 'not_found');
    assert.equal(documentFileAccess({ role, propertyStatus: null, reviewStatus: 'approved' }), 'not_found');
  }
});

test('confidential file access remains denied to support and data steward roles', () => {
  for (const role of ['support', 'data_steward']) assert.equal(documentFileAccess({ role }), 'forbidden');
  for (const role of ['owner', 'admin', 'lawyer', 'analyst', 'operations']) assert.equal(documentFileAccess({ role }), 'allow');
});
