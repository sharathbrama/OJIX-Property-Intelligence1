import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionEnvironment } from '../src/production-config.js';

const validProductionEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'mysql://app:secret@mysql.example.test:3306/ojix_property_mysql',
  DATABASE_SSL: 'true',
  CORS_ORIGIN: 'https://ojix-property-intelligence-ten.vercel.app',
  SMTP_HOST: 'smtp.example.test',
  SMTP_USER: 'smtp-user',
  SMTP_PASS: 'smtp-secret',
  DOCUMENT_STORAGE_PROVIDER: 'supabase',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'storage-secret',
  SUPABASE_STORAGE_BUCKET: 'private-documents',
  SUPER_ADMIN_EMAIL: 'admin@example.test',
  SUPER_ADMIN_PASSWORD: 'Safe!AdminPass2026',
});

test('production startup accepts complete remote TLS and private-storage configuration', () => {
  assert.doesNotThrow(() => validateProductionEnvironment(validProductionEnv()));
});

test('non-production startup does not require cloud environment variables', () => {
  assert.doesNotThrow(() => validateProductionEnvironment({ NODE_ENV: 'development' }));
});

test('production rejects missing database, SMTP, private storage, and bootstrap settings', () => {
  assert.throws(() => validateProductionEnvironment({ NODE_ENV: 'production' }), /DATABASE_URL.*CORS_ORIGIN.*SMTP_HOST.*DOCUMENT_STORAGE_PROVIDER.*SUPABASE_URL/s);
  const env = validProductionEnv();
  delete env.SUPER_ADMIN_PASSWORD;
  assert.throws(() => validateProductionEnvironment(env), /SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be configured together/);
});

test('production rejects local databases, disabled TLS, and insecure CORS origins', () => {
  const localDb = validProductionEnv();
  localDb.DATABASE_URL = 'mysql://app:secret@127.0.0.1:3306/ojix_property_mysql';
  assert.throws(() => validateProductionEnvironment(localDb), /remote MySQL/);

  const plaintextDb = validProductionEnv();
  plaintextDb.DATABASE_SSL = 'false';
  assert.throws(() => validateProductionEnvironment(plaintextDb), /DATABASE_SSL=true/);

  for (const origin of ['*', 'http://ojix.example.test', 'https://localhost:5173', 'https://ojix.example.test/path']) {
    const env = validProductionEnv();
    env.CORS_ORIGIN = origin;
    assert.throws(() => validateProductionEnvironment(env), /exact HTTPS frontend origins/);
  }
});
