import { Storage } from '@google-cloud/storage';
import fs from 'node:fs/promises';
import path from 'node:path';

export type StorageProviderName = 'local' | 'supabase' | 'gcs';
export type RemoteStorageProviderName = Exclude<StorageProviderName, 'local'>;

export interface StoredDocument {
  storageKey: string;
  provider: StorageProviderName;
}

export interface DocumentStorage {
  readonly provider: StorageProviderName;
  checkReady?(): Promise<void>;
  put(input: { localPath: string; objectKey: string; mimeType: string }): Promise<StoredDocument>;
  createSignedUrl(storageKey: string, expiresInSeconds: number): Promise<string | null>;
  createSignedUploadUrl?(storageKey: string, mimeType: string, sizeBytes: number, expiresInSeconds: number): Promise<{ url: string; method: 'PUT' | 'POST'; headers: Record<string, string>; fields?: Record<string, string> }>;
  getObject?(storageKey: string): Promise<Buffer>;
  delete?(storageKey: string): Promise<void>;
  canDelete?(storageKey: string): boolean;
}

type GcsFileLike = {
  save(data: Buffer, options?: Record<string, unknown>): Promise<unknown>;
  generateSignedPostPolicyV4(options: Record<string, unknown>): Promise<[{ url: string; fields: Record<string, string> }, unknown]>;
  getSignedUrl(options: { version: 'v4'; action: 'read'; expires: number }): Promise<[string]>;
  download(): Promise<[Buffer]>;
  delete(options?: { ignoreNotFound?: boolean }): Promise<unknown>;
};

export type GcsStorageClient = {
  bucket(name: string): { file(name: string): GcsFileLike; getMetadata?(): Promise<unknown>; name?: string };
};

const STORAGE_KEY_PREFIX: Record<RemoteStorageProviderName, string> = {
  supabase: 'supabase:',
  gcs: 'gcs:',
};

export function storageProviderForKey(storageKey: string | null | undefined): StorageProviderName | null {
  if (!storageKey || typeof storageKey !== 'string') return null;
  if (storageKey.startsWith(STORAGE_KEY_PREFIX.gcs)) return 'gcs';
  if (storageKey.startsWith(STORAGE_KEY_PREFIX.supabase)) return 'supabase';
  return 'local';
}

export function isRemoteStorageKey(storageKey: string | null | undefined): storageKey is string {
  const provider = storageProviderForKey(storageKey);
  return provider === 'gcs' || provider === 'supabase';
}

export function normalizeObjectKey(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/');
  if (!normalized || segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error('Invalid document object key.');
  }
  return segments.map(segment => encodeURIComponent(decodeURIComponent(segment))).join('/');
}

export class LocalDocumentStorage implements DocumentStorage {
  readonly provider = 'local' as const;

  async put(input: { localPath: string }): Promise<StoredDocument> {
    return { storageKey: path.basename(input.localPath), provider: this.provider };
  }

  async createSignedUrl(): Promise<null> {
    return null;
  }

  canDelete(): boolean { return false; }
}

export class SupabaseDocumentStorage implements DocumentStorage {
  readonly provider = 'supabase' as const;

  constructor(
    private readonly baseUrl: string,
    private readonly serviceRoleKey: string,
    private readonly bucket: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!baseUrl.startsWith('https://')) throw new Error('SUPABASE_URL must use HTTPS.');
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for Supabase storage.');
    if (!bucket) throw new Error('SUPABASE_STORAGE_BUCKET is required for Supabase storage.');
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      ...extra,
    };
  }

  async checkReady(): Promise<void> {
    const response = await this.fetchImpl(
      `${this.baseUrl.replace(/\/$/, '')}/storage/v1/bucket/${encodeURIComponent(this.bucket)}`,
      { method: 'GET', headers: this.headers(), signal: AbortSignal.timeout(5_000) },
    );
    if (!response.ok) throw new Error('Supabase storage is unavailable.');
  }

  private objectUrl(storageKey: string, action: 'object' | 'sign'): string {
    const key = normalizeObjectKey(storageKey.replace(/^supabase:/, ''));
    return `${this.baseUrl.replace(/\/$/, '')}/storage/v1/object/${action === 'sign' ? 'sign/' : ''}${encodeURIComponent(this.bucket)}/${key}`;
  }

  async put(input: { localPath: string; objectKey: string; mimeType: string }): Promise<StoredDocument> {
    const body = await fs.readFile(input.localPath);
    const key = normalizeObjectKey(input.objectKey);
    const response = await this.fetchImpl(this.objectUrl(`supabase:${key}`, 'object'), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': input.mimeType, 'x-upsert': 'false' }),
      body,
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Supabase storage upload failed (${response.status}): ${detail}`);
    }
    return { storageKey: `supabase:${key}`, provider: this.provider };
  }

  async createSignedUrl(storageKey: string, expiresInSeconds: number): Promise<string> {
    if (!storageKey.startsWith('supabase:')) throw new Error('Storage key does not belong to Supabase.');
    const response = await this.fetchImpl(this.objectUrl(storageKey, 'sign'), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Supabase signed URL creation failed (${response.status}): ${detail}`);
    }
    const payload = await response.json() as { signedURL?: string; signedUrl?: string };
    const signedPath = payload.signedURL || payload.signedUrl;
    if (!signedPath) throw new Error('Supabase did not return a signed URL.');
    return signedPath.startsWith('http') ? signedPath : `${this.baseUrl.replace(/\/$/, '')}/storage/v1${signedPath.startsWith('/') ? '' : '/'}${signedPath}`;
  }

  async createSignedUploadUrl(storageKey: string, mimeType: string, _sizeBytes: number, _expiresInSeconds: number): Promise<{ url: string; method: 'PUT'; headers: Record<string, string> }> {
    if (!storageKey.startsWith('supabase:')) throw new Error('Storage key does not belong to Supabase.');
    const key = normalizeObjectKey(storageKey.slice('supabase:'.length));
    const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/storage/v1/object/upload/sign/${encodeURIComponent(this.bucket)}/${key}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ upsert: false }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Supabase signed upload URL creation failed (${response.status}): ${detail}`);
    }
    const payload = await response.json() as { signedURL?: string; signedUrl?: string; token?: string };
    const signedPath = payload.signedURL || payload.signedUrl;
    const url = signedPath
      ? signedPath.startsWith('http') ? signedPath : `${this.baseUrl.replace(/\/$/, '')}/storage/v1${signedPath.startsWith('/') ? '' : '/'}${signedPath}`
      : payload.token ? `${this.baseUrl.replace(/\/$/, '')}/storage/v1/object/upload/sign/${encodeURIComponent(this.bucket)}/${key}?token=${encodeURIComponent(payload.token)}` : '';
    if (!url) throw new Error('Supabase did not return a signed upload URL.');
    return { url, method: 'PUT', headers: { 'Content-Type': mimeType, 'x-upsert': 'false' } };
  }

  async getObject(storageKey: string): Promise<Buffer> {
    const signedUrl = await this.createSignedUrl(storageKey, 120);
    const response = await this.fetchImpl(signedUrl, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Supabase document download failed (${response.status}).`);
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(storageKey: string): Promise<void> {
    if (!storageKey.startsWith('supabase:')) throw new Error('Storage key does not belong to Supabase.');
    const response = await this.fetchImpl(this.objectUrl(storageKey, 'object'), { method: 'DELETE', headers: this.headers() });
    if (!response.ok && response.status !== 404) throw new Error(`Supabase storage deletion failed (${response.status}).`);
  }

  canDelete(storageKey: string): boolean { return storageKey.startsWith('supabase:'); }
}

export class GcsDocumentStorage implements DocumentStorage {
  readonly provider = 'gcs' as const;
  private readonly bucket: ReturnType<GcsStorageClient['bucket']>;

  constructor(
    bucketName: string,
    storageClient: GcsStorageClient = new Storage() as unknown as GcsStorageClient,
  ) {
    if (!bucketName.trim()) throw new Error('GCS_BUCKET is required for Google Cloud Storage.');
    this.bucket = storageClient.bucket(bucketName);
  }

  async checkReady(): Promise<void> {
    if (!this.bucket.getMetadata) throw new Error('Google Cloud Storage readiness check is unavailable.');
    await this.bucket.getMetadata();
  }

  async put(input: { localPath: string; objectKey: string; mimeType: string }): Promise<StoredDocument> {
    const objectKey = normalizeObjectKey(input.objectKey);
    const body = await fs.readFile(input.localPath);
    await this.bucket.file(objectKey).save(body, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: input.mimeType, cacheControl: 'private, no-store' },
    });
    return { storageKey: `gcs:${objectKey}`, provider: this.provider };
  }

  async createSignedUrl(storageKey: string, expiresInSeconds: number): Promise<string> {
    if (!storageKey.startsWith('gcs:')) throw new Error('Storage key does not belong to Google Cloud Storage.');
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 900) {
      throw new Error('GCS signed URL expiry must be between 1 and 900 seconds.');
    }
    const objectKey = normalizeObjectKey(storageKey.slice('gcs:'.length));
    const [url] = await this.bucket.file(objectKey).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
    });
    return url;
  }

  async createSignedUploadUrl(storageKey: string, mimeType: string, sizeBytes: number, expiresInSeconds: number): Promise<{ url: string; method: 'POST'; headers: Record<string, string>; fields: Record<string, string> }> {
    if (!storageKey.startsWith('gcs:')) throw new Error('Storage key does not belong to Google Cloud Storage.');
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 900) {
      throw new Error('GCS signed URL expiry must be between 1 and 900 seconds.');
    }
    if (!Number.isInteger(sizeBytes) || sizeBytes < 1) throw new Error('GCS signed upload size must be a positive integer.');
    const objectKey = normalizeObjectKey(storageKey.slice('gcs:'.length));
    const [policy] = await this.bucket.file(objectKey).generateSignedPostPolicyV4({
      expires: Date.now() + expiresInSeconds * 1000,
      fields: { key: objectKey, 'Content-Type': mimeType, 'x-goog-if-generation-match': '0' },
      conditions: [
        ['eq', '$key', objectKey],
        ['eq', '$Content-Type', mimeType],
        ['eq', '$x-goog-if-generation-match', '0'],
        ['content-length-range', sizeBytes, sizeBytes],
      ],
    });
    return { url: policy.url, method: 'POST', headers: {}, fields: policy.fields };
  }

  async getObject(storageKey: string): Promise<Buffer> {
    if (!storageKey.startsWith('gcs:')) throw new Error('Storage key does not belong to Google Cloud Storage.');
    const objectKey = normalizeObjectKey(storageKey.slice('gcs:'.length));
    const [body] = await this.bucket.file(objectKey).download();
    return Buffer.from(body);
  }

  async delete(storageKey: string): Promise<void> {
    if (!storageKey.startsWith('gcs:')) throw new Error('Storage key does not belong to Google Cloud Storage.');
    const objectKey = normalizeObjectKey(storageKey.slice('gcs:'.length));
    await this.bucket.file(objectKey).delete({ ignoreNotFound: true });
  }

  canDelete(storageKey: string): boolean { return storageKey.startsWith('gcs:'); }
}

export class RoutedDocumentStorage implements DocumentStorage {
  readonly provider: StorageProviderName;

  constructor(
    private readonly active: DocumentStorage,
    private readonly providers: Partial<Record<RemoteStorageProviderName, DocumentStorage>>,
  ) {
    this.provider = active.provider;
  }

  put(input: { localPath: string; objectKey: string; mimeType: string }) {
    return this.active.put(input);
  }

  async checkReady(): Promise<void> {
    if (!this.active.checkReady) throw new Error('Durable document storage readiness check is unavailable.');
    await this.active.checkReady();
  }

  createSignedUploadUrl(storageKey: string, mimeType: string, sizeBytes: number, expiresInSeconds: number) {
    const provider = this.providerFor(storageKey);
    if (!provider?.createSignedUploadUrl) throw new Error(`Direct uploads are not supported by storage provider: ${storageProviderForKey(storageKey)}.`);
    return provider.createSignedUploadUrl(storageKey, mimeType, sizeBytes, expiresInSeconds);
  }

  private providerFor(storageKey: string): DocumentStorage | null {
    const provider = storageProviderForKey(storageKey);
    if (!provider) return null;
    if (provider === 'local') return this.active.provider === 'local' ? this.active : null;
    return this.providers[provider] || null;
  }

  async createSignedUrl(storageKey: string, expiresInSeconds: number): Promise<string | null> {
    const provider = this.providerFor(storageKey);
    if (!provider) throw new Error(`Storage provider for document key is not configured: ${storageProviderForKey(storageKey)}.`);
    return provider.createSignedUrl(storageKey, expiresInSeconds);
  }

  async getObject(storageKey: string): Promise<Buffer> {
    const provider = this.providerFor(storageKey);
    if (!provider?.getObject) throw new Error(`Storage provider cannot read document key: ${storageProviderForKey(storageKey)}.`);
    return provider.getObject(storageKey);
  }

  async delete(storageKey: string): Promise<void> {
    const provider = this.providerFor(storageKey);
    if (!provider?.delete) throw new Error(`Storage provider cannot delete document key: ${storageProviderForKey(storageKey)}.`);
    return provider.delete(storageKey);
  }

  canDelete(storageKey: string): boolean {
    const provider = this.providerFor(storageKey);
    return Boolean(provider?.delete && provider.canDelete?.(storageKey));
  }
}

export function createDocumentStorage(env: NodeJS.ProcessEnv = process.env): DocumentStorage {
  const provider = (env.DOCUMENT_STORAGE_PROVIDER || 'local').toLowerCase() as StorageProviderName;
  let active: DocumentStorage;
  if (provider === 'local') active = new LocalDocumentStorage();
  else if (provider === 'supabase') {
    active = new SupabaseDocumentStorage(env.SUPABASE_URL || '', env.SUPABASE_SERVICE_ROLE_KEY || '', env.SUPABASE_STORAGE_BUCKET || '');
  } else if (provider === 'gcs') {
    active = new GcsDocumentStorage(env.GCS_BUCKET || '');
  } else {
    throw new Error(`Unsupported DOCUMENT_STORAGE_PROVIDER: ${provider}`);
  }

  const providers: Partial<Record<RemoteStorageProviderName, DocumentStorage>> = {};
  if (active.provider === 'supabase' || (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_STORAGE_BUCKET)) {
    providers.supabase = active.provider === 'supabase' ? active : new SupabaseDocumentStorage(env.SUPABASE_URL || '', env.SUPABASE_SERVICE_ROLE_KEY || '', env.SUPABASE_STORAGE_BUCKET || '');
  }
  if (active.provider === 'gcs') providers.gcs = active;
  else if (env.GCS_BUCKET) providers.gcs = new GcsDocumentStorage(env.GCS_BUCKET);
  return new RoutedDocumentStorage(active, providers);
}

export function buildTenantObjectKey(input: {
  tenantId: string;
  propertyId: string;
  documentId: string;
  originalFilename: string;
}): string {
  const extension = path.extname(input.originalFilename).toLowerCase().slice(0, 12);
  return `${input.tenantId}/${input.propertyId}/${input.documentId}${extension}`;
}
