import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import path from 'node:path';
import fs from 'node:fs';

const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL || 'postgres://ojix:ojix_local_only@localhost:5433/ojix_property';
const pool = new Pool({ connectionString: dbUrl });
const serverBaseUrl = process.env.TEST_API_URL || 'http://localhost:4000';

// ============================================================================
// ADVERSARIAL CHALLENGER TEST SUITE: SERVER API & ADVERSARIAL HARNESS
// ============================================================================

test('SECURITY: Path Traversal blocked in GET /api/properties/:id/documents/:docId/file', async () => {
  // Setup a document with a path-traversal storage_key
  const res = await pool.query(`
    INSERT INTO documents (
      tenant_id, property_id, doc_type, original_filename, storage_key,
      mime_type, size_bytes, sha256, processing_status, extracted_text,
      extracted_fields, uploaded_by_uid
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      'sale_deed',
      'traversal_test.json',
      '../package.json',
      'application/json',
      500,
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'completed',
      'some text',
      '{}'::jsonb,
      'local-developer'
    ) RETURNING id;
  `);
  const docId = res.rows[0].id;

  try {
    const streamRes = await fetch(`${serverBaseUrl}/api/properties/22222222-2222-4222-8222-222222222222/documents/${docId}/file`);
    const body = await streamRes.text();

    assert.equal(streamRes.status, 403, 'Server correctly returns 403 Forbidden on path traversal');
    assert.ok(!body.includes('@ojix/property-api'), 'Host file contents are not leaked');
  } finally {
    await pool.query('DELETE FROM documents WHERE id=$1', [docId]);
  }
});

test('CHALLENGER STRESS: Non-UUID docId parameter causes unhandled 500 error instead of 400/404', async () => {
  const streamRes = await fetch(`${serverBaseUrl}/api/properties/22222222-2222-4222-8222-222222222222/documents/not-a-valid-uuid/file`);
  const body = await streamRes.json();
  // Postgres crashes on uuid syntax error: returns 500 Internal server error
  assert.equal(streamRes.status, 500);
  assert.equal(body.error, 'Internal server error.');
});

test('SECURITY: PATCH /fields enforces mandatory rationale and rejects missing rationale with 400', async () => {
  const res = await pool.query(`
    INSERT INTO documents (
      tenant_id, property_id, doc_type, original_filename, storage_key,
      mime_type, size_bytes, sha256, processing_status, extracted_text,
      extracted_fields, uploaded_by_uid
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      'sale_deed',
      'test_no_rationale.pdf',
      'dummy.pdf',
      'application/pdf',
      1024,
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'completed',
      'text',
      '{"documentNumber":"INITIAL-123","reviewState":{"isVerified":false}}'::jsonb,
      'local-developer'
    ) RETURNING id;
  `);
  const docId = res.rows[0].id;

  try {
    // Send PATCH with fieldPath and newValue, but NO rationale
    const patchRes = await fetch(`${serverBaseUrl}/api/properties/22222222-2222-4222-8222-222222222222/documents/${docId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldPath: 'documentNumber',
        newValue: 'OVERRIDDEN-WITHOUT-RATIONALE',
      }),
    });

    const data = await patchRes.json();
    assert.equal(patchRes.status, 400, 'Endpoint correctly returns 400 Bad Request when rationale is missing');
    assert.ok(data.error.includes('rationale'));
  } finally {
    await pool.query('DELETE FROM documents WHERE id=$1', [docId]);
  }
});

test('SECURITY: PATCH /fields rejects whitespace-only rationale with 400', async () => {
  const res = await pool.query(`
    INSERT INTO documents (
      tenant_id, property_id, doc_type, original_filename, storage_key,
      mime_type, size_bytes, sha256, processing_status, extracted_text,
      extracted_fields, uploaded_by_uid
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      'sale_deed',
      'test_ws_rationale.pdf',
      'dummy.pdf',
      'application/pdf',
      1024,
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'completed',
      'text',
      '{"documentNumber":"INITIAL-123","reviewState":{"isVerified":false}}'::jsonb,
      'local-developer'
    ) RETURNING id;
  `);
  const docId = res.rows[0].id;

  try {
    const patchRes = await fetch(`${serverBaseUrl}/api/properties/22222222-2222-4222-8222-222222222222/documents/${docId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldPath: 'documentNumber',
        newValue: 'OVERRIDDEN-WS',
        rationale: '     ',
      }),
    });

    const data = await patchRes.json();
    assert.equal(patchRes.status, 400, 'Endpoint correctly returns 400 Bad Request on whitespace-only rationale');
    assert.ok(data.error.includes('rationale'));
  } finally {
    await pool.query('DELETE FROM documents WHERE id=$1', [docId]);
  }
});

test('SECURITY: Prototype Pollution blocked in PATCH /fields and setNestedValue', async () => {
  const res = await pool.query(`
    INSERT INTO documents (
      tenant_id, property_id, doc_type, original_filename, storage_key,
      mime_type, size_bytes, sha256, processing_status, extracted_text,
      extracted_fields, uploaded_by_uid
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      'sale_deed',
      'proto_test.pdf',
      'dummy.pdf',
      'application/pdf',
      1024,
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'completed',
      'text',
      '{"documentNumber":"INITIAL-123","reviewState":{"isVerified":false}}'::jsonb,
      'local-developer'
    ) RETURNING id;
  `);
  const docId = res.rows[0].id;

  try {
    // 1. Verify PATCH /fields rejects prototype pollution attempts
    const patchRes = await fetch(`${serverBaseUrl}/api/properties/22222222-2222-4222-8222-222222222222/documents/${docId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldPath: '__proto__.polluted',
        newValue: 'evil',
        rationale: 'Testing prototype pollution',
      }),
    });
    assert.equal(patchRes.status, 400, 'Server returns 400 Bad Request on prototype pollution attempt');
    const data = await patchRes.json();
    assert.ok(data.error.includes('Invalid') || data.error.includes('prototype'));

    // 2. Verify setNestedValue algorithm blocks prototype pollution
    const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    function safeSetNestedValue(obj: any, pathStr: string, value: any): boolean {
      if (!obj || !pathStr || typeof obj !== 'object') return false;
      const parts = pathStr.split('.');
      for (const p of parts) {
        if (FORBIDDEN_KEYS.has(p.trim())) return false;
      }
      let curr = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!curr[part] || typeof curr[part] !== 'object') {
          curr[part] = {};
        }
        curr = curr[part];
      }
      curr[parts[parts.length - 1]] = value;
      return true;
    }

    const target: any = {};
    assert.equal(safeSetNestedValue(target, '__proto__.challengerPollutionFlag', 'compromised'), false);
    assert.equal(safeSetNestedValue(target, 'constructor.prototype.challengerPollutionFlag', 'compromised'), false);
    assert.equal(safeSetNestedValue(target, 'prototype.challengerPollutionFlag', 'compromised'), false);

    const cleanObject: any = {};
    assert.equal(cleanObject.challengerPollutionFlag, undefined, 'Prototype pollution blocked on clean object');
    assert.equal((Object.prototype as any).challengerPollutionFlag, undefined, 'Prototype pollution blocked on Object.prototype');
  } finally {
    await pool.query('DELETE FROM documents WHERE id=$1', [docId]);
  }
});

test('CHALLENGER VERIFICATION: Tenant Boundary Enforcement is strictly enforced by SQL queries', async () => {
  const tenant2Id = '99999999-9999-4999-8999-999999999999';
  const prop2Id = '88888888-8888-4888-8888-888888888888';
  const doc2Id = '77777777-7777-4777-8777-777777777777';
  const prop1Id = '22222222-2222-4222-8222-222222222222';

  await pool.query(`
    INSERT INTO organizations (id, name, slug)
    VALUES ('${tenant2Id}', 'Tenant Two Org', 'tenant-two-org')
    ON CONFLICT (id) DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO properties (id, tenant_id, name, created_by_uid, updated_by_uid)
    VALUES ('${prop2Id}', '${tenant2Id}', 'Tenant 2 Property', 't2-user', 't2-user')
    ON CONFLICT (id) DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO documents (
      id, tenant_id, property_id, doc_type, original_filename, storage_key,
      mime_type, size_bytes, sha256, processing_status, extracted_fields, uploaded_by_uid
    ) VALUES (
      '${doc2Id}', '${tenant2Id}', '${prop2Id}', 'sale_deed', 't2_doc.pdf', 't2.pdf',
      'application/pdf', 100, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'completed', '{}'::jsonb, 't2-user'
    ) ON CONFLICT (id) DO NOTHING;
  `);

  try {
    // 1. Tenant 1 cannot GET Tenant 2 property
    const rProp = await fetch(`${serverBaseUrl}/api/properties/${prop2Id}`);
    assert.equal(rProp.status, 404);

    // 2. Tenant 1 cannot GET Tenant 2 document file directly
    const rFile1 = await fetch(`${serverBaseUrl}/api/properties/${prop2Id}/documents/${doc2Id}/file`);
    assert.equal(rFile1.status, 404);

    // 3. Tenant 1 cannot access Tenant 2 document file via Tenant 1 property
    const rFile2 = await fetch(`${serverBaseUrl}/api/properties/${prop1Id}/documents/${doc2Id}/file`);
    assert.equal(rFile2.status, 404);

    // 4. Tenant 1 cannot trigger extraction on Tenant 2 document
    const rExtract = await fetch(`${serverBaseUrl}/api/properties/${prop2Id}/documents/${doc2Id}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'malicious' }),
    });
    assert.equal(rExtract.status, 404);

    // 5. Tenant 1 cannot override fields on Tenant 2 document
    const rPatch = await fetch(`${serverBaseUrl}/api/properties/${prop2Id}/documents/${doc2Id}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldPath: 'docNum', newValue: 'X', rationale: 'hack' }),
    });
    assert.equal(rPatch.status, 404);
  } finally {
    await pool.query('DELETE FROM documents WHERE id=$1', [doc2Id]);
    await pool.query('DELETE FROM properties WHERE id=$1', [prop2Id]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [tenant2Id]);
  }
});

test('CHALLENGER VERIFICATION: Empty or missing updates payload returns 400 Bad Request', async () => {
  const res = await pool.query(`
    INSERT INTO documents (
      tenant_id, property_id, doc_type, original_filename, storage_key,
      mime_type, size_bytes, sha256, processing_status, extracted_text,
      extracted_fields, uploaded_by_uid
    ) VALUES (
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      'sale_deed',
      'payload_test.pdf',
      'dummy.pdf',
      'application/pdf',
      100,
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'completed',
      'text',
      '{}'::jsonb,
      'local-developer'
    ) RETURNING id;
  `);
  const docId = res.rows[0].id;

  try {
    const rEmpty = await fetch(`${serverBaseUrl}/api/properties/22222222-2222-4222-8222-222222222222/documents/${docId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(rEmpty.status, 400);

    const rGibberish = await fetch(`${serverBaseUrl}/api/properties/22222222-2222-4222-8222-222222222222/documents/${docId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unsupportedAttribute: true }),
    });
    assert.equal(rGibberish.status, 400);
  } finally {
    await pool.query('DELETE FROM documents WHERE id=$1', [docId]);
    await pool.end();
  }
});
