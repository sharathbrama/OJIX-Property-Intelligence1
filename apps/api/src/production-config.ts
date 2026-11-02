import { validateSuperAdminBootstrapEnvironment } from './super-admin-bootstrap.js';

export function validateProductionEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const missing: string[] = [];
  if (!env.DATABASE_URL?.trim()) missing.push('DATABASE_URL');
  if (!env.CORS_ORIGIN?.trim()) missing.push('CORS_ORIGIN');
  if (!env.SMTP_HOST?.trim() || !env.SMTP_USER?.trim() || !env.SMTP_PASS) missing.push('SMTP_HOST, SMTP_USER, SMTP_PASS');
  if ((env.DOCUMENT_STORAGE_PROVIDER || '').toLowerCase() !== 'supabase') missing.push('DOCUMENT_STORAGE_PROVIDER=supabase');
  if (!env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !env.SUPABASE_STORAGE_BUCKET?.trim()) missing.push('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET');
  if (missing.length) throw new Error(`Production configuration is incomplete: ${[...new Set(missing)].join('; ')}.`);

  const origins = env.CORS_ORIGIN!.split(',').map(value => value.trim()).filter(Boolean);
  if (!origins.length || origins.some(origin => {
    try {
      const parsed = new URL(origin);
      return origin === '*' || parsed.protocol !== 'https:' || parsed.origin !== origin || ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname.toLowerCase());
    } catch { return true; }
  })) {
    throw new Error('Production CORS_ORIGIN must contain exact HTTPS frontend origins only.');
  }
  const databaseUrl = new URL(env.DATABASE_URL!);
  const databaseHost = databaseUrl.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (databaseUrl.protocol !== 'mysql:' || !databaseHost || ['localhost', '127.0.0.1', '::1'].includes(databaseHost)) {
    throw new Error('Production DATABASE_URL must point to a remote MySQL or MariaDB host.');
  }
  if (env.DATABASE_SSL?.toLowerCase() !== 'true') {
    throw new Error('Production DATABASE_SSL=true is required for encrypted MySQL connections.');
  }
  validateSuperAdminBootstrapEnvironment(env, true);
}
