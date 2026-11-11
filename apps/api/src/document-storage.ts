import fs from 'node:fs/promises';
import path from 'node:path';

export type StorageProviderName = 'local' | 'supabase';

export interface StoredDocument {
  storageKey: string;
  provider: StorageProviderName;
}

export interface DocumentStorage {
  readonly provider: StorageProviderName;
  put(input: { localPath: string; objectKey: string; mimeType: string }): Promise<StoredDocument>;
  createSignedUrl(storageKey: string, expiresInSeconds: number): Promise<string | null>;
  delete?(storageKey: string): Promise<void>;
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

  async delete(storageKey: string): Promise<void> {
    if (!storageKey.startsWith('supabase:')) throw new Error('Storage key does not belong to Supabase.');
    const response = await this.fetchImpl(this.objectUrl(storageKey, 'object'), { method: 'DELETE', headers: this.headers() });
    if (!response.ok && response.status !== 404) throw new Error(`Supabase storage deletion failed (${response.status}).`);
  }
}

export function createDocumentStorage(env: NodeJS.ProcessEnv = process.env): DocumentStorage {
  const provider = (env.DOCUMENT_STORAGE_PROVIDER || 'local').toLowerCase();
  if (provider === 'local') return new LocalDocumentStorage();
  if (provider === 'supabase') {
    return new SupabaseDocumentStorage(
      env.SUPABASE_URL || '',
      env.SUPABASE_SERVICE_ROLE_KEY || '',
      env.SUPABASE_STORAGE_BUCKET || '',
    );
  }
  throw new Error(`Unsupported DOCUMENT_STORAGE_PROVIDER: ${provider}`);
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
