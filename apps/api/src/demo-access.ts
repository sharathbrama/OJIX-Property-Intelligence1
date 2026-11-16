export const DEFAULT_DEMO_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_DEMO_SESSION_TTL_HOURS = 8;

/** Parse the hard session lifetime. Public demo access is intentionally capped at eight hours. */
export function resolveDemoSessionTtlMs(value: string | undefined): number {
  if (value == null || value.trim() === '') return DEFAULT_DEMO_SESSION_TTL_MS;
  const hours = Number(value);
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_DEMO_SESSION_TTL_HOURS) {
    throw new Error('PUBLIC_DEMO_SESSION_TTL_HOURS must be a whole number from 1 to 8.');
  }
  return hours * 60 * 60 * 1000;
}

/** A public demo API must point at a distinct database whose name is explicitly demo-only. */
export function isDedicatedDemoDatabase(databaseUrl: string | undefined, configuredName: string | undefined): boolean {
  if (!databaseUrl || !configuredName?.trim()) return false;
  try {
    const url = new URL(databaseUrl);
    if (!['mysql:', 'mariadb:'].includes(url.protocol)) return false;
    const actualName = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const expectedName = configuredName.trim();
    return actualName === expectedName && /demo/i.test(actualName);
  } catch {
    return false;
  }
}

export function isDemoTenantRequest(isDemo: boolean, sessionTenantId: string, requestedTenantId: string): boolean {
  return !isDemo || Boolean(sessionTenantId && requestedTenantId === sessionTenantId);
}

const DEMO_AUTH_ALLOWED_PATHS = new Set(['/demo/status', '/demo/login', '/me', '/logout', '/workspaces', '/activity']);
export function isDemoAuthRouteAllowed(path: string): boolean { return DEMO_AUTH_ALLOWED_PATHS.has(path); }

export function isDemoExternalShareAllowed(isDemo: boolean): boolean {
  return !isDemo;
}

export function resolveDemoWorkspaceRole(isPublicDemo: boolean, requestedRole?: string): string {
  // Public demo is deliberately a read-only Viewer session. Never derive its
  // role from client input or grant workspace/platform administration.
  return isPublicDemo ? 'viewer' : requestedRole || 'viewer';
}

const DEMO_READ_PERMISSIONS = new Set([
  'dashboard.view', 'properties.view', 'documents.view', 'documents.export',
  'findings.view', 'findings.export', 'reports.view', 'reports.export',
  'maps.view', 'legal.view', 'sources.view', 'workbench.view',
]);

/** Demo grants are additive only for approved reads; all writes stay denied. */
export function isDemoReadPermissionAllowed(isDemo: boolean, resource: string, action: string): boolean {
  return isDemo && DEMO_READ_PERMISSIONS.has(`${resource}.${action}`);
}

export function demoReadPermissions(): string[] { return [...DEMO_READ_PERMISSIONS]; }

export function demoSessionIsActive(expiresAt: number, now = Date.now()): boolean {
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function demoSessionExpiresAt(now: number, ttlMs: number): number {
  if (!Number.isFinite(now) || !Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > DEFAULT_DEMO_SESSION_TTL_MS) {
    throw new Error('Demo session lifetime must be positive and no longer than eight hours.');
  }
  return now + ttlMs;
}
