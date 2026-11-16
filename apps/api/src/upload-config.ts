import os from 'node:os';
import path from 'node:path';
import { Buffer } from 'node:buffer';

export const VERCEL_MAX_REQUEST_BYTES = 4.5 * 1024 * 1024;
// Leave headroom for multipart boundaries, form fields, and request headers.
export const VERCEL_MULTIPART_FILE_BYTES = 4 * 1024 * 1024;

export function resolveUploadDirectory(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): string {
  if (env.UPLOAD_DIR?.trim()) return path.resolve(cwd, env.UPLOAD_DIR.trim());
  if (env.VERCEL) return path.join(os.tmpdir(), 'ojix-uploads');
  return path.resolve(cwd, 'uploads');
}

export function resolveMultipartFileLimit(env: NodeJS.ProcessEnv = process.env): number {
  const configuredMb = Number(env.MAX_UPLOAD_MB || 25);
  const configuredBytes = Number.isFinite(configuredMb) && configuredMb > 0 ? configuredMb * 1024 * 1024 : 25 * 1024 * 1024;
  return env.VERCEL ? Math.min(configuredBytes, VERCEL_MULTIPART_FILE_BYTES) : configuredBytes;
}

export function resolveDirectUploadLimit(env: NodeJS.ProcessEnv = process.env): number {
  const configuredMb = Number(env.MAX_DIRECT_UPLOAD_MB || 25);
  // Completion verifies content and calculates SHA-256 in the function process.
  // Keep the maximum bounded so a caller cannot force unbounded memory use.
  return Number.isInteger(configuredMb) && configuredMb > 0 && configuredMb <= 100 ? configuredMb * 1024 * 1024 : 25 * 1024 * 1024;
}

export function detectedDocumentMimeType(content: Buffer): string | null {
  if (content.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) return 'image/jpeg';
  if (content.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png';
  if (content.subarray(0, 4).equals(Buffer.from([0x49,0x49,0x2a,0x00])) || content.subarray(0, 4).equals(Buffer.from([0x4d,0x4d,0x00,0x2a]))) return 'image/tiff';
  return null;
}
