import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { detectedDocumentMimeType, resolveDirectUploadLimit, resolveMultipartFileLimit, resolveUploadDirectory, VERCEL_MAX_REQUEST_BYTES, VERCEL_MULTIPART_FILE_BYTES } from '../src/upload-config.js';

test('Vercel upload staging uses ephemeral /tmp unless an explicit directory is set', () => {
  assert.equal(resolveUploadDirectory({ VERCEL: '1' }, '/srv/app'), path.join(os.tmpdir(), 'ojix-uploads'));
  assert.equal(resolveUploadDirectory({ VERCEL: '1', UPLOAD_DIR: '/custom/tmp' }, '/srv/app'), '/custom/tmp');
  assert.equal(resolveUploadDirectory({}, '/srv/app'), '/srv/app/uploads');
});

test('Vercel multipart files are kept below the 4.5 MB request cap', () => {
  assert.equal(VERCEL_MAX_REQUEST_BYTES, 4.5 * 1024 * 1024);
  assert.equal(VERCEL_MULTIPART_FILE_BYTES, 4 * 1024 * 1024);
  assert.equal(resolveMultipartFileLimit({ VERCEL: '1', MAX_UPLOAD_MB: '25' }), 4 * 1024 * 1024);
  assert.equal(resolveMultipartFileLimit({ VERCEL: '1', MAX_UPLOAD_MB: '2' }), 2 * 1024 * 1024);
  assert.equal(resolveMultipartFileLimit({ MAX_UPLOAD_MB: '25' }), 25 * 1024 * 1024);
});

test('direct-to-cloud upload limit is bounded for serverless content verification', () => {
  assert.equal(resolveDirectUploadLimit({}), 25 * 1024 * 1024);
  assert.equal(resolveDirectUploadLimit({ MAX_DIRECT_UPLOAD_MB: '80' }), 80 * 1024 * 1024);
  assert.equal(resolveDirectUploadLimit({ MAX_DIRECT_UPLOAD_MB: '101' }), 25 * 1024 * 1024);
});

test('direct-upload completion checks file signatures against declared MIME type', () => {
  assert.equal(detectedDocumentMimeType(Buffer.from('%PDF-1.7 synthetic')), 'application/pdf');
  assert.equal(detectedDocumentMimeType(Buffer.from([0xff,0xd8,0xff,0x00])), 'image/jpeg');
  assert.equal(detectedDocumentMimeType(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])), 'image/png');
  assert.equal(detectedDocumentMimeType(Buffer.from([0x49,0x49,0x2a,0x00])), 'image/tiff');
  assert.equal(detectedDocumentMimeType(Buffer.from('not a PDF')), null);
});
