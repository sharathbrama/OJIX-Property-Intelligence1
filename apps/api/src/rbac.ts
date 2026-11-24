export const RBAC_ROLES = ['super_admin','owner','admin','lawyer','analyst','operations','consultant','support','data_steward','viewer'] as const;
export type RbacRole = typeof RBAC_ROLES[number];
export const RBAC_ACTIONS = ['view','create','upload','edit','delete','review','approve','reject','export','manage','retry_ocr','configure'] as const;
export type RbacAction = typeof RBAC_ACTIONS[number];
export type Permission = `${string}.${RbacAction}`;

const grants = (items: string[]) => new Set(items as Permission[]);
export const DEFAULT_ROLE_PERMISSIONS: Record<RbacRole, Set<Permission>> = {
  super_admin: grants(['super_admin.view','super_admin.create','super_admin.edit','super_admin.delete','super_admin.export','super_admin.manage','super_admin.configure']),
  owner: grants(['dashboard.view','properties.view','properties.create','properties.upload','properties.edit','properties.delete','properties.export','properties.manage','documents.view','documents.upload','documents.edit','documents.delete','documents.review','documents.approve','documents.reject','documents.export','documents.retry_ocr','findings.view','findings.create','findings.edit','findings.delete','findings.review','findings.approve','findings.reject','findings.export','legal.view','legal.create','legal.edit','legal.review','legal.approve','legal.reject','reports.view','reports.create','reports.delete','reports.export','reports.approve','maps.view','maps.create','maps.configure','sources.view','sources.configure','members.view','members.manage','permissions.view','permissions.configure','audit.view','settings.view','settings.configure','ocr.view','ocr.configure','ocr.retry_ocr','support.view','support.retry_ocr','workbench.view','workbench.create','workbench.edit','workbench.delete','workbench.manage','sessions.view','sessions.manage','retention.view','retention.configure','admin.view','admin.manage','rtc.view','rtc.create']),
  admin: grants(['dashboard.view','properties.view','properties.create','properties.upload','properties.edit','properties.export','properties.manage','documents.view','documents.upload','documents.edit','documents.delete','documents.review','documents.export','documents.retry_ocr','findings.view','findings.create','findings.edit','findings.delete','findings.review','findings.export','legal.view','legal.create','legal.edit','legal.review','legal.approve','legal.reject','reports.view','reports.create','reports.export','maps.view','maps.configure','sources.view','sources.configure','members.view','members.manage','permissions.view','permissions.configure','audit.view','settings.view','settings.configure','ocr.view','ocr.configure','ocr.retry_ocr','workbench.view','workbench.create','workbench.edit','workbench.manage','sessions.view','sessions.manage','retention.view','retention.configure','admin.view','admin.manage','rtc.view','rtc.create']),
  lawyer: grants(['dashboard.view','properties.view','properties.edit','properties.upload','documents.view','documents.upload','documents.edit','documents.review','documents.approve','documents.reject','documents.export','findings.view','findings.review','findings.approve','findings.reject','findings.export','legal.view','legal.create','legal.edit','legal.review','legal.approve','legal.reject','reports.view','reports.create','reports.export','reports.approve','maps.view','sources.view','workbench.view','workbench.create','workbench.edit','workbench.manage']),
  analyst: grants(['dashboard.view','properties.view','properties.create','properties.edit','properties.upload','documents.view','documents.upload','documents.edit','documents.review','documents.export','documents.retry_ocr','findings.view','findings.create','findings.edit','findings.review','findings.export','maps.view','maps.create','sources.view','legal.view','legal.create','reports.view','reports.create','workbench.view','workbench.create','workbench.edit']),
  operations: grants(['dashboard.view','properties.view','documents.view','documents.upload','documents.retry_ocr','workbench.view','workbench.edit']),
  consultant: grants(['dashboard.view','properties.view','documents.view','documents.export','findings.view','findings.export','reports.view','reports.create','reports.delete','reports.export','reports.approve','maps.view','maps.create','workbench.view']),
  support: grants(['dashboard.view','properties.view','support.view','support.retry_ocr']),
  data_steward: grants(['dashboard.view','properties.view','documents.view','maps.view','sources.view','sources.configure','ocr.view','ocr.configure','admin.view']),
  viewer: grants(['dashboard.view','properties.view','documents.view','documents.export','findings.view','findings.export','reports.view','reports.export','maps.view']),
};

export type PermissionTarget = { resource: string; action: RbacAction };
const actionFor = (method: string, pathname: string, body: any): RbacAction => {
  const path = pathname.split('?')[0];
  if (/\/export(?:\/|$)/i.test(path) || /\/reports?\/[^/]+\/export$/i.test(path)) return 'export';
  if (/\/signed-url(?:\/|$)|\/screen-point(?:\/|$)|\/(?:search|query)(?:\/|$)/i.test(path)) return 'view';
  if (/\/reject(?:\/|$)/i.test(path)) return 'reject';
  if (/\/retry(?:\/|$)/i.test(path) || /\/jobs(?:\/|$)/i.test(path) && method === 'POST' || method === 'POST' && /\/extract(?:\/|$)|\/rebuild-fields(?:\/|$)/i.test(path)) return 'retry_ocr';
  if (/\/review(?:\/|$)/i.test(path) && method !== 'GET') {
    const decision=String(body?.decision||'').toLowerCase();
    return decision==='approve'?'approve':decision==='reject'?'reject':'review';
  }
  if (/\/submit-review(?:\/|$)|\/submit(?:\/|$)/i.test(path) && method !== 'GET') return 'review';
  if (method === 'GET' || method === 'HEAD') return 'view';
  if (method === 'DELETE') return 'delete';
  if (/\/documents(?:\/|$)/i.test(path) && method === 'POST') return 'upload';
  if (/\/permissions(?:\/|$)|\/mappings(?:\/|$)|\/document-types(?:\/|$)|\/settings(?:\/|$)|\/governance(?:\/|$)|\/retention(?:\/|$)/i.test(path)) return 'configure';
  if (/\/members(?:\/|$)|\/sessions(?:\/|$)|\/assignments?(?:\/|$)|\/purge(?:\/|$)/i.test(path)) return 'manage';
  if (method === 'POST') return 'create';
  if (method === 'PATCH' || method === 'PUT') return 'edit';
  return 'view';
};

export function permissionForRequest(method: string, pathname: string, body?: any): PermissionTarget | null {
  const path=pathname.split('?')[0];
  if (/^\/api\/(?:auth|health|healthz|readyz|shared-reports)(?:\/|$)/.test(path)) return null;
  if (path.startsWith('/api/super-admin/')) return {resource:'super_admin',action:actionFor(method,path,body)};
  // Unknown routes fail closed; add an explicit mapping when a new API surface is introduced.
  let resource='api';
  if(/^\/api\/(?:overview|owner\/dashboard)(?:\/|$)/.test(path)) resource='dashboard';
  if (/^\/api\/(?:properties|matters)(?:\/|$)/.test(path)) resource='properties';
  if (/^\/api\/(?:documents|properties\/[^/]+\/documents)(?:\/|$)/.test(path)) resource='documents';
  if (/^\/api\/(?:findings|consultant\/issues)(?:\/|$)/.test(path)) resource='findings';
  if (/^\/api\/(?:legal-research|properties\/[^/]+\/(?:title-chain|title-events|workflow|discrepancies))(?:\/|$)/.test(path)) resource='legal';
  if (/^\/api\/(?:consultant\/reports|consultant\/shares|properties\/[^/]+\/(?:report|due-diligence-report|due-diligence-snapshot))(?:\/|$)/.test(path)) resource='reports';
  if (/^\/api\/(?:spatial|map|properties\/[^/]+\/(?:spatial-screening|parcel-geometry|parcels))(?:\/|$)/.test(path)) resource='maps';
  if (/^\/api\/(?:source-registry|rtc)(?:\/|$)/.test(path)) resource='sources';
  if (/^\/api\/ocr(?:\/|$)/.test(path)) resource='ocr';
  if (/^\/api\/support(?:\/|$)/.test(path)) resource='support';
  if (/^\/api\/workbench(?:\/|$)/.test(path)) resource='workbench';
  if (/^\/api\/admin\/documents(?:\/|$)/.test(path)) resource='documents';
  else if (/^\/api\/admin\/permissions(?:\/|$)/.test(path)) resource='permissions';
  else if (/^\/api\/admin\/members(?:\/|$)|^\/api\/admin\/invitations(?:\/|$)/.test(path)) resource='members';
  else if (/^\/api\/admin\/audit(?:\/|$)|^\/api\/admin\/security-events(?:\/|$)/.test(path)) resource='audit';
  else if (/^\/api\/admin\/sessions(?:\/|$)/.test(path)) resource='sessions';
  else if (/^\/api\/admin\/retention(?:\/|$)/.test(path)) resource='retention';
  else if (/^\/api\/admin(?:\/|$)/.test(path)) resource='admin';
  else if (/^\/api\/settings(?:\/|$)/.test(path)) resource='settings';
  else if (/^\/api\/locations(?:\/|$)/.test(path)) resource='properties';
  const action=actionFor(method,path,body);
  if(/^\/api\/admin(?:\/|$)/.test(path)&&resource==='admin'&&method!=='GET')return {resource,action:'manage'};
  return {resource,action};
}

export function hasPermission(role: string, resource: string, action: string, override?: boolean): boolean {
  if (!RBAC_ROLES.includes(role as RbacRole)) return false;
  const grantedByPolicy=DEFAULT_ROLE_PERMISSIONS[role as RbacRole].has(`${resource}.${action}` as Permission);
  // Workspace overrides can restrict or restore an approved grant, but cannot expand
  // a role beyond its server-side policy baseline.
  if (override === false) return false;
  return grantedByPolicy;
}

export function isPermissionAction(value: string): value is RbacAction {
  return (RBAC_ACTIONS as readonly string[]).includes(value);
}
