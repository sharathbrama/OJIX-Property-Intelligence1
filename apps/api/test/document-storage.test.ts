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
  type GcsStorageClient,
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
          generateSignedPostPolicyV4: async (options: unknown) => { operations.push({ name: 'post-policy', value: { objectName, options } }); return [{ url: 'https://storage.test/upload', fields: { key: objectName, policy: 'signed-policy' } }, {}] as any; },
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

test('GCS direct upload URL is short-lived, MIME-bound, and cannot overwrite an existing object', async () => {
  const operations: Array<{ options: any }> = [];
  const client = { bucket: () => ({ file: () => ({
    save: async () => {},
    generateSignedPostPolicyV4: async (options: any) => { operations.push({ options }); return [{ url: 'https://storage.test/upload', fields: { key: 'tenant/property/document.pdf', policy: 'signed-policy', 'Content-Type': 'application/pdf', 'x-goog-if-generation-match': '0' } }, {}] as any; },
    getSignedUrl: async () => ['https://storage.test/download'] as [string],
    download: async () => [Buffer.from('')], delete: async () => {},
  }) }) } as unknown as GcsStorageClient;
  const storage = new GcsDocumentStorage('private-bucket', client);
  const result = await storage.createSignedUploadUrl('gcs:tenant/property/document.pdf', 'application/pdf', 8192, 300);
  const policy = operations[0];
  assert.equal(result.method, 'POST');
  assert.equal(result.fields.key, 'tenant/property/document.pdf');
  assert.equal(result.fields.policy, 'signed-policy');
  assert.equal(result.url, 'https://storage.test/upload');
  assert.equal(policy.options.fields['Content-Type'], 'application/pdf');
  assert.equal(policy.options.fields['x-goog-if-generation-match'], '0');
  assert.ok((policy.options.conditions as unknown[][]).some(condition => condition[0] === 'content-length-range' && condition[1] === 8192 && condition[2] === 8192));
  assert.ok(policy.options.expires <= Date.now() + 300_000);
});

test('routed storage delegates signed uploads to the provider encoded in the key', async () => {
  const signedKeys: string[] = [];
  const supabase = new SupabaseDocumentStorage('https://example.supabase.co', 'secret', 'private-documents', (async () => new Response(JSON.stringify({ signedURL: '/upload?token=1' }), { status: 200 })) as typeof fetch);
  const remote = {
    provider: 'supabase' as const,
    put: supabase.put.bind(supabase),
    createSignedUrl: supabase.createSignedUrl.bind(supabase),
    getObject: supabase.getObject.bind(supabase),
    delete: supabase.delete.bind(supabase),
    canDelete: supabase.canDelete.bind(supabase),
    createSignedUploadUrl: async (key: string, _mime: string, _size: number, _ttl: number) => { signedKeys.push(key); return { url: 'https://storage.test/signed', method: 'PUT' as const, headers: {} }; },
  };
  const local = { provider: 'local' as const, put: async () => ({ storageKey: 'file', provider: 'local' as const }), createSignedUrl: async () => null };
  const routed = new RoutedDocumentStorage(local, { supabase: remote });
  await routed.createSignedUploadUrl('supabase:tenant/property/document.pdf', 'application/pdf', 16, 300);
  assert.deepEqual(signedKeys, ['supabase:tenant/property/document.pdf']);
});

test('Supabase direct upload URL does not reveal its service role key', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const storage = new SupabaseDocumentStorage('https://example.supabase.co', 'server-secret', 'private-documents', (async (url, init) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify({ signedURL: '/object/upload/sign/private-documents/tenant/property/file.pdf?token=short-lived' }), { status: 200 });
  }) as typeof fetch);
  const result = await storage.createSignedUploadUrl('supabase:tenant/property/file.pdf', 'application/pdf', 12, 300);
  assert.equal(result.method, 'PUT');
  assert.equal(result.headers['Content-Type'], 'application/pdf');
  assert.match(result.url, /token=short-lived/);
  assert.doesNotMatch(result.url, /server-secret/);
  assert.equal((requests[0].init?.headers as Record<string, string>).Authorization, 'Bearer server-secret');
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), { upsert: false });
});

test('routes legacy Supabase keys while GCS is the active upload provider', async () => {
  const requests: string[] = [];
  const supabase = new SupabaseDocumentStorage('https://example.supabase.co', 'server-secret', 'private-documents', (async (url) => {
    requests.push(String(url));
    return new Response(JSON.stringify({ signedURL: '/legacy.pdf?token=short-lived' }), { status: 200 });
  }) as typeof fetch);
  const gcs = new GcsDocumentStorage('private-bucket', { bucket: () => ({ file: () => ({
    save: async () => {}, generateSignedPostPolicyV4: async () => [{ url: 'https://storage.test/upload', fields: {} }, {}] as any, getSignedUrl: async () => ['https://storage.test/current'] as [string],
    download: async () => [Buffer.from('')] as [Buffer], delete: async () => {},
  }) }) });
  const routed = new RoutedDocumentStorage(gcs, { gcs, supabase });
  assert.equal(routed.provider, 'gcs');
  assert.equal(routed.canDelete('supabase:tenant/property/old.pdf'), true);
  assert.equal(routed.canDelete('local-upload.pdf'), false);
  assert.equal(await routed.createSignedUrl('supabase:tenant/property/old.pdf', 60), 'https://example.supabase.co/storage/v1/legacy.pdf?token=short-lived');
  assert.equal(requests.length, 1);
});
