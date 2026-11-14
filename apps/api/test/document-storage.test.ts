import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildTenantObjectKey,
  createDocumentStorage,
  GcsDocumentStorage,
  normalizeObjectKey,
  RoutedDocumentStorage,
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

test('uploads, retrieves, signs and deletes private GCS objects', async () => {
  const operations: Array<{ name: string; value?: unknown }> = [];
  const fakeClient = {
    bucket: (bucketName: string) => {
      operations.push({ name: 'bucket', value: bucketName });
      return {
        file: (objectName: string) => ({
          save: async (body: Buffer, options: unknown) => { operations.push({ name: 'save', value: { objectName, body: body.toString(), options } }); },
          getSignedUrl: async (options: unknown) => { operations.push({ name: 'sign', value: { objectName, options } }); return [`https://storage.test/${objectName}?signed=1`] as [string]; },
          download: async () => { operations.push({ name: 'download', value: objectName }); return [Buffer.from('private document')] as [Buffer]; },
          delete: async (options: unknown) => { operations.push({ name: 'delete', value: { objectName, options } }); },
        }),
      };
    },
  };
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'ojix-gcs-test-'));
  const localPath = path.join(folder, 'input.pdf');
  await fs.writeFile(localPath, 'private document');
  try {
    const storage = new GcsDocumentStorage('private-bucket', fakeClient);
    const stored = await storage.put({ localPath, objectKey: 'tenant/property/document.pdf', mimeType: 'application/pdf' });
    assert.deepEqual(stored, { storageKey: 'gcs:tenant/property/document.pdf', provider: 'gcs' });
    const saved = operations.find(item => item.name === 'save')?.value as { options: { preconditionOpts: { ifGenerationMatch: number }; metadata: { cacheControl: string } } };
    assert.equal(saved.options.preconditionOpts.ifGenerationMatch, 0);
    assert.equal(saved.options.metadata.cacheControl, 'private, no-store');
    assert.equal((await storage.getObject(stored.storageKey)).toString(), 'private document');
    const before = Date.now();
    assert.equal(await storage.createSignedUrl(stored.storageKey, 60), 'https://storage.test/tenant/property/document.pdf?signed=1');
    const signed = operations.find(item => item.name === 'sign')?.value as { options: { expires: number } };
    assert.ok(signed.options.expires >= before + 60_000 && signed.options.expires <= Date.now() + 60_000);
    await storage.delete(stored.storageKey);
    assert.deepEqual(operations.find(item => item.name === 'delete')?.value, { objectName: 'tenant/property/document.pdf', options: { ignoreNotFound: true } });
    await assert.rejects(storage.createSignedUrl(stored.storageKey, 901), /between 1 and 900/);
  } finally {
    await fs.rm(folder, { recursive: true, force: true });
  }
});

test('routes legacy Supabase keys while GCS is the active upload provider', async () => {
  const requests: string[] = [];
  const supabase = new SupabaseDocumentStorage('https://example.supabase.co', 'server-secret', 'private-documents', (async (url) => {
    requests.push(String(url));
    return new Response(JSON.stringify({ signedURL: '/legacy.pdf?token=short-lived' }), { status: 200 });
  }) as typeof fetch);
  const gcs = new GcsDocumentStorage('private-bucket', { bucket: () => ({ file: () => ({
    save: async () => {}, getSignedUrl: async () => ['https://storage.test/current'] as [string],
    download: async () => [Buffer.from('')] as [Buffer], delete: async () => {},
  }) }) });
  const routed = new RoutedDocumentStorage(gcs, { gcs, supabase });
  assert.equal(routed.provider, 'gcs');
  assert.equal(routed.canDelete('supabase:tenant/property/old.pdf'), true);
  assert.equal(routed.canDelete('local-upload.pdf'), false);
  assert.equal(await routed.createSignedUrl('supabase:tenant/property/old.pdf', 60), 'https://example.supabase.co/storage/v1/legacy.pdf?token=short-lived');
  assert.equal(requests.length, 1);
});
