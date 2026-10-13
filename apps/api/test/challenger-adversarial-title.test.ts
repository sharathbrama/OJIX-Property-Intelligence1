process.env.NODE_ENV = 'test';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from './mariadb-test-pool.js';
import crypto from 'node:crypto';

const serverBaseUrl = process.env.TEST_API_URL || 'http://localhost:4000';

const PROPERTY_ID = '22222222-2222-4222-8222-222222222222';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';

// Helper to create a temporary test title event directly in DB
async function createTestEvent(overrides: Partial<{
  deedType: string;
  eventDate: string;
  status: string;
  fromParties: any[];
  toParties: any[];
  extentSqFt: number;
  consideration: number;
}> = {}): Promise<string> {
  const id = crypto.randomUUID();
  const fromParties = overrides.fromParties || [{ name: 'Seller A', normalizedName: 'SELLER A' }];
  const toParties = overrides.toParties || [{ name: 'Buyer B', normalizedName: 'BUYER B' }];

  await pool.query(
    `INSERT INTO title_events 
     (id, tenant_id, property_id, sequence_order, event_date, deed_type, from_parties, to_parties, extent_sq_ft, extent_raw, consideration, status, encumbrance_status, reviewed_by)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, '1000 sq ft', ?, ?, 'none', 'adversarial_tester')`,
    [
      id,
      TENANT_ID,
      PROPERTY_ID,
      overrides.eventDate || '2020-05-10',
      overrides.deedType || 'Absolute Sale Deed',
      JSON.stringify(fromParties),
      JSON.stringify(toParties),
      overrides.extentSqFt ?? 1000,
      overrides.consideration ?? 100000,
      overrides.status || 'unverified',
    ]
  );
  return id;
}

async function cleanupEvent(id: string) {
  await pool.query('DELETE FROM title_reviews WHERE event_id=?', [id]);
  await pool.query('DELETE FROM title_events WHERE id=?', [id]);
}

async function createTestDoc(storageKey: string): Promise<string> {
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO documents (
      id, tenant_id, property_id, doc_type, original_filename, storage_key,
      mime_type, size_bytes, sha256, processing_status, extracted_text,
      extracted_fields, uploaded_by_uid
    ) VALUES (?, ?, ?, 'sale_deed', 'test_deed.pdf', ?, 'application/pdf', 1024,
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'completed', 'sample deed recital text', '{}', 'local-developer')`,
    [id, TENANT_ID, PROPERTY_ID, storageKey]
  );
  return id;
}

async function cleanupDoc(id: string) {
  await pool.query('DELETE FROM documents WHERE id=?', [id]);
}

// ============================================================================
// SUITE 1: DISPUTE RATIONALE ENFORCEMENT ON POST /title-events/:eventId/review
// ============================================================================

test('ADVERSARIAL REVIEW-1: Dispute with empty string "" rationale returns 400 Bad Request', async () => {
  const eventId = await createTestEvent();
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events/${eventId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'disputed', rationale: '' }),
    });
    const body = await res.json();
    assert.equal(res.status, 400, 'Must return HTTP 400 Bad Request on empty rationale');
    assert.ok(body.error.includes('Dispute rationale is mandatory') || body.error.includes('rationale'));
  } finally {
    await cleanupEvent(eventId);
  }
});

test('ADVERSARIAL REVIEW-2: Dispute with whitespace-only "   " rationale returns 400 Bad Request', async () => {
  const eventId = await createTestEvent();
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events/${eventId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'disputed', rationale: '   ' }),
    });
    const body = await res.json();
    assert.equal(res.status, 400, 'Must return HTTP 400 Bad Request on whitespace rationale');
    assert.ok(body.error.includes('Dispute rationale is mandatory') || body.error.includes('rationale'));
  } finally {
    await cleanupEvent(eventId);
  }
});

test('ADVERSARIAL REVIEW-3: Dispute with null rationale returns 400 Bad Request', async () => {
  const eventId = await createTestEvent();
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events/${eventId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'disputed', rationale: null }),
    });
    assert.equal(res.status, 400, 'Must return HTTP 400 Bad Request on null rationale');
  } finally {
    await cleanupEvent(eventId);
  }
});

test('ADVERSARIAL REVIEW-4: Dispute with undefined/omitted rationale returns 400 Bad Request', async () => {
  const eventId = await createTestEvent();
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events/${eventId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'disputed' }),
    });
    const body = await res.json();
    assert.equal(res.status, 400, 'Must return HTTP 400 Bad Request when rationale is omitted');
    assert.ok(body.error.includes('Dispute rationale is mandatory') || body.error.includes('rationale'));
  } finally {
    await cleanupEvent(eventId);
  }
});

test('ADVERSARIAL REVIEW-5: Valid dispute rationale succeeds with 200 OK and logs audit entry', async () => {
  const eventId = await createTestEvent();
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events/${eventId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'disputed',
        rationale: 'PENDING_LITIGATION: Section 52 Transfer of Property Act violation under OS 452/2021',
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 200, 'Valid dispute must return HTTP 200 OK');
    assert.equal(body.item.status, 'disputed');
    assert.equal(body.item.dispute_rationale, 'PENDING_LITIGATION: Section 52 Transfer of Property Act violation under OS 452/2021');

    const auditRes = await pool.query('SELECT * FROM title_reviews WHERE event_id=?', [eventId]);
    assert.equal(auditRes.rowCount, 1, 'Audit log must record review decision in title_reviews');
    assert.equal(auditRes.rows[0].status, 'disputed');
  } finally {
    await cleanupEvent(eventId);
  }
});

test('ADVERSARIAL REVIEW-6: Verification and clearing back to unverified do not require rationale', async () => {
  const eventId = await createTestEvent({ status: 'disputed' });
  try {
    const resVerify = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events/${eventId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'verified' }),
    });
    assert.equal(resVerify.status, 200);

    const resClear = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events/${eventId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'unverified' }),
    });
    assert.equal(resClear.status, 200);
  } finally {
    await cleanupEvent(eventId);
  }
});

// ============================================================================
// SUITE 2: PATH TRAVERSAL PROTECTION IN POST /documents/:docId/extract
// ============================================================================

test('ADVERSARIAL TRAVERSAL-1: POST /extract with ../package.json returns 403 Forbidden', async () => {
  const docId = await createTestDoc('../package.json');
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Some text' }),
    });
    const body = await res.json();
    assert.equal(res.status, 403, 'Must return HTTP 403 Forbidden');
    assert.ok(body.error.includes('Access denied') || body.error.includes('traversal'));
  } finally {
    await cleanupDoc(docId);
  }
});

test('ADVERSARIAL TRAVERSAL-2: POST /extract with /etc/passwd returns 403 Forbidden', async () => {
  const docId = await createTestDoc('/etc/passwd');
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Some text' }),
    });
    const body = await res.json();
    assert.equal(res.status, 403, 'Must return HTTP 403 Forbidden');
    assert.ok(body.error.includes('Access denied') || body.error.includes('traversal'));
  } finally {
    await cleanupDoc(docId);
  }
});

test('ADVERSARIAL TRAVERSAL-3: POST /extract with ..\\package.json (backslashes) returns 403 Forbidden', async () => {
  const docId = await createTestDoc('..\\package.json');
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Some text' }),
    });
    const body = await res.json();
    assert.equal(res.status, 403, 'Must return HTTP 403 Forbidden');
    assert.ok(body.error.includes('Access denied') || body.error.includes('traversal'));
  } finally {
    await cleanupDoc(docId);
  }
});

test('ADVERSARIAL TRAVERSAL-4: POST /extract with nested dir/../../package.json returns 403 Forbidden', async () => {
  const docId = await createTestDoc('uploads/../../package.json');
  try {
    const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/documents/${docId}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Some text' }),
    });
    const body = await res.json();
    assert.equal(res.status, 403, 'Must return HTTP 403 Forbidden');
    assert.ok(body.error.includes('Access denied') || body.error.includes('traversal'));
  } finally {
    await cleanupDoc(docId);
  }
});

test('ADVERSARIAL TRAVERSAL-5: Null-byte injection is blocked by resolveSafeUploadPath', async () => {
  const { resolveSafeUploadPath } = await import('../src/server.js');
  const resNull = resolveSafeUploadPath('document.pdf\0malicious');
  assert.equal(resNull.isTraversal, true, 'resolveSafeUploadPath must flag null byte as traversal');
  assert.equal(resNull.safePath, null, 'safePath must be null');
});

// ============================================================================
// SUITE 3: INVALID/MALFORMED PAYLOADS ON POST /api/properties/:id/title-events
// ============================================================================

test('ADVERSARIAL PAYLOAD-1: Empty body {} returns 400 Bad Request with field errors', async () => {
  const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assert.equal(res.status, 400, 'Must return 400 Bad Request');
  assert.ok(body.error.includes('Invalid title event payload'));
  assert.ok(body.issues.fieldErrors.eventDate);
  assert.ok(body.issues.fieldErrors.deedType);
  assert.ok(body.issues.fieldErrors.fromParties);
  assert.ok(body.issues.fieldErrors.toParties);
  assert.ok(body.issues.fieldErrors.extentSqFt);
});

test('ADVERSARIAL PAYLOAD-2: Malformed eventDate (invalid format) returns 400 Bad Request', async () => {
  const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deedType: 'Absolute Sale Deed',
      eventDate: '2021/11/05',
      fromParties: [{ name: 'Party A' }],
      toParties: [{ name: 'Party B' }],
      extentSqFt: 1000,
    }),
  });
  assert.equal(res.status, 400, 'Must reject slash-delimited date');
  const body = await res.json();
  assert.ok(body.issues.fieldErrors.eventDate);
});

test('ADVERSARIAL PAYLOAD-3: Negative extentSqFt returns 400 Bad Request', async () => {
  const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deedType: 'Absolute Sale Deed',
      eventDate: '2021-11-05',
      fromParties: [{ name: 'Party A' }],
      toParties: [{ name: 'Party B' }],
      extentSqFt: -100,
    }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.issues.fieldErrors.extentSqFt);
});

test('ADVERSARIAL PAYLOAD-4: Negative consideration returns 400 Bad Request', async () => {
  const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deedType: 'Absolute Sale Deed',
      eventDate: '2021-11-05',
      fromParties: [{ name: 'Party A' }],
      toParties: [{ name: 'Party B' }],
      extentSqFt: 1000,
      consideration: -50000,
    }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.issues.fieldErrors.consideration);
});

test('ADVERSARIAL PAYLOAD-5: SequenceOrder < 1 (0 or negative) returns 400 Bad Request', async () => {
  const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sequenceOrder: 0,
      deedType: 'Absolute Sale Deed',
      eventDate: '2021-11-05',
      fromParties: [{ name: 'Party A' }],
      toParties: [{ name: 'Party B' }],
      extentSqFt: 1000,
    }),
  });
  assert.equal(res.status, 400, 'Must reject sequenceOrder: 0');
  const body = await res.json();
  assert.ok(body.issues.fieldErrors.sequenceOrder);
});

test('ADVERSARIAL PAYLOAD-6: Whitespace-only or empty deedType returns 400 Bad Request', async () => {
  const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deedType: '   ',
      eventDate: '2021-11-05',
      fromParties: [{ name: 'Party A' }],
      toParties: [{ name: 'Party B' }],
      extentSqFt: 1000,
    }),
  });
  assert.equal(res.status, 400, 'Must reject whitespace deedType');
  const body = await res.json();
  assert.ok(body.issues.fieldErrors.deedType);
});

test('ADVERSARIAL PAYLOAD-7: Whitespace-only party names return 400 Bad Request', async () => {
  const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deedType: 'Sale Deed',
      eventDate: '2021-11-05',
      fromParties: [{ name: '   ' }],
      toParties: [{ name: 'Party B' }],
      extentSqFt: 1000,
    }),
  });
  assert.equal(res.status, 400);
});

test('ADVERSARIAL PAYLOAD-8: Invalid enum values return 400 Bad Request', async () => {
  const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deedType: 'Sale Deed',
      eventDate: '2021-11-05',
      fromParties: [{ name: 'Party A' }],
      toParties: [{ name: 'Party B' }],
      extentSqFt: 1000,
      status: 'pending_approval',
    }),
  });
  assert.equal(res.status, 400);
});

test('ADVERSARIAL PAYLOAD-9: Valid title-event insertion succeeds with 201 Created and normalized parties', async () => {
  const res = await fetch(`${serverBaseUrl}/api/properties/${PROPERTY_ID}/title-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sequenceOrder: 10,
      deedType: 'Absolute Sale Deed',
      eventDate: '2022-03-25',
      registrationDate: '2022-04-10',
      fromParties: [{ name: 'Sri Muniyappa (S/o Govindappa)' }],
      toParties: [{ name: 'Suresh M (S/o Muniyappa)' }],
      extentSqFt: 21780,
      extentRaw: '20 Guntas',
      consideration: 4500000,
      encumbranceStatus: 'none',
    }),
  });
  assert.equal(res.status, 201, 'Valid creation returns 201');
  const body = await res.json();
  assert.ok(body.item.id);
  const createdId = body.item.id;

  try {
    const fromParties = typeof body.item.from_parties === 'string' ? JSON.parse(body.item.from_parties) : body.item.from_parties;
    const toParties = typeof body.item.to_parties === 'string' ? JSON.parse(body.item.to_parties) : body.item.to_parties;

    assert.equal(fromParties[0].name, 'Sri Muniyappa (S/o Govindappa)');
    assert.equal(fromParties[0].normalizedName, 'MUNIYAPPA (S/O GOVINDAPPA)');
    assert.equal(toParties[0].name, 'Suresh M (S/o Muniyappa)');
    assert.equal(toParties[0].normalizedName, 'SURESH (S/O MUNIYAPPA)');
  } finally {
    await cleanupEvent(createdId);
  }
});

// Finding verification test: normalizePartyName relationship tag canonicalization
test('EMPIRICAL FINDING: normalizePartyName hardcodes (S/O ...) for W/o and D/o in canonicalName', async () => {
  const { normalizePartyName } = await import('../src/title-engine.js');
  const resWife = normalizePartyName('Srimathi Shailaja (W/o Dr. Krishna Murthy)');
  assert.equal(resWife.relationType, 'w/o', 'relationType is correctly identified as w/o');
  // Empirical verification of the bug: canonicalName incorrectly formats as S/O instead of W/O
  assert.equal(resWife.canonicalName, 'SHAILAJA (S/O DR. KRISHNA MURTHY)', 'Demonstrates canonicalName hardcoding S/O instead of preserving W/O');
});

// Clean up test suite DB pool
test('Database connection pool cleanup', async () => {
  await pool.end();
  assert.ok(true);
});
