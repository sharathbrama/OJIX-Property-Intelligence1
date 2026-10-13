import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.TEST_API_URL || 'http://127.0.0.1:4000';
const databaseUrl = process.env.DATABASE_URL || 'mysql://ojix:ojix_local_only@127.0.0.1:3306/ojix_property_mysql';
const headers = { 'content-type': 'application/json', 'x-user-uid': 'user-owner' };
const db = await mysql.createConnection(databaseUrl);
let propertyId;
let titleEventId;
let documentId;
let bookmarkId;

async function request(path, options = {}, expected = 200) {
  const response = await fetch(`${base}${path}`, options);
  const type = response.headers.get('content-type') || '';
  const body = type.includes('json') ? await response.json() : await response.text();
  if (response.status !== expected) throw new Error(`${options.method || 'GET'} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

try {
  const created = await request('/api/properties', {
    method: 'POST', headers,
    body: JSON.stringify({ name: 'MariaDB migration smoke test', village: 'Temporary', surveyNumber: `SMOKE-${Date.now()}`, latitude: 12.887, longitude: 77.596 }),
  }, 201);
  propertyId = created.item.id;

  await request(`/api/properties/${propertyId}`, { headers: { 'x-user-uid': 'user-owner' } });
  await request(`/api/properties/${propertyId}`, { method: 'PATCH', headers, body: JSON.stringify({ notes: 'MariaDB update verified' }) });
  await request(`/api/properties?q=MariaDB%20migration`, { headers: { 'x-user-uid': 'user-owner' } });
  await request(`/api/properties/${propertyId}/analyze`, { method: 'POST', headers });
  await request(`/api/properties/${propertyId}/spatial-screening`, { headers: { 'x-user-uid': 'user-owner' } });
  await request('/api/spatial/screen-point', { method: 'POST', headers, body: JSON.stringify({ latitude: 12.887, longitude: 77.596 }) });
  await request(`/api/properties/${propertyId}/parcel-geometry`, {
    method: 'POST', headers,
    body: JSON.stringify({ type: 'Polygon', coordinates: [[[77.595,12.886],[77.597,12.886],[77.597,12.888],[77.595,12.886]]] }),
  });

  const form = new FormData();
  form.append('files', new Blob(['temporary migration smoke test deed'], { type: 'application/pdf' }), 'smoke-test.pdf');
  const uploaded = await request(`/api/properties/${propertyId}/documents`, { method: 'POST', headers: { 'x-user-uid': 'user-owner' }, body: form }, 201);
  documentId = uploaded.items[0].id;
  await request(`/api/properties/${propertyId}/documents/${documentId}/extract`, { method: 'POST', headers, body: JSON.stringify({ text: 'Sale deed dated 01/01/2020' }) });
  await request(`/api/properties/${propertyId}/documents/${documentId}/fields`, { method: 'PATCH', headers, body: JSON.stringify({ fieldPath: 'documentNumber', newValue: 'SMOKE-1', rationale: 'Migration smoke test' }) });

  const event = await request(`/api/properties/${propertyId}/title-events`, {
    method: 'POST', headers,
    body: JSON.stringify({ eventDate: '2020-01-01', deedType: 'Sale Deed', fromParties: [{ name: 'Test Seller' }], toParties: [{ name: 'Test Buyer' }], extentSqFt: 1000, extentRaw: '1000 sq ft', consideration: 100000, status: 'unverified', encumbranceStatus: 'none' }),
  }, 201);
  titleEventId = event.item.id;
  await request(`/api/properties/${propertyId}/title-chain`, { headers: { 'x-user-uid': 'user-owner' } });
  await request(`/api/properties/${propertyId}/title-events/${titleEventId}/review`, { method: 'POST', headers, body: JSON.stringify({ status: 'verified' }) });

  const bookmark = await request('/api/legal-research/bookmarks', { method: 'POST', headers, body: JSON.stringify({ actId: 'smoke', sectionNumber: '1', title: 'Temporary smoke bookmark', propertyId }) }, 201);
  bookmarkId = bookmark.item.id;
  await request('/api/legal-research/bookmarks', { headers: { 'x-user-uid': 'user-owner' } });
  await request(`/api/legal-research/bookmarks/${bookmark.item.id}`, { method: 'DELETE', headers });
  await request('/api/documents/all', { headers: { 'x-user-uid': 'user-owner' } });
  await request('/api/findings/all', { headers: { 'x-user-uid': 'user-owner' } });
  await request(`/api/properties/${propertyId}/discrepancies`, { headers: { 'x-user-uid': 'user-owner' } });
  await request(`/api/properties/${propertyId}/report`, { headers: { 'x-user-uid': 'user-owner' } });
  await request('/api/source-registry/status', { headers: { 'x-user-uid': 'user-owner' } });
  console.log(JSON.stringify({ ok: true, propertyId, documentId, titleEventId }, null, 2));
} finally {
  if (propertyId) {
    const [files] = await db.execute('SELECT storage_key FROM documents WHERE property_id=?', [propertyId]);
    for (const file of files) {
      const candidate = path.resolve(process.cwd(), 'uploads', path.basename(file.storage_key));
      if (candidate.startsWith(path.resolve(process.cwd(), 'uploads') + path.sep) && fs.existsSync(candidate)) fs.unlinkSync(candidate);
    }
    const entityIds = [propertyId, documentId, titleEventId, bookmarkId].filter(Boolean);
    if (entityIds.length) await db.query('DELETE FROM audit_events WHERE entity_id IN (?) OR JSON_UNQUOTE(JSON_EXTRACT(details, ?))=?', [entityIds, '$.propertyId', propertyId]);
    await db.execute('DELETE FROM properties WHERE id=?', [propertyId]);
  }
  await db.end();
}
