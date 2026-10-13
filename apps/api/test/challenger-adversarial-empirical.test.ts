process.env.NODE_ENV = 'test';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from './mariadb-test-pool.js';
import crypto from 'node:crypto';

const serverBaseUrl = process.env.TEST_API_URL || 'http://localhost:4000';

const PROPERTY_ID = '22222222-2222-4222-8222-222222222222';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';

async function createTestDoc(storageKey = 'dummy.pdf', initialFields = { documentNumber: 'ORIG-123' }) {
  const id = crypto.randomUUID();
  await pool.query(`
    INSERT INTO documents (
      id, tenant_id, property_id, doc_type, original_filename, storage_key,
      mime_type, size_bytes, sha256, processing_status, extracted_text,
      extracted_fields, uploaded_by_uid
    ) VALUES (?, ?, ?, 'sale_deed', 'test.pdf', ?, 'application/pdf', 1024,
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'completed', 'sample text', ?, 'local-developer')
  `, [id, TENANT_ID, PROPERTY_ID, storageKey, JSON.stringify(initialFields)]);
  return id;
}

async function cleanupDoc(id: string) {
  await pool.query('DELETE FROM documents WHERE id=?', [id]);
}

test('EMPIRICAL PROTO-1: Prototype pollution via fieldPath __proto__.polluted is rejected with 400', async () => {
  const docId = await createTestDoc();
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldPath: '__proto__.polluted',
        newValue: 'adversarial_payload',
        rationale: 'Legitimate looking rationale',
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400, 'Server must respond with HTTP 400');
    assert.ok(data.error.includes('prototype') || data.error.includes('forbidden'), 'Error specifies prototype forbidden');
    assert.equal((Object.prototype as any).polluted, undefined, 'Object.prototype must not be polluted');
    assert.equal(({} as any).polluted, undefined, 'Empty object literal must not have polluted property');
  } finally {
    await cleanupDoc(docId);
  }
});

test('EMPIRICAL PROTO-2: Prototype pollution via fieldPath constructor.prototype.polluted is rejected with 400', async () => {
  const docId = await createTestDoc();
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldPath: 'constructor.prototype.polluted',
        newValue: 'adversarial_payload_constructor',
        rationale: 'Legitimate looking rationale',
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400, 'Server must respond with HTTP 400');
    assert.ok(data.error.includes('prototype') || data.error.includes('forbidden'), 'Error specifies prototype forbidden');
    assert.equal((Object.prototype as any).polluted, undefined, 'Object.prototype must not be polluted');
    assert.equal(({} as any).polluted, undefined, 'Empty object literal must not have polluted property');
  } finally {
    await cleanupDoc(docId);
  }
});

test('EMPIRICAL PROTO-3: Prototype pollution via overrides key __proto__.polluted is rejected with 400', async () => {
  const docId = await createTestDoc();
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overrides: {
          '__proto__.polluted': {
            newValue: 'evil_override',
            rationale: 'Override rationale',
          },
        },
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400, 'Server must respond with HTTP 400 for override prototype key');
    assert.ok(data.error.includes('prototype'), 'Error specifies prototype forbidden');
    assert.equal((Object.prototype as any).polluted, undefined, 'Object.prototype must not be polluted');
  } finally {
    await cleanupDoc(docId);
  }
});

test('EMPIRICAL PROTO-4: Prototype pollution via overrides key constructor.prototype.polluted is rejected with 400', async () => {
  const docId = await createTestDoc();
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overrides: {
          'constructor.prototype.polluted': {
            newValue: 'evil_override',
            rationale: 'Override rationale',
          },
        },
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 400, 'Server must respond with HTTP 400 for constructor.prototype key');
    assert.ok(data.error.includes('prototype'), 'Error specifies prototype forbidden');
    assert.equal((Object.prototype as any).polluted, undefined, 'Object.prototype must not be polluted');
  } finally {
    await cleanupDoc(docId);
  }
});

test('EMPIRICAL TRAVERSAL-1: Path traversal via ../package.json returns 403 Forbidden', async () => {
  const docId = await createTestDoc('../package.json');
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/file`);
    const body = await res.text();
    assert.equal(res.status, 403, 'Must return HTTP 403 Forbidden');
    assert.ok(!body.includes('@ojix/property-api'), 'Must not leak package.json');
    assert.ok(body.includes('traversal') || body.includes('Access denied'));
  } finally {
    await cleanupDoc(docId);
  }
});

test('EMPIRICAL TRAVERSAL-2: Path traversal via /etc/passwd returns 403 Forbidden', async () => {
  const docId = await createTestDoc('/etc/passwd');
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/file`);
    const body = await res.text();
    assert.equal(res.status, 403, 'Must return HTTP 403 Forbidden');
    assert.ok(!body.includes('root:'), 'Must not leak /etc/passwd');
    assert.ok(body.includes('traversal') || body.includes('Access denied'));
  } finally {
    await cleanupDoc(docId);
  }
});

test('EMPIRICAL TRAVERSAL-3: Path traversal via ..\\package.json (Windows separators) returns 403 Forbidden', async () => {
  const docId = await createTestDoc('..\\package.json');
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/file`);
    assert.equal(res.status, 403, 'Must return HTTP 403 Forbidden');
  } finally {
    await cleanupDoc(docId);
  }
});

test('EMPIRICAL TRAVERSAL-4: Path traversal via dir/../../package.json returns 403 Forbidden', async () => {
  const docId = await createTestDoc('dir/../../package.json');
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/file`);
    assert.equal(res.status, 403, 'Must return HTTP 403 Forbidden');
  } finally {
    await cleanupDoc(docId);
  }
});

test('EMPIRICAL RATIONALE-1: Missing rationale in PATCH /fields returns 400 Bad Request', async () => {
  const docId = await createTestDoc();
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldPath: 'propertySchedule.surveyNumber',
        newValue: '100/1',
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 400, 'Must return 400 when rationale is omitted');
    assert.ok(data.error.includes('rationale'));
  } finally {
    await cleanupDoc(docId);
  }
});

test('EMPIRICAL RATIONALE-2: Empty string rationale in PATCH /fields returns 400 Bad Request', async () => {
  const docId = await createTestDoc();
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldPath: 'propertySchedule.surveyNumber',
        newValue: '100/1',
        rationale: '',
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 400, 'Must return 400 when rationale is empty string');
    assert.ok(data.error.includes('rationale'));
  } finally {
    await cleanupDoc(docId);
  }
});

test('EMPIRICAL RATIONALE-3: Whitespace-only rationale (spaces, tabs, newlines) returns 400 Bad Request', async () => {
  const docId = await createTestDoc();
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldPath: 'propertySchedule.surveyNumber',
        newValue: '100/1',
        rationale: '   \t  \n  ',
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 400, 'Must return 400 when rationale is whitespace-only');
    assert.ok(data.error.includes('rationale'));
  } finally {
    await cleanupDoc(docId);
  }
});

test('EMPIRICAL RATIONALE-4: Whitespace rationale inside overrides object returns 400 Bad Request', async () => {
  const docId = await createTestDoc();
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overrides: {
          'propertySchedule.surveyNumber': {
            newValue: '100/1',
            rationale: '   ',
          },
        },
      }),
    });
    const data = await res.json();
    assert.equal(res.status, 400, 'Must return 400 when override item has whitespace rationale');
    assert.ok(data.error.includes('rationale'));
  } finally {
    await cleanupDoc(docId);
  }
});

test('EMPIRICAL VALID-OVERRIDE: Legitimate correction is audited but does not auto-verify the document', async () => {
  const docId = await createTestDoc();
  try {
    const rationaleText = 'Verified against certified copy from Sub-Registrar Office Gandhinagar';
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldPath: 'propertySchedule.surveyNumber',
        newValue: '45/1A',
        rationale: rationaleText,
      }),
    });
    assert.equal(res.status, 200, 'Valid request must succeed with 200 OK');
    const data = await res.json();
    assert.ok(data.extractedFields, 'Extracted fields returned');
    assert.equal(data.extractedFields.propertySchedule.surveyNumber, '45/1A');
    assert.equal(data.extractedFields.reviewState.isVerified, false, 'A field correction must not silently verify the complete document');
    assert.equal(data.extractedFields.reviewState.overrides['propertySchedule.surveyNumber'].rationale, rationaleText);
    assert.equal(data.extractedFields.reviewState.overrides['propertySchedule.surveyNumber'].newValue, '45/1A');
  } finally {
    await cleanupDoc(docId);
  }
});

test('Clean up database pool', async () => {
  await pool.end();
  assert.ok(true);
});
