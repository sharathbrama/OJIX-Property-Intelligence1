import swaggerUi from 'swagger-ui-express';
import { openapiSpec } from './swagger/openapi.js';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import { z } from 'zod';
import { generateOtp, generateOtpSalt, hashOtp, hashPassword, resolveDemoCredential, verifyOtp, verifyPassword } from './auth-security.js';
import { sendOtpEmailWithSmtp } from './otp-email.js';
import { calculateRisk, buildBaselineFindings, type RiskFinding } from './risk-engine.js';
import { extractDocument, type ExtractionInput } from './document-extractor.js';
import type { ExtractedDocumentFields, KarnatakaDocumentType } from './types.js';
import {
  buildTitleDAG,
  detectTitleGaps,
  normalizePartyName,
  recordReviewerDispute,
  type TitleEvent,
  type TitleGap,
} from './title-engine.js';
import {
  screenSpatialBuffers,
  validateCadastralGeoJSON,
  type SpatialScreeningResult,
  type SpatialScreeningLayerInput,
  type SpatialLayerType,
} from './spatial-rules-engine.js';
import {
  parseKarnatakaLandExtent,
  compareExtents,
  compareBoundaries,
  detectCrossDocumentDiscrepancies,
  recordDiscrepancyReview,
  calculateRiskScore,
  type DiscrepancyFinding,
  type RiskScoreResult,
} from './discrepancy-engine.js';
import {
  createDueDiligenceSnapshot,
  generateDueDiligenceReport,
  computeSha256Checksum,
  type DueDiligenceReportSnapshot,
} from './report-generator.js';
import { legalResearchEngine, type StatutoryProvision } from './legal-research-engine.js';
import { sourceRegistryEngine, type RegistryName, type RegistryVerificationResult, type DirectRegistryQueryParams } from './source-registry-engine.js';
import { retrieveRtc, rtcSearchSchema } from './rtc-retrieval-service.js';
import { runLocalOcr } from './local-ocr.js';
import { buildTenantObjectKey, createDocumentStorage } from './document-storage.js';


dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env'), override: false });

const app = express();

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

const port = Number(process.env.PORT || 4000);
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
const documentStorage = createDocumentStorage();

fs.mkdirSync(uploadDir, { recursive: true });

function pendingDocumentFields(_documentId: string, documentType: string, classificationConfidence: number): ExtractedDocumentFields {
  return {
    documentType: documentType as KarnatakaDocumentType,
    documentNumber: 'Not recorded',
    parties: [],
    propertySchedule: {
      surveyNumber: 'Not recorded',
      village: 'Not recorded',
      extent: { rawText: '', normalizedSqFt: 0 },
      boundaries: { north: '', south: '', east: '', west: '' },
    },
    overallConfidence: 0,
    fieldConfidence: {
      documentType: classificationConfidence,
      documentNumber: 0,
      parties: 0,
      surveyNumber: 0,
      extent: 0,
      boundaries: 0,
      dates: 0,
    },
    fieldAnchors: {},
    extractionMetadata: {
      source: 'pending',
      status: 'manual_review',
      message: 'Local Kannada and English OCR is ready. Extracted facts still require reviewer confirmation.',
    },
    reviewState: { isVerified: false, overrides: {} },
  };
}

function usableExtractedText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (text.length < 20 || text.startsWith('%PDF-')) return '';
  const printable = [...text.slice(0, 4000)].filter(char => /[\p{L}\p{N}\p{P}\p{Z}\n\r\t]/u.test(char)).length;
  return printable / Math.min(text.length, 4000) >= 0.85 ? text : '';
}

type DbResult = {
  rows: any[];
  rowCount: number;
};

const jsonColumns = new Set([
  'details', 'metadata', 'extracted_fields', 'from_parties', 'to_parties',
  'query_params', 'matched_record', 'discrepancies', 'parcel_geojson',
  'search_criteria', 'retrieved_data', 'source_payload',
]);

function parseMariaDbJsonRows(rows: any[]): any[] {
  return rows.map(row => {
    if (!row || typeof row !== 'object') return row;
    for (const key of jsonColumns) {
      if (typeof row[key] !== 'string') continue;
      try { row[key] = JSON.parse(row[key]); } catch { /* preserve malformed legacy text */ }
    }
    return row;
  });
}

const mysqlPool = process.env.DATABASE_URL
  ? mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000,
    })
  : null;

const pool = mysqlPool
  ? {
      async query(sql: string, params: any[] = []): Promise<DbResult> {
        const [rows] = await mysqlPool.query(sql, params);

        if (Array.isArray(rows)) {
          return {
            rows: parseMariaDbJsonRows(rows),
            rowCount: rows.length,
          };
        }

        const result = rows as any;

        return {
          rows: [],
          rowCount: result.affectedRows ?? 0,
        };
      },

      async end() {
        await mysqlPool.end();
      },
      async getConnection() {
        const connection=await mysqlPool.getConnection();
        return {
          async beginTransaction(){await connection.beginTransaction();},
          async commit(){await connection.commit();},
          async rollback(){await connection.rollback();},
          async query(sql:string,params:any[]=[]):Promise<DbResult>{
            const [rows]=await connection.query(sql,params);
            if(Array.isArray(rows))return{rows:parseMariaDbJsonRows(rows),rowCount:rows.length};
            const result=rows as any;return{rows:[],rowCount:result.affectedRows??0};
          },
          release(){connection.release();}
        };
      },
    }
  : null;
// Schema changes are managed by database/mysql-schema.sql. Startup deliberately
// avoids DDL so an existing MariaDB database is never recreated or altered.
let firebaseAuth: any = null;
if (process.env.FIREBASE_PROJECT_ID) {
  try {
    const admin = (await import('firebase-admin')) as any;
    if (!admin.getApps().length) admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    firebaseAuth = admin.getAuth();
  } catch (e) { console.error('Firebase Auth initialisation failed; refusing production startup.', e); process.exit(1); }
}

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
const allowedCorsOrigins = corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS policy.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({
  windowMs: 60_000,
  limit: process.env.NODE_ENV === 'production' ? (process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 120) : 10_000,
  skip: (req) => {
    if (process.env.NODE_ENV === 'test') return true;
    if (process.env.NODE_ENV !== 'production') return true;
    const clientIp = req.ip || req.socket?.remoteAddress || '';
    if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.includes('127.0.0.1')) return true;
    if (req.headers['x-test-suite'] === 'true') return true;
    return false;
  },
  standardHeaders: true,
  legacyHeaders: false,
}));
const rtcRateLimit = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
const loginOtpRequestRateLimit = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test' });
const loginOtpVerifyRateLimit = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test' });

export const DUMMY_ACCOUNTS = [
  {
    uid: 'user-super-admin',
    email: 'mrsharath3126@gmail.com',
    name: 'Sharath — Super Admin',
    designation: 'Platform Administrator',
    role: 'owner',
    avatar: 'SA',
    description: 'Platform Super Admin — authorized platform-wide controls.',
    isSuperAdmin: true,
  },
  {
    uid: 'user-owner',
    email: 'mrsharath3126@gmail.com',
    name: 'Sharath — Owner',
    designation: 'Managing Partner',
    role: 'owner',
    avatar: 'RS',
    description: 'Workspace Owner — full tenant and governance administration, deletion, and system authorization.'
  },
  {
    uid: 'user-admin',
    email: 'mrsharath3126@gmail.com',
    name: 'Sharath — Admin',
    designation: 'Firm Administrator',
    role: 'admin',
    avatar: 'PN',
    description: 'Firm Administrator — workspace settings, GIS configurations, member governance, and data export.'
  },
  {
    uid: 'user-lawyer',
    email: 'mrsharath3126@gmail.com',
    name: 'Sharath — Lawyer',
    designation: 'Senior Legal Reviewer',
    role: 'lawyer',
    avatar: 'AR',
    description: 'Senior Legal Counsel — dispute/verify title chain events, override OCR extractions, and sign off reports.'
  },
  {
    uid: 'user-analyst',
    email: 'mrsharath3126@gmail.com',
    name: 'Sharath — Analyst',
    designation: 'Due Diligence Analyst',
    role: 'analyst',
    avatar: 'KR',
    description: 'Due Diligence Analyst — case intake, document upload, trigger preliminary analyses, and run registry sync.'
  },
  {
    uid: 'user-operations',
    email: 'mrsharath3126@gmail.com',
    name: 'Sharath — Operations',
    designation: 'Document Intake Specialist',
    role: 'operations',
    avatar: 'MK',
    description: 'Paralegal / Operations — bulk document intake, property assignment, metadata checks, and processing follow-up.'
  },
  {
    uid: 'user-consultant',
    email: 'mrsharath3126@gmail.com',
    name: 'Sharath — Consultant',
    designation: 'Property Consultant',
    role: 'consultant',
    avatar: 'SH',
    description: 'Property Consultant — matter access, client-ready dossier preparation, issue-list review, and approved exports.'
  },
  {
    uid: 'user-support',
    email: 'mrsharath3126@gmail.com',
    name: 'Sharath — Support',
    designation: 'OJIX Support Engineer',
    role: 'support',
    avatar: 'ND',
    description: 'OJIX Support — time-limited, read-only diagnostics with no business-data access by default.'
  },
  {
    uid: 'user-data-steward',
    email: 'mrsharath3126@gmail.com',
    name: 'Sharath — Data Steward',
    designation: 'OJIX Data Steward',
    role: 'data_steward',
    avatar: 'AI',
    description: 'OJIX Data Steward — source mappings, rule configuration, ingestion quality, and reference-data governance.'
  },
  {
    uid: 'user-viewer',
    email: 'mrsharath3126@gmail.com',
    name: 'Sharath — Viewer',
    designation: 'Client / Audit Inspector',
    role: 'viewer',
    avatar: 'VM',
    description: 'External Auditor / Read-Only Client — inspect evidence, view map layers and reports (all mutations blocked).'
  }
];

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
    tenantId?: string;
    role?: string;
    isSuperAdmin?: boolean;
  };
}
const supportSessions = new Map<string, number>();
const authSessions = new Map<string, { id:string; uid:string; email:string; name:string; role:string; tenantId:string; expiresAt:number; lastActivityAt:number }>();
const SUPPORT_SESSION_MS = 60 * 60 * 1000;
const AUTH_SESSION_MS = 8 * 60 * 60 * 1000;
const OWNER_INACTIVITY_EXPIRY_MS = 5 * 60_000 + 30_000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;
const OTP_REQUEST_WINDOW_MINUTES = 15;
const DEFAULT_ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';

class OtpDeliveryError extends Error {
  constructor(message: string) { super(message); this.name = 'OtpDeliveryError'; }
}

async function deliverOtpEmail(email:string, name:string, otp:string, purpose:'login'|'registration'|'password_reset') {
  const smtpUser=process.env.SMTP_USER?.trim();
  const smtpPass=process.env.SMTP_PASS?.trim();
  if (!smtpUser || !smtpPass) throw new OtpDeliveryError('Email OTP delivery is not configured. Set SMTP_USER and SMTP_PASS, then restart the API.');
  const host=process.env.SMTP_HOST?.trim() || (smtpUser.endsWith('@gmail.com')?'smtp.gmail.com':'');
  const port=Number(process.env.SMTP_PORT || (host==='smtp.gmail.com'?465:587));
  if (!host || !Number.isInteger(port) || port<1 || port>65535) throw new OtpDeliveryError('SMTP configuration is invalid. Set SMTP_HOST and a valid SMTP_PORT.');
  const secure=process.env.SMTP_SECURE ? process.env.SMTP_SECURE==='true' : port===465;
  try { await sendOtpEmailWithSmtp({host,port,secure,user:smtpUser,pass:smtpPass},{from:process.env.SMTP_FROM?.trim()||smtpUser,to:email,name,otp,purpose}); }
  catch { throw new OtpDeliveryError('The verification email could not be delivered. Check the SMTP provider configuration.'); }
  return { delivered:true, mode:'email' as const };
}

async function deliverOtpSms(phone:string, name:string, otp:string) {
  const accountSid=process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken=process.env.TWILIO_AUTH_TOKEN?.trim();
  const from=process.env.TWILIO_FROM_NUMBER?.trim();
  const messagingServiceSid=process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  if(!accountSid||!authToken||(!from&&!messagingServiceSid))throw new OtpDeliveryError('SMS OTP delivery is not configured. Add Twilio credentials and restart the API.');
  const body=new URLSearchParams({To:phone,Body:`OJIX sign-in code for ${name}: ${otp}. It expires in 10 minutes. Never share this code.`});
  if(messagingServiceSid)body.set('MessagingServiceSid',messagingServiceSid);else body.set('From',from!);
  const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!response.ok)throw new OtpDeliveryError('The SMS verification code could not be delivered. Check the Twilio sender and account configuration.');
  return {delivered:true,mode:'sms' as const};
}

const maskEmail=(value:string)=>{const[local,domain]=value.split('@');return `${local.slice(0,2)}${'*'.repeat(Math.max(2,local.length-2))}@${domain}`;};
const maskPhone=(value:string)=>`${value.slice(0,Math.max(0,value.length-4)).replace(/\d/g,'•')}${value.slice(-4)}`;

async function authGuard(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  let identity: { uid: string; email?: string; name?: string } | null = null;
  const authHeader = authReq.header('authorization') || '';
  const xUserUid = authReq.header('x-user-uid');

  if (xUserUid) {
    if (process.env.NODE_ENV === 'production') return res.status(401).json({ error: 'Development identity headers are disabled.' });
    const matched = DUMMY_ACCOUNTS.find(a => a.uid === xUserUid);
    identity = {
      uid: xUserUid,
      email: matched?.email || `${xUserUid}@ojix.local`,
      name: matched?.name
    };
  } else if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
    const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    let session=authSessions.get(rawToken);
    if (!session && pool && rawToken.startsWith('ojix-')) {
      const restored=await pool.query(
        `SELECT s.id,s.user_uid,s.tenant_id,s.expires_at,s.last_activity_at,m.email,m.role,u.full_name
         FROM authentication_sessions s
         JOIN org_memberships m ON m.user_uid=s.user_uid AND m.organization_id=s.tenant_id AND m.status='active'
         LEFT JOIN user_accounts u ON u.id=s.user_uid
         WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>NOW(6) LIMIT 1`,
        [crypto.createHash('sha256').update(rawToken).digest('hex')]
      );
      if (restored.rowCount) {
        const row=restored.rows[0];
        const dummy=DUMMY_ACCOUNTS.find(account=>account.uid===row.user_uid);
        session={id:row.id,uid:row.user_uid,email:row.email||dummy?.email||'',name:row.full_name||dummy?.name||row.email||row.user_uid,role:row.role,tenantId:row.tenant_id,expiresAt:new Date(row.expires_at).getTime(),lastActivityAt:new Date(row.last_activity_at).getTime()};
        authSessions.set(rawToken,session);
      }
    }
    if (session && session.expiresAt > Date.now()) {
      if(session.role==='owner'&&Date.now()-session.lastActivityAt>OWNER_INACTIVITY_EXPIRY_MS){if(pool)await pool.query("UPDATE authentication_sessions SET revoked_at=NOW(6),revoked_by_uid=?,revoke_reason='Inactivity timeout' WHERE id=? AND revoked_at IS NULL",[session.uid,session.id]);authSessions.delete(rawToken);return res.status(401).json({error:'Your session has expired due to inactivity. Please log in again.',code:'SESSION_INACTIVITY_EXPIRED'});}
      if(pool){const durable=await pool.query('SELECT id FROM authentication_sessions WHERE id=? AND revoked_at IS NULL AND expires_at>NOW(6)',[session.id]);if(!durable.rowCount){authSessions.delete(rawToken);return res.status(401).json({error:'Session has been revoked or expired.'});}if(session.role!=='owner')await pool.query('UPDATE authentication_sessions SET last_activity_at=NOW(6) WHERE id=?',[session.id]);}
      identity={uid:session.uid,email:session.email,name:session.name};
    }
    else if (session) authSessions.delete(rawToken);
    if (!identity) {
      if (firebaseAuth) {
        try {
          const decoded = await firebaseAuth.verifyIdToken(rawToken);
          identity = { uid: decoded.uid, email: decoded.email, name: decoded.name };
        } catch {
          return res.status(401).json({ error: 'Invalid or expired identity token.' });
        }
      } else {
        return res.status(401).json({ error: 'Invalid or expired identity token.' });
      }
    }
  }

  if (!identity) {
    return res.status(401).json({ error: firebaseAuth ? 'Bearer token required.' : 'Sign in is required.' });
  }

  const dummyIdentity = DUMMY_ACCOUNTS.find(account => account.uid === identity?.uid);
  if (dummyIdentity?.role === 'support') {
    const expiresAt = supportSessions.get(dummyIdentity.uid) || 0;
    if (expiresAt <= Date.now()) return res.status(401).json({ error: 'Support access has expired. Sign in again to request a new time-limited session.' });
  }

  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const membership = await pool.query(
    'SELECT organization_id, role, email, status FROM org_memberships WHERE user_uid=? ORDER BY created_at LIMIT 1',
    [identity.uid]
  );
  if (!membership.rowCount) {
    return res.status(403).json({ error: `No workspace membership exists for account '${identity.uid}'.` });
  }
  if(membership.rows[0].status&&membership.rows[0].status!=='active')return res.status(403).json({error:'This workspace membership is not active.'});

  authReq.user = {
    ...identity,
    email: membership.rows[0].email || identity.email,
    tenantId: membership.rows[0].organization_id,
    role: membership.rows[0].role,
    isSuperAdmin: (process.env.NODE_ENV !== 'production' && dummyIdentity?.uid === 'user-super-admin') ||
      (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean).includes((membership.rows[0].email || identity.email || '').toLowerCase())
  };
  next();
}

function writeGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (!user || !['owner', 'admin', 'lawyer', 'analyst'].includes(user.role || '')) {
    return res.status(403).json({
      error: 'This workspace role is read-only or lacks write permission.',
      requiredRoles: ['owner', 'admin', 'lawyer', 'analyst'],
      currentRole: user?.role || 'viewer'
    });
  }
  next();
}

function documentIntakeGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (!user || !['owner', 'admin', 'lawyer', 'analyst', 'operations'].includes(user.role || '')) {
    return res.status(403).json({
      error: 'Document intake permission is required.',
      requiredRoles: ['owner', 'admin', 'lawyer', 'analyst', 'operations'],
      currentRole: user?.role || 'viewer'
    });
  }
  next();
}

function sourceDataGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (!user || !['owner', 'admin', 'data_steward'].includes(user.role || '')) {
    return res.status(403).json({ error: 'Source and ingestion administration permission is required.', requiredRoles: ['owner', 'admin', 'data_steward'], currentRole: user?.role || 'viewer' });
  }
  next();
}

function rtcLookupGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (!user || !['owner', 'admin'].includes(user.role || '')) return res.status(403).json({ error: 'Owner or Admin permission is required for RTC retrieval.', requiredRoles: ['owner','admin'], currentRole: user?.role || 'viewer' });
  next();
}

function businessDataGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (user?.role === 'support') {
    return res.status(403).json({
      error: 'Support sessions are diagnostics-only and cannot access business data.',
      supportScope: 'diagnostics_only'
    });
  }
  next();
}

function legalDecisionDataGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (user && ['operations', 'data_steward', 'support', 'viewer'].includes(user.role || '')) {
    return res.status(403).json({ error: 'This role cannot access legal-review or decision data.' });
  }
  next();
}

function viewerInternalDataGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (user?.role === 'viewer') return res.status(403).json({ error: 'Client Viewer access excludes internal evidence and working data.' });
  next();
}

async function releasedMatterGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (user?.role !== 'viewer') return next();
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const released = await pool.query("SELECT id FROM properties WHERE id=? AND tenant_id=? AND status='complete' LIMIT 1", [req.params.id, user.tenantId]);
  if (!released.rowCount) return res.status(404).json({ error: 'Released matter not found.' });
  next();
}

function legalReviewerGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (!user || !['owner', 'admin', 'lawyer'].includes(user.role || '')) {
    return res.status(403).json({
      error: 'Senior Legal Reviewer role (lawyer, admin, owner) required to verify or dispute title chain events.',
      requiredRoles: ['owner', 'admin', 'lawyer'],
      currentRole: user?.role || 'viewer'
    });
  }
  next();
}

function adminGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (!user || !['owner', 'admin'].includes(user.role || '')) {
    return res.status(403).json({
      error: 'Administrator or Owner privileges required to modify workspace settings.',
      requiredRoles: ['owner', 'admin'],
      currentRole: user?.role || 'viewer'
    });
  }
  next();
}

function ownerGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (!user || user.role !== 'owner') {
    return res.status(403).json({
      error: 'Workspace Owner access is required.',
      requiredRoles: ['owner'],
      currentRole: user?.role || 'viewer'
    });
  }
  next();
}

const asyncRoute = (fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req as AuthenticatedRequest, res, next)).catch(next);

const basePropertySchema = z.object({
  name: z.string().trim().max(160).optional().default(''),
  reviewPurpose: z.union([z.enum(['property_purchase_sale','legal_due_diligence','land_survey_verification','revenue_municipal_verification','land_risk_planning_assessment','loan_mortgage_assessment','inheritance_gift_partition_transfer','other']), z.literal('')]).optional().default(''),
  reviewPurposeCustom: z.string().trim().max(255).optional().default(''),
  primaryDocumentType: z.union([z.enum(['sale_deed','gift_deed','partition_deed','release_deed','power_of_attorney','encumbrance_certificate','rtc_pahani','mutation_record','survey_sketch_tippan','khata_e_khata','property_tax_receipt','layout_approval_conversion_order','master_plan_zoning_document','court_order_legal_notice','other']), z.literal('')]).optional().default(''),
  primaryDocumentTypeCustom: z.string().trim().max(255).optional().default(''),
  propertyIdentifier: z.string().trim().max(160).optional().default(''),
  propertyIdentifierType: z.string().trim().max(80).optional().default(''),
  propertyType: z.enum(['land', 'site', 'apartment', 'building', 'agricultural', 'non_agricultural', 'other']).optional().default('agricultural'),
  village: z.string().trim().min(1).max(120),
  hobli: z.string().trim().min(1).max(120),
  taluk: z.string().trim().min(1).max(120),
  district: z.string().trim().min(1).max(120),
  districtId: z.string().uuid().nullable().optional(),
  talukId: z.string().uuid().nullable().optional(),
  hobliId: z.string().uuid().nullable().optional(),
  villageId: z.string().uuid().nullable().optional(),
  surveyNumber: z.string().trim().max(80).optional().default(''),
  survey_number: z.string().trim().max(80).optional(),
  subdivision: z.string().trim().max(80).optional().default(''),
  extent: z.string().trim().max(80).optional().default(''),
  extentValue: z.number().positive().nullable().optional(),
  extentUnit: z.enum(['acre', 'gunta', 'sq_ft', 'sq_m', 'cent', 'hectare', '']).optional().default(''),
  boundaryNorth: z.string().trim().max(500).optional().default(''),
  boundarySouth: z.string().trim().max(500).optional().default(''),
  boundaryEast: z.string().trim().max(500).optional().default(''),
  boundaryWest: z.string().trim().max(500).optional().default(''),
  address: z.string().trim().max(500).optional().default(''),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  coordinateSource: z.string().trim().max(120).optional().default(''),
  coordinateConfidence: z.number().int().min(0).max(100).nullable().optional(),
  coordinateCapturedAt: z.string().datetime().nullable().optional(),
  identityState: z.enum(['known', 'verified', 'disputed', 'unknown']).optional().default('known'),
  notes: z.string().max(4000).optional().default(''),
  allowDuplicate: z.boolean().optional().default(false)
});

const propertySchema = basePropertySchema.transform(d => ({
  ...d,
  surveyNumber: d.surveyNumber || d.survey_number || ''
}));

function validatePropertyConsistency(data: Partial<z.infer<typeof basePropertySchema>>) {
  const issues: string[] = [];
  const hasLatitude = data.latitude !== null && data.latitude !== undefined;
  const hasLongitude = data.longitude !== null && data.longitude !== undefined;
  const hasExtentValue = data.extentValue !== null && data.extentValue !== undefined;
  const hasExtentUnit = Boolean(data.extentUnit);
  const hasCoordinateSource = Boolean(data.coordinateSource?.trim());
  const hasCoordinateConfidence = data.coordinateConfidence !== null && data.coordinateConfidence !== undefined;
  if (hasLatitude !== hasLongitude) issues.push('Latitude and longitude must be provided together.');
  if (hasExtentValue !== hasExtentUnit) issues.push('Normalized extent value and extent unit must be provided together.');
  if ((hasLatitude || hasLongitude) && !hasCoordinateSource) issues.push('Coordinate source is required when coordinates are supplied.');
  if ((hasLatitude || hasLongitude) && !hasCoordinateConfidence) issues.push('Coordinate confidence is required when coordinates are supplied.');
  if ((hasCoordinateSource || hasCoordinateConfidence) && !(hasLatitude && hasLongitude)) issues.push('Coordinates are required when coordinate source or confidence is supplied.');
  if (data.propertyType === 'agricultural' && !data.surveyNumber?.trim()) issues.push('Survey number is required for agricultural property.');
  if (data.propertyType === 'non_agricultural' && !data.propertyIdentifierType?.trim()) issues.push('Property number type is required for non-agricultural property.');
  if (data.propertyType === 'non_agricultural' && !data.propertyIdentifier?.trim()) issues.push('Property number is required for non-agricultural property.');
  if (!data.name?.trim() && !data.reviewPurpose) issues.push('Purpose of property review is required.');
  if (!data.name?.trim() && !data.primaryDocumentType) issues.push('Primary document type is required.');
  if (data.reviewPurpose === 'other' && !data.reviewPurposeCustom?.trim()) issues.push('Custom review purpose is required when Other is selected.');
  if (data.primaryDocumentType === 'other' && !data.primaryDocumentTypeCustom?.trim()) issues.push('Custom document type is required when Other is selected.');
  const modernWorkspace = Boolean(data.reviewPurpose || data.primaryDocumentType);
  const meaningfulAddress = (value?:string) => Boolean(value && value.trim().length >= 10 && value.trim().split(/\s+/).length >= 2);
  const meaningfulBoundary = (value?:string) => Boolean(value && value.trim().length >= 4 && !/^([a-z])\1+$/i.test(value.trim()));
  if (modernWorkspace && !meaningfulAddress(data.address)) issues.push('Enter a specific address or directions using at least two words, such as a road, landmark or locality.');
  if (modernWorkspace) {
    const boundaries = [['North',data.boundaryNorth],['South',data.boundarySouth],['East',data.boundaryEast],['West',data.boundaryWest]] as const;
    for (const [direction,value] of boundaries) if (!meaningfulBoundary(value)) issues.push(`${direction} boundary must contain a specific feature, road, owner, property number or landmark.`);
  }
  return issues;
}

const locationIdSchema = z.string().uuid();

const parcelReferenceSchema = z.object({
  district: z.string().trim().max(120).optional().default(''),
  taluk: z.string().trim().max(120).optional().default(''),
  hobli: z.string().trim().max(120).optional().default(''),
  village: z.string().trim().min(1).max(120),
  surveyNumber: z.string().trim().min(1).max(80),
  subdivision: z.string().trim().max(80).optional().default(''),
  extentRaw: z.string().trim().max(80).optional().default(''),
  extentValue: z.number().positive().nullable().optional(),
  extentUnit: z.enum(['acre', 'gunta', 'sq_ft', 'sq_m', 'cent', 'hectare', '']).optional().default(''),
  sourceDescription: z.string().trim().max(255).optional().default(''),
  factState: z.enum(['known', 'verified', 'disputed', 'unknown']).optional().default('known'),
  notes: z.string().max(2000).optional().default('')
});

async function validateLocationHierarchy(data: { district:string;taluk:string;hobli:string;village:string;districtId?:string|null;talukId?:string|null;hobliId?:string|null;villageId?:string|null }) {
  if (!pool) throw new Error('Database not configured.');
  const ids = [data.districtId, data.talukId, data.hobliId, data.villageId];
  if (ids.every(id => !id)) return { valid: true as const }; // Legacy text-only API compatibility.
  if (ids.some(id => !id)) return { valid: false as const, error: 'District, Taluk, Hobli and Village selections must all be supplied.' };
  const result = await pool.query(
    `SELECT d.name AS district, t.name AS taluk, h.name AS hobli, v.name AS village
     FROM karnataka_districts d
     JOIN karnataka_taluks t ON t.district_id=d.id AND t.active=1
     JOIN karnataka_hoblis h ON h.taluk_id=t.id AND h.active=1
     JOIN karnataka_villages v ON v.hobli_id=h.id AND v.active=1
     WHERE d.id=? AND t.id=? AND h.id=? AND v.id=? AND d.active=1`,
    ids
  );
  if (!result.rowCount) return { valid: false as const, error: 'The selected District, Taluk, Hobli and Village combination is invalid or inactive.' };
  const row = result.rows[0];
  if ([row.district, row.taluk, row.hobli, row.village].some((name, index) => name !== [data.district, data.taluk, data.hobli, data.village][index])) {
    return { valid: false as const, error: 'Location names do not match the selected reference records.' };
  }
  return { valid: true as const };
}

async function audit(userId: string, tenantId: string | undefined, action: string, entityType: string, entityId: string | null, details: unknown = {}) {
  if (!pool) return;
  await pool.query('INSERT INTO audit_events (id, actor_uid, tenant_id, action, entity_type, entity_id, details) VALUES (?,?,?,?,?,?,?)', [crypto.randomUUID(), userId, tenantId || null, action, entityType, entityId, JSON.stringify(details)]);
}

app.get('/health', asyncRoute(async (_req, res) => {
  let database = 'not_configured';
  if (pool) { await pool.query('SELECT 1'); database = 'connected'; }
  res.json({ status: 'ok', service: 'ojix-property-api', version: '0.1.0', database, databaseEngine: 'MariaDB', authentication: firebaseAuth ? 'firebase' : 'local-development-only' });
}));

app.get('/healthz', (_req, res) => {
  res.status(200).send('OK');
});

app.get('/readyz', asyncRoute(async (_req, res) => {
  if (!pool) return res.status(503).json({ status: 'not_ready', error: 'Database pool not initialized' });
  try {
    const dbRes = await pool.query(`SELECT VERSION() AS database_version,
      ST_AsText(ST_GeomFromText('POINT(77.5946 12.9716)', 4326)) AS spatial_probe`);
    res.json({
      status: 'ready',
      service: 'ojix-property-api',
      databaseEngine: 'MariaDB',
      databaseVersion: dbRes.rows[0]?.database_version,
      spatial: dbRes.rows[0]?.spatial_probe === 'POINT(77.5946 12.9716)' ? 'available' : 'unavailable',
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(503).json({ status: 'not_ready', error: err.message });
  }
}));


/* ==========================================================================
   Authentication & RBAC Endpoints
   ========================================================================== */
app.get('/api/auth/dummy-accounts', (_req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Not found.' });
  res.json({ accounts: DUMMY_ACCOUNTS });
});

const registrationNameSchema=z.string().trim().min(2,'Name must contain at least 2 characters.').max(50,'Name must be 50 characters or fewer.').regex(/^[\p{L}]+(?:[ '\-][\p{L}]+)*$/u,'Use letters, spaces, hyphens or apostrophes only.');
const registrationSchema = z.object({
  firstName: registrationNameSchema,
  middleName: z.union([z.literal(''),registrationNameSchema]).optional().default(''),
  lastName: registrationNameSchema,
  gender: z.enum(['female', 'male', 'non_binary', 'prefer_not_to_say'], { required_error: 'Select a gender option.', invalid_type_error: 'Select a valid gender option.' }),
  countryCode: z.enum(['+91', '+1', '+44', '+61', '+971', '+65'], { required_error: 'Select a country calling code.', invalid_type_error: 'Select a supported country calling code.' }),
  mobileNumber: z.string({ required_error: 'Enter your mobile number.' }).regex(/^\d{8,10}$/, 'Enter a valid mobile number using digits only.').refine(value=>!(/^(\d)\1+$/.test(value)),'Repeated-digit mobile numbers are not valid.'),
  securityQuestion: z.enum(['first_school', 'first_employer', 'childhood_city', 'favorite_teacher'], { required_error: 'Choose a security question.', invalid_type_error: 'Choose a valid security question.' }),
  securityAnswer: z.string({ required_error: 'Enter an answer.' }).trim().min(3, 'Answer must contain at least 3 characters.').max(120, 'Answer must be 120 characters or fewer.'),
  email: z.string({ required_error: 'Enter your work email.' }).trim().email('Enter a valid work email, e.g. name@company.com.').regex(/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/, 'Use an email with a valid domain, such as name@company.com.').max(255, 'Email must be 255 characters or fewer.').transform(value => value.toLowerCase()),
  password: z.string({ required_error: 'Create a password.' }).min(8, 'Password must be at least 8 characters.').max(128, 'Password must be 128 characters or fewer.')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
    .regex(/[a-z]/, 'Password must contain a lowercase letter.')
    .regex(/[0-9]/, 'Password must contain a number.')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character.')
});

app.post('/api/auth/register/request-otp', loginOtpRequestRateLimit, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) {const fieldErrors=parsed.error.issues.reduce<Record<string,string>>((errors,issue)=>{const field=String(issue.path[0]||'form');if(!errors[field])errors[field]=issue.message;return errors;},{});return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration details.',fieldErrors });}
  const { firstName, middleName, lastName, gender, countryCode, mobileNumber, securityQuestion, securityAnswer, email, password } = parsed.data;
  const phoneFormats: Record<string, RegExp> = {
    '+91': /^[6-9]\d{9}$/,
    '+1': /^[2-9]\d{2}[2-9]\d{6}$/,
    '+44': /^7\d{9}$/,
    '+61': /^4\d{8}$/,
    '+971': /^5[024568]\d{7}$/,
    '+65': /^[89]\d{7}$/,
  };
  if (!phoneFormats[countryCode].test(mobileNumber)||/^(\d)\1+$/.test(mobileNumber)) return res.status(400).json({ error: 'Enter a valid mobile number for the selected country.',fieldErrors:{mobileNumber:'Enter a valid mobile number for the selected country.'} });
  const name = [firstName, middleName, lastName].filter(Boolean).join(' ');
  if (name.length > 160) return res.status(400).json({ error: 'The combined name must be 160 characters or fewer.' });
  const phoneE164 = `${countryCode}${mobileNumber}`;
  if (DUMMY_ACCOUNTS.some(account => account.email.toLowerCase() === email)) return res.status(409).json({ error: 'This email already belongs to a workspace account. Please sign in.' });
  const existing = await pool.query('SELECT id, email_verified FROM user_accounts WHERE email=? LIMIT 1', [email]);
  if (existing.rowCount && existing.rows[0].email_verified) return res.status(409).json({ error: 'An account already exists for this email. Please sign in.' });
  const recentRequests = await pool.query("SELECT COUNT(*) AS request_count, MAX(created_at) AS last_requested_at FROM otp_challenges WHERE email=? AND purpose='registration' AND created_at>DATE_SUB(NOW(6),INTERVAL 15 MINUTE)", [email]);
  const requestCount = Number(recentRequests.rows[0]?.request_count || 0);
  const lastRequestedAt = recentRequests.rows[0]?.last_requested_at ? new Date(recentRequests.rows[0].last_requested_at).getTime() : 0;
  const secondsSinceRequest = lastRequestedAt ? Math.max(0, Math.floor((Date.now() - lastRequestedAt) / 1000)) : OTP_RESEND_COOLDOWN_MS / 1000;
  if (requestCount >= OTP_MAX_REQUESTS_PER_WINDOW) return res.status(429).json({ error: 'Too many registration codes requested. Try again later.', retryAfterSeconds: Math.max(1, OTP_REQUEST_WINDOW_MINUTES * 60 - secondsSinceRequest) });
  if (lastRequestedAt && Date.now() - lastRequestedAt < OTP_RESEND_COOLDOWN_MS) return res.status(429).json({ error: 'Please wait before requesting another registration code.', retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - lastRequestedAt)) / 1000) });

  const userId = existing.rows[0]?.id || crypto.randomUUID();
  const passwordHash = hashPassword(password);
  const securityAnswerHash = hashPassword(securityAnswer.trim().toLocaleLowerCase('en'));
  if (existing.rowCount) {
    await pool.query('UPDATE user_accounts SET full_name=?, middle_name=?, gender=?, phone_e164=?, security_question=?, security_answer_hash=?, password_hash=?, status=\'pending\' WHERE id=?', [name, middleName || null, gender, phoneE164, securityQuestion, securityAnswerHash, passwordHash, userId]);
  } else {
    await pool.query('INSERT INTO user_accounts (id,email,full_name,middle_name,gender,phone_e164,security_question,security_answer_hash,password_hash,email_verified,status) VALUES (?,?,?,?,?,?,?,?,?,FALSE,\'pending\')', [userId, email, name, middleName || null, gender, phoneE164, securityQuestion, securityAnswerHash, passwordHash]);
  }
  await pool.query('UPDATE otp_challenges SET consumed_at=NOW(6) WHERE email=? AND purpose=\'registration\' AND consumed_at IS NULL', [email]);
  const otp = generateOtp();
  const otpSalt = generateOtpSalt();
  const challengeId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await pool.query('INSERT INTO otp_challenges (id,email,purpose,otp_hash,otp_salt,expires_at) VALUES (?,?,\'registration\',?,?,?)', [challengeId, email, hashOtp(email, otp, otpSalt), otpSalt, expiresAt]);
  let delivery;
  try {
    delivery=await deliverOtpEmail(email,name,otp,'registration');
  }
  catch (error) {
    await pool.query('UPDATE otp_challenges SET consumed_at=NOW(6) WHERE id=?',[challengeId]);
    throw error;
  }
  await audit(userId, DEFAULT_ORGANIZATION_ID, 'auth.registration_otp_requested', 'user_account', userId, { email });
  res.status(201).json({
    challengeId,
    email,
    expiresAt: expiresAt.toISOString(),
    resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
    deliveryMode: delivery.mode,
    message: 'A six-digit verification code was sent to your email.'
  });
}));

app.post('/api/auth/register/verify-otp', asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed = z.object({ challengeId: z.string().uuid(), email: z.string().email().transform(v => v.toLowerCase()), otp: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter the valid six-digit verification code.' });
  const { challengeId, email, otp } = parsed.data;
  const challenge = await pool.query('SELECT * FROM otp_challenges WHERE id=? AND email=? AND purpose=\'registration\' LIMIT 1', [challengeId, email]);
  if (!challenge.rowCount || challenge.rows[0].consumed_at) return res.status(400).json({ error: 'This verification request is no longer valid.' });
  if (new Date(challenge.rows[0].expires_at).getTime() <= Date.now()) return res.status(400).json({ error: 'The OTP has expired. Request a new code.' });
  if (Number(challenge.rows[0].attempts) >= 5) return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' });
  if (!challenge.rows[0].otp_salt || !verifyOtp(email, otp, String(challenge.rows[0].otp_salt), String(challenge.rows[0].otp_hash))) {
    await pool.query('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=? AND attempts<5 AND consumed_at IS NULL AND expires_at>NOW(6)', [challengeId]);
    return res.status(400).json({ error: 'Incorrect OTP. Please check the six-digit code.' });
  }
  const account = await pool.query('SELECT id, full_name FROM user_accounts WHERE email=? LIMIT 1', [email]);
  if (!account.rowCount) return res.status(400).json({ error: 'Registration account was not found.' });
  const consumed=await pool.query("UPDATE otp_challenges SET consumed_at=NOW(6) WHERE id=? AND email=? AND purpose='registration' AND consumed_at IS NULL AND attempts<5 AND expires_at>NOW(6)",[challengeId,email]);
  if(!consumed.rowCount)return res.status(400).json({error:'This verification request is no longer valid.'});
  await pool.query('UPDATE user_accounts SET email_verified=TRUE,status=\'active\' WHERE id=?', [account.rows[0].id]);
  await pool.query('INSERT IGNORE INTO org_memberships (id,organization_id,user_uid,email,role) VALUES (?,?,?,?,\'viewer\')', [crypto.randomUUID(), DEFAULT_ORGANIZATION_ID, account.rows[0].id, email]);
  await audit(account.rows[0].id, DEFAULT_ORGANIZATION_ID, 'auth.registration_verified', 'user_account', account.rows[0].id, { email, assignedRole: 'viewer' });
  res.json({ success: true, message: 'Email verified. Your read-only workspace account is ready; please sign in.' });
}));

const passwordResetRoleSchema = z.enum(['super-admin','owner','admin','lawyer','analyst','operations','consultant','support','data_steward','viewer']);

app.post('/api/auth/forgot-password/request-otp', loginOtpRequestRateLimit, asyncRoute(async (req,res)=>{
  if(!pool)return res.status(503).json({error:'Database not configured.'});
  const parsed=z.object({
    email:z.string().trim().email().transform(value=>value.toLowerCase()),
    expectedRole:passwordResetRoleSchema,
  }).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Enter a valid work email and select your assigned role.'});
  const {email,expectedRole}=parsed.data;
  const dummy=process.env.NODE_ENV!=='production'?DUMMY_ACCOUNTS.find(account=>account.email.toLowerCase()===email&&(expectedRole==='super-admin'?Boolean(account.isSuperAdmin):!account.isSuperAdmin&&account.role===expectedRole)):undefined;
  const registered=!dummy?await pool.query(`SELECT u.id,u.full_name,u.email,u.email_verified,u.status,m.organization_id,m.role AS membership_role,m.status AS membership_status
    FROM user_accounts u JOIN org_memberships m ON m.user_uid=u.id
    WHERE u.email=? ORDER BY m.created_at LIMIT 1`,[email]):{rowCount:0,rows:[]};
  const registeredRow=registered.rows[0];
  const configuredSuperAdmins=(process.env.SUPER_ADMIN_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
  const registeredRole=configuredSuperAdmins.includes(email)?'super-admin':registeredRow?.membership_role;
  const registeredMatches=Boolean(registered.rowCount&&registeredRow.email_verified&&registeredRow.status==='active'&&registeredRow.membership_status==='active'&&registeredRole===expectedRole);
  const account=dummy?{uid:dummy.uid,name:dummy.name,tenantId:DEFAULT_ORGANIZATION_ID}:registeredMatches?{uid:String(registeredRow.id),name:String(registeredRow.full_name),tenantId:String(registeredRow.organization_id)}:null;
  const fakeChallengeId=crypto.randomUUID();
  const expiresAt=new Date(Date.now()+OTP_TTL_MS);
  if(!account){
    return res.status(201).json({challengeId:fakeChallengeId,email,expiresAt:expiresAt.toISOString(),resendAfterSeconds:OTP_RESEND_COOLDOWN_MS/1000,message:'If the email and role match an active account, a recovery code has been sent.'});
  }
  const recent=await pool.query("SELECT COUNT(*) AS request_count,MAX(created_at) AS last_requested_at FROM otp_challenges WHERE account_uid=? AND purpose='password_reset' AND created_at>DATE_SUB(NOW(6),INTERVAL 15 MINUTE)",[account.uid]);
  const requestCount=Number(recent.rows[0]?.request_count||0);
  const lastRequestedAt=recent.rows[0]?.last_requested_at?new Date(recent.rows[0].last_requested_at).getTime():0;
  if(requestCount>=OTP_MAX_REQUESTS_PER_WINDOW)return res.status(429).json({error:'Too many recovery codes requested. Try again later.',retryAfterSeconds:OTP_REQUEST_WINDOW_MINUTES*60});
  if(lastRequestedAt&&Date.now()-lastRequestedAt<OTP_RESEND_COOLDOWN_MS)return res.status(429).json({error:'Please wait before requesting another recovery code.',retryAfterSeconds:Math.ceil((OTP_RESEND_COOLDOWN_MS-(Date.now()-lastRequestedAt))/1000)});
  await pool.query("UPDATE otp_challenges SET consumed_at=NOW(6) WHERE account_uid=? AND purpose='password_reset' AND consumed_at IS NULL",[account.uid]);
  const otp=generateOtp();
  const otpSalt=generateOtpSalt();
  const challengeId=crypto.randomUUID();
  await pool.query("INSERT INTO otp_challenges (id,email,account_uid,purpose,otp_hash,otp_salt,expires_at) VALUES (?,?,?,'password_reset',?,?,?)",[challengeId,email,account.uid,hashOtp(email,otp,otpSalt),otpSalt,expiresAt]);
  const deliveryTarget=dummy?(process.env.DEMO_OTP_EMAIL?.trim()||''):email;
  if(!deliveryTarget){await pool.query('UPDATE otp_challenges SET consumed_at=NOW(6) WHERE id=?',[challengeId]);return res.status(400).json({error:'Email delivery address is not configured for this demo account.'});}
  try{await deliverOtpEmail(deliveryTarget,account.name,otp,'password_reset');}
  catch(error){await pool.query('UPDATE otp_challenges SET consumed_at=NOW(6) WHERE id=?',[challengeId]);throw error;}
  await audit(account.uid,account.tenantId,'auth.password_reset_requested','user_account',account.uid,{email,expectedRole});
  res.status(201).json({challengeId,email,expiresAt:expiresAt.toISOString(),resendAfterSeconds:OTP_RESEND_COOLDOWN_MS/1000,message:'If the email and role match an active account, a recovery code has been sent.'});
}));

app.post('/api/auth/forgot-password/reset', loginOtpVerifyRateLimit, asyncRoute(async(req,res)=>{
  if(!pool)return res.status(503).json({error:'Database not configured.'});
  const parsed=z.object({
    challengeId:z.string().uuid(),
    email:z.string().trim().email().transform(value=>value.toLowerCase()),
    expectedRole:passwordResetRoleSchema,
    otp:z.string().regex(/^\d{6}$/),
    newPassword:z.string().min(8,'Use at least 8 characters.').max(128).regex(/[A-Z]/,'Add at least one uppercase letter.').regex(/[a-z]/,'Add at least one lowercase letter.').regex(/[0-9]/,'Add at least one number.'),
  }).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message||'Enter a valid recovery code and new password.'});
  const {challengeId,email,expectedRole,otp,newPassword}=parsed.data;
  const result=await pool.query("SELECT * FROM otp_challenges WHERE id=? AND email=? AND purpose='password_reset' LIMIT 1",[challengeId,email]);
  const challenge=result.rows[0];
  if(!challenge||challenge.consumed_at||new Date(challenge.expires_at).getTime()<=Date.now())return res.status(400).json({error:'This recovery request is no longer valid. Request a new code.'});
  if(Number(challenge.attempts)>=5)return res.status(429).json({error:'Too many incorrect attempts. Request a new code.'});
  if(!challenge.otp_salt||!verifyOtp(email,otp,String(challenge.otp_salt),String(challenge.otp_hash))){await pool.query('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=? AND attempts<5 AND consumed_at IS NULL AND expires_at>NOW(6)',[challengeId]);return res.status(400).json({error:'Incorrect recovery code.'});}
  const accountUid=String(challenge.account_uid||'');
  const dummy=process.env.NODE_ENV!=='production'?DUMMY_ACCOUNTS.find(account=>account.uid===accountUid&&account.email.toLowerCase()===email):undefined;
  const registered=!dummy?await pool.query(`SELECT u.id,m.organization_id,m.role,m.status FROM user_accounts u JOIN org_memberships m ON m.user_uid=u.id WHERE u.id=? AND u.email=? AND u.email_verified=TRUE AND u.status='active' ORDER BY m.created_at LIMIT 1`,[accountUid,email]):{rowCount:0,rows:[]};
  if(!dummy&&!registered.rowCount)return res.status(400).json({error:'This recovery request is no longer valid. Request a new code.'});
  const role=dummy?.isSuperAdmin?'super-admin':dummy?.role||((process.env.SUPER_ADMIN_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).includes(email)?'super-admin':registered.rows[0]?.role);
  if(role!==expectedRole||(!dummy&&registered.rows[0]?.status!=='active'))return res.status(400).json({error:'This recovery request is no longer valid. Request a new code.'});
  const consumed=await pool.query("UPDATE otp_challenges SET consumed_at=NOW(6) WHERE id=? AND email=? AND account_uid=? AND purpose='password_reset' AND consumed_at IS NULL AND attempts<5 AND expires_at>NOW(6)",[challengeId,email,accountUid]);
  if(!consumed.rowCount)return res.status(400).json({error:'This recovery request is no longer valid. Request a new code.'});
  const passwordHash=hashPassword(newPassword);
  if(dummy)await pool.query('INSERT INTO account_password_overrides (user_uid,password_hash,changed_at,changed_by_uid) VALUES (?,?,NOW(6),?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash),changed_at=NOW(6),changed_by_uid=VALUES(changed_by_uid)',[accountUid,passwordHash,accountUid]);
  else await pool.query('UPDATE user_accounts SET password_hash=?,updated_at=NOW(6) WHERE id=?',[passwordHash,accountUid]);
  await pool.query("UPDATE authentication_sessions SET revoked_at=NOW(6),revoked_by_uid=?,revoke_reason='Password reset' WHERE user_uid=? AND revoked_at IS NULL",[accountUid,accountUid]);
  for(const[token,session]of authSessions)if(session.uid===accountUid)authSessions.delete(token);
  const tenantId=dummy?DEFAULT_ORGANIZATION_ID:String(registered.rows[0].organization_id);
  await audit(accountUid,tenantId,'auth.password_reset_completed','user_account',accountUid,{email,expectedRole,allSessionsRevoked:true});
  res.json({success:true,message:'Password reset successfully. Sign in with your new password.'});
}));

app.post('/api/auth/login/request-otp', loginOtpRequestRateLimit, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed=z.object({email:z.string().trim().email().transform(value=>value.toLowerCase()),password:z.string().min(1).max(128),expectedRole:z.enum(['super-admin','owner','admin','lawyer','analyst','operations','consultant','support','data_steward','viewer']).optional(),deliveryChannel:z.enum(['email','sms']).default('email')}).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error:'Enter a valid email and password.' });
  const {email,password,expectedRole,deliveryChannel}=parsed.data;
  const dummyCandidates=process.env.NODE_ENV!=='production'?DUMMY_ACCOUNTS.filter(account=>account.email.toLowerCase()===email):[];
  const hashesResult=dummyCandidates.length?await pool.query(`SELECT user_uid,password_hash FROM account_password_overrides WHERE user_uid IN (${dummyCandidates.map(()=>'?').join(',')})`,dummyCandidates.map(account=>account.uid)):{rows:[],rowCount:0};
  const demoHashes=new Map<string,string>(hashesResult.rows.map(row=>[String(row.user_uid),String(row.password_hash)]));
  const dummy=resolveDemoCredential(email,password,dummyCandidates,demoHashes);
  if(dummyCandidates.length&&!dummy&&expectedRole==='super-admin')return res.status(401).json({error:'Invalid email or password.'});
  const registered=!dummy?await pool.query('SELECT id,email,full_name,password_hash,email_verified,status,phone_e164,phone_verified_at FROM user_accounts WHERE email=? LIMIT 1',[email]):{rowCount:0,rows:[]};
  if (!dummy&&!registered.rowCount) return res.status(401).json({ error:'Invalid email or password.' });
  const validPassword=dummy?true:verifyPassword(password,registered.rows[0].password_hash);
  if (!validPassword) return res.status(401).json({ error:'Invalid email or password.' });
  if (registered.rowCount&&(!registered.rows[0].email_verified||registered.rows[0].status!=='active')) return res.status(403).json({ error:'Complete account verification before signing in.' });
  const uid=dummy?.uid||registered.rows[0].id;
  const name=dummy?.name||registered.rows[0].full_name;
  const localSmsPreview=deliveryChannel==='sms'&&Boolean(dummy)&&process.env.NODE_ENV!=='production'&&process.env.DEV_AUTO_FILL_MOBILE_OTP==='true';
  const deliveryTarget=deliveryChannel==='sms'?(dummy?(process.env.DEMO_OTP_PHONE?.trim()||(localSmsPreview?'local-preview':'')):(registered.rows[0]?.phone_verified_at?String(registered.rows[0].phone_e164||''):'')):(dummy?(process.env.DEMO_OTP_EMAIL?.trim()||''):email);
  if(!deliveryTarget)return res.status(400).json({error:deliveryChannel==='sms'?'No verified mobile number is available for this account. Configure SMS delivery or use email.':'Email delivery address is not configured for this demo account.'});
  const membership=await pool.query('SELECT organization_id,status,role FROM org_memberships WHERE user_uid=? ORDER BY created_at LIMIT 1',[uid]);
  if (!membership.rowCount||membership.rows[0].status!=='active') return res.status(403).json({error:'This workspace membership is not active.'});
  const role=membership.rows[0].role;
  const isSuperAdmin=(process.env.NODE_ENV!=='production'&&dummy?.uid==='user-super-admin')||(process.env.SUPER_ADMIN_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean).includes(email);
  const authenticatedLoginRole=dummy?.isSuperAdmin?'super-admin':role;
  if(expectedRole&&expectedRole!==authenticatedLoginRole)return res.status(403).json({error:`This account is not authorized for the ${expectedRole.replace('_',' ')} sign-in portal.`});

  const recentRequests=await pool.query("SELECT COUNT(*) AS request_count,MAX(created_at) AS last_requested_at FROM otp_challenges WHERE account_uid=? AND purpose='login' AND created_at>DATE_SUB(NOW(6),INTERVAL 15 MINUTE)",[uid]);
  const requestCount=Number(recentRequests.rows[0]?.request_count||0);
  const lastRequestedAt=recentRequests.rows[0]?.last_requested_at?new Date(recentRequests.rows[0].last_requested_at).getTime():0;
  const secondsSinceRequest=lastRequestedAt?Math.max(0,Math.floor((Date.now()-lastRequestedAt)/1000)):OTP_RESEND_COOLDOWN_MS/1000;
  if(requestCount>=OTP_MAX_REQUESTS_PER_WINDOW)return res.status(429).json({error:'Too many sign-in codes requested. Try again later.',retryAfterSeconds:Math.max(1,OTP_REQUEST_WINDOW_MINUTES*60-secondsSinceRequest)});
  if(lastRequestedAt&&Date.now()-lastRequestedAt<OTP_RESEND_COOLDOWN_MS)return res.status(429).json({error:'Please wait before requesting another sign-in code.',retryAfterSeconds:Math.ceil((OTP_RESEND_COOLDOWN_MS-(Date.now()-lastRequestedAt))/1000)});

  await pool.query("UPDATE otp_challenges SET consumed_at=NOW(6) WHERE account_uid=? AND purpose='login' AND consumed_at IS NULL",[uid]);
  const otp=generateOtp();
  const otpSalt=generateOtpSalt();
  const challengeId=crypto.randomUUID();
  const expiresAt=new Date(Date.now()+OTP_TTL_MS);
  await pool.query("INSERT INTO otp_challenges (id,email,account_uid,purpose,otp_hash,otp_salt,expires_at) VALUES (?,?,?, 'login',?,?,?)",[challengeId,email,uid,hashOtp(email,otp,otpSalt),otpSalt,expiresAt]);
  let delivery;
  try { delivery=deliveryChannel==='sms'?(localSmsPreview?{delivered:true,mode:'sms' as const}:await deliverOtpSms(deliveryTarget,name,otp)):await deliverOtpEmail(deliveryTarget,name,otp,'login'); }
  catch (error) { await pool.query('UPDATE otp_challenges SET consumed_at=NOW(6) WHERE id=?',[challengeId]); throw error; }
  await audit(uid,membership.rows[0].organization_id,'auth.login_otp_requested','user_account',uid,{email,deliveryMode:delivery.mode});
  const maskedDeliveryTarget=localSmsPreview?'Local mobile preview':delivery.mode==='sms'?maskPhone(deliveryTarget):maskEmail(deliveryTarget);
  res.status(201).json({challengeId,email,deliveryTarget:maskedDeliveryTarget,expiresAt:expiresAt.toISOString(),resendAfterSeconds:OTP_RESEND_COOLDOWN_MS/1000,deliveryMode:delivery.mode,developmentOtp:localSmsPreview?otp:undefined,message:localSmsPreview?'A development-only mobile code was generated and autofilled.':`A six-digit sign-in code was sent by ${delivery.mode==='sms'?'SMS':'email'}.`});
}));

app.post('/api/auth/login/verify-otp', loginOtpVerifyRateLimit, asyncRoute(async (req,res)=>{
  if (!pool) return res.status(503).json({ error:'Database not configured.' });
  const parsed=z.object({challengeId:z.string().uuid(),email:z.string().trim().email().transform(value=>value.toLowerCase()),otp:z.string().regex(/^\d{6}$/),expectedRole:z.enum(['super-admin','owner','admin','lawyer','analyst','operations','consultant','support','data_steward','viewer']).optional()}).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error:'Enter the valid six-digit sign-in code.' });
  const {challengeId,email,otp,expectedRole}=parsed.data;
  const challenge=await pool.query("SELECT * FROM otp_challenges WHERE id=? AND email=? AND purpose='login' LIMIT 1",[challengeId,email]);
  if (!challenge.rowCount||challenge.rows[0].consumed_at) return res.status(400).json({ error:'This sign-in code is no longer valid.' });
  if (new Date(challenge.rows[0].expires_at).getTime()<=Date.now()) return res.status(400).json({ error:'The sign-in code has expired. Request a new code.' });
  if (Number(challenge.rows[0].attempts)>=5) return res.status(429).json({ error:'Too many incorrect attempts. Request a new code.' });
  if (!challenge.rows[0].otp_salt||!verifyOtp(email,otp,String(challenge.rows[0].otp_salt),String(challenge.rows[0].otp_hash))) {await pool.query('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=? AND attempts<5 AND consumed_at IS NULL AND expires_at>NOW(6)',[challengeId]);return res.status(400).json({ error:'Incorrect sign-in code.' });}
  const accountUid=String(challenge.rows[0].account_uid||'');
  if(!accountUid)return res.status(400).json({error:'This sign-in code is no longer valid. Request a new code.'});
  const dummy=process.env.NODE_ENV!=='production'?DUMMY_ACCOUNTS.find(account=>account.uid===accountUid&&account.email.toLowerCase()===email):undefined;
  const registered=!dummy?await pool.query("SELECT id,email,full_name FROM user_accounts WHERE id=? AND email=? AND email_verified=TRUE AND status='active' LIMIT 1",[accountUid,email]):{rowCount:0,rows:[]};
  if (!dummy&&!registered.rowCount) return res.status(401).json({ error:'The account is no longer active.' });
  const target:any=dummy||{uid:registered.rows[0].id,email:registered.rows[0].email,name:registered.rows[0].full_name,designation:'Registered Reviewer',role:'viewer',avatar:registered.rows[0].full_name.split(/\s+/).slice(0,2).map((part:string)=>part[0]).join('').toUpperCase(),description:'Verified workspace member'};
  const membership=await pool.query('SELECT organization_id,role,status FROM org_memberships WHERE user_uid=? LIMIT 1',[target.uid]);
  if (!membership.rowCount||membership.rows[0].status!=='active') return res.status(403).json({error:'This workspace membership is not active.'});
  const role=membership.rows[0]?.role||target.role;
  const isSuperAdmin=(process.env.NODE_ENV!=='production'&&dummy?.uid==='user-super-admin')||(process.env.SUPER_ADMIN_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean).includes(email);
  const authenticatedLoginRole=dummy?.isSuperAdmin?'super-admin':role;
  if(expectedRole&&expectedRole!==authenticatedLoginRole)return res.status(403).json({error:`This account is not authorized for the ${expectedRole.replace('_',' ')} sign-in portal.`});
  const consumed=await pool.query("UPDATE otp_challenges SET consumed_at=NOW(6) WHERE id=? AND email=? AND account_uid=? AND purpose='login' AND consumed_at IS NULL AND attempts<5 AND expires_at>NOW(6)",[challengeId,email,accountUid]);
  if(!consumed.rowCount)return res.status(400).json({error:'This sign-in code is no longer valid. Request a new code.'});
  const tenantId=membership.rows[0]?.organization_id||DEFAULT_ORGANIZATION_ID;
  const sessionMs=role==='support'?SUPPORT_SESSION_MS:AUTH_SESSION_MS;
  const token=`ojix-${crypto.randomBytes(32).toString('base64url')}`;
  const expiresAt=Date.now()+sessionMs;
  const sessionId=crypto.randomUUID();
  authSessions.set(token,{id:sessionId,uid:target.uid,email:target.email,name:target.name,role,tenantId,expiresAt,lastActivityAt:Date.now()});
  await pool.query('INSERT INTO authentication_sessions (id,tenant_id,user_uid,token_hash,expires_at,ip_address,user_agent) VALUES (?,?,?,?,?,?,?)',[sessionId,tenantId,target.uid,crypto.createHash('sha256').update(token).digest('hex'),new Date(expiresAt),req.ip||null,String(req.header('user-agent')||'').slice(0,500)||null]);
  if(role==='support') supportSessions.set(target.uid,expiresAt);
  await audit(target.uid,tenantId,'auth.login_otp_verified','user_account',target.uid,{email,role});
  res.json({token,user:{...target,role,tenantId,isSuperAdmin,accessExpiresAt:new Date(expiresAt).toISOString()},message:`Signed in securely as ${target.name} (${String(role).toUpperCase()})`});
}));

app.post('/api/auth/login', (_req, res) => res.status(410).json({ error: 'Password-only sign-in is disabled. Use the email OTP flow.' }));

app.get('/api/auth/me', authGuard, asyncRoute(async (req, res) => {
  const u = (req as AuthenticatedRequest).user;
  const registered = u?.uid && pool ? await pool.query('SELECT full_name,email FROM user_accounts WHERE id=? LIMIT 1', [u.uid]) : { rowCount: 0, rows: [] };
  const meta = DUMMY_ACCOUNTS.find(a => a.uid === u?.uid) || (registered.rowCount ? {
    uid: u?.uid || 'unknown', email: registered.rows[0].email, name: registered.rows[0].full_name,
    designation: 'Registered Reviewer', role: u?.role || 'viewer',
    avatar: registered.rows[0].full_name.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase(),
    description: 'Verified read-only workspace member'
  } : {
    uid: u?.uid || 'unknown',
    email: u?.email || '',
    name: u?.name || (u?.uid === 'local-developer' ? 'Demo Professional' : u?.uid || 'User'),
    designation: u?.role ? u.role.toUpperCase() : 'Member',
    role: u?.role || 'viewer',
    avatar: (u?.email || 'U').slice(0, 2).toUpperCase(),
    description: 'Active session'
  });
  res.json({
    user: {
      ...meta,
      role: u?.role || meta.role,
      isSuperAdmin: Boolean(u?.isSuperAdmin),
      tenantId: u?.tenantId,
      accessExpiresAt: u?.role === 'support' ? new Date(supportSessions.get(u.uid) || 0).toISOString() : undefined
    }
  });
}));

app.post('/api/auth/change-password',authGuard,asyncRoute(async(req,res)=>{
  if(!pool)return res.status(503).json({error:'Database not configured.'});
  const parsed=z.object({
    currentPassword:z.string().min(1).max(128),
    newPassword:z.string().min(8).max(128).regex(/[A-Z]/,'New password must contain an uppercase letter.').regex(/[a-z]/,'New password must contain a lowercase letter.').regex(/[0-9]/,'New password must contain a number.')
  }).refine(value=>value.currentPassword!==value.newPassword,{message:'New password must be different from the current password.'}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message||'Enter a valid new password.'});
  const user=(req as AuthenticatedRequest).user!;
  const dummy=DUMMY_ACCOUNTS.find(account=>account.uid===user.uid);
  const registered=await pool.query('SELECT password_hash FROM user_accounts WHERE id=? LIMIT 1',[user.uid]);
  const override=dummy?await pool.query('SELECT password_hash FROM account_password_overrides WHERE user_uid=? LIMIT 1',[user.uid]):{rowCount:0,rows:[]};
  const currentValid=registered.rowCount?verifyPassword(parsed.data.currentPassword,registered.rows[0].password_hash):dummy?Boolean(override.rowCount&&verifyPassword(parsed.data.currentPassword,override.rows[0].password_hash)):false;
  if(!currentValid)return res.status(401).json({error:'Current password is incorrect.'});
  const passwordHash=hashPassword(parsed.data.newPassword);
  if(registered.rowCount)await pool.query('UPDATE user_accounts SET password_hash=?,updated_at=NOW(6) WHERE id=?',[passwordHash,user.uid]);
  else await pool.query('INSERT INTO account_password_overrides (user_uid,password_hash,changed_at,changed_by_uid) VALUES (?,?,NOW(6),?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash),changed_at=NOW(6),changed_by_uid=VALUES(changed_by_uid)',[user.uid,passwordHash,user.uid]);
  const rawToken=(req.header('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  const currentSession=rawToken?authSessions.get(rawToken):undefined;
  await pool.query('UPDATE authentication_sessions SET revoked_at=NOW(6),revoked_by_uid=?,revoke_reason=? WHERE user_uid=? AND id<>? AND revoked_at IS NULL',[user.uid,'Password changed',user.uid,currentSession?.id||'']);
  for(const[token,session]of authSessions)if(session.uid===user.uid&&session.id!==currentSession?.id)authSessions.delete(token);
  await audit(user.uid,user.tenantId||DEFAULT_ORGANIZATION_ID,'auth.password_changed','user_account',user.uid,{email:user.email,otherSessionsRevoked:true});
  res.json({success:true,message:'Password changed successfully. Other sessions were revoked, and Super Admin can see the security event.'});
}));

app.post('/api/auth/activity', authGuard, asyncRoute(async(req, res) => {
  const user=(req as AuthenticatedRequest).user;
  const rawToken=(req.header('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  const session=rawToken?authSessions.get(rawToken):undefined;
  if(!session||session.uid!==user?.uid)return res.status(401).json({error:'Session is no longer active.'});
  session.lastActivityAt=Date.now();
  authSessions.set(rawToken,session);
  if(pool)await pool.query('UPDATE authentication_sessions SET last_activity_at=NOW(6) WHERE id=? AND revoked_at IS NULL',[session.id]);
  res.json({success:true,lastActivityAt:new Date(session.lastActivityAt).toISOString()});
}));

app.post('/api/auth/logout', authGuard, (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const rawToken=(req.header('authorization')||'').replace(/^Bearer\s+/i,'').trim();
  const session=rawToken?authSessions.get(rawToken):undefined;
  const reason=req.body?.reason==='inactivity'?'Inactivity timeout':'User logout';
  if(session&&pool)void pool.query('UPDATE authentication_sessions SET revoked_at=NOW(6),revoked_by_uid=?,revoke_reason=? WHERE id=?',[user?.uid||'unknown',reason,session.id]);
  if(rawToken) authSessions.delete(rawToken);
  if (user?.role === 'support') supportSessions.delete(user.uid);
  res.json({ success: true, message: 'Logged out successfully.' });
});

app.use('/api/properties/:id', authGuard, businessDataGuard, asyncRoute(releasedMatterGuard));
app.use(['/api/documents', '/api/findings', '/api/legal-research', '/api/source-registry', '/api/spatial'], authGuard, businessDataGuard);
app.use(['/api/documents', '/api/source-registry', '/api/spatial', '/api/properties/:id/documents'], authGuard, viewerInternalDataGuard);
app.use(['/api/findings', '/api/legal-research', '/api/properties/:id/workflow', '/api/properties/:id/title-chain', '/api/properties/:id/title-events', '/api/properties/:id/discrepancies', '/api/properties/:id/spatial-screening', '/api/properties/:id/due-diligence-snapshot'], authGuard, legalDecisionDataGuard);

app.get('/api/locations/districts', authGuard, asyncRoute(async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query('SELECT id, name, code FROM karnataka_districts WHERE active=1 ORDER BY name');
  res.json({ items: result.rows });
}));

app.get('/api/locations/source', authGuard, asyncRoute(async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query('SELECT source_name, source_date, imported_at, completeness, notes FROM karnataka_location_imports ORDER BY imported_at DESC LIMIT 1');
  res.json({ item: result.rows[0] || null, sourceUrl: 'https://kaveri.karnataka.gov.in/landing-page' });
}));

app.get('/api/locations/taluks', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed = locationIdSchema.safeParse(req.query.districtId);
  if (!parsed.success) return res.status(400).json({ error: 'A valid districtId is required.' });
  const parent = await pool.query('SELECT id FROM karnataka_districts WHERE id=? AND active=1', [parsed.data]);
  if (!parent.rowCount) return res.status(404).json({ error: 'District not found or inactive.' });
  const result = await pool.query('SELECT id, name, code FROM karnataka_taluks WHERE district_id=? AND active=1 ORDER BY name', [parsed.data]);
  res.json({ items: result.rows });
}));

app.get('/api/locations/hoblis', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed = locationIdSchema.safeParse(req.query.talukId);
  if (!parsed.success) return res.status(400).json({ error: 'A valid talukId is required.' });
  const parent = await pool.query('SELECT id FROM karnataka_taluks WHERE id=? AND active=1', [parsed.data]);
  if (!parent.rowCount) return res.status(404).json({ error: 'Taluk not found or inactive.' });
  const result = await pool.query('SELECT id, name, code FROM karnataka_hoblis WHERE taluk_id=? AND active=1 ORDER BY name', [parsed.data]);
  res.json({ items: result.rows });
}));

app.get('/api/locations/villages', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed = locationIdSchema.safeParse(req.query.hobliId);
  if (!parsed.success) return res.status(400).json({ error: 'A valid hobliId is required.' });
  const parent = await pool.query('SELECT id FROM karnataka_hoblis WHERE id=? AND active=1', [parsed.data]);
  if (!parent.rowCount) return res.status(404).json({ error: 'Hobli not found or inactive.' });
  const result = await pool.query('SELECT id, name, code FROM karnataka_villages WHERE hobli_id=? AND active=1 ORDER BY name', [parsed.data]);
  res.json({ items: result.rows });
}));

app.post('/api/rtc/search', rtcRateLimit, authGuard, rtcLookupGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed=rtcSearchSchema.safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Valid District, Taluk, Hobli, Village and Survey Number details are required.',issues:parsed.error.flatten()});
  const input=parsed.data;
  const locationValidation=await validateLocationHierarchy(input);
  if(!locationValidation.valid)return res.status(400).json({error:locationValidation.error});
  if(input.propertyId){const property=await pool.query('SELECT id FROM properties WHERE id=? AND tenant_id=?',[input.propertyId,req.user?.tenantId]);if(!property.rowCount)return res.status(404).json({error:'Property not found.'});}
  const lookupId=crypto.randomUUID();
  const result=await retrieveRtc(input);
  const retrievedData=result.status==='completed'?result.record:null;
  const sourcePayload=result.status==='completed'?result.raw:null;
  const errorCode=result.status==='completed'?null:result.errorCode;
  const errorMessage=result.status==='completed'?null:result.message;
  await pool.query(`INSERT INTO rtc_lookups
    (id,tenant_id,property_id,search_criteria,status,source_name,source_url,retrieved_data,source_payload,verification_status,error_code,error_message,requested_by_uid,retrieved_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
    lookupId,req.user?.tenantId,input.propertyId||null,JSON.stringify(input),result.status,result.sourceName,result.sourceUrl,
    retrievedData?JSON.stringify(retrievedData):null,sourcePayload?JSON.stringify(sourcePayload):null,'unverified',errorCode,errorMessage,req.user?.uid||'unknown',result.status==='completed'?new Date():null
  ]);
  await audit(req.user?.uid||'unknown',req.user?.tenantId,'rtc.lookup_requested','rtc_lookup',lookupId,{status:result.status,errorCode,propertyId:input.propertyId||null,surveyNumber:input.surveyNumber,subdivision:input.subdivision});
  res.status(201).json({item:{id:lookupId,status:result.status,sourceName:result.sourceName,sourceUrl:result.sourceUrl,retrievedData,verificationStatus:'unverified',errorCode,errorMessage,searchCriteria:input,createdAt:new Date().toISOString()}});
}));

app.get('/api/rtc/:id', authGuard, rtcLookupGuard, asyncRoute(async (req,res)=>{
  if(!pool)return res.status(503).json({error:'Database not configured.'});
  const id=locationIdSchema.safeParse(req.params.id);if(!id.success)return res.status(400).json({error:'A valid RTC lookup ID is required.'});
  const result=await pool.query(`SELECT id,property_id,search_criteria,status,source_name,source_url,retrieved_data,verification_status,confirmed_match,confirmed_by_uid,confirmed_at,error_code,error_message,retrieved_at,created_at,updated_at FROM rtc_lookups WHERE id=? AND tenant_id=?`,[id.data,req.user?.tenantId]);
  if(!result.rowCount)return res.status(404).json({error:'RTC lookup not found.'});res.json({item:result.rows[0]});
}));

app.get('/api/rtc/:id/status', authGuard, rtcLookupGuard, asyncRoute(async (req,res)=>{
  if(!pool)return res.status(503).json({error:'Database not configured.'});
  const id=locationIdSchema.safeParse(req.params.id);if(!id.success)return res.status(400).json({error:'A valid RTC lookup ID is required.'});
  const result=await pool.query('SELECT id,status,verification_status,error_code,error_message,retrieved_at,updated_at FROM rtc_lookups WHERE id=? AND tenant_id=?',[id.data,req.user?.tenantId]);
  if(!result.rowCount)return res.status(404).json({error:'RTC lookup not found.'});res.json({item:result.rows[0]});
}));

app.patch('/api/rtc/:id/confirmation', authGuard, rtcLookupGuard, asyncRoute(async(req,res)=>{
  if(!pool)return res.status(503).json({error:'Database not configured.'});
  const id=locationIdSchema.safeParse(req.params.id);const body=z.object({matchesProperty:z.boolean()}).safeParse(req.body);
  if(!id.success||!body.success)return res.status(400).json({error:'A valid lookup ID and match decision are required.'});
  const lookup=await pool.query('SELECT id,status FROM rtc_lookups WHERE id=? AND tenant_id=?',[id.data,req.user?.tenantId]);if(!lookup.rowCount)return res.status(404).json({error:'RTC lookup not found.'});if(lookup.rows[0].status!=='completed')return res.status(409).json({error:'Only a completed RTC retrieval can be confirmed.'});
  await pool.query('UPDATE rtc_lookups SET confirmed_match=?,confirmed_by_uid=?,confirmed_at=NOW(6),verification_status=? WHERE id=? AND tenant_id=?',[body.data.matchesProperty,req.user?.uid,body.data.matchesProperty?'source_matched':'source_mismatch',id.data,req.user?.tenantId]);
  await audit(req.user?.uid||'unknown',req.user?.tenantId,'rtc.match_confirmed','rtc_lookup',id.data,{matchesProperty:body.data.matchesProperty});res.json({success:true,verificationStatus:body.data.matchesProperty?'source_matched':'source_mismatch'});
}));

app.get('/api/overview', authGuard, asyncRoute(async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured. Start MariaDB and set DATABASE_URL.' });
  if (_req.user?.role === 'support') return res.json({ total:0, in_review:0, ready_for_review:0, documents:0, findings:0, sourceHealth:{ database:'connected', governmentConnectors:'not_connected', documentStorage:'local_development', ocr:'local_tesseract', gisLayers:'unavailable' }, supportScope:'diagnostics_only' });
  const result = await pool.query(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN p.status='in_review' THEN 1 ELSE 0 END) AS in_review,
       SUM(CASE WHEN p.status='ready_for_review' THEN 1 ELSE 0 END) AS ready_for_review,
       SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id) THEN 1 ELSE 0 END) AS missing_documents,
       SUM(CASE WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 1 ELSE 0 END) AS missing_coordinates,
       SUM(CASE WHEN p.identity_state='disputed' THEN 1 ELSE 0 END) AS disputed_identity,
       ROUND(AVG((
         (CASE WHEN p.survey_number<>'' AND p.village<>'' AND p.extent<>'' THEN 1 ELSE 0 END) +
         (CASE WHEN EXISTS (SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id) THEN 1 ELSE 0 END) +
         (CASE WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL THEN 1 ELSE 0 END) +
         (CASE WHEN p.boundary_north<>'' AND p.boundary_south<>'' AND p.boundary_east<>'' AND p.boundary_west<>'' THEN 1 ELSE 0 END) +
         (CASE WHEN p.identity_state='verified' THEN 1 ELSE 0 END)
       ) / 5 * 100), 0) AS readiness_pct
     FROM properties p WHERE p.tenant_id=?`,
    [_req.user?.tenantId]
  );
  const docs = await pool.query('SELECT COUNT(*) AS total FROM documents WHERE tenant_id=?', [_req.user?.tenantId]);
  const recent = await pool.query(`SELECT id, name, village, survey_number, district, status, updated_at FROM properties WHERE tenant_id=? ORDER BY updated_at DESC LIMIT 5`, [_req.user?.tenantId]);
  const findingSummary = await pool.query(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN severity IN ('high','critical') THEN 1 ELSE 0 END) AS high_attention
     FROM risk_findings WHERE tenant_id=?`,
    [_req.user?.tenantId]
  );
  const recentFindings = await pool.query(
    `SELECT f.id, f.property_id, f.title, f.severity, f.evidence_status, f.created_at, p.name AS property_name
     FROM risk_findings f JOIN properties p ON p.id=f.property_id AND p.tenant_id=f.tenant_id
     WHERE f.tenant_id=? ORDER BY f.created_at DESC LIMIT 5`,
    [_req.user?.tenantId]
  );
  const districtDistribution = await pool.query(
    `SELECT COALESCE(NULLIF(district,''),'Not recorded') AS district, COUNT(*) AS total
     FROM properties WHERE tenant_id=? GROUP BY COALESCE(NULLIF(district,''),'Not recorded')
     ORDER BY total DESC, district LIMIT 8`,
    [_req.user?.tenantId]
  );
  const documentStatus = await pool.query(
    `SELECT processing_status AS status, COUNT(*) AS total FROM documents
     WHERE tenant_id=? GROUP BY processing_status ORDER BY total DESC`,
    [_req.user?.tenantId]
  );
  const spatialLayerStatus = await pool.query("SELECT data_status, COUNT(*) AS total FROM spatial_layers WHERE active=true AND data_status='verified' AND source_name IS NOT NULL AND source_url IS NOT NULL AND source_date IS NOT NULL GROUP BY data_status");
  const portfolioCoverage = await pool.query(
    `SELECT
       SUM(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 ELSE 0 END) AS mapped,
       SUM(CASE WHEN identity_state='verified' THEN 1 ELSE 0 END) AS verified_identity,
       SUM(CASE WHEN identity_state='disputed' THEN 1 ELSE 0 END) AS disputed_identity,
       SUM(CASE WHEN boundary_north<>'' AND boundary_south<>'' AND boundary_east<>'' AND boundary_west<>'' THEN 1 ELSE 0 END) AS complete_boundaries
     FROM properties WHERE tenant_id=?`,
    [_req.user?.tenantId]
  );
  const attentionQueue = await pool.query(
    `SELECT p.id, p.name, p.district, p.village, p.property_type, p.property_identifier, p.property_identifier_type, p.survey_number, p.subdivision, p.status, p.updated_at,
       CASE WHEN NOT EXISTS (SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id) THEN 1 ELSE 0 END AS missing_documents,
       CASE WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 1 ELSE 0 END AS missing_coordinates,
       CASE WHEN p.extent='' THEN 1 ELSE 0 END AS missing_extent,
       CASE WHEN p.identity_state='disputed' THEN 1 ELSE 0 END AS disputed_identity
     FROM properties p WHERE p.tenant_id=? AND (
       NOT EXISTS (SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id)
       OR p.latitude IS NULL OR p.longitude IS NULL OR p.extent='' OR p.identity_state='disputed'
     )
     ORDER BY (CASE WHEN p.identity_state='disputed' THEN 4 ELSE 0 END +
       CASE WHEN NOT EXISTS (SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id) THEN 3 ELSE 0 END +
       CASE WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 2 ELSE 0 END +
       CASE WHEN p.extent='' THEN 1 ELSE 0 END) DESC, p.updated_at DESC LIMIT 6`,
    [_req.user?.tenantId]
  );
  res.json({
    ...result.rows[0],
    documents: docs.rows[0].total,
    findings: findingSummary.rows[0].total,
    high_attention_findings: findingSummary.rows[0].high_attention,
    recent: recent.rows,
    recentFindings: recentFindings.rows,
    districtDistribution: districtDistribution.rows,
    documentStatus: documentStatus.rows,
    portfolioCoverage: portfolioCoverage.rows[0],
    attentionQueue: attentionQueue.rows,
    sourceHealth: {
      database: 'connected',
      governmentConnectors: 'not_connected',
      documentStorage: 'local_development',
      ocr: 'local_tesseract',
      gisLayers: spatialLayerStatus.rows.length ? 'loaded_verified_provenance' : 'unavailable'
    }
  });
}));

app.get('/api/owner/dashboard', authGuard, ownerGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const tenantId = req.user?.tenantId;
  const dateValue=(value:unknown,fallback:string)=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):fallback;
  const defaultTo=new Date().toISOString().slice(0,10);
  const defaultFrom=new Date(Date.now()-180*24*60*60_000).toISOString().slice(0,10);
  const from=dateValue(req.query.from,defaultFrom),to=dateValue(req.query.to,defaultTo);
  if(from>to)return res.status(400).json({error:'The analytics start date must be on or before the end date.'});
  const [metrics, workflow, recentFindings, workload, reports, activity, evidenceSources] = await Promise.all([
    pool.query(`SELECT
      COUNT(*) AS total_matters,
      SUM(CASE WHEN p.status IN ('draft','documents_pending','in_review','clarification_required','ready_for_review','approved') AND p.archived_at IS NULL THEN 1 ELSE 0 END) AS active_reviews,
      SUM(CASE WHEN p.status='ready_for_review' THEN 1 ELSE 0 END) AS ready_for_legal_review,
      (SELECT COUNT(*) FROM documents d WHERE d.tenant_id=? AND d.governance_status='active' AND (d.manual_review_status IN ('pending','required') OR d.processing_status<>'completed')) AS documents_requiring_review,
      SUM(CASE WHEN p.due_date<CURDATE() AND p.status NOT IN ('complete','closed','archived') THEN 1 ELSE 0 END) AS overdue_tasks
      FROM properties p WHERE p.tenant_id=?`, [tenantId, tenantId]),
    pool.query(`SELECT p.*,
      (SELECT COUNT(*) FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.governance_status='active') AS document_count,
      (SELECT COUNT(*) FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.governance_status='active' AND (d.manual_review_status IN ('pending','required') OR d.processing_status<>'completed')) AS pending_document_reviews,
      COALESCE((SELECT f.severity FROM risk_findings f WHERE f.property_id=p.id AND f.tenant_id=p.tenant_id ORDER BY FIELD(f.severity,'critical','high','medium','low','unverified') LIMIT 1),'unverified') AS risk_level,
      CASE WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND LOWER(COALESCE(p.coordinate_source,'')) NOT LIKE '%demo%' AND LOWER(COALESCE(p.coordinate_source,'')) NOT LIKE '%synthetic%' THEN 1 ELSE 0 END AS coordinates_verified,
      ((CASE WHEN p.survey_number='' AND p.property_identifier='' THEN 1 ELSE 0 END) +
       (CASE WHEN p.extent='' THEN 1 ELSE 0 END) +
       (CASE WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 1 ELSE 0 END) +
       (CASE WHEN NOT EXISTS (SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.governance_status='active') THEN 1 ELSE 0 END)) AS missing_evidence,
      CASE
        WHEN p.status='ready_for_review' THEN 'Legal review'
        WHEN p.status='approved' THEN 'Report submission'
        WHEN p.status='complete' THEN 'Completed'
        WHEN p.status='clarification_required' THEN 'Clarification'
        WHEN p.status='documents_pending' THEN 'Document intake'
        ELSE 'Evidence review'
      END AS review_stage,
      CASE
        WHEN p.due_date<CURDATE() AND p.status NOT IN ('complete','closed','archived') THEN 'Resolve overdue task'
        WHEN p.status='ready_for_review' THEN 'Complete legal review'
        WHEN p.status='approved' THEN 'Prepare final submission'
        WHEN NOT EXISTS (SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.governance_status='active') THEN 'Upload source evidence'
        WHEN EXISTS (SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.governance_status='active' AND (d.manual_review_status IN ('pending','required') OR d.processing_status<>'completed')) THEN 'Review pending documents'
        WHEN p.assigned_lawyer_uid='' THEN 'Assign Legal Reviewer'
        ELSE 'Continue review'
      END AS next_action
      FROM properties p WHERE p.tenant_id=? AND p.archived_at IS NULL
      ORDER BY (p.due_date<CURDATE() AND p.status NOT IN ('complete','closed','archived')) DESC,
        FIELD(p.workflow_priority,'urgent','high','normal','low'), p.due_date IS NULL, p.due_date, p.updated_at DESC
      LIMIT 100`, [tenantId]),
    pool.query(`SELECT f.id,f.property_id,f.title,f.severity,f.evidence_status,f.created_at,p.name AS property_name,p.application_number
      FROM risk_findings f JOIN properties p ON p.id=f.property_id AND p.tenant_id=f.tenant_id
      WHERE f.tenant_id=? ORDER BY f.created_at DESC LIMIT 6`, [tenantId]),
    pool.query(`SELECT m.user_uid,m.email,m.role,COALESCE(u.full_name,m.email,m.user_uid) AS name,
      CASE m.role
        WHEN 'lawyer' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.assigned_lawyer_uid=m.user_uid AND p.status NOT IN ('complete','closed','archived'))
        WHEN 'analyst' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.assigned_analyst_uid=m.user_uid AND p.status NOT IN ('complete','closed','archived'))
        WHEN 'operations' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.assigned_operations_uid=m.user_uid AND p.status NOT IN ('complete','closed','archived'))
        ELSE 0 END AS assigned_matters,
      CASE m.role
        WHEN 'lawyer' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.assigned_lawyer_uid=m.user_uid AND p.status='ready_for_review')
        WHEN 'analyst' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.assigned_analyst_uid=m.user_uid AND p.status IN ('documents_pending','in_review','clarification_required'))
        WHEN 'operations' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.assigned_operations_uid=m.user_uid AND p.status='documents_pending')
        ELSE 0 END AS pending_reviews,
      CASE m.role
        WHEN 'lawyer' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.assigned_lawyer_uid=m.user_uid AND p.status='complete')
        WHEN 'analyst' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.assigned_analyst_uid=m.user_uid AND p.status='complete')
        WHEN 'operations' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.assigned_operations_uid=m.user_uid AND p.status='complete')
        ELSE 0 END AS completed_tasks
      FROM org_memberships m LEFT JOIN user_accounts u ON u.id=m.user_uid
      WHERE m.organization_id=? AND m.status='active' AND m.role IN ('lawyer','analyst','operations')
      ORDER BY assigned_matters DESC,m.role,name LIMIT 12`, [tenantId]),
    pool.query(`SELECT p.id AS property_id,p.application_number,p.name AS property_name,p.status,p.assigned_lawyer_uid AS assigned_owner,p.due_date,p.updated_at,
      CASE WHEN p.status='ready_for_review' THEN 'Review required' WHEN p.status='approved' THEN 'Submission required' ELSE 'Report action' END AS action
      FROM properties p WHERE p.tenant_id=? AND p.status IN ('ready_for_review','approved') AND p.archived_at IS NULL
      ORDER BY p.due_date IS NULL,p.due_date,p.updated_at DESC LIMIT 6`, [tenantId]),
    pool.query(`SELECT a.id,a.actor_uid,a.action,a.entity_type,a.entity_id,a.created_at,COALESCE(u.full_name,m.email,a.actor_uid) AS actor_name
      FROM audit_events a
      LEFT JOIN user_accounts u ON u.id=a.actor_uid
      LEFT JOIN org_memberships m ON m.organization_id=a.tenant_id AND m.user_uid=a.actor_uid
      WHERE a.tenant_id=? AND a.action IN ('property.created','document.uploaded','document.fields_overridden','property.workflow_updated','report.snapshot_created','title_event.reviewed')
      ORDER BY a.created_at DESC LIMIT 8`, [tenantId]),
    pool.query(`SELECT
      (SELECT COUNT(DISTINCT source_name) FROM rtc_lookups WHERE tenant_id=? AND status='completed') AS connected_sources,
      ((SELECT COUNT(*) FROM rtc_lookups WHERE tenant_id=? AND verification_status='source_matched') +
       (SELECT COUNT(*) FROM documents WHERE tenant_id=? AND governance_status='active' AND manual_review_status='completed')) AS verification_completed,
      ((SELECT COUNT(*) FROM rtc_lookups WHERE tenant_id=? AND verification_status='unverified') +
       (SELECT COUNT(*) FROM documents WHERE tenant_id=? AND governance_status='active' AND manual_review_status IN ('pending','required'))) AS verification_pending,
      ((SELECT COUNT(*) FROM rtc_lookups WHERE tenant_id=? AND (verification_status='source_mismatch' OR status='failed')) +
       (SELECT COUNT(*) FROM documents WHERE tenant_id=? AND governance_status IN ('rejected','quarantined'))) AS failed_verification,
      (SELECT MAX(COALESCE(retrieved_at,updated_at,created_at)) FROM rtc_lookups WHERE tenant_id=?) AS last_synchronization`,
      [tenantId,tenantId,tenantId,tenantId,tenantId,tenantId,tenantId,tenantId])
  ]);
  const [mattersByStatus,monthlyTrends,riskSeverity,taskComparison]=await Promise.all([
    pool.query(`SELECT status AS label,COUNT(*) AS value FROM properties WHERE tenant_id=? AND DATE(created_at) BETWEEN ? AND ? GROUP BY status ORDER BY value DESC`,[tenantId,from,to]),
    pool.query(`SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,COUNT(*) AS created,
      SUM(CASE WHEN status IN ('approved','complete','closed') THEN 1 ELSE 0 END) AS completed
      FROM properties WHERE tenant_id=? AND DATE(created_at) BETWEEN ? AND ? GROUP BY DATE_FORMAT(created_at,'%Y-%m') ORDER BY month`,[tenantId,from,to]),
    pool.query(`SELECT f.severity AS label,COUNT(*) AS value FROM risk_findings f WHERE f.tenant_id=? AND DATE(f.created_at) BETWEEN ? AND ? GROUP BY f.severity ORDER BY value DESC`,[tenantId,from,to]),
    pool.query(`SELECT
      SUM(CASE WHEN status IN ('complete','closed') THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status NOT IN ('complete','closed','archived') THEN 1 ELSE 0 END) AS pending
      FROM properties WHERE tenant_id=? AND DATE(created_at) BETWEEN ? AND ?`,[tenantId,from,to])
  ]);
  const metricRow=metrics.rows[0]||{};
  res.json({
    metrics:Object.fromEntries(Object.entries(metricRow).map(([key,value])=>[key,Number(value||0)])),
    workflow:workflow.rows,
    pendingActions:[
      {id:'documents',label:'Pending document reviews',count:Number(metricRow.documents_requiring_review||0),priority:Number(metricRow.documents_requiring_review||0)>0?'high':'normal',status:Number(metricRow.documents_requiring_review||0)>0?'Action required':'Clear',nextAction:'Review documents',target:'all-documents'},
      {id:'approval',label:'Matters awaiting approval',count:Number(metricRow.ready_for_legal_review||0),priority:Number(metricRow.ready_for_legal_review||0)>0?'high':'normal',status:Number(metricRow.ready_for_legal_review||0)>0?'Pending':'Clear',nextAction:'Open matters',target:'properties'},
      {id:'evidence',label:'Missing evidence',count:Number(workflow.rows.reduce((sum:number,item:any)=>sum+Number(item.missing_evidence||0),0)),priority:'high',status:'Review',nextAction:'Inspect workflow',target:'properties'},
      {id:'overdue',label:'Overdue tasks',count:Number(metricRow.overdue_tasks||0),priority:Number(metricRow.overdue_tasks||0)>0?'urgent':'normal',status:Number(metricRow.overdue_tasks||0)>0?'Overdue':'Clear',nextAction:'Resolve tasks',target:'properties'},
      {id:'legal',label:'Pending legal reviews',count:Number(metricRow.ready_for_legal_review||0),priority:Number(metricRow.ready_for_legal_review||0)>0?'high':'normal',status:Number(metricRow.ready_for_legal_review||0)>0?'Waiting':'Clear',nextAction:'Review queue',target:'all-findings'}
    ],
    recentFindings:recentFindings.rows,
    teamWorkload:workload.rows,
    reports:reports.rows,
    recentActivity:activity.rows,
    evidenceSources:evidenceSources.rows[0]||{},
    analytics:{from,to,mattersByStatus:mattersByStatus.rows,monthlyTrends:monthlyTrends.rows,riskSeverity:riskSeverity.rows,taskComparison:taskComparison.rows[0]||{pending:0,completed:0}}
  });
}));

app.get('/api/properties', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const q = String(req.query.q || '').trim().slice(0, 120);
  const result = await pool.query(
    `SELECT p.*, (SELECT COUNT(*) FROM documents d WHERE d.property_id=p.id) AS document_count
     FROM properties p
     WHERE p.tenant_id=?
       AND ? <> 'support'
       AND (? <> 'viewer' OR p.status='complete')
       AND (? <> 'lawyer' OR p.assigned_lawyer_uid=?)
       AND (? <> 'analyst' OR p.assigned_analyst_uid=?)
       AND (? <> 'operations' OR p.assigned_operations_uid=? OR p.assigned_operations_uid IS NULL OR p.assigned_operations_uid='')
       AND (
         ?=''
         OR LOWER(p.application_number) LIKE LOWER(CONCAT('%', ?, '%'))
         OR LOWER(p.name) LIKE LOWER(CONCAT('%', ?, '%'))
         OR LOWER(p.survey_number) LIKE LOWER(CONCAT('%', ?, '%'))
         OR LOWER(p.village) LIKE LOWER(CONCAT('%', ?, '%'))
         OR LOWER(p.address) LIKE LOWER(CONCAT('%', ?, '%'))
       )
     ORDER BY p.updated_at DESC
     LIMIT 100`,
    [req.user?.tenantId, req.user?.role || 'viewer', req.user?.role || 'viewer', req.user?.role || 'viewer', req.user?.uid || '', req.user?.role || 'viewer', req.user?.uid || '', req.user?.role || 'viewer', req.user?.uid || '', q, q, q, q, q, q]
  );
  res.json({ items: result.rows });
}));

app.post('/api/properties', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed = propertySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid property payload.', issues: parsed.error.flatten() });
  const p = parsed.data;
  const consistencyIssues = validatePropertyConsistency(p);
  if (consistencyIssues.length) return res.status(400).json({ error: consistencyIssues[0], issues: consistencyIssues });
  const locationValidation = await validateLocationHierarchy(p);
  if (!locationValidation.valid) return res.status(400).json({ error: locationValidation.error });
  const duplicate = p.propertyType === 'non_agricultural'
    ? await pool.query(
        `SELECT id, name, district, taluk, hobli, village, property_identifier, property_identifier_type
         FROM properties WHERE tenant_id=? AND LOWER(district)=LOWER(?) AND LOWER(taluk)=LOWER(?)
           AND LOWER(hobli)=LOWER(?) AND LOWER(village)=LOWER(?)
           AND LOWER(property_identifier_type)=LOWER(?) AND LOWER(property_identifier)=LOWER(?) LIMIT 1`,
        [req.user?.tenantId, p.district, p.taluk, p.hobli, p.village, p.propertyIdentifierType, p.propertyIdentifier]
      )
    : await pool.query(
        `SELECT id, name, district, taluk, hobli, village, survey_number, subdivision
         FROM properties WHERE tenant_id=? AND LOWER(district)=LOWER(?) AND LOWER(taluk)=LOWER(?)
           AND LOWER(hobli)=LOWER(?) AND LOWER(village)=LOWER(?) AND LOWER(survey_number)=LOWER(?)
           AND LOWER(COALESCE(subdivision,''))=LOWER(COALESCE(?,'')) LIMIT 1`,
        [req.user?.tenantId, p.district, p.taluk, p.hobli, p.village, p.surveyNumber, p.subdivision]
      );
  if (duplicate.rowCount && !p.allowDuplicate) {
    return res.status(409).json({
      error: 'A similar property already exists. Please review it.',
      duplicate: duplicate.rows[0]
    });
  }
  const id = crypto.randomUUID();
  const applicationNumber = `OJIX-PR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${id.replace(/-/g,'').slice(0,8).toUpperCase()}`;
  const generatedName = p.name || [p.reviewPurposeCustom || p.reviewPurpose.replace(/_/g, ' '), p.village, p.propertyType === 'agricultural' ? p.surveyNumber : p.propertyIdentifier].filter(Boolean).join(' - ');
  await pool.query(
    `INSERT INTO properties
      (id, tenant_id, application_number, name, review_purpose, review_purpose_custom, primary_document_type, primary_document_type_custom, property_identifier, property_identifier_type, property_type, village, hobli, taluk, district, district_id, taluk_id, hobli_id, village_id, survey_number,
       subdivision, extent, extent_value, extent_unit, boundary_north, boundary_south, boundary_east, boundary_west,
       address, latitude, longitude, coordinate_source, coordinate_confidence, coordinate_captured_at, notes, identity_state,
       created_by_uid, updated_by_uid)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      req.user?.tenantId,
      applicationNumber,
      generatedName,
      p.reviewPurpose,
      p.reviewPurposeCustom,
      p.primaryDocumentType,
      p.primaryDocumentTypeCustom,
      p.propertyIdentifier,
      p.propertyIdentifierType,
      p.propertyType,
      p.village,
      p.hobli,
      p.taluk,
      p.district,
      p.districtId || null,
      p.talukId || null,
      p.hobliId || null,
      p.villageId || null,
      p.surveyNumber,
      p.subdivision,
      p.extent,
      p.extentValue ?? null,
      p.extentUnit,
      p.boundaryNorth,
      p.boundarySouth,
      p.boundaryEast,
      p.boundaryWest,
      p.address,
      p.latitude ?? null,
      p.longitude ?? null,
      p.coordinateSource,
      p.coordinateConfidence ?? null,
      p.coordinateCapturedAt ? new Date(p.coordinateCapturedAt) : null,
      p.notes,
      p.identityState,
      req.user?.uid || 'unknown',
      req.user?.uid || 'unknown'
    ]
  );

  const result = await pool.query(
    'SELECT * FROM properties WHERE id=? AND tenant_id=?',
    [id, req.user?.tenantId]
  );

  await pool.query(
    `INSERT INTO parcel_refs
      (id, tenant_id, property_id, sequence_no, is_primary, district, taluk, hobli, village,
       survey_number, subdivision, extent_raw, extent_value, extent_unit, source_description,
       fact_state, notes, created_by_uid)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [crypto.randomUUID(), req.user?.tenantId, id, 1, 1, p.district, p.taluk, p.hobli, p.village,
      p.surveyNumber, p.subdivision, p.extent, p.extentValue ?? null, p.extentUnit,
      'Created from primary property identity', p.identityState, '', req.user?.uid || 'unknown']
  );

  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'property.created', 'property', id, { name: generatedName, reviewPurpose: p.reviewPurpose, primaryDocumentType: p.primaryDocumentType, applicationNumber });
  res.status(201).json({ item: result.rows[0] });
}));

app.get('/api/properties/:id', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query("SELECT * FROM properties WHERE id=? AND tenant_id=? AND ? <> 'support' AND (? <> 'viewer' OR status='complete') AND (? <> 'lawyer' OR assigned_lawyer_uid=?) AND (? <> 'analyst' OR assigned_analyst_uid=?) AND (? <> 'operations' OR assigned_operations_uid=? OR assigned_operations_uid IS NULL OR assigned_operations_uid='')", [req.params.id, req.user?.tenantId, req.user?.role || 'viewer', req.user?.role || 'viewer', req.user?.role || 'viewer', req.user?.uid || '', req.user?.role || 'viewer', req.user?.uid || '', req.user?.role || 'viewer', req.user?.uid || '']);
  if (!result.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const documents = req.user?.role === 'viewer'
    ? { rows: [] }
    : await pool.query('SELECT id, original_filename, mime_type, size_bytes, sha256, doc_type, doc_type_custom, classification_confidence, classification_source, manual_review_status, processing_status, extracted_fields, created_at FROM documents WHERE property_id=? AND tenant_id=? ORDER BY created_at DESC', [req.params.id, req.user?.tenantId]);
  const findings = ['owner','admin','lawyer','analyst','consultant'].includes(req.user?.role || '')
    ? await pool.query('SELECT * FROM risk_findings WHERE property_id=? AND tenant_id=? ORDER BY created_at DESC', [req.params.id, req.user?.tenantId])
    : { rows: [] };
  res.json({ item: result.rows[0], documents: documents.rows, findings: findings.rows });
}));

const workflowUpdateSchema = z.object({
  status: z.enum(['draft','documents_pending','in_review','clarification_required','ready_for_review','approved','complete','closed','archived']),
  priority: z.enum(['low','normal','high','urgent']),
  dueDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()]).optional(),
  assignedLawyerUid: z.string().max(191).optional().default(''),
  assignedAnalystUid: z.string().max(191).optional().default(''),
  assignedOperationsUid: z.string().max(191).optional().default(''),
  reason: z.string().trim().min(3).max(500),
});

async function getWorkflowApprovalChecks(property: any, tenantId: string) {
  const blockers: string[] = [];
  if (!property.assigned_lawyer_uid) blockers.push('Assign a Lead Lawyer before approval.');
  if (!String(property.survey_number || '').trim()) blockers.push('Record the survey or property identifier.');
  if (!String(property.village || '').trim()) blockers.push('Record the Index-II village.');
  if (!String(property.extent || '').trim()) blockers.push('Record the property extent.');
  if (property.latitude == null || property.longitude == null) blockers.push('Record both latitude and longitude.');
  if (![property.boundary_north, property.boundary_south, property.boundary_east, property.boundary_west].every(value => String(value || '').trim())) blockers.push('Record all four schedule boundaries.');

  const documentResult = await pool!.query(
    'SELECT original_filename, manual_review_status, extracted_fields FROM documents WHERE property_id=? AND tenant_id=? ORDER BY created_at',
    [property.id, tenantId]
  );
  if (!documentResult.rowCount) blockers.push('Upload at least one source document.');
  const manualReviewFiles = documentResult.rows.filter(document => document.manual_review_status === 'required').map(document => document.original_filename);
  if (manualReviewFiles.length) blockers.push(`Complete manual review for ${manualReviewFiles.length} document${manualReviewFiles.length === 1 ? '' : 's'}.`);
  const unverifiedFiles = documentResult.rows.filter(document => !document.extracted_fields?.reviewState?.isVerified).map(document => document.original_filename);
  if (unverifiedFiles.length) blockers.push(`Verify ${unverifiedFiles.length} source document${unverifiedFiles.length === 1 ? '' : 's'} against the application.`);

  return { ready: blockers.length === 0, blockers, documentCount: documentResult.rowCount, verifiedDocumentCount: documentResult.rowCount - unverifiedFiles.length };
}

app.get('/api/properties/:id/workflow', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const property = await pool.query('SELECT * FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!property.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const membershipResult = await pool.query("SELECT user_uid, email, role FROM org_memberships WHERE organization_id=? AND role IN ('lawyer','analyst','operations') ORDER BY role,email", [req.user?.tenantId]);
  const members = membershipResult.rows.map(member => {
    const account = DUMMY_ACCOUNTS.find(item => item.uid === member.user_uid);
    return { uid: member.user_uid, email: member.email, role: member.role, name: account?.name || member.email || member.user_uid };
  });
  const history = await pool.query('SELECT * FROM property_workflow_history WHERE property_id=? AND tenant_id=? ORDER BY created_at DESC LIMIT 50', [req.params.id, req.user?.tenantId]);
  const approvalChecks = await getWorkflowApprovalChecks(property.rows[0], req.user?.tenantId || '');
  res.json({ item: property.rows[0], members, history: history.rows, approvalChecks });
}));

app.patch('/api/properties/:id/workflow', authGuard, adminGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed = workflowUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid workflow update.', issues: parsed.error.flatten() });
  const currentResult = await pool.query('SELECT * FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!currentResult.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const current = currentResult.rows[0];
  const update = parsed.data;
  const assignments = [
    ['lawyer', update.assignedLawyerUid],
    ['analyst', update.assignedAnalystUid],
    ['operations', update.assignedOperationsUid],
  ] as const;
  for (const [role, uid] of assignments) {
    if (!uid) continue;
    const member = await pool.query('SELECT user_uid FROM org_memberships WHERE organization_id=? AND user_uid=? AND role=? LIMIT 1', [req.user?.tenantId, uid, role]);
    if (!member.rowCount) return res.status(400).json({ error: `Selected ${role} is not an active member of this workspace.` });
  }
  if (['approved','complete'].includes(update.status)) {
    const candidate = { ...current, assigned_lawyer_uid: update.assignedLawyerUid };
    const approvalChecks = await getWorkflowApprovalChecks(candidate, req.user?.tenantId || '');
    if (!approvalChecks.ready) return res.status(409).json({ error: 'This application cannot be approved or released until the evidence safeguards are complete.', issues: approvalChecks.blockers, approvalChecks });
    if (update.status === 'complete' && current.status !== 'approved' && current.status !== 'complete') return res.status(409).json({ error: 'Approve the application before releasing it as complete.', issues: ['Change the status to Approved first, then release it as Complete.'] });
  }
  const before = { status:current.status, priority:current.workflow_priority, dueDate:current.due_date, assignedLawyerUid:current.assigned_lawyer_uid, assignedAnalystUid:current.assigned_analyst_uid, assignedOperationsUid:current.assigned_operations_uid };
  const after = { status:update.status, priority:update.priority, dueDate:update.dueDate || null, assignedLawyerUid:update.assignedLawyerUid, assignedAnalystUid:update.assignedAnalystUid, assignedOperationsUid:update.assignedOperationsUid };
  if (JSON.stringify(before) === JSON.stringify(after)) return res.status(400).json({ error: 'No workflow changes were supplied.' });
  await pool.query(`UPDATE properties SET status=?, workflow_priority=?, due_date=?, assigned_lawyer_uid=?, assigned_analyst_uid=?, assigned_operations_uid=?, updated_by_uid=?, updated_at=now() WHERE id=? AND tenant_id=?`, [after.status,after.priority,after.dueDate,after.assignedLawyerUid,after.assignedAnalystUid,after.assignedOperationsUid,req.user?.uid||'unknown',req.params.id,req.user?.tenantId]);
  await pool.query('INSERT INTO property_workflow_history (id,tenant_id,property_id,previous_status,new_status,reason,changes_json,changed_by_uid) VALUES (?,?,?,?,?,?,?,?)', [crypto.randomUUID(),req.user?.tenantId,req.params.id,current.status,after.status,update.reason,JSON.stringify({before,after}),req.user?.uid||'unknown']);
  await audit(req.user?.uid||'unknown',req.user?.tenantId,'property.workflow_updated','property',req.params.id,{before,after,reason:update.reason});
  const result = await pool.query('SELECT * FROM properties WHERE id=? AND tenant_id=?',[req.params.id,req.user?.tenantId]);
  res.json({ item: result.rows[0] });
}));

app.get('/api/properties/:id/parcels', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const property = await pool.query('SELECT id FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!property.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const result = await pool.query(
    'SELECT * FROM parcel_refs WHERE property_id=? AND tenant_id=? ORDER BY is_primary DESC, sequence_no, created_at',
    [req.params.id, req.user?.tenantId]
  );
  res.json({ items: result.rows });
}));

app.post('/api/properties/:id/parcels', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed = parcelReferenceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid parcel reference.', issues: parsed.error.flatten() });
  const property = await pool.query('SELECT id FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!property.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const p = parsed.data;
  const hasExtentValue = p.extentValue !== null && p.extentValue !== undefined;
  if (hasExtentValue !== Boolean(p.extentUnit)) return res.status(400).json({ error: 'Parcel extent value and unit must be provided together.' });
  const duplicate = await pool.query(
    `SELECT id FROM parcel_refs WHERE property_id=? AND tenant_id=? AND LOWER(village)=LOWER(?)
       AND LOWER(survey_number)=LOWER(?) AND LOWER(subdivision)=LOWER(?) LIMIT 1`,
    [req.params.id, req.user?.tenantId, p.village, p.surveyNumber, p.subdivision]
  );
  if (duplicate.rowCount) return res.status(409).json({ error: 'This parcel reference is already recorded for the property.' });
  const sequence = await pool.query('SELECT COALESCE(MAX(sequence_no),0)+1 AS next_sequence FROM parcel_refs WHERE property_id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO parcel_refs
      (id, tenant_id, property_id, sequence_no, is_primary, district, taluk, hobli, village,
       survey_number, subdivision, extent_raw, extent_value, extent_unit, source_description,
       fact_state, notes, created_by_uid)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, req.user?.tenantId, req.params.id, Number(sequence.rows[0].next_sequence), 0,
      p.district, p.taluk, p.hobli, p.village, p.surveyNumber, p.subdivision, p.extentRaw,
      p.extentValue ?? null, p.extentUnit, p.sourceDescription, p.factState, p.notes, req.user?.uid || 'unknown']
  );
  const result = await pool.query('SELECT * FROM parcel_refs WHERE id=? AND tenant_id=?', [id, req.user?.tenantId]);
  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'parcel_reference.created', 'parcel_reference', id, { propertyId: req.params.id, surveyNumber: p.surveyNumber });
  res.status(201).json({ item: result.rows[0] });
}));

app.delete('/api/properties/:id/parcels/:parcelId', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parcel = await pool.query('SELECT id, is_primary FROM parcel_refs WHERE id=? AND property_id=? AND tenant_id=?', [req.params.parcelId, req.params.id, req.user?.tenantId]);
  if (!parcel.rowCount) return res.status(404).json({ error: 'Parcel reference not found.' });
  if (Boolean(parcel.rows[0].is_primary)) return res.status(409).json({ error: 'The primary parcel is part of the property identity and cannot be deleted here.' });
  await pool.query('DELETE FROM parcel_refs WHERE id=? AND property_id=? AND tenant_id=?', [req.params.parcelId, req.params.id, req.user?.tenantId]);
  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'parcel_reference.deleted', 'parcel_reference', req.params.parcelId, { propertyId: req.params.id });
  res.status(204).end();
}));

app.patch('/api/properties/:id', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed = basePropertySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid property payload.', issues: parsed.error.flatten() });
  const existing = await pool.query('SELECT * FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!existing.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const current = existing.rows[0];
  const mergedLocation = {
    ...parsed.data,
    name: parsed.data.name ?? current.name,
    district: parsed.data.district ?? current.district,
    taluk: parsed.data.taluk ?? current.taluk,
    hobli: parsed.data.hobli ?? current.hobli,
    village: parsed.data.village ?? current.village,
    surveyNumber: parsed.data.surveyNumber ?? current.survey_number,
    districtId: parsed.data.districtId ?? current.district_id,
    talukId: parsed.data.talukId ?? current.taluk_id,
    hobliId: parsed.data.hobliId ?? current.hobli_id,
    villageId: parsed.data.villageId ?? current.village_id,
  } as z.infer<typeof basePropertySchema>;
  const consistencyIssues = validatePropertyConsistency({
    ...mergedLocation,
    extentValue: parsed.data.extentValue ?? current.extent_value,
    extentUnit: parsed.data.extentUnit ?? current.extent_unit,
    latitude: parsed.data.latitude ?? current.latitude,
    longitude: parsed.data.longitude ?? current.longitude,
    coordinateSource: parsed.data.coordinateSource ?? current.coordinate_source,
    coordinateConfidence: parsed.data.coordinateConfidence ?? current.coordinate_confidence
  });
  if (consistencyIssues.length) return res.status(400).json({ error: consistencyIssues[0], issues: consistencyIssues });
  const locationValidation = await validateLocationHierarchy(mergedLocation);
  if (!locationValidation.valid) return res.status(400).json({ error: locationValidation.error });
  const allowed: Record<string,string> = { name:'name', reviewPurpose:'review_purpose', reviewPurposeCustom:'review_purpose_custom', primaryDocumentType:'primary_document_type', primaryDocumentTypeCustom:'primary_document_type_custom', propertyIdentifier:'property_identifier', propertyIdentifierType:'property_identifier_type', propertyType:'property_type', village:'village', hobli:'hobli', taluk:'taluk', district:'district', districtId:'district_id', talukId:'taluk_id', hobliId:'hobli_id', villageId:'village_id', surveyNumber:'survey_number', subdivision:'subdivision', extent:'extent', extentValue:'extent_value', extentUnit:'extent_unit', boundaryNorth:'boundary_north', boundarySouth:'boundary_south', boundaryEast:'boundary_east', boundaryWest:'boundary_west', address:'address', latitude:'latitude', longitude:'longitude', coordinateSource:'coordinate_source', coordinateConfidence:'coordinate_confidence', coordinateCapturedAt:'coordinate_captured_at', identityState:'identity_state', notes:'notes' };
  const entries = Object.entries(parsed.data).filter(([key]) => allowed[key]);
  if (!entries.length) return res.status(400).json({ error: 'No supported fields supplied.' });
  const values: unknown[] = [];
  const sets = entries.map(([key, value]) => {
    values.push(value);
    return `${allowed[key]}=?`;
  });

  values.push(req.user?.uid || 'unknown');
  sets.push('updated_by_uid=?', 'updated_at=now()');

  values.push(req.params.id);
  values.push(req.user?.tenantId);

  const result = await pool.query(
    `UPDATE properties
     SET ${sets.join(', ')}
     WHERE id=? AND tenant_id=?`,
    values
  );

  if (!result.rowCount) return res.status(404).json({ error: 'Property not found.' });

  const updated = await pool.query(
    'SELECT * FROM properties WHERE id=? AND tenant_id=?',
    [req.params.id, req.user?.tenantId]
  );

  const property = updated.rows[0];
  await pool.query(
    `UPDATE parcel_refs
     SET district=?, taluk=?, hobli=?, village=?, survey_number=?, subdivision=?,
         extent_raw=?, extent_value=?, extent_unit=?, fact_state=?, updated_at=now()
     WHERE property_id=? AND tenant_id=? AND is_primary=1`,
    [property.district, property.taluk, property.hobli, property.village,
      property.survey_number, property.subdivision, property.extent,
      property.extent_value, property.extent_unit, property.identity_state,
      req.params.id, req.user?.tenantId]
  );

  await audit(
    req.user?.uid || 'unknown',
    req.user?.tenantId,
    'property.updated',
    'property',
    req.params.id,
    { fields: entries.map(([k]) => k) }
  );

  res.json({ item: property });
}));

app.post('/api/properties/:id/analyze', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const property = await pool.query('SELECT * FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!property.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const p = property.rows[0];
  const docCount = await pool.query('SELECT COUNT(*) AS count FROM documents WHERE property_id=? AND tenant_id=?', [p.id, req.user?.tenantId]);
  const findings = buildBaselineFindings({ hasSurveyNumber: Boolean(p.survey_number), documentCount: docCount.rows[0].count, coordinatesPresent: p.latitude !== null && p.longitude !== null });
  // Query only explicitly imported spatial layers. No official layer is included in the starter seed.
  if (p.latitude !== null && p.longitude !== null) {
    const spatial = await pool.query(`SELECT id, layer_type, label, source_name, source_url, source_date, data_status,
      ST_Distance_Sphere(ST_Centroid(geom), ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326)) AS distance_m
      FROM spatial_layers WHERE active=true AND data_status='verified' AND source_name IS NOT NULL AND source_url IS NOT NULL AND source_date IS NOT NULL ORDER BY distance_m LIMIT 50`, [p.longitude, p.latitude]);
    for (const layer of spatial.rows) {
      findings.push({ code: `SPATIAL_${String(layer.layer_type).toUpperCase()}_${layer.id}`, title: `${layer.layer_type} layer nearby: ${layer.label}`, severity: 'unverified', points: 0, explanation: `A spatial dataset feature is approximately ${Math.round(Number(layer.distance_m))} metres from the entered map point. Proximity alone does not establish legal impact or boundary intersection. Source: ${layer.source_name || 'not recorded'}.`, evidenceStatus: layer.data_status === 'verified' ? 'verified' : layer.data_status === 'demo' ? 'demo' : 'unverified', nextAction: 'Review source metadata, geometry quality, applicable buffer rules and obtain confirmation from the competent authority.' } as RiskFinding);
    }
  }
  await pool.query('DELETE FROM risk_findings WHERE property_id=? AND tenant_id=?', [p.id, req.user?.tenantId]);
  for (const f of findings) await pool.query(`INSERT INTO risk_findings (id, tenant_id, property_id, code, title, severity, points, explanation, evidence_status, next_action, created_by_uid) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [crypto.randomUUID(),req.user?.tenantId,p.id,f.code,f.title,f.severity,f.points,f.explanation,f.evidenceStatus,f.nextAction,req.user?.uid || 'unknown']);
  const summary = calculateRisk(findings);
  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'property.analysis_run', 'property', p.id, summary);
  res.json({ summary, findings, dataStatus: 'Starter analysis uses completeness checks and only imported spatial layers. No live government record verification is performed.' });
}));

const maxBytes = Number(process.env.MAX_UPLOAD_MB || 25) * 1024 * 1024;
const upload = multer({ storage: multer.diskStorage({ destination: (_req,_file,cb)=>cb(null,uploadDir), filename: (_req,file,cb)=>cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).slice(0,12)}`) }), limits: { fileSize: maxBytes, files: 10 }, fileFilter: (_req,file,cb) => {
  const allowed = ['application/pdf','image/jpeg','image/png','image/tiff'];
  if (!allowed.includes(file.mimetype)) return cb(new Error('Only PDF, JPEG, PNG and TIFF files are allowed.'));
  cb(null, true);
} });

export const FORBIDDEN_PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function isSafeFieldPath(pathStr: string): boolean {
  if (!pathStr || typeof pathStr !== 'string') return false;
  const parts = pathStr.split('.');
  return parts.every(part => {
    const trimmed = part.trim();
    return trimmed.length > 0 && !FORBIDDEN_PROTOTYPE_KEYS.has(trimmed);
  });
}

export function getNestedValue(obj: any, pathStr: string): any {
  if (!obj || typeof obj !== 'object' || !pathStr || typeof pathStr !== 'string') return undefined;
  const parts = pathStr.split('.');
  for (const part of parts) {
    if (FORBIDDEN_PROTOTYPE_KEYS.has(part.trim())) return undefined;
  }
  return parts.reduce((acc, part) => {
    const trimmed = part.trim();
    return acc && typeof acc === 'object' && !FORBIDDEN_PROTOTYPE_KEYS.has(trimmed) ? acc[trimmed] : undefined;
  }, obj);
}

export function setNestedValue(obj: any, pathStr: string, value: any): boolean {
  if (!obj || typeof obj !== 'object' || !pathStr || typeof pathStr !== 'string') return false;
  const parts = pathStr.split('.');
  for (const part of parts) {
    if (FORBIDDEN_PROTOTYPE_KEYS.has(part.trim())) {
      return false;
    }
  }
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i].trim();
    if (FORBIDDEN_PROTOTYPE_KEYS.has(part)) return false;
    if (!curr[part] || typeof curr[part] !== 'object' || Array.isArray(curr[part])) {
      curr[part] = {};
    }
    curr = curr[part];
  }
  const lastPart = parts[parts.length - 1].trim();
  if (FORBIDDEN_PROTOTYPE_KEYS.has(lastPart)) return false;
  curr[lastPart] = value;
  return true;
}

export function resolveSafeUploadPath(storageKey: string | null | undefined): { safePath: string | null; isTraversal: boolean } {
  if (!storageKey || typeof storageKey !== 'string') {
    return { safePath: null, isTraversal: false };
  }
  // Check for traversal tokens, slashes, or null bytes in standard single-file storage keys
  if (storageKey.includes('\0') || storageKey.includes('..') || storageKey.includes('/') || storageKey.includes('\\')) {
    return { safePath: null, isTraversal: true };
  }

  const normalizedUploadDir = path.resolve(uploadDir);
  const resolvedPath = path.resolve(normalizedUploadDir, storageKey);

  // Must reside strictly within normalizedUploadDir
  if (!resolvedPath.startsWith(normalizedUploadDir + path.sep)) {
    return { safePath: null, isTraversal: true };
  }

  // Relative path must not escape
  const relative = path.relative(normalizedUploadDir, resolvedPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return { safePath: null, isTraversal: true };
  }

  return { safePath: resolvedPath, isTraversal: false };
}

app.post('/api/properties/:id/documents', authGuard, documentIntakeGuard, upload.array('files', 10), asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const property = await pool.query('SELECT id FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!property.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const files = (req.files || []) as Express.Multer.File[];
  const requestedDocumentType = String(req.body?.documentType || '').trim();
  const allowedDocumentTypes = new Set(['sale_deed','gift_deed','partition_deed','release_deed','power_of_attorney','encumbrance_certificate','rtc_pahani','mutation_record','survey_sketch_tippan','khata_e_khata','property_tax_receipt','layout_approval_conversion_order','master_plan_zoning_document','court_order_legal_notice','other','e_khata','mutation_extract','survey_sketch','tax_receipt','conversion_order','layout_approval','court_order']);
  if (requestedDocumentType && !allowedDocumentTypes.has(requestedDocumentType)) return res.status(400).json({ error: 'Unsupported document type.' });
  if (!files.length) return res.status(400).json({ error: 'No files received. Use multipart form field "files".' });
  let metadata: Array<{documentType?:string;customDocumentType?:string;classificationConfidence?:number|null;manualReview?:boolean}> = [];
  if (req.body?.metadata) {
    try { metadata = JSON.parse(String(req.body.metadata)); } catch { return res.status(400).json({ error: 'Document metadata must be valid JSON.' }); }
    if (!Array.isArray(metadata) || metadata.length !== files.length) return res.status(400).json({ error: 'Provide one metadata entry for each uploaded file.' });
  }
  const preparedFiles = files.map(file => {
    const fileBuffer = fs.readFileSync(file.path);
    return { file, sha256: crypto.createHash('sha256').update(fileBuffer).digest('hex') };
  });
  const hashesSeen = new Set<string>();
  for (const prepared of preparedFiles) {
    const duplicateInBatch = hashesSeen.has(prepared.sha256);
    hashesSeen.add(prepared.sha256);
    const existing = duplicateInBatch
      ? { rowCount: 0, rows: [] as any[] }
      : await pool.query(
          `SELECT id, original_filename, created_at
           FROM documents
           WHERE tenant_id=? AND property_id=? AND sha256=? AND governance_status<>'quarantined'
           ORDER BY created_at DESC LIMIT 1`,
          [req.user?.tenantId, req.params.id, prepared.sha256]
        );
    if (duplicateInBatch || existing.rowCount) {
      for (const item of preparedFiles) fs.unlink(item.file.path, () => {});
      await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'document.duplicate_rejected', 'property', req.params.id, {
        filename: prepared.file.originalname,
        sha256: prepared.sha256,
        duplicateDocumentId: existing.rows[0]?.id || null,
        duplicateInBatch,
      });
      return res.status(409).json({
        error: `Duplicate document rejected: ${prepared.file.originalname} has already been uploaded to this application.`,
        code: 'DUPLICATE_DOCUMENT',
        duplicate: existing.rows[0] || { batch: true },
      });
    }
  }
  const inserted = [];
  for (const [fileIndex, prepared] of preparedFiles.entries()) {
    const { file, sha256 } = prepared;
    const fileMetadata = metadata[fileIndex] || {};
    const selectedType = String(fileMetadata.documentType || requestedDocumentType || '').trim();
    if (selectedType && !allowedDocumentTypes.has(selectedType)) return res.status(400).json({ error: `Unsupported document type for ${file.originalname}.` });
    if (selectedType === 'other' && !String(fileMetadata.customDocumentType || '').trim()) return res.status(400).json({ error: `Enter a custom document type for ${file.originalname}.` });
    if (fileMetadata.classificationConfidence != null && (!Number.isFinite(Number(fileMetadata.classificationConfidence)) || Number(fileMetadata.classificationConfidence) < 0 || Number(fileMetadata.classificationConfidence) > 1)) return res.status(400).json({ error: `Classification confidence for ${file.originalname} must be between 0 and 1.` });
    const documentId = crypto.randomUUID();
    const classificationConfidence = fileMetadata.classificationConfidence == null ? (selectedType ? 1 : 0) : Number(fileMetadata.classificationConfidence);
    const initialExtracted = pendingDocumentFields(documentId, selectedType || 'other', classificationConfidence);
    const needsManualReview = true;
    const processingStatus = 'manual_review';
    const storedDocument = await documentStorage.put({
      localPath: file.path,
      objectKey: buildTenantObjectKey({
        tenantId: req.user?.tenantId || 'unknown-tenant',
        propertyId: req.params.id,
        documentId,
        originalFilename: file.originalname,
      }),
      mimeType: file.mimetype,
    });
    if (storedDocument.provider !== 'local') await fs.promises.unlink(file.path).catch(() => {});

    await pool.query(
      `INSERT INTO documents
       (id, tenant_id, property_id, doc_type, doc_type_custom, classification_confidence, classification_source, manual_review_status, original_filename, storage_key,
        mime_type, size_bytes, sha256, processing_status, extracted_text,
        extracted_fields, uploaded_by_uid)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        documentId,
        req.user?.tenantId,
        req.params.id,
        initialExtracted.documentType,
        String(fileMetadata.customDocumentType || '').trim(),
        classificationConfidence,
        selectedType ? 'manual' : 'automatic',
        needsManualReview ? 'required' : 'not_required',
        file.originalname,
        storedDocument.storageKey,
        file.mimetype,
        file.size,
        sha256,
        processingStatus,
        '',
        JSON.stringify(initialExtracted),
        req.user?.uid || 'unknown',
      ]
    );

    const result = await pool.query(
      `SELECT id, original_filename, mime_type, size_bytes, sha256,
              doc_type, doc_type_custom, classification_confidence, classification_source, manual_review_status, processing_status, extracted_fields, created_at
       FROM documents
       WHERE id=? AND property_id=? AND tenant_id=?`,
      [documentId, req.params.id, req.user?.tenantId]
    );

    inserted.push(result.rows[0]);
  }
  const importedTypes = inserted.map((item: any) => item.doc_type).filter(Boolean);
  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'document.uploaded', 'property', req.params.id, { count: inserted.length, documentTypes: importedTypes });
  if (importedTypes.includes('rtc_pahani')) {
    await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'rtc.assisted_imported', 'property', req.params.id, {
      documentIds: inserted.filter((item: any) => item.doc_type === 'rtc_pahani').map((item: any) => item.id),
      source: 'user_supplied_government_record',
      verificationStatus: 'manual_review_required'
    });
  }
  res.status(201).json({ items: inserted, note: 'Files uploaded. OCR extraction is pending; source facts require manual review.' });
}));

app.get('/api/properties/:id/documents/:docId/file', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const docResult = await pool.query(
    'SELECT * FROM documents WHERE id=? AND property_id=? AND tenant_id=?',
    [req.params.docId, req.params.id, req.user?.tenantId]
  );
  if (!docResult.rowCount) return res.status(404).json({ error: 'Document not found.' });
  const doc = docResult.rows[0];

  if (String(doc.storage_key).startsWith('supabase:')) {
    const signedUrl = await documentStorage.createSignedUrl(String(doc.storage_key), 60);
    if (!signedUrl) return res.status(503).json({ error: 'Cloud document storage is not configured.' });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.redirect(307, signedUrl);
  }

  const { safePath, isTraversal } = resolveSafeUploadPath(doc.storage_key);
  if (isTraversal || !safePath) {
    return res.status(403).json({ error: 'Access denied: invalid file path traversal.' });
  }

  if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
    return res.status(404).json({ error: 'Document file not found on disk.' });
  }

  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_filename)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  const stream = fs.createReadStream(safePath);
  stream.on('error', (err) => {
    console.error('File stream error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to stream document file.' });
  });
  stream.pipe(res);
}));

app.post('/api/properties/:id/documents/:docId/signed-url', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const docResult = await pool.query(
    'SELECT id, storage_key FROM documents WHERE id=? AND property_id=? AND tenant_id=?',
    [req.params.docId, req.params.id, req.user?.tenantId]
  );
  if (!docResult.rowCount) return res.status(404).json({ error: 'Document not found.' });

  const configuredTtl = Number(process.env.SIGNED_URL_TTL_SECONDS || 300);
  const requestedTtl = Number(req.body?.expiresInSeconds || configuredTtl);
  const expiresInSeconds = Math.max(30, Math.min(Number.isFinite(requestedTtl) ? requestedTtl : configuredTtl, 900));
  const storageKey = String(docResult.rows[0].storage_key || '');

  if (!storageKey.startsWith('supabase:')) {
    return res.json({
      url: `/api/properties/${encodeURIComponent(req.params.id)}/documents/${encodeURIComponent(req.params.docId)}/file`,
      expiresInSeconds: null,
      provider: 'local',
      note: 'Local sandbox files use the authenticated API route. Expiring links are enabled when Supabase storage is configured.',
    });
  }

  const url = await documentStorage.createSignedUrl(storageKey, expiresInSeconds);
  if (!url) return res.status(503).json({ error: 'Cloud document storage is not configured.' });
  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'document.signed_url_created', 'document', req.params.docId, {
    propertyId: req.params.id,
    expiresInSeconds,
  });
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ url, expiresInSeconds, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(), provider: 'supabase' });
}));

app.post('/api/properties/:id/documents/:docId/extract', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const docResult = await pool.query(
    'SELECT * FROM documents WHERE id=? AND property_id=? AND tenant_id=?',
    [req.params.docId, req.params.id, req.user?.tenantId]
  );
  if (!docResult.rowCount) return res.status(404).json({ error: 'Document not found.' });
  const doc = docResult.rows[0];

  if (String(doc.storage_key).startsWith('supabase:') && !usableExtractedText(req.body?.text) && !req.body?.jsonPayload && !req.body?.tokens) {
    return res.status(409).json({
      error: 'Cloud document OCR requires the background-worker adapter. Supply extracted text/provider output or use local storage in the sandbox.',
      code: 'CLOUD_OCR_WORKER_NOT_CONFIGURED',
    });
  }

  const { safePath, isTraversal } = resolveSafeUploadPath(doc.storage_key);
  if (isTraversal || !safePath) {
    return res.status(403).json({ error: 'Access denied: invalid file path traversal.' });
  }

  let suppliedText = usableExtractedText(req.body?.text) || usableExtractedText(doc.extracted_text);
  const hasProviderPayload = req.body?.jsonPayload && typeof req.body.jsonPayload === 'object';
  const hasOcrTokens = Array.isArray(req.body?.tokens) && req.body.tokens.length > 0;
  if (!suppliedText && !hasProviderPayload && !hasOcrTokens) {
    if (!fs.existsSync(safePath)) return res.status(404).json({ error: 'Document file not found on disk.' });
    try {
      const ocr = await runLocalOcr(safePath, doc.mime_type || 'application/octet-stream');
      suppliedText = ocr.text;
    } catch (error) {
      console.error('Local OCR failed:', error);
      return res.status(422).json({
        error: error instanceof Error ? error.message : 'Automatic OCR could not read this document.',
        code: 'OCR_FAILED',
      });
    }
  }

  const extractionInput: ExtractionInput = {
    text: suppliedText || undefined,
    tokens: req.body?.tokens || undefined,
    jsonPayload: req.body?.jsonPayload || undefined,
  };

  const extracted = extractDocument(extractionInput, {
    documentId: doc.id,
    filename: doc.original_filename,
    mimeType: doc.mime_type,
  });

  const processingStatus = extracted.overallConfidence >= 0.60 ? 'completed' : 'manual_review';
  const extractedText = extractionInput.text || '';

  await pool.query(
    `UPDATE documents
     SET doc_type = ?,
         extracted_fields = ?,
         extracted_text = COALESCE(NULLIF(?, ''), extracted_text),
         processing_status = ?,
         manual_review_status = ?
     WHERE id = ? AND property_id = ? AND tenant_id = ?`,
    [
      extracted.documentType,
      JSON.stringify(extracted),
      extractedText,
      processingStatus,
      processingStatus === 'completed' ? 'not_required' : 'required',
      doc.id,
      req.params.id,
      req.user?.tenantId,
    ]
  );

  const updateResult = await pool.query(
    `SELECT id, property_id, original_filename, mime_type, size_bytes,
            sha256, doc_type, processing_status, extracted_fields, created_at
     FROM documents
     WHERE id=? AND property_id=? AND tenant_id=?`,
    [doc.id, req.params.id, req.user?.tenantId]
  );

  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'document.extracted', 'document', doc.id, {
    docType: extracted.documentType,
    overallConfidence: extracted.overallConfidence,
  });

  res.json({
    document: updateResult.rows[0],
    extractedFields: extracted,
  });
}));

function documentVerificationIssues(fields: ExtractedDocumentFields): string[] {
  const issues: string[] = [];
  const missing = (value: unknown) => !value || ['not recorded','not specified','none','unknown','—'].includes(String(value).trim().toLowerCase());
  const schedule = fields.propertySchedule;
  const conveyanceTypes = new Set(['sale_deed','gift_deed','partition_deed','release_deed','power_of_attorney']);
  if (missing(fields.documentNumber)) issues.push('Document / registration number is missing.');
  if (missing(schedule?.surveyNumber)) issues.push('Survey number is missing.');
  if (missing(schedule?.village)) issues.push('Village is missing.');
  if (!schedule?.extent?.normalizedSqFt || schedule.extent.normalizedSqFt <= 0) issues.push('A valid property extent is missing.');
  const boundaries = schedule?.boundaries;
  if (!boundaries || [boundaries.north,boundaries.south,boundaries.east,boundaries.west].some(missing)) issues.push('All four schedule boundaries must be reviewed.');
  if (conveyanceTypes.has(fields.documentType)) {
    if (!fields.parties?.length) issues.push('Vendor/claimant parties are missing.');
    if (missing(fields.executionDate)) issues.push('Execution date is missing.');
    if (missing(fields.registrationDate)) issues.push('Registration date is missing.');
  }
  const confidence = fields.fieldConfidence || {};
  const lowConfidenceCore = ['documentNumber','surveyNumber','extent','boundaries'].filter(key => confidence[key] !== undefined && confidence[key] < 0.60);
  if (lowConfidenceCore.length) issues.push(`Low-confidence core fields require correction: ${lowConfidenceCore.join(', ')}.`);
  return issues;
}

function propertyDocumentIdentityIssues(fields: ExtractedDocumentFields, property: any): string[] {
  const clean = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const missing = (value: unknown) => !value || ['notrecorded','notspecified','none','unknown'].includes(clean(value));
  const issues: string[] = [];
  const documentSurvey = clean(fields.propertySchedule?.surveyNumber);
  const documentHissa = clean(fields.propertySchedule?.subdivisionHissa);
  const expectedSurvey = clean(property.survey_number);
  const expectedHissa = clean(property.subdivision);
  if (!missing(fields.propertySchedule?.surveyNumber) && expectedSurvey) {
    const surveyMatches = documentSurvey === clean(`${property.survey_number}${property.subdivision || ''}`) ||
      (documentSurvey === expectedSurvey && (!documentHissa || !expectedHissa || documentHissa === expectedHissa));
    if (!surveyMatches) issues.push(`Survey/Hissa does not match application ${property.survey_number}${property.subdivision ? `/${property.subdivision}` : ''}.`);
  }
  const documentVillage = clean(fields.propertySchedule?.village);
  const expectedVillage = clean(property.village);
  if (!missing(fields.propertySchedule?.village) && expectedVillage && documentVillage !== expectedVillage) {
    issues.push(`Village does not match application village ${property.village}.`);
  }
  if (missing(fields.propertySchedule?.surveyNumber) && missing(fields.propertySchedule?.village)) {
    issues.push('Survey/Hissa and village are missing, so the document cannot be linked confidently to this application.');
  }
  return issues;
}

app.patch('/api/properties/:id/documents/:docId/fields', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const docResult = await pool.query(
    'SELECT * FROM documents WHERE id=? AND property_id=? AND tenant_id=?',
    [req.params.docId, req.params.id, req.user?.tenantId]
  );
  if (!docResult.rowCount) return res.status(404).json({ error: 'Document not found.' });
  const doc = docResult.rows[0];

  let currentFields: ExtractedDocumentFields =
    typeof doc.extracted_fields === 'object' && doc.extracted_fields !== null && Object.keys(doc.extracted_fields).length > 0
      ? doc.extracted_fields
      : extractDocument('', { documentId: doc.id, filename: doc.original_filename, mimeType: doc.mime_type });

  const { fieldPath, newValue, rationale, overrides } = req.body || {};
  if (!rationale && !overrides && !fieldPath && req.body?.isVerified === undefined) {
    return res.status(400).json({ error: 'Rationale and field updates are required for reviewer overrides.' });
  }

  // Prototype Pollution Guard: Reject dangerous field paths immediately
  if (fieldPath && !isSafeFieldPath(fieldPath)) {
    return res.status(400).json({ error: 'Invalid fieldPath: prototype properties (__proto__, constructor, prototype) are strictly forbidden.' });
  }

  if (overrides && typeof overrides === 'object') {
    for (const key of Object.keys(overrides)) {
      if (!isSafeFieldPath(key)) {
        return res.status(400).json({ error: `Invalid override key "${key}": prototype properties are strictly forbidden.` });
      }
    }
  }

  // Enforce mandatory non-empty review rationale when overriding fields
  if (fieldPath && (!rationale || typeof rationale !== 'string' || rationale.trim().length === 0)) {
    return res.status(400).json({ error: 'A non-empty review rationale is mandatory when overriding extracted document fields.' });
  }

  if (overrides && typeof overrides === 'object') {
    for (const [key, ov] of Object.entries(overrides as Record<string, any>)) {
      const itemRationale = ov?.rationale || rationale;
      if (!itemRationale || typeof itemRationale !== 'string' || itemRationale.trim().length === 0) {
        return res.status(400).json({ error: `A non-empty review rationale is mandatory for override "${key}".` });
      }
    }
  }

  currentFields.reviewState = currentFields.reviewState || { isVerified: false, overrides: {} };
  currentFields.reviewState.overrides = currentFields.reviewState.overrides || {};

  if (fieldPath) {
    const previousValue = getNestedValue(currentFields, fieldPath);
    setNestedValue(currentFields, fieldPath, newValue);
    currentFields.reviewState.overrides[fieldPath] = {
      previousValue,
      newValue,
      rationale: rationale.trim(),
      reviewerUid: req.user?.uid || 'unknown',
      updatedAt: new Date().toISOString(),
    };
  }

  if (overrides && typeof overrides === 'object') {
    for (const [key, ov] of Object.entries(overrides as Record<string, any>)) {
      const prev = ov.previousValue !== undefined ? ov.previousValue : getNestedValue(currentFields, key);
      const next = ov.newValue;
      setNestedValue(currentFields, key, next);
      currentFields.reviewState.overrides[key] = {
        previousValue: prev,
        newValue: next,
        rationale: (ov.rationale || rationale).trim(),
        reviewerUid: req.user?.uid || 'unknown',
        updatedAt: new Date().toISOString(),
      };
    }
  }

  if (req.body?.isVerified !== undefined) {
    if (Boolean(req.body.isVerified) && !['owner', 'lawyer'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Only the Owner or Lead Advocate can verify document evidence.', requiredRoles: ['owner', 'lawyer'], currentRole: req.user?.role || 'viewer' });
    }
    if (Boolean(req.body.isVerified)) {
      const verificationIssues = documentVerificationIssues(currentFields);
      const propertyResult = await pool.query('SELECT survey_number, subdivision, village, district FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
      const identityIssues = propertyResult.rowCount ? propertyDocumentIdentityIssues(currentFields, propertyResult.rows[0]) : ['Property application was not found.'];
      if (verificationIssues.length || identityIssues.length) return res.status(409).json({ error: identityIssues.length ? 'Document identity does not match or cannot yet be confirmed for this application.' : 'Document cannot be verified until required evidence fields are reviewed.', issues: [...identityIssues, ...verificationIssues] });
    }
    currentFields.reviewState.isVerified = Boolean(req.body.isVerified);
    currentFields.reviewState.verifiedByUid = Boolean(req.body.isVerified) ? req.user?.uid || 'unknown' : undefined;
    currentFields.reviewState.verifiedAt = Boolean(req.body.isVerified) ? new Date().toISOString() : undefined;
  }

  const updatedDocType = currentFields.documentType || doc.doc_type || 'other';

  await pool.query(
    `UPDATE documents
     SET doc_type = ?,
         extracted_fields = ?,
         processing_status = ?,
         manual_review_status = ?
     WHERE id = ? AND property_id = ? AND tenant_id = ?`,
    [
      updatedDocType,
      JSON.stringify(currentFields),
      currentFields.reviewState.isVerified ? 'completed' : 'manual_review',
      currentFields.reviewState.isVerified ? 'completed' : 'required',
      doc.id,
      req.params.id,
      req.user?.tenantId,
    ]
  );

  const updateResult = await pool.query(
    `SELECT id, property_id, original_filename, mime_type, size_bytes,
            sha256, doc_type, processing_status, extracted_fields, created_at
     FROM documents
     WHERE id=? AND property_id=? AND tenant_id=?`,
    [doc.id, req.params.id, req.user?.tenantId]
  );

  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'document.fields_overridden', 'document', doc.id, {
    reviewerUid: req.user?.uid,
    rationale,
    overridesCount: Object.keys(currentFields.reviewState.overrides || {}).length,
  });

  res.json({
    document: updateResult.rows[0],
    extractedFields: currentFields,
  });
}));

const titleEventSchema = z.object({
  documentId: z.string().optional().nullable(),
  sequenceOrder: z.number().int().min(1).optional().default(1),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'eventDate must be in YYYY-MM-DD format'),
  registrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'registrationDate must be in YYYY-MM-DD format').optional().nullable(),
  deedType: z.string().trim().min(2),
  fromParties: z.array(z.object({
    name: z.string().trim().min(1),
    normalizedName: z.string().optional()
  })),
  toParties: z.array(z.object({
    name: z.string().trim().min(1),
    normalizedName: z.string().optional()
  })),
  extentSqFt: z.number().nonnegative(),
  extentRaw: z.string().optional().default(''),
  consideration: z.number().nonnegative().optional().default(0),
  status: z.enum(['verified', 'unverified', 'disputed']).optional().default('unverified'),
  disputeRationale: z.string().optional().nullable(),
  encumbranceStatus: z.enum(['active_mortgage', 'discharged', 'none']).optional().default('none'),
});

const titleReviewSchema = z.object({
  status: z.enum(['verified', 'disputed', 'unverified']),
  rationale: z.string().optional(),
});

app.get('/api/properties/:id/title-chain', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const propertyRes = await pool.query('SELECT * FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!propertyRes.rowCount) return res.status(404).json({ error: 'Property not found.' });

  const eventsResult = await pool.query(
    'SELECT * FROM title_events WHERE property_id=? AND tenant_id=? ORDER BY event_date ASC, sequence_order ASC',
    [req.params.id, req.user?.tenantId]
  );

  let events: TitleEvent[] = [];
  if (eventsResult.rowCount && eventsResult.rowCount > 0) {
    events = eventsResult.rows.map((row: any) => ({
      id: row.id,
      propertyId: row.property_id,
      documentId: row.document_id || '',
      sequenceOrder: Number(row.sequence_order),
      eventDate: row.event_date instanceof Date ? row.event_date.toISOString().slice(0, 10) : String(row.event_date),
      registrationDate: row.registration_date ? (row.registration_date instanceof Date ? row.registration_date.toISOString().slice(0, 10) : String(row.registration_date)) : undefined,
      deedType: row.deed_type,
      fromParties: typeof row.from_parties === 'string' ? JSON.parse(row.from_parties) : (row.from_parties || []),
      toParties: typeof row.to_parties === 'string' ? JSON.parse(row.to_parties) : (row.to_parties || []),
      extentSqFt: Number(row.extent_sq_ft),
      extentRaw: row.extent_raw || '',
      consideration: Number(row.consideration),
      status: row.status,
      disputeRationale: row.dispute_rationale || undefined,
      reviewedBy: row.reviewed_by || undefined,
      encumbranceStatus: row.encumbrance_status || 'none',
    }));
  }

  const dag = buildTitleDAG(events);
  const gaps = detectTitleGaps(events);

  res.json({
    events,
    dag,
    gaps,
    summary: {
      totalEvents: events.length,
      isAcyclic: dag.isAcyclic,
      nodeCount: dag.nodes.length,
      edgeCount: dag.edges.length,
      gapCount: gaps.length,
      verifiedCount: events.filter(e => e.status === 'verified').length,
      disputedCount: events.filter(e => e.status === 'disputed').length,
      unverifiedCount: events.filter(e => e.status === 'unverified').length,
    },
  });
}));

app.post('/api/properties/:id/title-events', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const propertyRes = await pool.query('SELECT id FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!propertyRes.rowCount) return res.status(404).json({ error: 'Property not found.' });

  const parsed = titleEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid title event payload.', issues: parsed.error.flatten() });
  }

  const evData = parsed.data;
  const fromParties = evData.fromParties.map(p => ({
    name: p.name,
    normalizedName: p.normalizedName || normalizePartyName(p.name).canonicalName,
  }));
  const toParties = evData.toParties.map(p => ({
    name: p.name,
    normalizedName: p.normalizedName || normalizePartyName(p.name).canonicalName,
  }));

  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO title_events
     (id, tenant_id, property_id, document_id, sequence_order, event_date,
      registration_date, deed_type, from_parties, to_parties, extent_sq_ft,
      extent_raw, consideration, status, dispute_rationale,
      encumbrance_status, reviewed_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      req.user?.tenantId,
      req.params.id,
      evData.documentId || null,
      evData.sequenceOrder,
      evData.eventDate,
      evData.registrationDate || null,
      evData.deedType,
      JSON.stringify(fromParties),
      JSON.stringify(toParties),
      evData.extentSqFt,
      evData.extentRaw,
      evData.consideration,
      evData.status,
      evData.disputeRationale || null,
      evData.encumbranceStatus,
      req.user?.uid || 'unknown',
    ]
  );

  const insertResult = await pool.query(
    'SELECT * FROM title_events WHERE id=? AND property_id=? AND tenant_id=?',
    [id, req.params.id, req.user?.tenantId]
  );

  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'title_event.created', 'property', req.params.id, {
    eventId: id,
    deedType: evData.deedType,
    eventDate: evData.eventDate,
  });

  res.status(201).json({ item: insertResult.rows[0] });
}));

app.post('/api/properties/:id/title-events/:eventId/review', authGuard, legalReviewerGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const eventRes = await pool.query(
    'SELECT * FROM title_events WHERE id=? AND property_id=? AND tenant_id=?',
    [req.params.eventId, req.params.id, req.user?.tenantId]
  );
  if (!eventRes.rowCount) return res.status(404).json({ error: 'Title event not found.' });

  const parsed = titleReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid review payload.', issues: parsed.error.flatten() });
  }

  const row = eventRes.rows[0];
  const currentEvent: TitleEvent = {
    id: row.id,
    propertyId: row.property_id,
    documentId: row.document_id || '',
    sequenceOrder: Number(row.sequence_order),
    eventDate: row.event_date instanceof Date ? row.event_date.toISOString().slice(0, 10) : String(row.event_date),
    registrationDate: row.registration_date ? (row.registration_date instanceof Date ? row.registration_date.toISOString().slice(0, 10) : String(row.registration_date)) : undefined,
    deedType: row.deed_type,
    fromParties: typeof row.from_parties === 'string' ? JSON.parse(row.from_parties) : (row.from_parties || []),
    toParties: typeof row.to_parties === 'string' ? JSON.parse(row.to_parties) : (row.to_parties || []),
    extentSqFt: Number(row.extent_sq_ft),
    extentRaw: row.extent_raw || '',
    consideration: Number(row.consideration),
    status: row.status,
    disputeRationale: row.dispute_rationale || undefined,
    reviewedBy: row.reviewed_by || undefined,
    encumbranceStatus: row.encumbrance_status || 'none',
  };

  let updatedEvent: TitleEvent;
  try {
    updatedEvent = recordReviewerDispute(
      currentEvent,
      parsed.data.status,
      parsed.data.rationale,
      req.user?.uid || 'legal_reviewer'
    );
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  await pool.query(
    `UPDATE title_events
     SET status = ?,
         dispute_rationale = ?,
         reviewed_by = ?,
         updated_at = now()
     WHERE id = ? AND tenant_id = ?`,
    [
      updatedEvent.status,
      updatedEvent.disputeRationale || null,
      updatedEvent.reviewedBy || null,
      req.params.eventId,
      req.user?.tenantId,
    ]
  );

  const updateResult = await pool.query(
    'SELECT * FROM title_events WHERE id=? AND tenant_id=?',
    [req.params.eventId, req.user?.tenantId]
  );

  await pool.query(
    `INSERT INTO title_reviews (id, tenant_id, property_id, event_id, status, rationale, reviewer_uid)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      req.user?.tenantId,
      req.params.id,
      req.params.eventId,
      updatedEvent.status,
      updatedEvent.disputeRationale || null,
      req.user?.uid || 'unknown',
    ]
  );

  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'title_event.reviewed', 'title_event', req.params.eventId, {
    status: updatedEvent.status,
    rationale: updatedEvent.disputeRationale,
  });

  res.json({ item: updateResult.rows[0] });
}));

app.get('/api/properties/:id/spatial-screening', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const p = await pool.query(
    'SELECT id, name, village, survey_number, latitude, longitude FROM properties WHERE id=? AND tenant_id=?',
    [req.params.id, req.user?.tenantId]
  );
  if (!p.rowCount) return res.status(404).json({ error: 'Property not found.' });

  const prop = p.rows[0];
  if (prop.latitude === null || prop.latitude === undefined || prop.longitude === null || prop.longitude === undefined) {
    return res.json({
      screeningStatus: 'missing_coordinates',
      message: 'Property coordinates are not recorded; spatial screening was not run.',
      drainClearanceStatus: 'unknown', lakeClearanceStatus: 'unknown', findings: [],
      cadastralParcelGeoJSON: null, georeferencedSnapshot: null,
    });
  }
  const lat = Number(prop.latitude);
  const lon = Number(prop.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(422).json({ error: 'Stored property coordinates are invalid; spatial screening was not run.', code: 'INVALID_STORED_COORDINATES' });
  }

  // MariaDB 10.4 computes spherical centroid-to-point distance in metres.
  const spatial = await pool.query(
    `SELECT id, layer_type, label, source_name, data_status,
            ST_Distance_Sphere(ST_Centroid(geom), ST_GeomFromText(CONCAT('POINT(', ?, ' ', ?, ')'), 4326)) AS distance_m
     FROM spatial_layers
     WHERE active=true AND data_status='verified' AND source_name IS NOT NULL AND source_url IS NOT NULL AND source_date IS NOT NULL
       AND layer_type IN ('swd_primary', 'swd_secondary', 'swd_tertiary', 'waterbody')
     ORDER BY distance_m LIMIT 50`,
    [lon, lat]
  );

  let layers: SpatialScreeningLayerInput[] = spatial.rows.map(r => ({
    id: r.id,
    layerType: r.layer_type as SpatialLayerType,
    label: r.label,
    distanceM: Math.round(Number(r.distance_m) * 10) / 10,
  }));

  // Retrieve linked parcel geometry from audit log if available
  let linkedParcelGeoJSON: any = null;
  const parcelAudit = await pool.query(
    `SELECT JSON_EXTRACT(details, '$.parcelGeoJSON') AS parcel_geojson
     FROM audit_events
     WHERE tenant_id=? AND entity_type='property' AND entity_id=? AND action='UPDATE_PARCEL_GEOMETRY'
     ORDER BY created_at DESC LIMIT 1`,
    [req.user?.tenantId, req.params.id]
  );
  if (parcelAudit.rowCount && parcelAudit.rows[0].parcel_geojson) {
    linkedParcelGeoJSON = typeof parcelAudit.rows[0].parcel_geojson === 'string'
      ? JSON.parse(parcelAudit.rows[0].parcel_geojson)
      : parcelAudit.rows[0].parcel_geojson;
  }

  const result = screenSpatialBuffers({ latitude: lat, longitude: lon }, layers, linkedParcelGeoJSON);
  if (linkedParcelGeoJSON) {
    result.cadastralParcelGeoJSON = linkedParcelGeoJSON;
  }
  if (result.cadastralParcelGeoJSON?.properties) {
    if (prop.survey_number && !result.cadastralParcelGeoJSON.properties.surveyNumber) {
      result.cadastralParcelGeoJSON.properties.surveyNumber = prop.survey_number;
    }
    if (prop.village && !result.cadastralParcelGeoJSON.properties.village) {
      result.cadastralParcelGeoJSON.properties.village = prop.village;
    }
  }

  res.json(result);
}));

app.post('/api/spatial/screen-point', authGuard, asyncRoute(async (req, res) => {
  const { latitude, longitude } = req.body;
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return res.status(400).json({ error: 'Both latitude and longitude are required; coordinates are never inferred.' });
  }
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return res.status(400).json({
      error: 'Invalid coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180.',
    });
  }

  let layers: SpatialScreeningLayerInput[] = [];
  if (pool) {
    try {
      const q = await pool.query(
        `SELECT id, layer_type, label, source_name, source_url, source_date,
                ST_X(ST_Centroid(geom)) as lon, ST_Y(ST_Centroid(geom)) as lat
         FROM spatial_layers
         WHERE active=true
           AND data_status='verified'
           AND source_name IS NOT NULL AND source_url IS NOT NULL AND source_date IS NOT NULL
           AND layer_type IN ('swd_primary', 'swd_secondary', 'swd_tertiary', 'waterbody')
         LIMIT 100`
      );
      layers = q.rows.map((r: any) => ({
        id: r.id,
        layerType: r.layer_type as SpatialLayerType,
        label: r.label,
        sourceName: r.source_name,
        sourceUrl: r.source_url,
        sourceDate: r.source_date ? new Date(r.source_date).toISOString().slice(0, 10) : null,
        coords: [Number(r.lon), Number(r.lat)],
      }));
    } catch {
      return res.status(503).json({ error: 'Spatial layer data are unavailable; screening was not performed.', code: 'SPATIAL_DATA_UNAVAILABLE' });
    }
  }
  const result = screenSpatialBuffers({ latitude: lat, longitude: lon }, layers);
  res.json({
    latitude: lat,
    longitude: lon,
    ...result
  });
}));


app.post('/api/properties/:id/parcel-geometry', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const p = await pool.query('SELECT id FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!p.rowCount) return res.status(404).json({ error: 'Property not found.' });

  const geojson = req.body;
  const isValid = validateCadastralGeoJSON(geojson);
  if (!isValid) {
    return res.status(400).json({
      error: 'Invalid cadastral GeoJSON. Geometry must be a closed Polygon with at least 4 coordinates (first and last coordinate identical).',
    });
  }

  // Extract coordinates to calculate centroid and update property location
  let ring: number[][] | undefined;
  if (geojson.type === 'FeatureCollection' && geojson.features?.[0]?.geometry?.coordinates) {
    const geom = geojson.features[0].geometry;
    ring = geom.type === 'MultiPolygon' ? geom.coordinates[0]?.[0] : geom.coordinates[0];
  } else if (geojson.type === 'Feature' && geojson.geometry?.coordinates) {
    const geom = geojson.geometry;
    ring = geom.type === 'MultiPolygon' ? geom.coordinates[0]?.[0] : geom.coordinates[0];
  } else if (geojson.type === 'Polygon' && geojson.coordinates) {
    ring = geojson.coordinates[0];
  } else if (geojson.type === 'MultiPolygon' && geojson.coordinates) {
    ring = geojson.coordinates[0]?.[0];
  }

  let lat: number | null = null;
  let lon: number | null = null;
  if (ring && ring.length >= 4) {
    let sumLon = 0;
    let sumLat = 0;
    const count = ring.length - 1; // exclude closing duplicate point
    for (let i = 0; i < count; i++) {
      sumLon += ring[i][0];
      sumLat += ring[i][1];
    }
    lon = Math.round((sumLon / count) * 1e6) / 1e6;
    lat = Math.round((sumLat / count) * 1e6) / 1e6;
  }

  if (
    lat === null ||
    lon === null ||
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return res.status(400).json({
      error: 'Invalid parcel geometry coordinates or computed centroid is out of geographic bounds [-90, 90], [-180, 180].',
    });
  }

  await pool.query(
    'UPDATE properties SET latitude=?, longitude=?, updated_at=now(), updated_by_uid=? WHERE id=? AND tenant_id=?',
    [lat, lon, req.user?.uid || 'system', req.params.id, req.user?.tenantId]
  );

  await audit(
    req.user?.uid || 'system',
    req.user?.tenantId,
    'UPDATE_PARCEL_GEOMETRY',
    'property',
    req.params.id,
    { parcelGeoJSON: geojson, centroid: lat !== null && lon !== null ? { latitude: lat, longitude: lon } : null }
  );

  res.json({
    message: 'Cadastral parcel geometry updated successfully.',
    propertyId: req.params.id,
    latitude: lat,
    longitude: lon,
    geometry: geojson,
  });
}));

app.get('/api/properties/:id/report', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const p = await pool.query('SELECT * FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!p.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const docs = await pool.query('SELECT id, original_filename, mime_type, size_bytes, sha256, processing_status, extracted_fields, created_at FROM documents WHERE property_id=? AND tenant_id=? ORDER BY created_at', [req.params.id, req.user?.tenantId]);
  const findings = await pool.query('SELECT code, title, severity, points, explanation, evidence_status, next_action, created_at FROM risk_findings WHERE property_id=? AND tenant_id=? ORDER BY created_at', [req.params.id, req.user?.tenantId]);
  const body = { reportVersion: '0.1', generatedAt: new Date().toISOString(), generatedAtTimezone: 'UTC', property: p.rows[0], documents: docs.rows.map((document:any) => ({ ...document, evidenceUrl: `/api/properties/${encodeURIComponent(req.params.id)}/documents/${encodeURIComponent(document.id)}/file` })), findings: findings.rows, reviewNotice: 'This report is an evidence-organising aid and is not a legal opinion, ownership certificate, encumbrance certificate, or government verification. Confirm findings against current official records and qualified professional advice.', dataLimitations: ['Government integrations are not enabled.', 'Uploaded documents require human review unless a configured OCR provider result is recorded.', 'Spatial conclusions require active permitted datasets and are unknown when none are available.'] };
  res.setHeader('Content-Disposition', `attachment; filename="ojix-property-report-${p.rows[0].id}.json"`);
  res.type('application/json').send(JSON.stringify(body, null, 2));
}));

app.get('/api/map/layers', authGuard, asyncRoute(async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query(`SELECT id, layer_type, label, source_name, source_url, source_date, data_status, ST_AsGeoJSON(geom) AS geometry FROM spatial_layers WHERE active=true ORDER BY layer_type, label LIMIT 1000`);
  res.json({ type: 'FeatureCollection', features: result.rows.map((r:any) => ({ type: 'Feature', id: r.id, geometry: typeof r.geometry === 'string' ? JSON.parse(r.geometry) : r.geometry, properties: { layerType: r.layer_type, label: r.label, sourceName: r.source_name, sourceUrl: r.source_url, sourceDate: r.source_date, dataStatus: r.data_status } })), disclaimer: 'Only datasets explicitly loaded into this workspace are shown. The seed layer is synthetic demonstration data, not an official land or Rajakaluve boundary.' });
}));

app.get('/api/properties/:id/discrepancies', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const p = await pool.query('SELECT * FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!p.rowCount) return res.status(404).json({ error: 'Property not found.' });

  const docs = await pool.query(
    'SELECT id, original_filename, doc_type, extracted_fields FROM documents WHERE property_id=? AND tenant_id=?',
    [req.params.id, req.user?.tenantId]
  );

  const docItems = docs.rows.map(r => ({
    id: r.id,
    originalFilename: r.original_filename,
    classification: { documentType: r.doc_type || 'other' },
    extractedFields: typeof r.extracted_fields === 'string' ? JSON.parse(r.extracted_fields) : (r.extracted_fields || {}),
  }));

  const discrepancies = detectCrossDocumentDiscrepancies(docItems, p.rows[0]);
  const riskSummary = calculateRiskScore(discrepancies.map(d => ({ severity: d.severity, points: d.points, code: d.code })));

  res.json({
    propertyId: req.params.id,
    discrepancies,
    riskSummary,
    count: discrepancies.length,
  });
}));

app.post('/api/properties/:id/due-diligence-snapshot', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const p = await pool.query('SELECT * FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!p.rowCount) return res.status(404).json({ error: 'Property not found.' });

  const docs = await pool.query('SELECT * FROM documents WHERE property_id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  const eventsResult = await pool.query(
    'SELECT * FROM title_events WHERE property_id=? AND tenant_id=? ORDER BY event_date ASC',
    [req.params.id, req.user?.tenantId]
  );

  const titleTimeline: TitleEvent[] = eventsResult.rows.map((row: any) => ({
    id: row.id,
    propertyId: row.property_id,
    documentId: row.document_id || '',
    sequenceOrder: Number(row.sequence_order),
    eventDate: row.event_date instanceof Date ? row.event_date.toISOString().slice(0, 10) : String(row.event_date),
    registrationDate: row.registration_date ? (row.registration_date instanceof Date ? row.registration_date.toISOString().slice(0, 10) : String(row.registration_date)) : undefined,
    deedType: row.deed_type,
    fromParties: typeof row.from_parties === 'string' ? JSON.parse(row.from_parties) : (row.from_parties || []),
    toParties: typeof row.to_parties === 'string' ? JSON.parse(row.to_parties) : (row.to_parties || []),
    extentSqFt: Number(row.extent_sq_ft),
    extentRaw: row.extent_raw || '',
    consideration: Number(row.consideration),
    status: row.status,
    disputeRationale: row.dispute_rationale || undefined,
    reviewedBy: row.reviewed_by || undefined,
    encumbranceStatus: row.encumbrance_status || 'none',
  }));

  const titleGaps = detectTitleGaps(titleTimeline);
  const docItems = docs.rows.map(r => ({
    id: r.id,
    originalFilename: r.original_filename,
    extractedFields: typeof r.extracted_fields === 'string' ? JSON.parse(r.extracted_fields) : (r.extracted_fields || {}),
  }));
  const discrepancies = detectCrossDocumentDiscrepancies(docItems, p.rows[0]);

  const snapshot = createDueDiligenceSnapshot({
    property: p.rows[0],
    documents: docs.rows,
    titleTimeline,
    titleGaps,
    discrepancies,
  });

  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'report.snapshot_created', 'property', req.params.id, {
    reportId: snapshot.reportId,
    score: snapshot.riskSummary.score,
  });

  res.status(201).json(snapshot);
}));

app.get('/api/properties/:id/due-diligence-report/html', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const p = await pool.query('SELECT * FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!p.rowCount) return res.status(404).json({ error: 'Property not found.' });

  const docs = await pool.query('SELECT * FROM documents WHERE property_id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  const eventsResult = await pool.query('SELECT * FROM title_events WHERE property_id=? AND tenant_id=? ORDER BY event_date ASC', [req.params.id, req.user?.tenantId]);
  const titleTimeline: TitleEvent[] = eventsResult.rows.map((row: any) => ({
    id: row.id,
    propertyId: row.property_id,
    documentId: row.document_id || '',
    sequenceOrder: Number(row.sequence_order),
    eventDate: row.event_date instanceof Date ? row.event_date.toISOString().slice(0, 10) : String(row.event_date),
    registrationDate: row.registration_date ? (row.registration_date instanceof Date ? row.registration_date.toISOString().slice(0, 10) : String(row.registration_date)) : undefined,
    deedType: row.deed_type,
    fromParties: typeof row.from_parties === 'string' ? JSON.parse(row.from_parties) : (row.from_parties || []),
    toParties: typeof row.to_parties === 'string' ? JSON.parse(row.to_parties) : (row.to_parties || []),
    extentSqFt: Number(row.extent_sq_ft),
    extentRaw: row.extent_raw || '',
    consideration: Number(row.consideration),
    status: row.status,
    disputeRationale: row.dispute_rationale || undefined,
    reviewedBy: row.reviewed_by || undefined,
    encumbranceStatus: row.encumbrance_status || 'none',
  }));

  const titleGaps = detectTitleGaps(titleTimeline);
  const docItems = docs.rows.map(r => ({
    id: r.id,
    originalFilename: r.original_filename,
    extractedFields: typeof r.extracted_fields === 'string' ? JSON.parse(r.extracted_fields) : (r.extracted_fields || {}),
  }));
  const discrepancies = detectCrossDocumentDiscrepancies(docItems, p.rows[0]);
  const snapshot = createDueDiligenceSnapshot({
    property: p.rows[0],
    documents: docs.rows,
    titleTimeline,
    titleGaps,
    discrepancies,
  });

  const report = generateDueDiligenceReport(snapshot);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(report.html);
}));

app.get('/api/properties/:id/due-diligence-report/pdf', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const p = await pool.query('SELECT * FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!p.rowCount) return res.status(404).json({ error: 'Property not found.' });
  return res.status(501).json({
    error: 'PDF report generation is not configured. Use the HTML evidence report until a validated PDF renderer is installed.',
    code: 'PDF_RENDERER_NOT_CONFIGURED',
  });
}));

/* ==========================================================================
   Legal Research Engine Endpoints
   ========================================================================== */
app.get('/api/legal-research', authGuard, asyncRoute(async (req, res) => {
  const q = String(req.query.q || '');
  const category = req.query.category ? String(req.query.category) : undefined;
  const items = legalResearchEngine.search(q, category);
  res.json({ items, count: items.length });
}));

app.get('/api/legal-research/categories', authGuard, asyncRoute(async (_req, res) => {
  res.json({ categories: legalResearchEngine.getCategories() });
}));

app.get('/api/legal-research/provisions/:id', authGuard, asyncRoute(async (req, res) => {
  const item = legalResearchEngine.getById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Statutory provision not found.' });
  res.json({ item });
}));

app.get('/api/legal-research/bookmarks', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const propertyId = req.query.propertyId ? String(req.query.propertyId) : null;
  let q = 'SELECT b.*, p.name as property_name FROM legal_bookmarks b LEFT JOIN properties p ON b.property_id=p.id WHERE b.tenant_id=?';
  const params: any[] = [req.user?.tenantId];
  if (propertyId) {
    q += ' AND b.property_id=?';
    params.push(propertyId);
  }
  q += ' ORDER BY b.created_at DESC';
  const result = await pool.query(q, params);
  res.json({ items: result.rows });
}));

app.post('/api/legal-research/bookmarks', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const { actId, sectionNumber, title, notes, propertyId } = req.body;
  if (!actId || !sectionNumber || !title) return res.status(400).json({ error: 'actId, sectionNumber, and title are required.' });
  const bookmarkId = crypto.randomUUID();

  await pool.query(
    `INSERT INTO legal_bookmarks
     (id, tenant_id, property_id, act_id, section_number, title, notes, created_by_uid)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bookmarkId,
      req.user?.tenantId,
      propertyId || null,
      actId,
      sectionNumber,
      title,
      notes || '',
      req.user?.uid || 'anonymous'
    ]
  );

  const result = await pool.query(
    'SELECT * FROM legal_bookmarks WHERE id=? AND tenant_id=?',
    [bookmarkId, req.user?.tenantId]
  );

  await audit(
    req.user?.uid || 'anon',
    req.user?.tenantId,
    'create',
    'legal_bookmark',
    bookmarkId,
    { actId, sectionNumber }
  );

  res.status(201).json({ item: result.rows[0] });
}));

app.delete('/api/legal-research/bookmarks/:id', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  await pool.query('DELETE FROM legal_bookmarks WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  res.json({ success: true });
}));

/* ==========================================================================
   Source Registry Engine Endpoints
   ========================================================================== */
app.get('/api/source-registry/status', authGuard, asyncRoute(async (req, res) => {
  const probe = req.query.probe === 'true';
  const registries = await sourceRegistryEngine.getRegistryHealth(probe);
  res.json({
    registries,
    connectorsConfigured: false,
    allOperational: false,
    liveProbe: probe,
    probeMeaning: 'Portal reachability only; no property records were queried or verified.',
    timestamp: new Date().toISOString()
  });
}));


app.get('/api/source-registry/properties/:id', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const p = await pool.query('SELECT * FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!p.rows.length) return res.status(404).json({ error: 'Property not found.' });

  const verifications = await pool.query(
    'SELECT * FROM source_registry_verifications WHERE property_id=? AND tenant_id=? ORDER BY verified_at DESC',
    [req.params.id, req.user?.tenantId]
  );
  res.json({ items: verifications.rows });
}));

app.post('/api/source-registry/properties/:id/verify', authGuard, sourceDataGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const p = await pool.query('SELECT * FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!p.rows.length) return res.status(404).json({ error: 'Property not found.' });

  const property = p.rows[0];
  const results = await sourceRegistryEngine.verifyAll({
    id: property.id,
    name: property.name,
    village: property.village,
    hobli: property.hobli,
    taluk: property.taluk,
    district: property.district,
    surveyNumber: property.survey_number,
    subdivision: property.subdivision,
    extent: property.extent,
    latitude: property.latitude,
    longitude: property.longitude,
  });

  for (const v of results.verifications) {
    await pool.query(
      `INSERT INTO source_registry_verifications 
       (id, tenant_id, property_id, registry_name, status, query_params, matched_record, discrepancies, latency_ms, response_hash, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        req.user?.tenantId,
        property.id,
        v.registryName,
        v.status,
        JSON.stringify(v.queryParameters),
        JSON.stringify(v.matchedRecord),
        JSON.stringify(v.discrepancies),
        v.latencyMs,
        v.evidenceHash,
        v.timestamp
      ]
    );
  }

  await audit(req.user?.uid || 'anon', req.user?.tenantId, 'verify_registries', 'property', property.id, {
    registriesChecked: results.verifications.length,
    overallTrustScore: results.overallTrustScorePct
  });

  res.json(results);
}));

app.post('/api/source-registry/properties/:id/verify/:registryName', authGuard, sourceDataGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const regName = req.params.registryName as RegistryName;
  const p = await pool.query('SELECT * FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!p.rows.length) return res.status(404).json({ error: 'Property not found.' });

  const property = p.rows[0];
  const propInput = {
    id: property.id,
    name: property.name,
    village: property.village,
    hobli: property.hobli,
    taluk: property.taluk,
    district: property.district,
    surveyNumber: property.survey_number,
    subdivision: property.subdivision,
    extent: property.extent,
    latitude: property.latitude,
    longitude: property.longitude,
  };

  let vResult: RegistryVerificationResult;
  switch (regName) {
    case 'bhoomi': vResult = sourceRegistryEngine.verifyBhoomi(propInput); break;
    case 'kaveri': vResult = sourceRegistryEngine.verifyKaveri(propInput); break;
    case 'mojini': vResult = sourceRegistryEngine.verifyMojini(propInput); break;
    case 'dishaank': vResult = sourceRegistryEngine.verifyDishaank(propInput); break;
    case 'easthi': vResult = sourceRegistryEngine.verifyEAasthi(propInput); break;
    case 'rera': vResult = sourceRegistryEngine.verifyRera(propInput); break;
    default: return res.status(400).json({ error: 'Invalid registry name.' });
  }

  await pool.query(
    `INSERT INTO source_registry_verifications 
     (id, tenant_id, property_id, registry_name, status, query_params, matched_record, discrepancies, latency_ms, response_hash, verified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      req.user?.tenantId,
      property.id,
      vResult.registryName,
      vResult.status,
      JSON.stringify(vResult.queryParameters),
      JSON.stringify(vResult.matchedRecord),
      JSON.stringify(vResult.discrepancies),
      vResult.latencyMs,
      vResult.evidenceHash,
      vResult.timestamp
    ]
  );

  res.json({ verification: vResult });
}));

app.post('/api/source-registry/query', authGuard, asyncRoute(async (req, res) => {
  const {
    registry = 'all',
    district,
    taluk,
    hobli,
    village,
    surveyNumber,
    subdivision,
    sroOffice,
    pidNumber,
    reraNumber,
    latitude,
    longitude,
    ownerNameQuery
  } = req.body || {};

  const required = [district, taluk, hobli, village, surveyNumber];
  if (required.some(value => typeof value !== 'string' || !value.trim())) {
    return res.status(400).json({ error: 'District, taluk, hobli, village and survey number are required. Search values are never assumed.' });
  }
  const queryParams: DirectRegistryQueryParams = {
    registry,
    district: String(district).trim(),
    taluk: String(taluk).trim(),
    hobli: String(hobli).trim(),
    village: String(village).trim(),
    surveyNumber: String(surveyNumber).trim(),
    subdivision: subdivision ? String(subdivision).trim() : undefined,
    sroOffice: sroOffice ? String(sroOffice).trim() : undefined,
    pidNumber: pidNumber ? String(pidNumber).trim() : undefined,
    reraNumber: reraNumber ? String(reraNumber).trim() : undefined,
    latitude: typeof latitude === 'number' ? latitude : undefined,
    longitude: typeof longitude === 'number' ? longitude : undefined,
    ownerNameQuery: ownerNameQuery ? String(ownerNameQuery).trim() : undefined,
  };

  const results = await sourceRegistryEngine.queryDirect(queryParams);

  await audit(req.user?.uid || 'anon', req.user?.tenantId, 'query_registries', 'system', 'search-engine', {
    registry,
    surveyNumber: queryParams.surveyNumber,
    village: queryParams.village,
    verificationsCount: results.verifications.length,
    overallTrustScore: results.overallTrustScorePct
  });

  res.json({
    success: true,
    ...results
  });
}));

/* ==========================================================================
   Global Cross-Workspace Views & Settings Endpoints
   ========================================================================== */
app.get('/api/documents/all', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query(
    `SELECT d.id,d.tenant_id,d.property_id,d.doc_type,d.doc_type_custom,d.classification_confidence,
            d.classification_source,d.manual_review_status,d.governance_status,d.original_filename,
            d.mime_type,d.size_bytes,d.sha256,d.processing_status,d.uploaded_by_uid,d.created_at,
            p.name as property_name,p.application_number,p.survey_number,p.village,p.district
     FROM documents d
     JOIN properties p ON d.property_id=p.id
     WHERE d.tenant_id=? AND (? <> 'lawyer' OR p.assigned_lawyer_uid=?) AND (? <> 'analyst' OR p.assigned_analyst_uid=?) AND (? <> 'operations' OR p.assigned_operations_uid=? OR p.assigned_operations_uid IS NULL OR p.assigned_operations_uid='')
     ORDER BY d.created_at DESC LIMIT 200`,
    [req.user?.tenantId,req.user?.role||'viewer',req.user?.uid||'',req.user?.role||'viewer',req.user?.uid||'',req.user?.role||'viewer',req.user?.uid||'']
  );
  res.json({ items: result.rows, count: result.rows.length });
}));

app.get('/api/findings/all', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query(
    `SELECT f.*, p.name as property_name, p.survey_number, p.village, p.district
     FROM risk_findings f
     JOIN properties p ON f.property_id=p.id
     WHERE f.tenant_id=? AND (? <> 'lawyer' OR p.assigned_lawyer_uid=?) AND (? <> 'analyst' OR p.assigned_analyst_uid=?) AND (? <> 'operations' OR p.assigned_operations_uid=?)
     ORDER BY f.created_at DESC LIMIT 200`,
    [req.user?.tenantId,req.user?.role||'viewer',req.user?.uid||'',req.user?.role||'viewer',req.user?.uid||'',req.user?.role||'viewer',req.user?.uid||'']
  );
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, unverified: 0 };
  for (const r of result.rows) {
    if (r.severity in severityCounts) (severityCounts as any)[r.severity]++;
  }
  res.json({ items: result.rows, severityCounts, count: result.rows.length });
}));

const ADMIN_ROLES=['admin','lawyer','analyst','operations','consultant','support','data_steward','viewer'] as const;
const ROLE_PERMISSIONS:Record<string,string[]>={owner:['workspace_admin','member_admin','property_edit','document_intake','document_review','legal_review','source_governance','audit_read','retention_admin'],admin:['workspace_admin','member_admin','property_edit','document_intake','document_review','source_governance','audit_read','retention_admin'],lawyer:['property_edit','document_intake','document_review','legal_review'],analyst:['property_edit','document_intake','document_review'],operations:['document_intake'],consultant:['property_read','document_read'],support:['diagnostics_read'],data_steward:['source_governance','property_read','document_read'],viewer:['property_read']};
const reasonSchema=z.object({reason:z.string().trim().min(3).max(500)});
const pageSchema=z.object({page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25),search:z.string().trim().max(120).optional().default('')});

function superAdminGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (!user?.isSuperAdmin) return res.status(403).json({ error: 'Platform super-admin access is required.' });
  next();
}

app.get('/api/super-admin/overview',authGuard,superAdminGuard,asyncRoute(async(_req,res)=>{
  const [organizations,members,properties,documents,sessions,findings,reviews,pendingDocuments,services]=await Promise.all([
    pool!.query('SELECT COUNT(*) total FROM organizations'),
    pool!.query("SELECT COUNT(*) total,SUM(status='active') active,SUM(status<>'active') inactive FROM org_memberships"),
    pool!.query('SELECT COUNT(*) total,SUM(archived_at IS NULL) active FROM properties'),
    pool!.query("SELECT COUNT(*) total,SUM(governance_status='active') active FROM documents"),
    pool!.query('SELECT COUNT(*) total FROM authentication_sessions WHERE revoked_at IS NULL AND expires_at>NOW(6)'),
    pool!.query('SELECT COUNT(*) total,SUM(severity=\'critical\') critical,SUM(severity=\'high\') high FROM risk_findings'),
    pool!.query('SELECT COUNT(*) total,SUM(status IN (\'pending\',\'in_review\')) pending FROM title_reviews'),
    pool!.query("SELECT COUNT(*) total FROM documents WHERE governance_status='active' AND (manual_review_status='required' OR processing_status<>'completed')"),
    pool!.query('SELECT 1 database_connected')
  ]);
  res.json({organizations:organizations.rows[0],members:members.rows[0],properties:properties.rows[0],documents:documents.rows[0],sessions:sessions.rows[0],findings:findings.rows[0],reviews:reviews.rows[0],pendingDocuments:pendingDocuments.rows[0],health:{database:services.rowCount?'connected':'unavailable'}});
}));
app.get('/api/super-admin/organizations',authGuard,superAdminGuard,asyncRoute(async(req,res)=>{
  const q=pageSchema.safeParse(req.query);if(!q.success)return res.status(400).json({error:'Invalid organization filters.'});
  const {page,limit,search}=q.data,like=`%${search}%`;
  const count=await pool!.query(`SELECT COUNT(*) total FROM organizations o WHERE ?='' OR o.name LIKE ? OR o.slug LIKE ? OR o.id LIKE ?`,[search,like,like,like]);
  const result=await pool!.query(`SELECT o.id,o.name,o.slug,o.created_at,
    (SELECT COUNT(*) FROM org_memberships m WHERE m.organization_id=o.id) member_count,
    (SELECT COUNT(*) FROM org_memberships m WHERE m.organization_id=o.id AND m.status='active') active_member_count,
    (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=o.id) property_count
    FROM organizations o WHERE ?='' OR o.name LIKE ? OR o.slug LIKE ? OR o.id LIKE ? ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,[search,like,like,like,limit,(page-1)*limit]);
  res.json({items:result.rows,page,limit,total:Number(count.rows[0]?.total||0)});
}));
app.get('/api/super-admin/members',authGuard,superAdminGuard,asyncRoute(async(req,res)=>{
  const q=pageSchema.safeParse(req.query);if(!q.success)return res.status(400).json({error:'Invalid member filters.'});
  const {page,limit,search}=q.data,like=`%${search}%`;
  const filter=`(?='' OR m.email LIKE ? OR m.user_uid LIKE ? OR m.role LIKE ? OR m.status LIKE ? OR o.name LIKE ? OR u.full_name LIKE ?)`;
  const params=[search,like,like,like,like,like,like];
  const count=await pool!.query(`SELECT COUNT(*) total FROM org_memberships m JOIN organizations o ON o.id=m.organization_id LEFT JOIN user_accounts u ON u.id=m.user_uid WHERE ${filter}`,params);
  const result=await pool!.query(`SELECT m.id,m.organization_id,m.user_uid,m.email,m.role,m.status,m.created_at,o.name organization_name,u.full_name,u.last_login_at
    FROM org_memberships m JOIN organizations o ON o.id=m.organization_id LEFT JOIN user_accounts u ON u.id=m.user_uid
    WHERE ${filter} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,[...params,limit,(page-1)*limit]);
  res.json({items:result.rows,page,limit,total:Number(count.rows[0]?.total||0)});
}));
app.patch('/api/super-admin/members/:id',authGuard,superAdminGuard,asyncRoute(async(req,res)=>{
  const normalizeChoice=(value:unknown)=>typeof value==='string'?value.trim().toLowerCase().replace(/[\s-]+/g,'_'):value;
  const parsed=z.object({status:z.preprocess(normalizeChoice,z.enum(['active','disabled']).optional()),role:z.preprocess(normalizeChoice,z.enum(['owner','admin','lawyer','analyst','operations','consultant','support','data_steward','viewer']).optional()),reason:z.string().trim().min(3).max(500)}).refine(value=>value.status||value.role).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Choose a supported role or status and provide a reason.'});
  const {status,role,reason}=parsed.data;
  const conn=await pool!.getConnection();
  try{
    await conn.beginTransaction();
    const current=await conn.query('SELECT id,organization_id,user_uid,email,role,status FROM org_memberships WHERE id=? FOR UPDATE',[req.params.id]);
    if(!current.rowCount){await conn.rollback();return res.status(404).json({error:'Workspace membership not found.'});}
    const member=current.rows[0];
    if(member.user_uid===req.user?.uid&&status==='disabled'){await conn.rollback();return res.status(409).json({error:'You cannot disable your own active membership.'});}
    if(member.role==='owner'&&member.status==='active'&&(status==='disabled'||(role&&role!=='owner'))){
      const owners=await conn.query("SELECT id FROM org_memberships WHERE organization_id=? AND role='owner' AND status='active' FOR UPDATE",[member.organization_id]);
      if(owners.rowCount<=1){await conn.rollback();return res.status(409).json({error:'Each organization must retain at least one active owner.'});}
    }
    await conn.query('UPDATE org_memberships SET role=COALESCE(?,role),status=COALESCE(?,status),updated_at=NOW(6) WHERE id=?',[role||null,status||null,member.id]);
    if(status==='disabled')await conn.query('UPDATE authentication_sessions SET revoked_at=NOW(6),revoked_by_uid=?,revoke_reason=? WHERE user_uid=? AND tenant_id=? AND revoked_at IS NULL',[req.user?.uid||'unknown',reason,member.user_uid,member.organization_id]);
    await audit(req.user?.uid||'unknown',member.organization_id,'super_admin.membership_updated','org_membership',member.id,{email:member.email,previousRole:member.role,role:role||member.role,previousStatus:member.status,status:status||member.status,reason});
    await conn.commit();res.json({success:true});
  }catch(error){await conn.rollback();throw error;}finally{conn.release();}
}));
app.get('/api/super-admin/sessions',authGuard,superAdminGuard,asyncRoute(async(req,res)=>{
  const q=pageSchema.safeParse(req.query);if(!q.success)return res.status(400).json({error:'Invalid session filters.'});
  const {page,limit,search}=q.data,like=`%${search}%`;
  const filter=`(?='' OR s.user_uid LIKE ? OR s.ip_address LIKE ? OR m.email LIKE ? OR m.role LIKE ? OR o.name LIKE ?)`;
  const params=[search,like,like,like,like,like];
  const count=await pool!.query(`SELECT COUNT(*) total FROM authentication_sessions s LEFT JOIN org_memberships m ON m.organization_id=s.tenant_id AND m.user_uid=s.user_uid LEFT JOIN organizations o ON o.id=s.tenant_id WHERE ${filter}`,params);
  const result=await pool!.query(`SELECT s.id,s.tenant_id,s.user_uid,s.created_at,s.last_activity_at,s.expires_at,s.revoked_at,s.ip_address,s.user_agent,
    m.email,m.role,o.name organization_name FROM authentication_sessions s
    LEFT JOIN org_memberships m ON m.organization_id=s.tenant_id AND m.user_uid=s.user_uid
    LEFT JOIN organizations o ON o.id=s.tenant_id WHERE ${filter} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,[...params,limit,(page-1)*limit]);
  res.json({items:result.rows,page,limit,total:Number(count.rows[0]?.total||0)});
}));
app.delete('/api/super-admin/sessions/:id',authGuard,superAdminGuard,asyncRoute(async(req,res)=>{
  const parsed=reasonSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'A session revocation reason is required.'});
  const result=await pool!.query('SELECT id,tenant_id,user_uid FROM authentication_sessions WHERE id=? AND revoked_at IS NULL',[req.params.id]);
  if(!result.rowCount)return res.status(404).json({error:'Active session not found.'});
  const session=result.rows[0];await pool!.query('UPDATE authentication_sessions SET revoked_at=NOW(6),revoked_by_uid=?,revoke_reason=? WHERE id=?',[req.user?.uid||'unknown',parsed.data.reason,session.id]);
  await audit(req.user?.uid||'unknown',session.tenant_id,'super_admin.session_revoked','authentication_session',session.id,{userUid:session.user_uid,reason:parsed.data.reason});
  res.json({success:true});
}));
app.get('/api/super-admin/audit',authGuard,superAdminGuard,asyncRoute(async(req,res)=>{
  const q=pageSchema.safeParse(req.query);if(!q.success)return res.status(400).json({error:'Invalid audit filters.'});
  const {page,limit,search}=q.data,like=`%${search}%`;
  const filter=`(?='' OR a.actor_uid LIKE ? OR a.action LIKE ? OR a.entity_type LIKE ? OR a.entity_id LIKE ? OR o.name LIKE ?)`;
  const params=[search,like,like,like,like,like];
  const count=await pool!.query(`SELECT COUNT(*) total FROM audit_events a LEFT JOIN organizations o ON o.id=a.tenant_id WHERE ${filter}`,params);
  const result=await pool!.query(`SELECT a.id,a.tenant_id,a.actor_uid,a.action,a.entity_type,a.entity_id,a.details,a.created_at,o.name organization_name
    FROM audit_events a LEFT JOIN organizations o ON o.id=a.tenant_id WHERE ${filter} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,[...params,limit,(page-1)*limit]);
  res.json({items:result.rows,page,limit,total:Number(count.rows[0]?.total||0)});
}));

app.use('/api/admin',(req,res,next)=>{
  if (!req.header('authorization')&&!req.header('x-user-uid')) return res.status(401).json({error:'Authenticated administrator access is required.'});
  next();
});

app.get('/api/admin/summary',authGuard,adminGuard,asyncRoute(async(req,res)=>{const tenant=req.user?.tenantId;const [members,invites,properties,documents,audits]=await Promise.all([pool!.query("SELECT COUNT(*) total,SUM(status='active') active FROM org_memberships WHERE organization_id=?",[tenant]),pool!.query("SELECT COUNT(*) total FROM workspace_invitations WHERE tenant_id=? AND status='pending' AND expires_at>NOW(6)",[tenant]),pool!.query("SELECT COUNT(*) total,SUM(archived_at IS NULL) active,SUM(due_date<CURDATE() AND status NOT IN ('complete','closed','archived')) overdue FROM properties WHERE tenant_id=?",[tenant]),pool!.query("SELECT COUNT(*) total,SUM(manual_review_status='required') manual_review,SUM(processing_status<>'completed') processing FROM documents WHERE tenant_id=? AND governance_status='active'",[tenant]),pool!.query('SELECT id,actor_uid,action,entity_type,entity_id,created_at FROM audit_events WHERE tenant_id=? ORDER BY created_at DESC LIMIT 8',[tenant])]);res.json({members:members.rows[0],pendingInvitations:Number(invites.rows[0]?.total||0),applications:properties.rows[0],documents:documents.rows[0],recentAudit:audits.rows});}));

app.get('/api/admin/members',authGuard,adminGuard,asyncRoute(async(req,res)=>{const q=pageSchema.safeParse(req.query);if(!q.success)return res.status(400).json({error:'Invalid member filters.'});const {page,limit,search}=q.data;const like=`%${search}%`;const result=await pool!.query(`SELECT m.id,m.user_uid,m.email,m.role,m.status,m.created_at,m.updated_at,u.full_name,u.last_login_at,u.otp_required FROM org_memberships m LEFT JOIN user_accounts u ON u.id=m.user_uid WHERE m.organization_id=? AND (?='' OR m.email LIKE ? OR u.full_name LIKE ? OR m.user_uid LIKE ?) ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,[req.user?.tenantId,search,like,like,like,limit,(page-1)*limit]);const invitations=await pool!.query("SELECT id,email,invited_name,assigned_role,status,delivery_status,expires_at,created_at FROM workspace_invitations WHERE tenant_id=? AND status='pending' ORDER BY created_at DESC",[req.user?.tenantId]);res.json({items:result.rows.map(row=>({...row,name:row.full_name||DUMMY_ACCOUNTS.find(a=>a.uid===row.user_uid)?.name||row.email||row.user_uid})),invitations:invitations.rows,page,limit});}));

app.post('/api/admin/members/invite',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=z.object({name:z.string().trim().min(2).max(160),email:z.string().email().transform(v=>v.toLowerCase()),role:z.enum(ADMIN_ROLES)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Enter a valid name, email and assignable role.'});const {name,email,role}=parsed.data;const existing=await pool!.query('SELECT id FROM org_memberships WHERE organization_id=? AND LOWER(email)=? LIMIT 1',[req.user?.tenantId,email]);if(existing.rowCount)return res.status(409).json({error:'This email is already a workspace member.'});const pending=await pool!.query("SELECT id FROM workspace_invitations WHERE tenant_id=? AND email=? AND status='pending' AND expires_at>NOW(6) LIMIT 1",[req.user?.tenantId,email]);if(pending.rowCount)return res.status(409).json({error:'An active invitation already exists for this email.'});const id=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex');await pool!.query('INSERT INTO workspace_invitations (id,tenant_id,email,invited_name,assigned_role,invitation_token_hash,status,delivery_status,invited_by_uid,expires_at) VALUES (?,?,?,?,?,?,\'pending\',\'not_configured\',?,DATE_ADD(NOW(6),INTERVAL 7 DAY))',[id,req.user?.tenantId,email,name,role,crypto.createHash('sha256').update(token).digest('hex'),req.user?.uid]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.member_invited','workspace_invitation',id,{email,name,role,deliveryStatus:'not_configured'});res.status(201).json({item:{id,email,invited_name:name,assigned_role:role,status:'pending',delivery_status:'not_configured'},message:'Invitation recorded. Email delivery is not configured, so delivery is not claimed.'});}));

app.post('/api/admin/members/:id/resend-invitation',authGuard,adminGuard,asyncRoute(async(req,res)=>{const inv=await pool!.query("SELECT * FROM workspace_invitations WHERE id=? AND tenant_id=? AND status='pending'",[req.params.id,req.user?.tenantId]);if(!inv.rowCount)return res.status(404).json({error:'Pending invitation not found.'});await pool!.query("UPDATE workspace_invitations SET expires_at=DATE_ADD(NOW(6),INTERVAL 7 DAY),delivery_status='not_configured',updated_at=NOW(6) WHERE id=?",[req.params.id]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.invitation_resent','workspace_invitation',req.params.id,{email:inv.rows[0].email,deliveryStatus:'not_configured'});res.json({success:true,message:'Invitation expiry renewed; email delivery is not configured.'});}));

app.delete('/api/admin/invitations/:id',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=reasonSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'A revocation reason is required.'});const invitation=await pool!.query("SELECT id,email,status FROM workspace_invitations WHERE id=? AND tenant_id=? AND status='pending'",[req.params.id,req.user?.tenantId]);if(!invitation.rowCount)return res.status(404).json({error:'Pending invitation not found.'});await pool!.query("UPDATE workspace_invitations SET status='revoked',revoked_at=NOW(6),revoked_by_uid=?,updated_at=NOW(6) WHERE id=? AND tenant_id=?",[req.user?.uid,req.params.id,req.user?.tenantId]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.invitation_revoked','workspace_invitation',req.params.id,{email:invitation.rows[0].email,reason:parsed.data.reason});res.json({success:true});}));

app.patch('/api/admin/members/:id/role',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=z.object({role:z.enum(ADMIN_ROLES),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Valid role and reason are required.'});const member=await pool!.query('SELECT * FROM org_memberships WHERE id=? AND organization_id=?',[req.params.id,req.user?.tenantId]);if(!member.rowCount)return res.status(404).json({error:'Member not found.'});if(member.rows[0].role==='owner')return res.status(403).json({error:'Owner roles cannot be changed through Admin operations.'});if(member.rows[0].user_uid===req.user?.uid)return res.status(403).json({error:'You cannot change your own administrative role.'});await pool!.query('UPDATE org_memberships SET role=? WHERE id=? AND organization_id=?',[parsed.data.role,req.params.id,req.user?.tenantId]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.member_role_changed','membership',req.params.id,{before:member.rows[0].role,after:parsed.data.role,reason:parsed.data.reason});res.json({success:true});}));

app.patch('/api/admin/members/:id/status',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=z.object({status:z.enum(['active','disabled','locked']),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Valid status and reason are required.'});const member=await pool!.query('SELECT * FROM org_memberships WHERE id=? AND organization_id=?',[req.params.id,req.user?.tenantId]);if(!member.rowCount)return res.status(404).json({error:'Member not found.'});if(member.rows[0].role==='owner'||member.rows[0].user_uid===req.user?.uid)return res.status(403).json({error:'Owner and current administrator accounts are protected.'});await pool!.query('UPDATE org_memberships SET status=? WHERE id=? AND organization_id=?',[parsed.data.status,req.params.id,req.user?.tenantId]);await pool!.query("UPDATE user_accounts SET status=?,disabled_at=IF(?='disabled',NOW(6),NULL),disabled_by_uid=?,disabled_reason=? WHERE id=?",[parsed.data.status,parsed.data.status,req.user?.uid,parsed.data.reason,member.rows[0].user_uid]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.member_status_changed','membership',req.params.id,{before:member.rows[0].status,after:parsed.data.status,reason:parsed.data.reason});res.json({success:true});}));

app.delete('/api/admin/members/:id',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=reasonSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'A removal reason is required.'});const member=await pool!.query('SELECT * FROM org_memberships WHERE id=? AND organization_id=?',[req.params.id,req.user?.tenantId]);if(!member.rowCount)return res.status(404).json({error:'Member not found.'});if(member.rows[0].role==='owner'||member.rows[0].user_uid===req.user?.uid)return res.status(403).json({error:'Owner and current administrator accounts cannot be removed.'});await pool!.query('DELETE FROM org_memberships WHERE id=? AND organization_id=?',[req.params.id,req.user?.tenantId]);await pool!.query("UPDATE authentication_sessions SET revoked_at=NOW(6),revoked_by_uid=?,revoke_reason=? WHERE tenant_id=? AND user_uid=? AND revoked_at IS NULL",[req.user?.uid,parsed.data.reason,req.user?.tenantId,member.rows[0].user_uid]);for(const[token,session]of authSessions)if(session.tenantId===req.user?.tenantId&&session.uid===member.rows[0].user_uid)authSessions.delete(token);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.member_removed','membership',req.params.id,{userUid:member.rows[0].user_uid,reason:parsed.data.reason});res.json({success:true});}));

app.post('/api/admin/members/:id/revoke-sessions',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=reasonSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'A revocation reason is required.'});const member=await pool!.query('SELECT * FROM org_memberships WHERE id=? AND organization_id=?',[req.params.id,req.user?.tenantId]);if(!member.rowCount)return res.status(404).json({error:'Member not found.'});await pool!.query('UPDATE authentication_sessions SET revoked_at=NOW(6),revoked_by_uid=?,revoke_reason=? WHERE tenant_id=? AND user_uid=? AND revoked_at IS NULL',[req.user?.uid,parsed.data.reason,req.user?.tenantId,member.rows[0].user_uid]);for(const[token,session]of authSessions)if(session.tenantId===req.user?.tenantId&&session.uid===member.rows[0].user_uid)authSessions.delete(token);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.sessions_revoked','user_account',member.rows[0].user_uid,{reason:parsed.data.reason});res.json({success:true});}));

app.get('/api/admin/roles',authGuard,adminGuard,(_req,res)=>res.json({items:Object.entries(ROLE_PERMISSIONS).map(([role,permissions])=>({role,permissions}))}));
app.get('/api/admin/permissions',authGuard,adminGuard,(_req,res)=>res.json({roles:ROLE_PERMISSIONS}));

app.get('/api/admin/applications',authGuard,adminGuard,asyncRoute(async(req,res)=>{const result=await pool!.query(`SELECT p.*,(SELECT COUNT(*) FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.governance_status='active') document_count,(SELECT COUNT(*) FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.manual_review_status='required' AND d.governance_status='active') manual_review_count FROM properties p WHERE p.tenant_id=? ORDER BY p.archived_at IS NOT NULL,p.due_date IS NULL,p.due_date,p.updated_at DESC LIMIT 500`,[req.user?.tenantId]);res.json({items:result.rows});}));

app.patch('/api/admin/applications/:id/assignment',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=z.object({assignedLawyerUid:z.string().max(191).default(''),assignedAnalystUid:z.string().max(191).default(''),assignedOperationsUid:z.string().max(191).default(''),priority:z.enum(['low','normal','high','urgent']),dueDate:z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.literal(''),z.null()]),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid assignment update.'});const current=await pool!.query('SELECT * FROM properties WHERE id=? AND tenant_id=?',[req.params.id,req.user?.tenantId]);if(!current.rowCount)return res.status(404).json({error:'Application not found.'});for(const[role,uid]of [['lawyer',parsed.data.assignedLawyerUid],['analyst',parsed.data.assignedAnalystUid],['operations',parsed.data.assignedOperationsUid]])if(uid){const member=await pool!.query("SELECT id FROM org_memberships WHERE organization_id=? AND user_uid=? AND role=? AND status='active'",[req.user?.tenantId,uid,role]);if(!member.rowCount)return res.status(400).json({error:`Assigned ${role} is not an active member.`});}await pool!.query('UPDATE properties SET assigned_lawyer_uid=?,assigned_analyst_uid=?,assigned_operations_uid=?,workflow_priority=?,due_date=?,updated_by_uid=?,updated_at=NOW(6) WHERE id=? AND tenant_id=?',[parsed.data.assignedLawyerUid,parsed.data.assignedAnalystUid,parsed.data.assignedOperationsUid,parsed.data.priority,parsed.data.dueDate||null,req.user?.uid,req.params.id,req.user?.tenantId]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.application_assignment_changed','property',req.params.id,{before:current.rows[0],after:parsed.data,reason:parsed.data.reason});res.json({success:true});}));

app.patch('/api/admin/applications/:id/workflow',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=z.object({status:z.enum(['draft','documents_pending','in_review','clarification_required','ready_for_review','closed']),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Admins may update operational statuses only; legal approval and release are excluded.'});const current=await pool!.query('SELECT * FROM properties WHERE id=? AND tenant_id=?',[req.params.id,req.user?.tenantId]);if(!current.rowCount)return res.status(404).json({error:'Application not found.'});await pool!.query('UPDATE properties SET status=?,updated_by_uid=?,updated_at=NOW(6) WHERE id=? AND tenant_id=?',[parsed.data.status,req.user?.uid,req.params.id,req.user?.tenantId]);await pool!.query('INSERT INTO property_workflow_history (id,tenant_id,property_id,previous_status,new_status,reason,changes_json,changed_by_uid) VALUES (?,?,?,?,?,?,?,?)',[crypto.randomUUID(),req.user?.tenantId,req.params.id,current.rows[0].status,parsed.data.status,parsed.data.reason,JSON.stringify({administrative:true}),req.user?.uid]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.application_workflow_changed','property',req.params.id,{before:current.rows[0].status,after:parsed.data.status,reason:parsed.data.reason});res.json({success:true});}));

for(const action of ['archive','restore'] as const)app.post(`/api/admin/applications/:id/${action}`,authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=reasonSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'A reason is required.'});const current=await pool!.query('SELECT id,status,archived_at FROM properties WHERE id=? AND tenant_id=?',[req.params.id,req.user?.tenantId]);if(!current.rowCount)return res.status(404).json({error:'Application not found.'});if(action==='archive')await pool!.query("UPDATE properties SET archived_at=NOW(6),archived_by_uid=?,archive_reason=?,status='archived' WHERE id=? AND tenant_id=?",[req.user?.uid,parsed.data.reason,req.params.id,req.user?.tenantId]);else await pool!.query("UPDATE properties SET archived_at=NULL,archived_by_uid=NULL,archive_reason=NULL,status='in_review' WHERE id=? AND tenant_id=?",[req.params.id,req.user?.tenantId]);await audit(req.user?.uid||'unknown',req.user?.tenantId,`admin.application_${action}d`,'property',req.params.id,{reason:parsed.data.reason});res.json({success:true});}));

app.get('/api/admin/documents',authGuard,adminGuard,asyncRoute(async(req,res)=>{const result=await pool!.query('SELECT d.id,d.property_id,d.original_filename,d.doc_type,d.classification_confidence,d.processing_status,d.manual_review_status,d.governance_status,d.governance_reason,d.uploaded_by_uid,d.size_bytes,d.sha256,d.created_at,p.application_number,p.name property_name FROM documents d JOIN properties p ON p.id=d.property_id AND p.tenant_id=d.tenant_id WHERE d.tenant_id=? ORDER BY d.created_at DESC LIMIT 500',[req.user?.tenantId]);res.json({items:result.rows});}));

app.patch('/api/admin/documents/:id/reassign',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=z.object({propertyId:z.string().uuid(),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Target property and reason are required.'});const doc=await pool!.query('SELECT * FROM documents WHERE id=? AND tenant_id=?',[req.params.id,req.user?.tenantId]);const property=await pool!.query('SELECT id FROM properties WHERE id=? AND tenant_id=?',[parsed.data.propertyId,req.user?.tenantId]);if(!doc.rowCount||!property.rowCount)return res.status(404).json({error:'Document or target application not found.'});if(doc.rows[0].extracted_fields?.reviewState?.isVerified)return res.status(409).json({error:'Verified evidence must be returned to review before reassignment.'});await pool!.query("UPDATE documents SET property_id=?,manual_review_status='required',governance_status='active',governance_reason=?,governance_by_uid=?,governance_at=NOW(6) WHERE id=? AND tenant_id=?",[parsed.data.propertyId,parsed.data.reason,req.user?.uid,req.params.id,req.user?.tenantId]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.document_reassigned','document',req.params.id,{beforePropertyId:doc.rows[0].property_id,afterPropertyId:parsed.data.propertyId,reason:parsed.data.reason});res.json({success:true});}));

app.patch('/api/admin/documents/:id/manual-review',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=z.object({required:z.boolean(),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Review state and reason are required.'});const result=await pool!.query("UPDATE documents SET manual_review_status=?,governance_reason=?,governance_by_uid=?,governance_at=NOW(6) WHERE id=? AND tenant_id=?",[parsed.data.required?'required':'completed',parsed.data.reason,req.user?.uid,req.params.id,req.user?.tenantId]);if(!result.rowCount)return res.status(404).json({error:'Document not found.'});await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.document_manual_review_changed','document',req.params.id,{required:parsed.data.required,reason:parsed.data.reason});res.json({success:true});}));

for(const action of ['reject','delete'] as const){const method=action==='delete'?'delete':'post';(app as any)[method](`/api/admin/documents/:id${action==='reject'?'/reject':''}`,authGuard,adminGuard,asyncRoute(async(req:AuthenticatedRequest,res:Response)=>{const parsed=reasonSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'A reason is required.'});const status=action==='reject'?'rejected':'quarantined';const result=await pool!.query("UPDATE documents SET governance_status=?,governance_reason=?,governance_by_uid=?,governance_at=NOW(6),manual_review_status='required' WHERE id=? AND tenant_id=?",[status,parsed.data.reason,req.user?.uid,req.params.id,req.user?.tenantId]);if(!result.rowCount)return res.status(404).json({error:'Document not found.'});await audit(req.user?.uid||'unknown',req.user?.tenantId,`admin.document_${status}`,'document',req.params.id,{reason:parsed.data.reason,softDelete:true});res.json({success:true,softDelete:true});}));}

app.get('/api/admin/integrations',authGuard,adminGuard,asyncRoute(async(_req,res)=>{let database='unavailable';try{await pool!.query('SELECT 1');database='connected';}catch{}const emailConfigured=Boolean(process.env.SMTP_USER?.trim()&&process.env.SMTP_PASS?.trim()&&(process.env.SMTP_HOST?.trim()||process.env.SMTP_USER?.trim().endsWith('@gmail.com')));res.json({items:[{id:'mariadb',label:'MariaDB workspace',state:database,testSupported:true},{id:'storage',label:'Document storage adapter',state:documentStorage.provider==='supabase'?'supabase_private':'local_development',testSupported:false,detail:documentStorage.provider==='supabase'?'Private Supabase Storage with server-created expiring links.':'Local sandbox storage; configure Supabase for private cloud objects and expiring links.'},{id:'ocr',label:'OCR and extraction',state:'configured',testSupported:false,detail:'Local Tesseract OCR with Kannada and English language models.'},{id:'email',label:'OTP email delivery',state:emailConfigured?'configured':'not_configured',testSupported:false},{id:'government',label:'Government source connectors',state:'not_connected',testSupported:false},{id:'gis',label:'GIS / spatial data',state:'unavailable',testSupported:false}]});}));
app.post('/api/admin/integrations/:id/test',authGuard,adminGuard,asyncRoute(async(req,res)=>{if(req.params.id!=='mariadb')return res.status(501).json({error:'A live connection test is unsupported for this integration.'});await pool!.query('SELECT 1');await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.integration_tested','integration','mariadb',{result:'connected'});res.json({state:'connected',checkedAt:new Date().toISOString()});}));

app.get('/api/admin/sessions',authGuard,adminGuard,asyncRoute(async(req,res)=>{const result=await pool!.query('SELECT s.id,s.user_uid,s.created_at,s.last_activity_at,s.expires_at,s.ip_address,s.user_agent,m.email,m.role FROM authentication_sessions s LEFT JOIN org_memberships m ON m.organization_id=s.tenant_id AND m.user_uid=s.user_uid WHERE s.tenant_id=? AND s.revoked_at IS NULL AND s.expires_at>NOW(6) ORDER BY s.last_activity_at DESC',[req.user?.tenantId]);res.json({items:result.rows});}));
app.delete('/api/admin/sessions/:id',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=reasonSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'A revocation reason is required.'});const session=await pool!.query('SELECT * FROM authentication_sessions WHERE id=? AND tenant_id=? AND revoked_at IS NULL',[req.params.id,req.user?.tenantId]);if(!session.rowCount)return res.status(404).json({error:'Active session not found.'});await pool!.query('UPDATE authentication_sessions SET revoked_at=NOW(6),revoked_by_uid=?,revoke_reason=? WHERE id=? AND tenant_id=?',[req.user?.uid,parsed.data.reason,req.params.id,req.user?.tenantId]);for(const[token,item]of authSessions)if(item.id===req.params.id)authSessions.delete(token);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.session_revoked','authentication_session',req.params.id,{userUid:session.rows[0].user_uid,reason:parsed.data.reason});res.json({success:true});}));
app.get('/api/admin/security-events',authGuard,adminGuard,asyncRoute(async(req,res)=>{const result=await pool!.query("SELECT id,actor_uid,action,entity_type,entity_id,details,created_at FROM audit_events WHERE tenant_id=? AND (action LIKE 'auth.%' OR action LIKE 'admin.session%' OR action LIKE 'admin.member%' OR action LIKE 'admin.invitation%') ORDER BY created_at DESC LIMIT 200",[req.user?.tenantId]);res.json({items:result.rows});}));

app.get('/api/admin/storage',authGuard,adminGuard,asyncRoute(async(req,res)=>{const result=await pool!.query("SELECT COUNT(*) document_count,COALESCE(SUM(size_bytes),0) size_bytes,SUM(governance_status='quarantined') quarantined_count FROM documents WHERE tenant_id=?",[req.user?.tenantId]);const archives=await pool!.query('SELECT COUNT(*) archived_count FROM properties WHERE tenant_id=? AND archived_at IS NOT NULL',[req.user?.tenantId]);res.json({measured:true,...result.rows[0],...archives.rows[0]});}));
app.get('/api/admin/retention',authGuard,adminGuard,asyncRoute(async(req,res)=>{const result=await pool!.query('SELECT * FROM workspace_retention_policies WHERE tenant_id=?',[req.user?.tenantId]);res.json({item:result.rows[0]||{tenant_id:req.user?.tenantId,retention_days:2555,archive_after_days:365,legal_hold:false,automatic_cleanup_enabled:false},schedulerActive:false});}));
app.patch('/api/admin/retention',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=z.object({retentionDays:z.number().int().min(365).max(36500),archiveAfterDays:z.number().int().min(30).max(36500),legalHold:z.boolean(),automaticCleanupEnabled:z.literal(false),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid retention policy. Automatic deletion is not available.'});const before=await pool!.query('SELECT * FROM workspace_retention_policies WHERE tenant_id=?',[req.user?.tenantId]);await pool!.query('INSERT INTO workspace_retention_policies (tenant_id,retention_days,archive_after_days,legal_hold,automatic_cleanup_enabled,updated_by_uid) VALUES (?,?,?,?,FALSE,?) ON DUPLICATE KEY UPDATE retention_days=VALUES(retention_days),archive_after_days=VALUES(archive_after_days),legal_hold=VALUES(legal_hold),automatic_cleanup_enabled=FALSE,updated_by_uid=VALUES(updated_by_uid)',[req.user?.tenantId,parsed.data.retentionDays,parsed.data.archiveAfterDays,parsed.data.legalHold,req.user?.uid]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.retention_updated','workspace_retention_policy',req.user?.tenantId||null,{before:before.rows[0]||null,after:parsed.data,reason:parsed.data.reason});res.json({success:true,schedulerActive:false});}));

app.get('/api/admin/audit',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=pageSchema.extend({action:z.string().max(120).optional().default(''),actor:z.string().max(191).optional().default(''),entityType:z.string().max(120).optional().default(''),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).safeParse(req.query);if(!parsed.success)return res.status(400).json({error:'Invalid audit filters.'});const q=parsed.data,where=['tenant_id=?'],params:any[]=[req.user?.tenantId];if(q.action){where.push('action=?');params.push(q.action);}if(q.actor){where.push('actor_uid=?');params.push(q.actor);}if(q.entityType){where.push('entity_type=?');params.push(q.entityType);}if(q.from){where.push('created_at>=?');params.push(`${q.from} 00:00:00`);}if(q.to){where.push('created_at<=?');params.push(`${q.to} 23:59:59`);}if(q.search){where.push('(action LIKE ? OR actor_uid LIKE ? OR entity_id LIKE ?)');const like=`%${q.search}%`;params.push(like,like,like);}const count=await pool!.query(`SELECT COUNT(*) total FROM audit_events WHERE ${where.join(' AND ')}`,params);const result=await pool!.query(`SELECT id,actor_uid,action,entity_type,entity_id,details,created_at FROM audit_events WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,[...params,q.limit,(q.page-1)*q.limit]);res.json({items:result.rows,total:Number(count.rows[0]?.total||0),page:q.page,limit:q.limit});}));

app.get('/api/settings', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query('SELECT * FROM workspace_settings WHERE tenant_id=?', [req.user?.tenantId]);
  if (!result.rows.length) {
    return res.json({
      settings: {
        org_name: 'Karnataka Legal Partners LLP',
        primary_contact: 'Deepak Professional (deepak@ojix.local)',
        default_district: 'Bengaluru Urban',
        auto_screen_bhoomi: true,
        auto_screen_kaveri: true,
        auto_screen_spatial: true,
        swd_primary_buffer_m: 50,
        swd_secondary_buffer_m: 25,
        swd_tertiary_buffer_m: 15,
        lake_buffer_m: 30,
        survey_margin_tolerance_pct: 1.0,
        ocr_confidence_threshold: 0.60,
      }
    });
  }
  res.json({ settings: result.rows[0] });
}));

app.post('/api/settings', authGuard, adminGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const s = req.body || {};
  await pool.query(
    `INSERT INTO workspace_settings
     (tenant_id, org_name, primary_contact, default_district,
      auto_screen_bhoomi, auto_screen_kaveri, auto_screen_spatial,
      swd_primary_buffer_m, swd_secondary_buffer_m, swd_tertiary_buffer_m,
      lake_buffer_m, survey_margin_tolerance_pct, ocr_confidence_threshold,
      updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
     ON DUPLICATE KEY UPDATE
       org_name = VALUES(org_name),
       primary_contact = VALUES(primary_contact),
       default_district = VALUES(default_district),
       auto_screen_bhoomi = VALUES(auto_screen_bhoomi),
       auto_screen_kaveri = VALUES(auto_screen_kaveri),
       auto_screen_spatial = VALUES(auto_screen_spatial),
       swd_primary_buffer_m = VALUES(swd_primary_buffer_m),
       swd_secondary_buffer_m = VALUES(swd_secondary_buffer_m),
       swd_tertiary_buffer_m = VALUES(swd_tertiary_buffer_m),
       lake_buffer_m = VALUES(lake_buffer_m),
       survey_margin_tolerance_pct = VALUES(survey_margin_tolerance_pct),
       ocr_confidence_threshold = VALUES(ocr_confidence_threshold),
       updated_at = now()`,
    [
      req.user?.tenantId,
      s.org_name || 'Karnataka Legal Partners LLP',
      s.primary_contact || 'Deepak Professional (deepak@ojix.local)',
      s.default_district || 'Bengaluru Urban',
      s.auto_screen_bhoomi ?? true,
      s.auto_screen_kaveri ?? true,
      s.auto_screen_spatial ?? true,
      Number(s.swd_primary_buffer_m || 50),
      Number(s.swd_secondary_buffer_m || 25),
      Number(s.swd_tertiary_buffer_m || 15),
      Number(s.lake_buffer_m || 30),
      Number(s.survey_margin_tolerance_pct || 1.0),
      Number(s.ocr_confidence_threshold || 0.60),
    ]
  );

  const result = await pool.query(
    'SELECT * FROM workspace_settings WHERE tenant_id=?',
    [req.user?.tenantId]
  );
  await audit(req.user?.uid || 'anon', req.user?.tenantId, 'update_settings', 'organization', req.user?.tenantId || null, s);
  res.json({ settings: result.rows[0], message: 'Workspace settings updated successfully.' });
}));


// Serve frontend web client bundle in production / sandbox mode
const baseDir = (import.meta as any).dirname || process.cwd();
const webDistCandidates = [
  path.resolve(baseDir, '../../web/dist'),
  path.resolve(baseDir, '../../../apps/web/dist'),
  path.resolve(process.cwd(), '../web/dist'),
  path.resolve(process.cwd(), 'apps/web/dist'),
];
const webDistPath = webDistCandidates.find(p => fs.existsSync(p));
if (webDistPath) {
  app.use(express.static(webDistPath));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? `File exceeds ${process.env.MAX_UPLOAD_MB || 25} MB limit.` : err.message });
  if (err instanceof OtpDeliveryError) return res.status(503).json({ error: err.message });
  if (err?.message?.includes('Only PDF')) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

let server: any;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(port, () => console.log(`OJIX Property API listening on http://localhost:${port}`));
  async function shutdown() { server?.close(); if (pool) await pool.end(); process.exit(0); }
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
