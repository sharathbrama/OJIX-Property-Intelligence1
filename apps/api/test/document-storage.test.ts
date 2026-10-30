import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTenantObjectKey,
  createDocumentStorage,
  normalizeObjectKey,
  SupabaseDocumentStorage,
} from '../src/document-storage.js';

test('defaults to local document storage', () => {
  assert.equal(createDocumentStorage({}).provider, 'local');
});

test('builds tenant-scoped opaque object keys', () => {
  assert.equal(buildTenantObjectKey({ tenantId: 'org-1', propertyId: 'p-1', documentId: 'd-1', originalFilename: 'deed.PDF' }), 'org-1/p-1/d-1.pdf');
});

test('rejects object-key traversal', () => {
  assert.throws(() => normalizeObjectKey('org/../secret.pdf'), /Invalid document object key/);
});

test('creates a short-lived Supabase signed URL without exposing the service key', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify({ signedURL: '/object/sign/private-documents/org/p/doc.pdf?token=test' }), { status: 200 });
  };
  const storage = new SupabaseDocumentStorage('https://example.supabase.co', 'server-secret', 'private-documents', fakeFetch as typeof fetch);
  const url = await storage.createSignedUrl('supabase:org/p/doc.pdf', 120);
  assert.equal(url, 'https://example.supabase.co/storage/v1/object/sign/private-documents/org/p/doc.pdf?token=test');
  assert.equal(JSON.parse(String(requests[0].init?.body)).expiresIn, 120);
  assert.equal((requests[0].init?.headers as Record<string, string>).Authorization, 'Bearer server-secret');
  assert.doesNotMatch(url, /server-secret/);
});
