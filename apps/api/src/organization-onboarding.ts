import crypto from 'node:crypto';

export interface OnboardingConnection {
  query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
}

export async function provisionOrganizationOwner(
  connection: OnboardingConnection,
  input: { name: string; email: string; userUid: string },
): Promise<string> {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 160) throw new Error('Organization name must contain 2 to 160 characters.');
  const organizationId = crypto.randomUUID();
  const slugBase = name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'organization';
  const slug = `${slugBase}-${organizationId.slice(0, 8)}`;
  await connection.query('INSERT INTO organizations (id,name,slug) VALUES (?,?,?)', [organizationId, name, slug]);
  await connection.query("INSERT INTO org_memberships (id,organization_id,user_uid,email,role,status) VALUES (?,?,?,?, 'owner','active')", [crypto.randomUUID(), organizationId, input.userUid, input.email]);
  await connection.query('INSERT INTO audit_events (id,actor_uid,tenant_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?,?)', [crypto.randomUUID(), input.userUid, organizationId, 'auth.organization_created', 'organization', organizationId, JSON.stringify({ name, ownerUid: input.userUid, source: 'verified_registration' })]);
  return organizationId;
}
