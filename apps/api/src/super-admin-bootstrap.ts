import crypto from 'node:crypto';
import { z } from 'zod';
import { hashPassword } from './auth-security.js';

const emailSchema = z.string().trim().email().max(255).transform(value => value.toLowerCase());
const MIN_BOOTSTRAP_PASSWORD_LENGTH = 12;
const PLATFORM_ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';

export type BootstrapConnection = {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
  query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
};

export type BootstrapPool = {
  getConnection(): Promise<BootstrapConnection>;
};

export function configuredSuperAdminEmails(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const emails = [env.SUPER_ADMIN_EMAIL || '', ...(env.SUPER_ADMIN_EMAILS || '').split(',')];
  return new Set(emails.map(value => value.trim().toLowerCase()).filter(Boolean));
}

export function isConfiguredSuperAdminEmail(email: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(email && configuredSuperAdminEmails(env).has(email.trim().toLowerCase()));
}

export function validateSuperAdminBootstrapEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const emailValue = env.SUPER_ADMIN_EMAIL?.trim() || '';
  const password = env.SUPER_ADMIN_PASSWORD || '';
  const hasEmail = Boolean(emailValue);
  const hasPassword = Boolean(password);

  if (hasEmail !== hasPassword) {
    throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be configured together.');
  }
  if (!hasEmail) return null;

  const parsedEmail = emailSchema.safeParse(emailValue);
  if (!parsedEmail.success) throw new Error('SUPER_ADMIN_EMAIL must be a valid email address.');
  if (password.length < MIN_BOOTSTRAP_PASSWORD_LENGTH || password.length > 128) {
    throw new Error(`SUPER_ADMIN_PASSWORD must contain ${MIN_BOOTSTRAP_PASSWORD_LENGTH} to 128 characters.`);
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error('SUPER_ADMIN_PASSWORD must include uppercase and lowercase letters, a number, and a special character.');
  }
  return { email: parsedEmail.data, password };
}

/**
 * Idempotently provisions the configured platform identity. Existing passwords
 * are never replaced during a restart. Only the explicitly configured email
 * receives the isolated platform role. Workspace access requires a separate,
 * explicit workspace membership and the role is never mapped to Owner.
 */
export async function bootstrapSuperAdmin(
  pool: BootstrapPool,
  env: NodeJS.ProcessEnv = process.env,
  dependencies: { hash?: (password: string) => string; newId?: () => string } = {},
) {
  const credentials = validateSuperAdminBootstrapEnvironment(env);
  if (!credentials) return { configured: false, created: false };

  const connection = await pool.getConnection();
  let created = false;
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT IGNORE INTO organizations (id,name,slug)
       VALUES (?,?,?)`,
      [PLATFORM_ORGANIZATION_ID, 'OJIX Platform', 'ojix-platform'],
    );
    const organization = await connection.query('SELECT id FROM organizations WHERE id=? LIMIT 1', [PLATFORM_ORGANIZATION_ID]);
    if (!organization.rowCount) throw new Error('Could not find or create the OJIX platform organization. Check for a conflicting organization slug.');

    let account = await connection.query('SELECT id,status,email_verified FROM user_accounts WHERE email=? LIMIT 1 FOR UPDATE', [credentials.email]);
    if (!account.rowCount) {
      const userId = (dependencies.newId || crypto.randomUUID)();
      const passwordHash = (dependencies.hash || hashPassword)(credentials.password);
      await connection.query(
        `INSERT IGNORE INTO user_accounts (id,email,full_name,password_hash,email_verified,status,otp_required)
         VALUES (?,?,?, ?,TRUE,'active',TRUE)`,
        [userId, credentials.email, 'OJIX Super Admin', passwordHash],
      );
      account = await connection.query('SELECT id,status,email_verified FROM user_accounts WHERE email=? LIMIT 1 FOR UPDATE', [credentials.email]);
      if (!account.rowCount) throw new Error('Could not create the configured Super Admin account.');
      created = String(account.rows[0].id) === userId;
    }

    const user = account.rows[0];
    if (user.status !== 'active') throw new Error('The configured Super Admin account already exists but is disabled. Re-enable it through an authorized account recovery process.');
    if (!user.email_verified) throw new Error('The configured Super Admin account already exists but its email is not verified. Verify the account before bootstrapping it.');

    const existingMembership=await connection.query('SELECT id,role,status FROM org_memberships WHERE organization_id=? AND user_uid=? LIMIT 1 FOR UPDATE',[PLATFORM_ORGANIZATION_ID,user.id]);
    if(existingMembership.rowCount&&existingMembership.rows[0].role!=='super_admin')throw new Error('The configured Super Admin identity already has a different platform role; resolve the membership through controlled database governance.');
    if(!existingMembership.rowCount){
      const membershipId=(dependencies.newId || crypto.randomUUID)();
      await connection.query(
        `INSERT IGNORE INTO org_memberships (id,organization_id,user_uid,email,role,status)
         VALUES (?,?,?,?,'super_admin','active')`,
        [membershipId, PLATFORM_ORGANIZATION_ID, user.id, credentials.email],
      );
      await connection.query('INSERT INTO audit_events (id,actor_uid,tenant_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?,?)',[
        (dependencies.newId || crypto.randomUUID)(),user.id,PLATFORM_ORGANIZATION_ID,'super_admin.bootstrap_provisioned','org_membership',membershipId,JSON.stringify({email:credentials.email,reason:'Configured first-time platform bootstrap'})
      ]);
    }
    await connection.commit();
    return { configured: true, created, userId: String(user.id), email: credentials.email, membershipStatus: existingMembership.rows[0]?.status || 'active' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
