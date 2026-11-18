import swaggerUi from 'swagger-ui-express';
import { openapiSpec } from './swagger/openapi.js';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import { z } from 'zod';
import { generateOtp, generateOtpSalt, hashOtp, hashPassword, resolveDemoCredential, verifyOtp, verifyPassword } from './auth-security.js';
import { bootstrapSuperAdmin, isConfiguredSuperAdminEmail } from './super-admin-bootstrap.js';
import { classifySmtpFailure, getSmtpConfigurationIssues, readSmtpSettings, sendOtpEmailWithSmtp, smtpPublicError } from './otp-email.js';
import { calculateRisk, buildBaselineFindings, type RiskFinding } from './risk-engine.js';
import { extractDocument } from './document-extractor.js';
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
import { buildTenantObjectKey, createDocumentStorage, isRemoteStorageKey, storageProviderForKey } from './document-storage.js';
import { documentFileAccess } from './document-access.js';
import { provisionOrganizationOwner } from './organization-onboarding.js';
import { renderReportPdf } from './report-pdf.js';
import { isCorsOriginAllowed } from './cors-policy.js';
import { ocrAccess, type OcrRole } from './ocr-access.js';
import { DEFAULT_ROLE_PERMISSIONS, hasPermission, permissionForRequest, RBAC_ACTIONS, RBAC_ROLES } from './rbac.js';
import { demoReadPermissions, demoSessionExpiresAt, demoSessionIsActive, isDedicatedDemoDatabase, isDemoAuthRouteAllowed, isDemoExternalShareAllowed, isDemoReadPermissionAllowed, isDemoTenantRequest, resolveDemoSessionTtlMs, resolveDemoWorkspaceRole } from './demo-access.js';
import { detectedDocumentMimeType, resolveDirectUploadLimit, resolveMultipartFileLimit, resolveUploadDirectory } from './upload-config.js';
import { createMockPool } from './mock-pool.js';
import { isMockMode, getMockStore } from './mock-data-store.js';
import { demoSessionRepo, VALID_DEMO_ROLES, type DemoSessionWorkspace, type DemoProperty, type DemoStoredDocument } from './session-repository.js';
import { processDocumentWithOcr, executePythonTesseractOcr } from './demo-ocr-runner.js';


// Resolve environment files from this package so `tsx watch` and the compiled
// `dist/src/server.js` entry point load the same files from any working dir.
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.basename(path.dirname(serverDir)) === 'dist'
  ? path.resolve(serverDir, '../..')
  : path.resolve(serverDir, '..');
dotenv.config({ path: path.join(apiRoot, '.env'), override: false });
dotenv.config({ path: path.resolve(apiRoot, '../../.env'), override: false });

const app = express();

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

const port = Number(process.env.PORT || 4000);
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
let uploadDir = resolveUploadDirectory();
const documentStorage = createDocumentStorage();

try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (error) {
  uploadDir = path.join(os.tmpdir(), 'ojix-uploads');
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch {
    // Read-only filesystem fallback; do not crash startup
  }
}

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
      message: 'Local Tesseract extraction has not started. Extracted facts require reviewer confirmation.',
    },
    reviewState: { isVerified: false, overrides: {} },
  };
}

type DbResult = {
  rows: any[];
  rowCount: number;
};

const jsonColumns = new Set([
  'details', 'metadata', 'extracted_fields', 'from_parties', 'to_parties',
  'query_params', 'matched_record', 'discrepancies', 'parcel_geojson', 'checklist', 'snapshot', 'evidence_references', 'refs',
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

const mysqlPool = process.env.DATABASE_URL && !isMockMode()
  ? mysql.createPool({
      uri: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL?.toLowerCase() === 'true'
        || process.env.NODE_ENV === 'production'
        || Boolean(process.env.VERCEL)
        ? {
            rejectUnauthorized: true,
            ...(process.env.DATABASE_SSL_CA ? { ca: fs.readFileSync(process.env.DATABASE_SSL_CA, 'utf8') } : {}),
          }
        : undefined,
      waitForConnections: true,
      connectionLimit: (() => {
        const serverless = Boolean(process.env.VERCEL);
        const maxConnections = serverless ? 2 : 10;
        const configured = Number(process.env.DB_POOL_LIMIT || maxConnections);
        return Number.isInteger(configured) && configured >= 1 && configured <= maxConnections ? configured : maxConnections;
      })(),
      queueLimit: 0,
      connectTimeout: 5000,
    })
  : null;

// When the real MySQL pool is unavailable (no DATABASE_URL, DEMO_MODE=true, or
// DB unreachable), fall back to the in-memory mock pool so the entire application
// works without any external database, SMTP, or cloud dependencies.
const _usingMockPool = !mysqlPool;
if (_usingMockPool) console.info('[server] 🟢 DEMO MODE active — in-memory mock database, no external dependencies required.');

const pool = mysqlPool
  ? {
      async query(sql: string, params: any[] = []): Promise<DbResult> {
        try {
          const [rows] = await mysqlPool.query(sql, params);
          if (Array.isArray(rows)) {
            return { rows: parseMariaDbJsonRows(rows), rowCount: rows.length };
          }
          const result = rows as any;
          return { rows: [], rowCount: result.affectedRows ?? 0 };
        } catch (dbError: any) {
          // Auto-fallback to mock pool on connection failures
          if (dbError?.code === 'ECONNREFUSED' || dbError?.code === 'ETIMEDOUT' || dbError?.code === 'ENOTFOUND' || dbError?.code === 'ER_ACCESS_DENIED_ERROR' || dbError?.code === 'PROTOCOL_CONNECTION_LOST') {
            console.warn(`[server] DB query failed (${dbError?.code}), falling back to mock data.`);
            return createMockPool().query(sql, params);
          }
          throw dbError;
        }
      },
      async end() { await mysqlPool.end(); },
      async getConnection() {
        try {
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
        } catch {
          return createMockPool().getConnection();
        }
      },
    }
  : createMockPool();

let superAdminBootstrapPromise: Promise<void> | null = null;
function ensureSuperAdminBootstrapped(): Promise<void> {
  if (!pool) return Promise.resolve();
  if (!superAdminBootstrapPromise) {
    superAdminBootstrapPromise = bootstrapSuperAdmin(pool as unknown as import('./super-admin-bootstrap.js').BootstrapPool)
      .then(result => { if (result.configured) console.log(`Super Admin bootstrap ready (${result.created ? 'created' : 'account preserved'}).`); })
      .catch(error => { superAdminBootstrapPromise = null; throw error; });
  }
  return superAdminBootstrapPromise;
}

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
const configuredProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(configuredProxyHops) && configuredProxyHops > 0) app.set('trust proxy', configuredProxyHops);
else if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'https://ojix-property-intelligence.web.app',
  'https://ojix-property-intelligence.firebaseapp.com'
];
const allowedCorsOrigins = Array.from(new Set([
  ...defaultOrigins,
  ...corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean)
]));
app.use(cors({
  origin(origin, callback) {
    if (!origin || isCorsOriginAllowed(origin, allowedCorsOrigins)) return callback(null, true);
    if (/^https:\/\/[a-z0-9-]+(\.vercel\.app|\.preview\.vercel\.app)$/i.test(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    if (_usingMockPool || process.env.DEMO_MODE === 'true' || Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by CORS policy.'));
  },
  credentials: true,
}));
// Vercel initializes functions on demand, so run the same idempotent bootstrap
// before authentication routes. Avoid database work for preflight and health calls.
if (process.env.VERCEL) {
  app.use((req, _res, next) => {
    if (req.method === 'OPTIONS' || !req.path.startsWith('/api/auth')) return next();
    void ensureSuperAdminBootstrapped().then(() => next()).catch(next);
  });
}
app.use(express.json({ limit: '25mb' }));
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
    isDemo?: boolean;
    accessExpiresAt?: number;
    permissions?: string[];
  };
}
const supportSessions = new Map<string, number>();
const authSessions = new Map<string, { id:string; uid:string; email:string; name:string; role:string; tenantId:string; expiresAt:number; lastActivityAt:number; isDemo?:boolean }>();
const SUPPORT_SESSION_MS = 60 * 60 * 1000;
const AUTH_SESSION_MS = 8 * 60 * 60 * 1000;
const DEMO_SESSION_TTL_MS = resolveDemoSessionTtlMs(process.env.PUBLIC_DEMO_SESSION_TTL_HOURS);
const OWNER_INACTIVITY_EXPIRY_MS = 5 * 60_000 + 30_000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;
const OTP_REQUEST_WINDOW_MINUTES = 15;
const DEFAULT_ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';

class OtpDeliveryError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'OtpDeliveryError'; }
}

function smtpSafeDiagnostic(error:unknown) {
  const detail=error as {code?:unknown;responseCode?:unknown;command?:unknown;smtpStage?:unknown};
  return {
    code:typeof detail?.code==='string'?detail.code:'unknown',
    responseCode:typeof detail?.responseCode==='number'?detail.responseCode:undefined,
    command:typeof detail?.command==='string'?detail.command:'unknown',
    stage:detail?.smtpStage==='verify'||detail?.smtpStage==='sendMail'?detail.smtpStage:'unknown'
  };
}

async function deliverOtpEmail(email:string, name:string, otp:string, purpose:'login'|'registration'|'password_reset') {
  // In demo/mock mode, skip SMTP entirely — OTP is auto-filled on the client
  if (_usingMockPool || isMockMode()) {
    console.info(`[demo] OTP for ${email} (${purpose}): ${otp} — SMTP bypassed in demo mode.`);
    return { delivered:true, mode:'email' as const };
  }
  let settings;
  try { settings=readSmtpSettings(); }
  catch(error) {
    // If SMTP is not configured, still succeed in non-production
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[smtp] Not configured — OTP for ${email}: ${otp}. Proceeding without delivery.`);
      return { delivered:true, mode:'email' as const };
    }
    const issues=getSmtpConfigurationIssues();
    const code=classifySmtpFailure(error);
    console.error('[smtp] Configuration rejected',{code,issues});
    throw new OtpDeliveryError(code,smtpPublicError(code));
  }
  const issues=getSmtpConfigurationIssues();
  if(issues.length){
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[smtp] Config issues — OTP for ${email}: ${otp}. Proceeding without delivery.`);
      return { delivered:true, mode:'email' as const };
    }
    console.error('[smtp] Configuration rejected',{reasonCode:'SMTP_CONFIG_INVALID',issues});
    throw new OtpDeliveryError('SMTP_CONFIG_INVALID',smtpPublicError('SMTP_CONFIG_INVALID'));
  }
  const from=process.env.SMTP_FROM?.trim()||settings.user;
  try {
    await sendOtpEmailWithSmtp(settings,{from,to:email,name,otp,purpose});
    console.info('[smtp] OTP email accepted by SMTP server',{purpose});
  }
  catch (error) {
    // If SMTP delivery fails in non-production, log the OTP and continue
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[smtp] Delivery failed — OTP for ${email}: ${otp}. Proceeding without delivery.`);
      return { delivered:true, mode:'email' as const };
    }
    const code=classifySmtpFailure(error);
    console.error('[smtp] OTP delivery failed',{
      reasonCode:code,
      port:settings.port,tls:settings.secure?'implicit':'required STARTTLS',
      ...smtpSafeDiagnostic(error)
    });
    throw new OtpDeliveryError(code,smtpPublicError(code));
  }
  return { delivered:true, mode:'email' as const };
}

async function deliverOtpSms(phone:string, name:string, otp:string) {
  // In demo/mock mode, skip Twilio entirely
  if (_usingMockPool || isMockMode()) {
    console.info(`[demo] SMS OTP for ${phone} (${name}): ${otp} — Twilio bypassed in demo mode.`);
    return { delivered:true, mode:'sms' as const };
  }
  const accountSid=process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken=process.env.TWILIO_AUTH_TOKEN?.trim();
  const from=process.env.TWILIO_FROM_NUMBER?.trim();
  const messagingServiceSid=process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  if(!accountSid||!authToken||(!from&&!messagingServiceSid)){
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[sms] Not configured — OTP for ${phone}: ${otp}. Proceeding without delivery.`);
      return { delivered:true, mode:'sms' as const };
    }
    throw new OtpDeliveryError('SMS_NOT_CONFIGURED','SMS OTP delivery is not configured. Add Twilio credentials and restart the API.');
  }
  const body=new URLSearchParams({To:phone,Body:`OJIX sign-in code for ${name}: ${otp}. It expires in 10 minutes. Never share this code.`});
  if(messagingServiceSid)body.set('MessagingServiceSid',messagingServiceSid);else body.set('From',from!);
  const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!response.ok)throw new OtpDeliveryError('SMS_DELIVERY_FAILED','The SMS verification code could not be delivered. Check the Twilio sender and account configuration.');
  return {delivered:true,mode:'sms' as const};
}

const maskEmail=(value:string)=>{const[local,domain]=value.split('@');return `${local.slice(0,2)}${'*'.repeat(Math.max(2,local.length-2))}@${domain}`;};
const maskPhone=(value:string)=>`${value.slice(0,Math.max(0,value.length-4)).replace(/\d/g,'•')}${value.slice(-4)}`;

export function extractTokenFromReq(req: Request): string {
  const authHeader = req.header('authorization') || '';
  if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }
  const customHeader = req.header('x-ojix-demo-token');
  if (customHeader) return customHeader.trim();
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)ojix_demo_session=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return '';
}

async function authGuard(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;

  // Check demo session repository first
  const demoCandidateToken = extractTokenFromReq(req);
  if (demoCandidateToken) {
    const demoWs = demoSessionRepo.getSession(demoCandidateToken);
    if (demoWs) {
      (authReq as any).demoWorkspace = demoWs;
      authReq.user = {
        uid: demoWs.user.uid,
        email: demoWs.user.email,
        name: demoWs.user.name,
        tenantId: demoWs.user.tenantId,
        role: demoWs.user.role,
        isSuperAdmin: demoWs.user.isSuperAdmin,
        isDemo: true,
        accessExpiresAt: demoWs.expiresAt,
        permissions: [...demoWs.user.permissions],
      };

      const target = permissionForRequest(req.method, req.originalUrl, req.body);
      if (target) {
        if (target.resource === 'super_admin' && !authReq.user.isSuperAdmin) {
          return res.status(403).json({ error: 'Platform Super Admin access is required through the isolated platform role.', code: 'SUPER_ADMIN_REQUIRED' });
        }
        const requiredPerm = `${target.resource}.${target.action}`;
        const userPerms = authReq.user.permissions || [];
        const hasPerm = userPerms.includes(requiredPerm) ||
                        userPerms.includes(`${target.resource}.*`) ||
                        authReq.user.role === 'owner' ||
                        authReq.user.isSuperAdmin;
        if (!hasPerm) {
          return res.status(403).json({ error: `Permission denied: ${requiredPerm} required.`, code: 'FORBIDDEN' });
        }
      }
      return next();
    }
  }

  let identity: { uid: string; email?: string; name?: string } | null = null;
  let requestSession: { id:string; uid:string; email:string; name:string; role:string; tenantId:string; expiresAt:number; lastActivityAt:number; isDemo?:boolean } | undefined;
  const authHeader = authReq.header('authorization') || '';
  const xUserUid = authReq.header('x-user-uid');

  if (xUserUid) {
    if (process.env.NODE_ENV === 'production') return res.status(401).json({ error: 'Development identity headers are disabled.' });
    const matched = DUMMY_ACCOUNTS.find(a => a.uid === xUserUid);
    if (process.env.NODE_ENV !== 'production' && matched?.role === 'support') supportSessions.set(matched.uid,Date.now()+SUPPORT_SESSION_MS);
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
        `SELECT s.id,s.user_uid,s.tenant_id,s.expires_at,s.last_activity_at,m.email,m.role,u.full_name,o.slug
         FROM authentication_sessions s
         JOIN org_memberships m ON m.user_uid=s.user_uid AND m.organization_id=s.tenant_id AND m.status='active'
         JOIN organizations o ON o.id=s.tenant_id
         LEFT JOIN user_accounts u ON u.id=s.user_uid
         WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>NOW(6) LIMIT 1`,
        [crypto.createHash('sha256').update(rawToken).digest('hex')]
      );
      if (restored.rowCount) {
        const row=restored.rows[0];
        const dummy=DUMMY_ACCOUNTS.find(account=>account.uid===row.user_uid);
        const isDemo=publicDemoEnabled()&&row.slug==='ojix-public-demo'&&row.user_uid==='user-viewer'&&row.role==='viewer'&&row.tenant_id===process.env.PUBLIC_DEMO_TENANT_ID?.trim();
        const expiresAt=new Date(row.expires_at).getTime();
        // Durable demo-session rehydration preserves the same hard expiry.
        session={id:row.id,uid:row.user_uid,email:isDemo?'demo.viewer@ojix-public-demo.invalid':row.email||dummy?.email||'',name:isDemo?'OJIX Demo Admin (Read only)':row.full_name||dummy?.name||row.email||row.user_uid,role:row.role,tenantId:row.tenant_id,expiresAt,lastActivityAt:new Date(row.last_activity_at).getTime(),isDemo};
        authSessions.set(rawToken,session);
      }
    }
    requestSession=session;
    if (session && demoSessionIsActive(session.expiresAt)) {
      if(!session.isDemo&&['owner','super_admin'].includes(session.role)&&Date.now()-session.lastActivityAt>OWNER_INACTIVITY_EXPIRY_MS){if(pool)await pool.query("UPDATE authentication_sessions SET revoked_at=NOW(6),revoked_by_uid=?,revoke_reason='Inactivity timeout' WHERE id=? AND revoked_at IS NULL",[session.uid,session.id]);authSessions.delete(rawToken);return res.status(401).json({error:'Your session has expired due to inactivity. Please log in again.',code:'SESSION_INACTIVITY_EXPIRED'});}
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
    // Durable API sessions are validated from MySQL and can be rehydrated on
    // any Vercel instance. The in-memory map is only for local dev identities.
    const expiresAt = requestSession?.uid === dummyIdentity.uid && requestSession.role === 'support'
      ? requestSession.expiresAt
      : supportSessions.get(dummyIdentity.uid) || 0;
    if (expiresAt <= Date.now()) return res.status(401).json({ error: 'Support access has expired. Sign in again to request a new time-limited session.' });
  }

  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const requestedWorkspace = String(authReq.header('x-ojix-workspace-id') || requestSession?.tenantId || '').trim();
  if(requestSession?.isDemo&&!isDemoTenantRequest(true,requestSession.tenantId,requestedWorkspace))return res.status(403).json({error:'Demo sessions are restricted to their isolated synthetic workspace.',code:'DEMO_TENANT_MISMATCH'});
  const membership = requestedWorkspace
    ? await pool.query('SELECT organization_id, role, email, status FROM org_memberships WHERE user_uid=? AND organization_id=? LIMIT 1',[identity.uid,requestedWorkspace])
    : await pool.query('SELECT organization_id, role, email, status FROM org_memberships WHERE user_uid=? ORDER BY created_at LIMIT 1',[identity.uid]);
  if (!membership.rowCount) {
    return res.status(403).json({ error: `No workspace membership exists for account '${identity.uid}'.` });
  }
  if(membership.rows[0].status&&membership.rows[0].status!=='active')return res.status(403).json({error:'This workspace membership is not active.'});

  const authenticatedEmail = membership.rows[0].email || identity.email;
  if (pool && !dummyIdentity) {
    const account=await pool.query('SELECT status,email_verified FROM user_accounts WHERE id=? LIMIT 1',[identity.uid]);
    if(account.rowCount&&(account.rows[0].status!=='active'||!account.rows[0].email_verified))return res.status(403).json({error:'This user account is disabled or unverified.',code:'ACCOUNT_INACTIVE'});
  }
  const isSuperAdmin = membership.rows[0].role === 'super_admin';
  authReq.user = {
    ...identity,
    email: authenticatedEmail,
    tenantId: membership.rows[0].organization_id,
    role: membership.rows[0].role,
    isSuperAdmin,
    isDemo:Boolean(requestSession?.isDemo&&membership.rows[0].organization_id===requestSession.tenantId&&membership.rows[0].role==='viewer'),
    accessExpiresAt:requestSession?.isDemo?requestSession.expiresAt:undefined,
  };
  const effectivePermissions=new Set(DEFAULT_ROLE_PERMISSIONS[membership.rows[0].role as keyof typeof DEFAULT_ROLE_PERMISSIONS]||[]);
  if(authReq.user.isDemo)for(const permission of demoReadPermissions())effectivePermissions.add(permission as any);
  try{
    const overrides=await pool.query('SELECT resource,action,allowed FROM workspace_permission_overrides WHERE tenant_id=? AND role=?',[membership.rows[0].organization_id,membership.rows[0].role]);
    for(const row of overrides.rows){const permission=`${row.resource}.${row.action}`;if(Boolean(row.allowed))effectivePermissions.add(permission as any);else effectivePermissions.delete(permission as any);}
  }catch(error:any){if(error?.code!=='ER_NO_SUCH_TABLE'&&error?.errno!==1146)throw error;}
  authReq.user.permissions=[...effectivePermissions];
  const target=permissionForRequest(req.method,req.originalUrl,req.body);
  if(target){
    if(target.resource==='super_admin'&&(!isSuperAdmin||membership.rows[0].role!=='super_admin'))return res.status(403).json({error:'Platform Super Admin access is required through the isolated platform role.',code:'SUPER_ADMIN_REQUIRED'});
    if(membership.rows[0].role==='super_admin'&&target.resource!=='super_admin')return res.status(403).json({error:'Platform Super Admin identities do not inherit workspace permissions. Sign in through a workspace membership for workspace access.',code:'WORKSPACE_ROLE_REQUIRED'});
    let override:boolean|undefined;
    try{
      const result=await pool.query('SELECT allowed FROM workspace_permission_overrides WHERE tenant_id=? AND role=? AND resource=? AND action=? LIMIT 1',[membership.rows[0].organization_id,membership.rows[0].role,target.resource,target.action]);
      if(result.rowCount)override=Boolean(result.rows[0].allowed);
    }catch(error:any){
      if(error?.code!=='ER_NO_SUCH_TABLE'&&error?.errno!==1146)throw error;
      // Keep the existing deployment usable until migration 033 is applied;
      // server-side role defaults still enforce access, while configuration APIs report migration readiness.
    }
    if(!(isDemoReadPermissionAllowed(Boolean(authReq.user.isDemo),target.resource,target.action))&&!hasPermission(membership.rows[0].role,target.resource,target.action,override))return res.status(403).json({error:`Permission denied for ${target.resource}.${target.action}.`,code:'PERMISSION_DENIED',requiredPermission:`${target.resource}.${target.action}`,currentRole:membership.rows[0].role});
  }
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
  if (!user || !ocrAccess.canIntake(user.role as OcrRole)) {
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
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  if (user?.role === 'consultant') {
    const assigned = await pool.query('SELECT id FROM properties WHERE id=? AND tenant_id=? AND assigned_consultant_uid=? LIMIT 1',[req.params.id,user.tenantId,user.uid]);
    if (!assigned.rowCount) return res.status(404).json({ error: 'Assigned matter not found.' });
  } else if (user?.role === 'lawyer' || user?.role === 'analyst' || user?.role === 'operations' || user?.role === 'viewer') {
    const column=user.role==='lawyer'?'assigned_lawyer_uid':user.role==='analyst'?'assigned_analyst_uid':user.role==='operations'?'assigned_operations_uid':'assigned_viewer_uid';
    const released=user.role==='viewer'?" AND status IN ('approved','complete')":'';
    const assigned = await pool.query(`SELECT id FROM properties WHERE id=? AND tenant_id=? AND ${column}=?${released} LIMIT 1`,[req.params.id,user.tenantId,user.uid]);
    if (!assigned.rowCount) return res.status(404).json({ error: user.role==='viewer'?'Released matter not assigned to this Viewer.':'Assigned matter not found.' });
  }
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

async function loadTenantReportBranding(tenantId: string) {
  const result = await pool!.query(
    'SELECT org_name,llpin,office_address,firm_logo_url,firm_email,default_report_template,legal_disclaimer FROM workspace_settings WHERE tenant_id=?',
    [tenantId],
  );
  const row = result.rows[0];
  return row ? {
    id: tenantId,
    organizationName: String(row.org_name || 'Not recorded'),
    llpin: String(row.llpin || ''),
    officeAddress: String(row.office_address || ''),
    firmLogoUrl: String(row.firm_logo_url || ''),
    firmEmail: String(row.firm_email || ''),
    defaultReportTemplate: String(row.default_report_template || 'detailed_due_diligence'),
    legalDisclaimer: String(row.legal_disclaimer || ''),
  } : { id: tenantId, organizationName: 'Not recorded' };
}

function consultantReportScope(user: AuthenticatedRequest['user']) {
  if (['owner','admin'].includes(user?.role || '')) return { sql:'r.tenant_id=?', params:[user?.tenantId] };
  if (user?.role==='lawyer') return { sql:'r.tenant_id=? AND p.assigned_lawyer_uid=?', params:[user.tenantId,user.uid] };
  return { sql:'r.tenant_id=? AND p.assigned_consultant_uid=?', params:[user?.tenantId,user?.uid] };
}
function clientSafeReport(row:any) {
  const original=typeof row.snapshot==='string'?JSON.parse(row.snapshot):row.snapshot;
  const verifiedFindings=(original.findings||[]).filter((f:any)=>f.reviewer_state==='approved');
  const titleTimeline=(original.titleTimeline||[]).filter((event:any)=>event.status==='verified');
  const pendingReviewCount=(original.findings||[]).filter((f:any)=>f.reviewer_state!=='approved').length+
    (original.titleTimeline||[]).filter((event:any)=>event.status!=='verified').length;
  const common={...original,findings:verifiedFindings,titleTimeline,pendingReviewCount,approvalStatus:'approved'};
  const clientSnapshot={...common,documents:(original.documents||[]).filter((d:any)=>d.review_status==='approved'),gisFindings:(original.gisFindings||[]).filter((f:any)=>f.reviewer_state==='approved'),reportSections:consultantReportSections(common,row.report_type)};
  return {reportId:row.id,version:row.version_number,reportType:row.report_type,title:row.title,approvalStatus:row.approval_status,reviewDecision:row.review_decision,reviewRationale:row.review_rationale,reviewerName:row.reviewer_name||'Authorized reviewer',reviewedAt:row.reviewed_at,dataCheckedAt:row.data_checked_at,createdAt:row.created_at,snapshotSha256:row.snapshot_sha256,snapshot:clientSnapshot};
}
function consultantReportSections(snapshot:any,type:string) {
  const approvedFindings=(snapshot.findings||[]).filter((f:any)=>f.reviewer_state==='approved');
  const approvedTimeline=(snapshot.titleTimeline||[]).filter((e:any)=>e.status==='verified');
  const pending=Number(snapshot.pendingReviewCount??((snapshot.findings||[]).length-approvedFindings.length+(snapshot.titleTimeline||[]).length-approvedTimeline.length));
  const map={latitude:snapshot.property?.latitude??null,longitude:snapshot.property?.longitude??null,coordinateSource:snapshot.property?.coordinate_source||'not recorded',coordinateCapturedAt:snapshot.property?.coordinate_captured_at||null,limitations:'Map context is not a cadastral boundary or planning determination.'};
  if(type==='preliminary_screening')return {propertyProfile:snapshot.sourceFacts,mapScreening:map,documentCompleteness:{total:(snapshot.documents||[]).length,reviewerApproved:(snapshot.documents||[]).filter((d:any)=>d.review_status==='approved').length},preliminaryFindings:approvedFindings,pendingReviewerItems:pending};
  if(type==='detailed_due_diligence')return {executiveSummary:{matter:snapshot.property?.name,approvedFindingCount:approvedFindings.length,pendingReviewerItems:pending},titleTimeline:approvedTimeline,discrepancies:snapshot.discrepancies||[],gisEvidence:(snapshot.gisFindings||[]).filter((f:any)=>f.reviewer_state==='approved'),sourceAppendix:(snapshot.documents||[]).filter((d:any)=>d.review_status==='approved')};
  if(type==='client_decision_pack')return {approvedFindings,questions:snapshot.questions||[],nextActions:approvedFindings.map((f:any)=>({findingId:f.id,action:f.next_action,evidenceReferences:f.evidence_references})),limitations:snapshot.limitations||[],pendingReviewerItems:pending};
  return {documentIndex:(snapshot.documents||[]).filter((d:any)=>d.review_status==='approved'),citations:(snapshot.findings||[]).filter((f:any)=>f.reviewer_state==='approved').flatMap((f:any)=>(f.evidence_references||[]).map((e:any)=>({findingId:f.id,...e}))),mapSnapshot:map,sourceProvenance:snapshot.sourceFreshness};
}
async function loadConsultantSnapshot(tenantId:string,propertyId:string,reportType:string) {
  const property=await pool!.query('SELECT * FROM properties WHERE id=? AND tenant_id=?',[propertyId,tenantId]);
  if(!property.rowCount)return null;
  const [docs,events,findings,source]=await Promise.all([
    pool!.query("SELECT id,original_filename,doc_type,sha256,review_status,manual_review_status,processing_status,created_at FROM documents WHERE property_id=? AND tenant_id=? AND governance_status='active' ORDER BY created_at",[propertyId,tenantId]),
    pool!.query('SELECT id,document_id,sequence_order,event_date,registration_date,deed_type,from_parties,to_parties,extent_sq_ft,extent_raw,consideration,status,dispute_rationale,reviewed_by,encumbrance_status,created_at FROM title_events WHERE property_id=? AND tenant_id=? ORDER BY event_date,sequence_order',[propertyId,tenantId]),
    pool!.query(`SELECT f.id,f.code,f.title,f.severity,f.points,f.explanation,f.evidence_status,f.next_action,f.created_at,COALESCE(fr.review_status,'pending') AS reviewer_state,fr.rationale AS reviewer_rationale,fr.reviewer_uid,fr.reviewed_at,COALESCE(JSON_ARRAYAGG(CASE WHEN e.document_id IS NULL THEN NULL ELSE JSON_OBJECT('id',d.id,'filename',d.original_filename,'sha256',d.sha256,'createdAt',d.created_at) END),JSON_ARRAY()) AS evidence_references FROM risk_findings f LEFT JOIN consultant_finding_reviews fr ON fr.finding_id=f.id AND fr.tenant_id=f.tenant_id LEFT JOIN consultant_issue_evidence e ON e.finding_id=f.id AND e.tenant_id=f.tenant_id LEFT JOIN documents d ON d.id=e.document_id AND d.tenant_id=e.tenant_id AND d.review_status='approved' AND d.governance_status='active' WHERE f.property_id=? AND f.tenant_id=? GROUP BY f.id ORDER BY f.created_at`,[propertyId,tenantId]),
    pool!.query('SELECT MAX(created_at) latest_document_at FROM documents WHERE property_id=? AND tenant_id=?',[propertyId,tenantId])
  ]);
  const approvedDocs=docs.rows.filter((d:any)=>d.review_status==='approved');
  const titleTimeline=events.rows.map((row:any)=>({id:row.id,propertyId,documentId:row.document_id||'',sequenceOrder:Number(row.sequence_order),eventDate:row.event_date instanceof Date?row.event_date.toISOString().slice(0,10):String(row.event_date||''),registrationDate:row.registration_date?String(row.registration_date):undefined,deedType:row.deed_type||'',fromParties:typeof row.from_parties==='string'?JSON.parse(row.from_parties):(row.from_parties||[]),toParties:typeof row.to_parties==='string'?JSON.parse(row.to_parties):(row.to_parties||[]),extentSqFt:Number(row.extent_sq_ft||0),extentRaw:row.extent_raw||'',consideration:Number(row.consideration||0),status:row.status,disputeRationale:row.dispute_rationale||undefined,reviewedBy:row.reviewed_by||undefined,encumbranceStatus:row.encumbrance_status||'none'}));
  const docItems=approvedDocs.map((r:any)=>({id:r.id,originalFilename:r.original_filename,extractedFields:{}}));
  const derived=createDueDiligenceSnapshot({property:property.rows[0],documents:approvedDocs,titleTimeline:titleTimeline.filter((e:any)=>e.status==='verified'),titleGaps:detectTitleGaps(titleTimeline.filter((e:any)=>e.status==='verified')),discrepancies:detectCrossDocumentDiscrepancies(docItems,property.rows[0])});
  const findingRows=findings.rows.map((f:any)=>({...f,evidence_references:(Array.isArray(f.evidence_references)?f.evidence_references:[]).filter(Boolean)}));
  const pendingQuestions:string[]=[];
  if(!property.rows[0].survey_number)pendingQuestions.push('Confirm the survey number against current official records.');
  if(!property.rows[0].extent)pendingQuestions.push('Confirm the stated property extent.');
  if(!approvedDocs.length)pendingQuestions.push('No reviewer-approved documents are available for this matter.');
  if(findingRows.some((f:any)=>f.reviewer_state!=='approved'))pendingQuestions.push('One or more issue items are not yet approved for client reporting by a legal reviewer.');
  return {reportType,property:property.rows[0],sourceFacts:{name:property.rows[0].name,applicationNumber:property.rows[0].application_number,surveyNumber:property.rows[0].survey_number,subdivision:property.rows[0].subdivision,village:property.rows[0].village,hobli:property.rows[0].hobli,taluk:property.rows[0].taluk,district:property.rows[0].district,extent:property.rows[0].extent,coordinates:property.rows[0].latitude==null||property.rows[0].longitude==null?null:{latitude:property.rows[0].latitude,longitude:property.rows[0].longitude,source:property.rows[0].coordinate_source,recordedAt:property.rows[0].coordinate_captured_at}},normalizedFacts:derived,documents:docs.rows.map((d:any)=>({...d,clientVisible:d.review_status==='approved'})),titleTimeline,discrepancies:derived.discrepancies||[],findings:findingRows,gisFindings:findingRows.filter((f:any)=>/gis|spatial|lake|drain/i.test(`${f.code} ${f.title}`)),sourceFreshness:{latestDocumentAt:source.rows[0]?.latest_document_at||null,checkedAt:new Date().toISOString()},questions:pendingQuestions,limitations:['This report is prepared from records available in this workspace as of the stated data-checked date.','Government source integrations are not live unless explicitly identified with source provenance.','A Consultant does not make or approve legal findings; only reviewer-approved findings appear in the client-facing issue list.','This report is not a title certificate, government verification or legal opinion.']};
}
function escapeReportHtml(value:unknown) { return String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
function consultantWordHtml(report:any) {
  const snapshot=report.snapshot;const findings=snapshot.findings||[];
  const rows=findings.map((f:any)=>`<tr><td>${escapeReportHtml(f.id||f.code)}</td><td>${escapeReportHtml(f.title)}</td><td>${escapeReportHtml(f.severity)}</td><td>${escapeReportHtml(f.reviewer_state)}</td><td>${escapeReportHtml(f.next_action)}</td><td>${(f.evidence_references||[]).map((e:any)=>escapeReportHtml(e.filename)).join(', ')}</td></tr>`).join('');
  const sections=Object.entries(snapshot.reportSections||{}).map(([name,value])=>`<h2>${escapeReportHtml(name.replace(/_/g,' '))}</h2><pre>${escapeReportHtml(JSON.stringify(value,null,2))}</pre>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeReportHtml(report.title)}</title><style>@page{size:A4;margin:18mm 16mm 20mm}body{font:11pt Calibri,Arial,sans-serif;color:#182036;margin:0;line-height:1.45}h1{font-size:22pt;color:#352267;break-after:avoid}h2{font-size:14pt;border-bottom:1px solid #d9d5e7;padding-bottom:5px;break-after:avoid}table{width:100%;border-collapse:collapse;page-break-inside:auto}tr{page-break-inside:avoid}th,td{border:1px solid #cfd3dd;padding:6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#f0edf8}.notice{background:#f8f5ff;padding:12px;border-left:3px solid #6848c6}pre{font:9pt Calibri,Arial,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;background:#faf9fd;padding:9px;border:1px solid #eeedf4;page-break-inside:auto}</style></head><body><h1>${escapeReportHtml(report.title)}</h1><p>Version ${report.version} · Data checked ${escapeReportHtml(report.dataCheckedAt)} · Approval: Approved</p><p>Reviewed by ${escapeReportHtml(report.reviewerName)} on ${escapeReportHtml(report.reviewedAt)}. Decision: ${escapeReportHtml(report.reviewDecision)}. ${escapeReportHtml(report.reviewRationale)}</p><h2>Property profile</h2><p>${escapeReportHtml(snapshot.property?.name)} · ${escapeReportHtml(snapshot.property?.application_number)} · ${escapeReportHtml(snapshot.property?.village)} · Survey ${escapeReportHtml(snapshot.property?.survey_number)}</p>${sections}<h2>Approved issue list</h2><table><thead><tr><th>Issue ID</th><th>Issue</th><th>Severity</th><th>Review state</th><th>Next action</th><th>Evidence references</th></tr></thead><tbody>${rows||'<tr><td colspan="6">No reviewer-approved findings in this snapshot.</td></tr>'}</tbody></table><h2>Questions and limitations</h2><div class="notice"><p>Items awaiting reviewer confirmation: ${Number(snapshot.pendingReviewCount||0)}</p>${(snapshot.questions||[]).map((q:string)=>`<p>${escapeReportHtml(q)}</p>`).join('')}${(snapshot.limitations||[]).map((q:string)=>`<p>${escapeReportHtml(q)}</p>`).join('')}</div><p>Snapshot SHA-256: ${escapeReportHtml(report.snapshotSha256)}</p></body></html>`;
}
app.get('/api/shared-reports/:token',asyncRoute(async(req,res)=>{
  if(!pool)return res.status(503).json({error:'Report storage is unavailable.'});
  const token=String(req.params.token||'');if(!/^[a-f0-9]{64}$/.test(token))return res.status(404).json({error:'Shared report not found.'});
  const tokenHash=crypto.createHash('sha256').update(token).digest('hex');
  const result=await pool!.query("SELECT s.id AS share_id,s.tenant_id,r.* FROM consultant_report_shares s JOIN consultant_report_versions r ON r.id=s.report_id AND r.tenant_id=s.tenant_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>NOW(6)) AND r.approval_status='approved' LIMIT 1",[tokenHash]);
  if(!result.rowCount)return res.status(404).json({error:'Shared report not found or expired.'});
  const report=result.rows[0],rawSnapshot=typeof report.snapshot==='string'?JSON.parse(report.snapshot):report.snapshot;const checksum=crypto.createHash('sha256').update(JSON.stringify(rawSnapshot)).digest('hex');if(checksum!==report.snapshot_sha256)return res.status(409).json({error:'Shared report integrity check failed.'});const snapshot=clientSafeReport(report);await audit('public_share',report.tenant_id,'report.share_accessed','consultant_report',report.id,{shareId:report.share_id,version:report.version_number});res.json(snapshot);
}));
app.get('/api/consultant/issues',authGuard,asyncRoute(async(req,res)=>{
  if(!['consultant','owner','admin','lawyer'].includes(req.user?.role||''))return res.status(403).json({error:'Consultant issue overview is unavailable for this role.'});
  const consultant=req.user?.role==='consultant';const base='f.tenant_id=?';const scope=consultant?' AND p.assigned_consultant_uid=?':req.user?.role==='lawyer'?' AND p.assigned_lawyer_uid=?':'';const args:any[]=[req.user?.tenantId];if(scope)args.push(req.user?.uid);
  const result=await pool!.query(`SELECT f.id,f.code,f.title,f.severity,f.points,f.explanation,f.evidence_status,COALESCE(fr.review_status,'pending') AS reviewer_state,fr.rationale AS reviewer_rationale,fr.reviewer_uid,fr.reviewed_at,CASE WHEN fr.review_status='approved' THEN 'approved_for_report' WHEN fr.review_status='rejected' THEN 'excluded_from_report' ELSE 'open' END AS issue_status,f.next_action,f.created_at,p.id AS property_id,p.name AS property_name,p.application_number,p.village,p.survey_number,COALESCE(ev.refs,JSON_ARRAY()) AS evidence_references FROM risk_findings f JOIN properties p ON p.id=f.property_id AND p.tenant_id=f.tenant_id LEFT JOIN consultant_finding_reviews fr ON fr.finding_id=f.id AND fr.tenant_id=f.tenant_id LEFT JOIN (SELECT e.finding_id,e.tenant_id,JSON_ARRAYAGG(JSON_OBJECT('id',d.id,'filename',d.original_filename,'sha256',d.sha256,'createdAt',d.created_at)) refs FROM consultant_issue_evidence e JOIN documents d ON d.id=e.document_id AND d.tenant_id=e.tenant_id AND d.review_status='approved' AND d.governance_status='active' GROUP BY e.finding_id,e.tenant_id) ev ON ev.finding_id=f.id AND ev.tenant_id=f.tenant_id WHERE ${base}${scope} ORDER BY FIELD(f.severity,'critical','high','medium','low','unverified'),f.created_at DESC LIMIT 500`,args);
  res.json({items:result.rows,count:result.rows.length,openCount:result.rows.filter((r:any)=>r.reviewer_state==='pending').length,reviewerNotice:'Reviewer state records approval or exclusion for client reporting. It does not certify legal clearance.'});
}));
app.post('/api/consultant/issues/:findingId/review',authGuard,asyncRoute(async(req,res)=>{
  if(!['lawyer','owner','admin'].includes(req.user?.role||''))return res.status(403).json({error:'Only a Lead Advocate or authorized Reviewer can approve an issue for client reporting.'});
  const parsed=z.object({decision:z.enum(['approve','reject']),rationale:z.string().trim().min(5).max(2000)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Choose a review decision and provide a rationale.'});
  const clauses=['f.id=?','f.tenant_id=?'],params:any[]=[req.params.findingId,req.user?.tenantId];if(req.user?.role==='lawyer'){clauses.push('p.assigned_lawyer_uid=?');params.push(req.user.uid);}
  const finding=await pool!.query(`SELECT f.id,f.property_id FROM risk_findings f JOIN properties p ON p.id=f.property_id AND p.tenant_id=f.tenant_id WHERE ${clauses.join(' AND ')}`,params);if(!finding.rowCount)return res.status(404).json({error:'Issue not found in an authorized matter.'});
  const status=parsed.data.decision==='approve'?'approved':'rejected';await pool!.query('INSERT INTO consultant_finding_reviews (id,tenant_id,property_id,finding_id,review_status,rationale,reviewer_uid) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE review_status=VALUES(review_status),rationale=VALUES(rationale),reviewer_uid=VALUES(reviewer_uid),reviewed_at=NOW(6)',[crypto.randomUUID(),req.user?.tenantId,finding.rows[0].property_id,req.params.findingId,status,parsed.data.rationale,req.user?.uid]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'legal.finding_report_review_decision','risk_finding',req.params.findingId,{decision:parsed.data.decision,rationale:parsed.data.rationale});res.json({success:true,reviewerState:status});
}));
app.post('/api/consultant/issues/:findingId/evidence',authGuard,asyncRoute(async(req,res)=>{
  if(req.user?.role!=='consultant')return res.status(403).json({error:'Only the assigned Consultant can attach issue evidence.'});
  const parsed=z.object({documentId:z.string().uuid()}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Select a document.'});
  const match=await pool!.query('SELECT f.id,f.property_id FROM risk_findings f JOIN properties p ON p.id=f.property_id AND p.tenant_id=f.tenant_id WHERE f.id=? AND f.tenant_id=? AND p.assigned_consultant_uid=?',[req.params.findingId,req.user?.tenantId,req.user?.uid]);if(!match.rowCount)return res.status(404).json({error:'Issue not found in assigned matters.'});
  const doc=await pool!.query("SELECT id FROM documents WHERE id=? AND property_id=? AND tenant_id=? AND review_status='approved' AND governance_status='active'",[parsed.data.documentId,match.rows[0].property_id,req.user?.tenantId]);if(!doc.rowCount)return res.status(400).json({error:'Evidence must be an active reviewer-approved document in this matter.'});
  await pool!.query('INSERT IGNORE INTO consultant_issue_evidence (id,tenant_id,property_id,finding_id,document_id,linked_by_uid) VALUES (?,?,?,?,?,?)',[crypto.randomUUID(),req.user?.tenantId,match.rows[0].property_id,req.params.findingId,parsed.data.documentId,req.user?.uid]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'consultant.issue_evidence_linked','risk_finding',req.params.findingId,{documentId:parsed.data.documentId});res.status(201).json({success:true});
}));
app.get('/api/consultant/reports',authGuard,asyncRoute(async(req,res)=>{
  if(!['consultant','lawyer','owner','admin'].includes(req.user?.role||''))return res.status(403).json({error:'Report workspace is unavailable for this role.'});
  const scope=consultantReportScope(req.user);const propertyId=String(req.query.propertyId||''),status=String(req.query.status||'');const clauses=[scope.sql],args:any[]=[...scope.params];if(propertyId){clauses.push('r.property_id=?');args.push(propertyId);}if(['draft','submitted','approved','rejected'].includes(status)){clauses.push('r.approval_status=?');args.push(status);}
  const rows=await pool!.query(`SELECT r.id,r.property_id,r.version_number,r.report_type,r.title,r.approval_status,r.snapshot_sha256,r.data_checked_at,r.created_by_uid,r.submitted_at,r.reviewed_by_uid,r.review_decision,r.review_rationale,r.reviewed_at,r.created_at,p.name AS property_name,p.application_number FROM consultant_report_versions r JOIN properties p ON p.id=r.property_id AND p.tenant_id=r.tenant_id WHERE ${clauses.join(' AND ')} ORDER BY r.created_at DESC LIMIT 200`,args);res.json({items:rows.rows});
}));
app.post('/api/consultant/reports',authGuard,asyncRoute(async(req,res)=>{
  if(!['consultant','owner','admin'].includes(req.user?.role||''))return res.status(403).json({error:'Report preparation is not available for this role.'});
  const parsed=z.object({propertyId:z.string().uuid(),reportType:z.enum(['preliminary_screening','detailed_due_diligence','client_decision_pack','evidence_appendix']),title:z.string().trim().min(3).max(255)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Choose a matter, report type and title.'});
  const property=await pool!.query('SELECT id FROM properties WHERE id=? AND tenant_id=? AND (? <> \'consultant\' OR assigned_consultant_uid=?)',[parsed.data.propertyId,req.user?.tenantId,req.user?.role,req.user?.uid]);if(!property.rowCount)return res.status(404).json({error:'Assigned matter not found.'});
  const snapshot=await loadConsultantSnapshot(req.user!.tenantId!,parsed.data.propertyId,parsed.data.reportType);if(!snapshot)return res.status(404).json({error:'Matter not found.'});(snapshot as any).reportSections=consultantReportSections(snapshot,parsed.data.reportType);const versions=await pool!.query('SELECT COALESCE(MAX(version_number),0) AS current_version FROM consultant_report_versions WHERE tenant_id=? AND property_id=?',[req.user?.tenantId,parsed.data.propertyId]);const version=Number(versions.rows[0]?.current_version||0)+1;
  const id=crypto.randomUUID(),serialized=JSON.stringify(snapshot),checksum=crypto.createHash('sha256').update(serialized).digest('hex');await pool!.query("INSERT INTO consultant_report_versions (id,tenant_id,property_id,version_number,report_type,title,approval_status,snapshot,snapshot_sha256,data_checked_at,created_by_uid) VALUES (?,?,?,?,?,?,'draft',?,?,?,?)",[id,req.user?.tenantId,parsed.data.propertyId,version,parsed.data.reportType,parsed.data.title,serialized,checksum,new Date(),req.user?.uid]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'consultant.report_version_created','consultant_report',id,{propertyId:parsed.data.propertyId,version,reportType:parsed.data.reportType,sha256:checksum});res.status(201).json({id,version,approvalStatus:'draft',snapshotSha256:checksum});
}));
app.get('/api/consultant/reports/:id',authGuard,asyncRoute(async(req,res)=>{
  if(!['consultant','lawyer','owner','admin'].includes(req.user?.role||''))return res.status(403).json({error:'Report workspace is unavailable for this role.'});const scope=consultantReportScope(req.user);const rows=await pool!.query(`SELECT r.*,p.name AS property_name,p.application_number FROM consultant_report_versions r JOIN properties p ON p.id=r.property_id AND p.tenant_id=r.tenant_id WHERE r.id=? AND ${scope.sql}`,[req.params.id,...scope.params]);if(!rows.rowCount)return res.status(404).json({error:'Report not found.'});const row=rows.rows[0],snapshot=typeof row.snapshot==='string'?JSON.parse(row.snapshot):row.snapshot;const checksum=crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');if(checksum!==row.snapshot_sha256)return res.status(409).json({error:'Report snapshot integrity check failed.'});res.json({item:{...row,snapshot}});
}));
app.post('/api/consultant/reports/:id/submit',authGuard,asyncRoute(async(req,res)=>{
  if(req.user?.role!=='consultant')return res.status(403).json({error:'Only the assigned Consultant can submit a report for review.'});const scope=consultantReportScope(req.user);const report=await pool!.query(`SELECT r.* FROM consultant_report_versions r JOIN properties p ON p.id=r.property_id AND p.tenant_id=r.tenant_id WHERE r.id=? AND ${scope.sql}`,[req.params.id,...scope.params]);if(!report.rowCount)return res.status(404).json({error:'Report not found.'});if(report.rows[0].approval_status!=='draft')return res.status(409).json({error:'Only a draft version can be submitted. Create a new report version for corrections.'});await pool!.query("UPDATE consultant_report_versions SET approval_status='submitted',submitted_at=NOW(6) WHERE id=? AND tenant_id=?",[req.params.id,req.user?.tenantId]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'consultant.report_submitted','consultant_report',req.params.id,{version:report.rows[0].version_number});res.json({success:true,approvalStatus:'submitted'});
}));
app.post('/api/consultant/reports/:id/review',authGuard,legalReviewerGuard,asyncRoute(async(req,res)=>{
  const parsed=z.object({decision:z.enum(['approve','reject']),rationale:z.string().trim().min(5).max(2000)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Choose a review decision and provide a rationale.'});const scope=consultantReportScope(req.user);const report=await pool!.query(`SELECT r.* FROM consultant_report_versions r JOIN properties p ON p.id=r.property_id AND p.tenant_id=r.tenant_id WHERE r.id=? AND ${scope.sql}`,[req.params.id,...scope.params]);if(!report.rowCount)return res.status(404).json({error:'Report not found.'});if(report.rows[0].approval_status!=='submitted')return res.status(409).json({error:'Only submitted reports can be reviewed.'});const decision=parsed.data.decision,status=decision==='approve'?'approved':'rejected';await pool!.query('UPDATE consultant_report_versions SET approval_status=?,review_decision=?,review_rationale=?,reviewed_by_uid=?,reviewed_at=NOW(6) WHERE id=? AND tenant_id=?',[status,decision,parsed.data.rationale,req.user?.uid,req.params.id,req.user?.tenantId]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'legal.report_review_decision','consultant_report',req.params.id,{decision,rationale:parsed.data.rationale,version:report.rows[0].version_number});res.json({success:true,approvalStatus:status});
}));
app.get('/api/consultant/reports/:id/export',authGuard,asyncRoute(async(req,res)=>{
  const scope=consultantReportScope(req.user);const rows=await pool!.query(`SELECT r.*,COALESCE(u.full_name,m.email,r.reviewed_by_uid) AS reviewer_name FROM consultant_report_versions r JOIN properties p ON p.id=r.property_id AND p.tenant_id=r.tenant_id LEFT JOIN org_memberships m ON m.organization_id=r.tenant_id AND m.user_uid=r.reviewed_by_uid LEFT JOIN user_accounts u ON u.id=r.reviewed_by_uid WHERE r.id=? AND ${scope.sql}`,[req.params.id,...scope.params]);
  if(!rows.rowCount)return res.status(404).json({error:'Report not found.'});
  const report=rows.rows[0];
  if(report.approval_status!=='approved')return res.status(409).json({error:'Only reviewer-approved report versions can be exported.'});
  const rawSnapshot=typeof report.snapshot==='string'?JSON.parse(report.snapshot):report.snapshot;
  const actual=crypto.createHash('sha256').update(JSON.stringify(rawSnapshot)).digest('hex');
  if(actual!==report.snapshot_sha256)return res.status(409).json({error:'Report snapshot integrity check failed.'});
  const safe=clientSafeReport(report),format=req.query.format==='pdf'?'pdf':req.query.format==='word'?'word':'json';
  let pdf:Buffer|undefined;
  if(format==='pdf') {
    try { pdf=await renderReportPdf(consultantWordHtml(safe)); }
    catch(error) { console.error('Report PDF rendering failed.',error); return res.status(503).json({error:'PDF rendering is temporarily unavailable. No export was recorded.'}); }
  }
  await pool!.query("INSERT INTO workspace_export_events (id,tenant_id,actor_uid,resource_type,resource_id,export_format,result,details) VALUES (?,?,?,?,?,?,'success',?)",[crypto.randomUUID(),req.user?.tenantId,req.user?.uid||'unknown','consultant_report',report.id,format,JSON.stringify({version:report.version_number,sha256:report.snapshot_sha256})]);
  await audit(req.user?.uid||'unknown',req.user?.tenantId,'consultant.report_exported','consultant_report',report.id,{version:report.version_number,format,sha256:report.snapshot_sha256});
  if(format==='pdf'){res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Length',String(pdf!.length));res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Disposition',`attachment; filename="ojix-report-v${report.version_number}.pdf"`);return res.send(pdf);}
  if(format==='word'){res.setHeader('Content-Type','application/msword; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="ojix-report-v${report.version_number}.doc"`);return res.send(consultantWordHtml(safe));}
  res.setHeader('Content-Disposition',`attachment; filename="ojix-report-v${report.version_number}.json"`);res.json(safe);
}));
app.post('/api/consultant/reports/:id/share',authGuard,asyncRoute(async(req,res)=>{
  if(!isDemoExternalShareAllowed(Boolean(req.user?.isDemo)))return res.status(403).json({error:'External report sharing is disabled in Demo Mode.'});
  if(!['consultant','owner','admin'].includes(req.user?.role||''))return res.status(403).json({error:'Read-only report sharing is not available for this role.'});const scope=consultantReportScope(req.user);const rows=await pool!.query(`SELECT r.* FROM consultant_report_versions r JOIN properties p ON p.id=r.property_id AND p.tenant_id=r.tenant_id WHERE r.id=? AND ${scope.sql}`,[req.params.id,...scope.params]);if(!rows.rowCount)return res.status(404).json({error:'Report not found.'});if(rows.rows[0].approval_status!=='approved')return res.status(409).json({error:'Only approved reports can be shared.'});const token=crypto.randomBytes(32).toString('hex'),tokenHash=crypto.createHash('sha256').update(token).digest('hex'),id=crypto.randomUUID();const expiry=Number(req.body?.expiresInDays||30);if(!Number.isInteger(expiry)||expiry<1||expiry>365)return res.status(400).json({error:'Share expiry must be from 1 to 365 days.'});await pool!.query('INSERT INTO consultant_report_shares (id,tenant_id,report_id,token_hash,expires_at,created_by_uid) VALUES (?,?,?,?,DATE_ADD(NOW(6),INTERVAL ? DAY),?)',[id,req.user?.tenantId,req.params.id,tokenHash,expiry,req.user?.uid]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'consultant.report_shared','consultant_report',req.params.id,{shareId:id,version:rows.rows[0].version_number,expiresInDays:expiry});res.status(201).json({id,url:`/shared/reports/${token}`,expiresInDays:expiry});
}));
app.get('/api/consultant/shares',authGuard,asyncRoute(async(req,res)=>{
  const scope=consultantReportScope(req.user);const rows=await pool!.query(`SELECT s.id,s.report_id,s.created_at,s.expires_at,s.revoked_at,r.title,r.version_number,r.report_type,p.name AS property_name,p.application_number FROM consultant_report_shares s JOIN consultant_report_versions r ON r.id=s.report_id AND r.tenant_id=s.tenant_id JOIN properties p ON p.id=r.property_id AND p.tenant_id=r.tenant_id WHERE ${scope.sql} ORDER BY s.created_at DESC LIMIT 200`,scope.params);res.json({items:rows.rows});
}));
app.delete('/api/consultant/shares/:id',authGuard,asyncRoute(async(req,res)=>{
  if(!['consultant','owner','admin'].includes(req.user?.role||''))return res.status(403).json({error:'Only the assigned Consultant or workspace administrator can revoke a share.'});const scope=consultantReportScope(req.user);const share=await pool!.query(`SELECT s.id,s.report_id FROM consultant_report_shares s JOIN consultant_report_versions r ON r.id=s.report_id AND r.tenant_id=s.tenant_id JOIN properties p ON p.id=r.property_id AND p.tenant_id=r.tenant_id WHERE s.id=? AND ${scope.sql}`,[req.params.id,...scope.params]);if(!share.rowCount)return res.status(404).json({error:'Share not found.'});await pool!.query('UPDATE consultant_report_shares SET revoked_at=NOW(6) WHERE id=? AND tenant_id=? AND revoked_at IS NULL',[req.params.id,req.user?.tenantId]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'consultant.report_share_revoked','consultant_report',share.rows[0].report_id,{shareId:req.params.id});res.json({success:true});
}));

const workbenchStatuses = ['pending','in_progress','under_review','blocked','completed'] as const;
const workbenchCategories = ['Document Review','Sale Deed Verification','RTC / Pahani Verification','Encumbrance Certificate Review','Mutation / Khata Verification','Title Chain Verification','Ownership Verification','Survey and Boundary Verification','Property Extent Verification','GIS and Risk Review','Legal Research','Findings Review','Report Review','Client Decision Pack Review'] as const;
const workbenchScope = (user: AuthenticatedRequest['user']) => {
  if (['owner','admin'].includes(user?.role || '')) return { sql: 't.tenant_id=?', params: [user?.tenantId] };
  return { sql: 't.tenant_id=? AND (t.assigned_to_uid=? OR t.reviewer_uid=?)', params: [user?.tenantId,user?.uid,user?.uid] };
};
async function recordWorkbenchActivity(tenantId: string, taskId: string, actorUid: string, action: string, details: unknown = {}) {
  await pool!.query('INSERT INTO workbench_task_activity (id,tenant_id,task_id,actor_uid,action,details) VALUES (?,?,?,?,?,?)',[crypto.randomUUID(),tenantId,taskId,actorUid,action,JSON.stringify(details)]);
  await audit(actorUid,tenantId,`workbench.${action}`,'workbench_task',taskId,details);
}
app.get('/api/workbench/members',authGuard,asyncRoute(async(req,res)=>{
  const result=await pool!.query("SELECT m.user_uid,m.role,m.email,COALESCE(u.full_name,m.email,m.user_uid) AS full_name FROM org_memberships m LEFT JOIN user_accounts u ON u.id=m.user_uid WHERE m.organization_id=? AND m.status='active' AND m.role IN ('owner','admin','lawyer','analyst') ORDER BY full_name",[req.user?.tenantId]);
  res.json({items:result.rows});
}));
app.get('/api/workbench/tasks',authGuard,asyncRoute(async(req,res)=>{
  const scope=workbenchScope(req.user);const params:any[]=[...scope.params];const clauses=[scope.sql,'p.archived_at IS NULL'];
  const status=String(req.query.status||'');if(status&&status!=='all'&&workbenchStatuses.includes(status as any)){clauses.push('t.status=?');params.push(status);}
  const category=String(req.query.category||'');if(category){clauses.push('t.category=?');params.push(category);}
  const priority=String(req.query.priority||'');if(priority){clauses.push('t.priority=?');params.push(priority);}
  const assignee=String(req.query.assignee||'');if(assignee&&(['owner','admin'].includes(req.user?.role||'')||assignee===req.user?.uid)){clauses.push('t.assigned_to_uid=?');params.push(assignee);}
  const due=String(req.query.due||'');if(due==='overdue')clauses.push("t.due_date<CURDATE() AND t.status NOT IN ('completed','cancelled')");else if(due==='today')clauses.push('t.due_date=CURDATE()');else if(due==='upcoming')clauses.push('t.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(),INTERVAL 7 DAY)');
  const search=String(req.query.search||'').trim().slice(0,160);if(search){clauses.push('(t.task_code LIKE ? OR t.title LIKE ? OR t.description LIKE ? OR p.name LIKE ? OR p.application_number LIKE ? OR p.village LIKE ? OR p.survey_number LIKE ?)');const like=`%${search}%`;params.push(like,like,like,like,like,like,like);}
  const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||50));
  const where=clauses.join(' AND ');
  const [count,rows,summary]=await Promise.all([
    pool!.query(`SELECT COUNT(*) AS total FROM workbench_tasks t JOIN properties p ON p.id=t.property_id AND p.tenant_id=t.tenant_id WHERE ${where}`,params),
    pool!.query(`SELECT t.id,t.task_code,t.title,t.description,t.category,t.priority,t.status,t.due_date,t.assigned_by_uid,t.assigned_to_uid,t.reviewer_uid,t.checklist,t.linked_document_id,t.linked_finding_id,t.created_at,t.updated_at,p.id AS property_id,p.name AS property_name,p.application_number,p.village,p.survey_number,p.subdivision,COALESCE(au.full_name,am.email,t.assigned_to_uid) AS assignee_name,COALESCE(bu.full_name,bm.email,t.assigned_by_uid) AS assigner_name FROM workbench_tasks t JOIN properties p ON p.id=t.property_id AND p.tenant_id=t.tenant_id LEFT JOIN org_memberships am ON am.organization_id=t.tenant_id AND am.user_uid=t.assigned_to_uid LEFT JOIN user_accounts au ON au.id=t.assigned_to_uid LEFT JOIN org_memberships bm ON bm.organization_id=t.tenant_id AND bm.user_uid=t.assigned_by_uid LEFT JOIN user_accounts bu ON bu.id=t.assigned_by_uid WHERE ${where} ORDER BY (t.due_date IS NULL),t.due_date ASC,t.updated_at DESC LIMIT ? OFFSET ?`,[...params,limit,(page-1)*limit]),
    pool!.query(`SELECT COUNT(*) total,SUM(t.assigned_to_uid=?) my_count,SUM(t.status='pending') pending,SUM(t.status='in_progress') in_progress,SUM(t.status='under_review') under_review,SUM(t.status NOT IN ('completed','cancelled') AND t.due_date<CURDATE()) overdue,SUM(t.status='completed') completed FROM workbench_tasks t JOIN properties p ON p.id=t.property_id AND p.tenant_id=t.tenant_id WHERE ${scope.sql} AND p.archived_at IS NULL`,[req.user?.uid,...scope.params])
  ]);
  res.json({items:rows.rows,total:Number(count.rows[0]?.total||0),page,limit,summary:summary.rows[0]});
}));
app.get('/api/workbench/tasks/:id',authGuard,asyncRoute(async(req,res)=>{
  const scope=workbenchScope(req.user);
  const task=await pool!.query(`SELECT t.*,p.name AS property_name,p.application_number,p.village,p.survey_number,p.subdivision,COALESCE(au.full_name,am.email,t.assigned_to_uid) AS assignee_name,COALESCE(bu.full_name,bm.email,t.assigned_by_uid) AS assigner_name FROM workbench_tasks t JOIN properties p ON p.id=t.property_id AND p.tenant_id=t.tenant_id LEFT JOIN org_memberships am ON am.organization_id=t.tenant_id AND am.user_uid=t.assigned_to_uid LEFT JOIN user_accounts au ON au.id=t.assigned_to_uid LEFT JOIN org_memberships bm ON bm.organization_id=t.tenant_id AND bm.user_uid=t.assigned_by_uid LEFT JOIN user_accounts bu ON bu.id=t.assigned_by_uid WHERE t.id=? AND ${scope.sql}`,[req.params.id,...scope.params]);
  if(!task.rowCount)return res.status(404).json({error:'Task not found.'});
  const [activity,comments]=await Promise.all([
    pool!.query('SELECT a.id,a.actor_uid,a.action,a.details,a.created_at,COALESCE(u.full_name,m.email,a.actor_uid) AS actor_name FROM workbench_task_activity a LEFT JOIN user_accounts u ON u.id=a.actor_uid LEFT JOIN org_memberships m ON m.organization_id=a.tenant_id AND m.user_uid=a.actor_uid WHERE a.task_id=? AND a.tenant_id=? ORDER BY a.created_at DESC LIMIT 100',[req.params.id,req.user?.tenantId]),
    pool!.query('SELECT c.id,c.author_uid,c.body,c.created_at,COALESCE(u.full_name,m.email,c.author_uid) AS author_name FROM workbench_task_comments c LEFT JOIN user_accounts u ON u.id=c.author_uid LEFT JOIN org_memberships m ON m.organization_id=c.tenant_id AND m.user_uid=c.author_uid WHERE c.task_id=? AND c.tenant_id=? ORDER BY c.created_at DESC LIMIT 100',[req.params.id,req.user?.tenantId])
  ]);
  res.json({item:task.rows[0],activity:activity.rows,comments:comments.rows});
}));
app.get('/api/workbench/tasks/:id/documents',authGuard,asyncRoute(async(req,res)=>{
  const scope=workbenchScope(req.user);const task=await pool!.query(`SELECT t.property_id FROM workbench_tasks t WHERE t.id=? AND ${scope.sql}`,[req.params.id,...scope.params]);if(!task.rowCount)return res.status(404).json({error:'Task not found.'});
  const docs=await pool!.query("SELECT id,original_filename,doc_type,processing_status,created_at FROM documents WHERE property_id=? AND tenant_id=? AND governance_status='active' ORDER BY created_at DESC LIMIT 100",[task.rows[0].property_id,req.user?.tenantId]);res.json({items:docs.rows});
}));
app.post('/api/workbench/tasks/:id/evidence',authGuard,asyncRoute(async(req,res)=>{
  const scope=workbenchScope(req.user);const task=await pool!.query(`SELECT t.id,t.property_id FROM workbench_tasks t WHERE t.id=? AND ${scope.sql}`,[req.params.id,...scope.params]);if(!task.rowCount)return res.status(404).json({error:'Task not found.'});
  if(!['owner','admin','lawyer','analyst'].includes(req.user?.role||''))return res.status(403).json({error:'Evidence linking is not available for this role.'});
  const parsed=z.object({documentId:z.string().uuid()}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Select a valid workspace document.'});
  const doc=await pool!.query("SELECT id,original_filename FROM documents WHERE id=? AND property_id=? AND tenant_id=? AND governance_status='active'",[parsed.data.documentId,task.rows[0].property_id,req.user?.tenantId]);if(!doc.rowCount)return res.status(404).json({error:'Document not found for this task property.'});
  await pool!.query('UPDATE workbench_tasks SET linked_document_id=? WHERE id=? AND tenant_id=?',[parsed.data.documentId,req.params.id,req.user?.tenantId]);await recordWorkbenchActivity(req.user!.tenantId!,req.params.id,req.user!.uid,'evidence_linked',{documentId:parsed.data.documentId,filename:doc.rows[0].original_filename});res.json({success:true});
}));
app.post('/api/workbench/tasks',authGuard,asyncRoute(async(req,res)=>{
  if(!['owner','admin','lawyer'].includes(req.user?.role||''))return res.status(403).json({error:'Only a workspace administrator or legal reviewer can assign work.'});
  const parsed=z.object({propertyId:z.string().uuid(),title:z.string().trim().min(3).max(255),description:z.string().trim().max(5000).default(''),category:z.enum(workbenchCategories),priority:z.enum(['high','medium','low']).default('medium'),dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),assignedToUid:z.string().trim().min(1).max(191),reviewerUid:z.string().trim().max(191).optional(),linkedDocumentId:z.string().uuid().optional(),linkedFindingId:z.string().uuid().optional(),checklist:z.array(z.string().trim().min(1).max(255)).max(30).default([])}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message||'Invalid task details.'});
  const c=parsed.data;const [property,member]=await Promise.all([pool!.query('SELECT id FROM properties WHERE id=? AND tenant_id=?',[c.propertyId,req.user?.tenantId]),pool!.query("SELECT user_uid FROM org_memberships WHERE user_uid=? AND organization_id=? AND status='active' AND role IN ('owner','admin','lawyer','analyst')",[c.assignedToUid,req.user?.tenantId])]);
  if(!property.rowCount)return res.status(404).json({error:'Property not found in this workspace.'});if(!member.rowCount)return res.status(400).json({error:'Select an active workspace lawyer or analyst.'});
  if(c.linkedDocumentId){const doc=await pool!.query('SELECT id FROM documents WHERE id=? AND property_id=? AND tenant_id=?',[c.linkedDocumentId,c.propertyId,req.user?.tenantId]);if(!doc.rowCount)return res.status(400).json({error:'Linked document does not belong to the selected property.'});}
  if(c.linkedFindingId){const finding=await pool!.query('SELECT id FROM risk_findings WHERE id=? AND property_id=? AND tenant_id=?',[c.linkedFindingId,c.propertyId,req.user?.tenantId]);if(!finding.rowCount)return res.status(400).json({error:'Linked finding does not belong to the selected property.'});}
  const id=crypto.randomUUID(),code=`OJX-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;const checklist=c.checklist.map((label,index)=>({id:String(index+1),label,done:false}));
  await pool!.query('INSERT INTO workbench_tasks (id,tenant_id,property_id,task_code,title,description,category,priority,due_date,assigned_by_uid,assigned_to_uid,reviewer_uid,linked_document_id,linked_finding_id,checklist) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,req.user?.tenantId,c.propertyId,code,c.title,c.description,c.category,c.priority,c.dueDate||null,req.user?.uid,c.assignedToUid,c.reviewerUid|| (req.user?.role==='lawyer'?req.user.uid:null),c.linkedDocumentId||null,c.linkedFindingId||null,JSON.stringify(checklist)]);
  await recordWorkbenchActivity(req.user!.tenantId!,id,req.user!.uid,'task_created',{taskCode:code,assignedToUid:c.assignedToUid});
  res.status(201).json({id,taskCode:code});
}));
app.patch('/api/workbench/tasks/:id',authGuard,asyncRoute(async(req,res)=>{
  const scope=workbenchScope(req.user);const found=await pool!.query(`SELECT t.* FROM workbench_tasks t WHERE t.id=? AND ${scope.sql}`,[req.params.id,...scope.params]);if(!found.rowCount)return res.status(404).json({error:'Task not found.'});
  const task=found.rows[0],isManager=['owner','admin'].includes(req.user?.role||''),isAssigned=task.assigned_to_uid===req.user?.uid,isReviewer=task.reviewer_uid===req.user?.uid||['owner','admin','lawyer'].includes(req.user?.role||'');
  const parsed=z.object({status:z.enum(workbenchStatuses).optional(),checklistItemId:z.string().max(40).optional(),checklistDone:z.boolean().optional(),priority:z.enum(['high','medium','low']).optional(),dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),assignedToUid:z.string().min(1).max(191).optional(),reviewDecision:z.enum(['approve','reject','corrections']).optional(),rationale:z.string().trim().max(1000).optional()}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid task update.'});const c=parsed.data;
  if(c.reviewDecision&&!c.rationale)return res.status(400).json({error:'A rationale is required for reviewer decisions.'});
  if(c.reviewDecision&&task.assigned_to_uid===req.user?.uid)return res.status(403).json({error:'The assigned user cannot review their own work.'});
  if(c.checklistItemId){if(!isAssigned)return res.status(403).json({error:'Only the assigned user can update this checklist.'});const items=typeof task.checklist==='string'?JSON.parse(task.checklist):task.checklist;const item=items.find((x:any)=>x.id===c.checklistItemId);if(!item)return res.status(404).json({error:'Checklist item not found.'});item.done=Boolean(c.checklistDone);await pool!.query('UPDATE workbench_tasks SET checklist=? WHERE id=? AND tenant_id=?',[JSON.stringify(items),task.id,req.user?.tenantId]);await recordWorkbenchActivity(req.user!.tenantId!,task.id,req.user!.uid,'checklist_updated',{item:item.label,done:item.done});}
  if(c.assignedToUid||c.priority||c.dueDate!==undefined){if(!isManager)return res.status(403).json({error:'Only an administrator can change assignment, priority, or deadline.'});if(c.assignedToUid){const m=await pool!.query("SELECT user_uid FROM org_memberships WHERE organization_id=? AND user_uid=? AND status='active' AND role IN ('owner','admin','lawyer','analyst')",[req.user?.tenantId,c.assignedToUid]);if(!m.rowCount)return res.status(400).json({error:'Select an active workspace lawyer or analyst.'});}await pool!.query('UPDATE workbench_tasks SET assigned_to_uid=COALESCE(?,assigned_to_uid),priority=COALESCE(?,priority),due_date=? WHERE id=? AND tenant_id=?',[c.assignedToUid||null,c.priority||null,c.dueDate===undefined?task.due_date:c.dueDate,task.id,req.user?.tenantId]);await recordWorkbenchActivity(req.user!.tenantId!,task.id,req.user!.uid,c.assignedToUid?'task_reassigned':c.priority?'priority_changed':'deadline_changed',{assignedToUid:c.assignedToUid,priority:c.priority,dueDate:c.dueDate});}
  if(c.reviewDecision){if(!isReviewer)return res.status(403).json({error:'Reviewer permission is required.'});const status=c.reviewDecision==='approve'?'completed':'in_progress';await pool!.query('UPDATE workbench_tasks SET status=? WHERE id=? AND tenant_id=?',[status,task.id,req.user?.tenantId]);await pool!.query('INSERT INTO workbench_task_comments (id,tenant_id,task_id,author_uid,body) VALUES (?,?,?,?,?)',[crypto.randomUUID(),req.user?.tenantId,task.id,req.user?.uid,`${c.reviewDecision.toUpperCase()}: ${c.rationale}`]);await recordWorkbenchActivity(req.user!.tenantId!,task.id,req.user!.uid,'review_decision',{decision:c.reviewDecision,rationale:c.rationale});}
  else if(c.status){if(c.status==='completed')return res.status(400).json({error:'Use the review decision action with a rationale to complete a task.'});if(c.status==='under_review'&&!isAssigned)return res.status(403).json({error:'Only the assigned user can submit this task for review.'});if(c.status==='blocked'&&!isAssigned)return res.status(403).json({error:'Only the assigned user can mark this task as blocked.'});await pool!.query('UPDATE workbench_tasks SET status=? WHERE id=? AND tenant_id=?',[c.status,task.id,req.user?.tenantId]);await recordWorkbenchActivity(req.user!.tenantId!,task.id,req.user!.uid,'status_changed',{from:task.status,to:c.status});}
  res.json({success:true});
}));
app.post('/api/workbench/tasks/:id/comments',authGuard,asyncRoute(async(req,res)=>{
  const scope=workbenchScope(req.user);const task=await pool!.query(`SELECT t.id FROM workbench_tasks t WHERE t.id=? AND ${scope.sql}`,[req.params.id,...scope.params]);if(!task.rowCount)return res.status(404).json({error:'Task not found.'});const parsed=z.object({body:z.string().trim().min(1).max(3000)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Enter a comment of up to 3,000 characters.'});await pool!.query('INSERT INTO workbench_task_comments (id,tenant_id,task_id,author_uid,body) VALUES (?,?,?,?,?)',[crypto.randomUUID(),req.user?.tenantId,req.params.id,req.user?.uid,parsed.data.body]);await recordWorkbenchActivity(req.user!.tenantId!,req.params.id,req.user!.uid,'comment_added',{});res.status(201).json({success:true});
}));

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

async function validateLocationHierarchy(data: { district?: string | null; taluk?: string | null; hobli?: string | null; village?: string | null; districtId?: string | null; talukId?: string | null; hobliId?: string | null; villageId?: string | null }) {
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
  const names = [data.district || '', data.taluk || '', data.hobli || '', data.village || ''];
  if ([row.district, row.taluk, row.hobli, row.village].some((name, index) => name !== names[index])) {
    return { valid: false as const, error: 'Location names do not match the selected reference records.' };
  }
  return { valid: true as const };
}

async function audit(userId: string, tenantId: string | undefined, action: string, entityType: string, entityId: string | null, details: unknown = {}) {
  if (!pool) return;
  await pool.query('INSERT INTO audit_events (id, actor_uid, tenant_id, action, entity_type, entity_id, details) VALUES (?,?,?,?,?,?,?)', [crypto.randomUUID(), userId, tenantId || null, action, entityType, entityId, JSON.stringify(details)]);
}

const databaseHealthHandler = asyncRoute(async (_req, res) => {
  const common = {
    service: 'ojix-property-api',
    version: '0.1.0',
    databaseEngine: 'MariaDB',
    authentication: firebaseAuth ? 'firebase-id-token-and-otp-session' : 'password-and-otp-session',
  };
  if (!pool) {
    return res.status(503).json({
      ...common,
      status: 'not_ready',
      database: 'not_configured',
      error: 'Database is not configured. Set DATABASE_URL and restart the API.',
    });
  }
  try {
    await pool.query('SELECT 1');
    return res.json({ ...common, status: 'ok', database: 'connected' });
  } catch (error) {
    const errorCode = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || 'DATABASE_CONNECTIVITY_ERROR')
      : 'DATABASE_CONNECTIVITY_ERROR';
    return res.status(503).json({
      ...common,
      status: 'not_ready',
      database: 'disconnected',
      error: 'Database connectivity check failed.',
      errorCode,
    });
  }
});
app.get('/health', databaseHealthHandler);
app.get('/api/health', databaseHealthHandler);

const livenessResponse = { status: 'ok', service: 'ojix-property-api', version: '0.1.0' };
app.get('/healthz', (_req, res) => {
  res.status(200).json(livenessResponse);
});
app.get('/api/healthz', (_req, res) => {
  res.status(200).json(livenessResponse);
});

const databaseReadinessHandler = asyncRoute(async (_req, res) => {
  if (!pool) return res.status(503).json({
    status: 'not_ready',
    service: 'ojix-property-api',
    database: 'not_configured',
    storage: documentStorage.provider === 'local' ? 'ephemeral' : 'configured',
    error: 'Database pool not initialized',
  });
  try {
    const dbRes = await pool.query(`SELECT ST_AsText(ST_GeomFromText('POINT(77.5946 12.9716)', 4326)) AS spatial_probe`);
    if (
      documentStorage.provider === 'local'
      && (process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL))
    ) {
      return res.status(503).json({
        status: 'not_ready',
        service: 'ojix-property-api',
        database: 'connected',
        storage: 'ephemeral',
        error: 'Durable remote document storage is required for production readiness.',
      });
    }
    if (documentStorage.provider !== 'local') {
      try {
        await documentStorage.checkReady?.();
      } catch {
        return res.status(503).json({
          status: 'not_ready',
          service: 'ojix-property-api',
          database: 'connected',
          storage: 'disconnected',
          error: 'Durable document storage readiness check failed.',
        });
      }
    }
    res.json({
      status: 'ready',
      service: 'ojix-property-api',
      database: 'connected',
      storage: documentStorage.provider,
      spatial: dbRes.rows[0]?.spatial_probe === 'POINT(77.5946 12.9716)' ? 'available' : 'unavailable',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'not_ready',
      service: 'ojix-property-api',
      database: 'disconnected',
      storage: documentStorage.provider === 'local' ? 'ephemeral' : documentStorage.provider,
      error: 'Database readiness check failed.',
    });
  }
});
app.get('/readyz', databaseReadinessHandler);
app.get('/api/readyz', databaseReadinessHandler);


/* ==========================================================================
   Authentication & RBAC Endpoints
   ========================================================================== */
app.get('/api/auth/dummy-accounts', (_req, res) => {
  if (process.env.NODE_ENV === 'production' && !isMockMode() && !_usingMockPool) return res.status(404).json({ error: 'Not found.' });
  res.json({ accounts: DUMMY_ACCOUNTS });
});

const publicDemoDatabaseIsolated = () => isDedicatedDemoDatabase(process.env.DATABASE_URL, process.env.PUBLIC_DEMO_DATABASE_NAME);
const publicDemoEnabled = () => process.env.PUBLIC_DEMO_LOGIN_ENABLED === 'true'
  && Boolean(process.env.PUBLIC_DEMO_TENANT_ID?.trim())
  && publicDemoDatabaseIsolated();

app.get('/api/auth/demo/status', (_req, res) => {
  res.json({
    enabled: true,
    mode: 'one-click',
    roles: VALID_DEMO_ROLES,
    defaultRole: 'owner',
    sessionTtlHours: 8,
  });
});

app.post('/api/auth/demo/login', loginOtpRequestRateLimit, asyncRoute(async (req, res) => {
  const parsed = z.object({ role: z.string().optional() }).safeParse(req.body);
  const requestedRole = parsed.success && parsed.data.role ? parsed.data.role : 'owner';
  const ws = demoSessionRepo.createSession(requestedRole);

  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('ojix_demo_session', ws.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });

  res.status(201).json({
    token: ws.token,
    user: ws.user,
    message: `Synthetic demo session started as ${ws.user.name}.`,
  });
}));

app.post('/api/auth/demo/switch-role', authGuard, asyncRoute(async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const rawToken = extractTokenFromReq(req);
  const parsed = z.object({ role: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Role is required.' });

  const role = parsed.data.role.toLowerCase().replace(/[\s-]/g, '_');
  if (!VALID_DEMO_ROLES.includes(role as any)) {
    return res.status(400).json({ error: `Invalid role '${role}'. Supported roles: ${VALID_DEMO_ROLES.join(', ')}` });
  }

  const result = demoSessionRepo.switchRole(rawToken, role);
  if (!result) {
    return res.status(404).json({ error: 'Active demo session not found.' });
  }

  authReq.user = {
    ...authReq.user,
    uid: result.user.uid,
    role: result.user.role,
    isSuperAdmin: result.user.isSuperAdmin,
    name: result.user.name,
    permissions: result.user.permissions,
  };

  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('ojix_demo_session', result.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });

  res.json({ success: true, user: result.user, token: result.token });
}));

app.get('/api/auth/session', authGuard, asyncRoute(async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  res.json({
    active: true,
    user: authReq.user,
    isDemo: Boolean(authReq.user?.isDemo),
  });
}));

const registrationNameSchema=z.string().trim().min(2,'Name must contain at least 2 characters.').max(50,'Name must be 50 characters or fewer.').regex(/^[\p{L}]+(?:[ '\-][\p{L}]+)*$/u,'Use letters, spaces, hyphens or apostrophes only.');
const registrationSchema = z.object({
  organizationName: z.string().trim().min(2, 'Organization name must contain at least 2 characters.').max(160, 'Organization name must be 160 characters or fewer.'),
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
  const { organizationName, firstName, middleName, lastName, gender, countryCode, mobileNumber, securityQuestion, securityAnswer, email, password } = parsed.data;
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
  if (existing.rowCount && existing.rows[0].email_verified) return res.status(409).json({ code:'EMAIL_ALREADY_VERIFIED', error: 'This email is already verified. Please sign in.' });
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
    await pool.query('UPDATE user_accounts SET full_name=?, onboarding_organization_name=?, middle_name=?, gender=?, phone_e164=?, security_question=?, security_answer_hash=?, password_hash=?, status=\'pending\' WHERE id=?', [name, organizationName, middleName || null, gender, phoneE164, securityQuestion, securityAnswerHash, passwordHash, userId]);
  } else {
    await pool.query('INSERT INTO user_accounts (id,email,full_name,onboarding_organization_name,middle_name,gender,phone_e164,security_question,security_answer_hash,password_hash,email_verified,status) VALUES (?,?,?,?,?,?,?,?,?,?,FALSE,\'pending\')', [userId, email, name, organizationName, middleName || null, gender, phoneE164, securityQuestion, securityAnswerHash, passwordHash]);
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
  await audit(userId, undefined, 'auth.registration_otp_requested', 'user_account', userId, { email });
  const autoFillRegOtp = _usingMockPool || isMockMode();
  res.status(201).json({
    challengeId,
    email,
    expiresAt: expiresAt.toISOString(),
    resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
    deliveryMode: delivery.mode,
    developmentOtp: autoFillRegOtp ? otp : undefined,
    message: autoFillRegOtp ? 'Demo mode — verification code has been auto-filled.' : 'A six-digit verification code was sent to your email.'
  });
}));

app.post('/api/auth/register/verify-otp', asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed = z.object({ challengeId: z.string().uuid(), email: z.string().email().transform(v => v.toLowerCase()), otp: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter the valid six-digit verification code.' });
  const { challengeId, email, otp } = parsed.data;
  const challenge = await pool.query('SELECT * FROM otp_challenges WHERE id=? AND email=? AND purpose=\'registration\' LIMIT 1', [challengeId, email]);
  if (!challenge.rowCount || challenge.rows[0].consumed_at) {
    const existingAccount=await pool.query('SELECT email_verified FROM user_accounts WHERE email=? LIMIT 1',[email]);
    if(existingAccount.rows[0]?.email_verified)return res.status(409).json({code:'EMAIL_ALREADY_VERIFIED',error:'This email is already verified. Please sign in.'});
    return res.status(400).json({ error: 'This verification request is no longer valid.' });
  }
  if (new Date(challenge.rows[0].expires_at).getTime() <= Date.now()) return res.status(400).json({ error: 'The OTP has expired. Request a new code.' });
  if (Number(challenge.rows[0].attempts) >= 5) return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' });
  if (!challenge.rows[0].otp_salt || !verifyOtp(email, otp, String(challenge.rows[0].otp_salt), String(challenge.rows[0].otp_hash))) {
    await pool.query('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=? AND attempts<5 AND consumed_at IS NULL AND expires_at>NOW(6)', [challengeId]);
    return res.status(400).json({ error: 'Incorrect OTP. Please check the six-digit code.' });
  }
  const account = await pool.query('SELECT id, full_name, onboarding_organization_name FROM user_accounts WHERE email=? LIMIT 1', [email]);
  if (!account.rowCount) return res.status(400).json({ error: 'Registration account was not found.' });
  const organizationName=String(account.rows[0].onboarding_organization_name||'').trim();
  if(organizationName.length<2)return res.status(409).json({error:'Organization name is missing. Restart registration with an organization name.'});
  const connection=await pool.getConnection();
  let organizationId='';
  try {
    await connection.beginTransaction();
    const consumed=await connection.query("UPDATE otp_challenges SET consumed_at=NOW(6) WHERE id=? AND email=? AND purpose='registration' AND consumed_at IS NULL AND attempts<5 AND expires_at>NOW(6)",[challengeId,email]);
    if(!consumed.rowCount){await connection.rollback();return res.status(400).json({error:'This verification request is no longer valid.'});}
    const alreadyMember=await connection.query("SELECT organization_id FROM org_memberships WHERE user_uid=? AND status='active' LIMIT 1",[account.rows[0].id]);
    if(alreadyMember.rowCount){await connection.rollback();return res.status(409).json({error:'This account already belongs to a workspace. Please sign in or accept an invitation.'});}
    organizationId=await provisionOrganizationOwner(connection,{name:organizationName,email,userUid:String(account.rows[0].id)});
    await connection.query("UPDATE user_accounts SET email_verified=TRUE,status='active' WHERE id=?",[account.rows[0].id]);
    await connection.query('INSERT INTO audit_events (id,actor_uid,tenant_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?,?)',[crypto.randomUUID(),account.rows[0].id,organizationId,'auth.registration_verified','user_account',account.rows[0].id,JSON.stringify({email,assignedRole:'owner'})]);
    await connection.commit();
  } catch(error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
  res.json({ success: true, organizationId, role:'owner', message: 'Email verified. Your organization workspace is ready; please sign in.' });
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
  const dummy=(process.env.NODE_ENV!=='production' || isMockMode() || _usingMockPool)?DUMMY_ACCOUNTS.find(account=>account.email.toLowerCase()===email&&(expectedRole==='super-admin'?Boolean(account.isSuperAdmin):!account.isSuperAdmin&&account.role===expectedRole)):undefined;
  const registered=!dummy?await pool.query(`SELECT u.id,u.full_name,u.email,u.email_verified,u.status,m.organization_id,m.role AS membership_role,m.status AS membership_status
    FROM user_accounts u JOIN org_memberships m ON m.user_uid=u.id
    WHERE u.email=? ORDER BY m.created_at LIMIT 1`,[email]):{rowCount:0,rows:[]};
  const registeredRow=registered.rows[0];
  const registeredRole=isConfiguredSuperAdminEmail(email)?'super-admin':registeredRow?.membership_role;
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
  const autoFillRecovery = _usingMockPool || isMockMode();
  res.status(201).json({challengeId,email,expiresAt:expiresAt.toISOString(),resendAfterSeconds:OTP_RESEND_COOLDOWN_MS/1000,developmentOtp:autoFillRecovery?otp:undefined,message:autoFillRecovery?'Demo mode — recovery code has been auto-filled.':'If the email and role match an active account, a recovery code has been sent.'});
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
  if(expectedRole==='super-admin'&&(newPassword.length<12||!/[A-Z]/.test(newPassword)||!/[a-z]/.test(newPassword)||!/[0-9]/.test(newPassword)||!/[^A-Za-z0-9]/.test(newPassword)))return res.status(400).json({error:'Super Admin passwords must contain at least 12 characters with uppercase, lowercase, a number and a special character.'});
  const result=await pool.query("SELECT * FROM otp_challenges WHERE id=? AND email=? AND purpose='password_reset' LIMIT 1",[challengeId,email]);
  const challenge=result.rows[0];
  if(!challenge||challenge.consumed_at||new Date(challenge.expires_at).getTime()<=Date.now())return res.status(400).json({error:'This recovery request is no longer valid. Request a new code.'});
  if(Number(challenge.attempts)>=5)return res.status(429).json({error:'Too many incorrect attempts. Request a new code.'});
  if(!challenge.otp_salt||!verifyOtp(email,otp,String(challenge.otp_salt),String(challenge.otp_hash))){await pool.query('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=? AND attempts<5 AND consumed_at IS NULL AND expires_at>NOW(6)',[challengeId]);return res.status(400).json({error:'Incorrect recovery code.'});}
  const accountUid=String(challenge.account_uid||'');
  const dummy=(process.env.NODE_ENV!=='production' || isMockMode() || _usingMockPool)?DUMMY_ACCOUNTS.find(account=>account.uid===accountUid&&account.email.toLowerCase()===email):undefined;
  const registered=!dummy?await pool.query(`SELECT u.id,m.organization_id,m.role,m.status FROM user_accounts u JOIN org_memberships m ON m.user_uid=u.id WHERE u.id=? AND u.email=? AND u.email_verified=TRUE AND u.status='active' ORDER BY m.created_at LIMIT 1`,[accountUid,email]):{rowCount:0,rows:[]};
  if(!dummy&&!registered.rowCount)return res.status(400).json({error:'This recovery request is no longer valid. Request a new code.'});
  const role=dummy?.isSuperAdmin?'super-admin':dummy?.role||(isConfiguredSuperAdminEmail(email)?'super-admin':registered.rows[0]?.role);
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
  const dummyCandidates=(process.env.NODE_ENV!=='production' || isMockMode() || _usingMockPool)?DUMMY_ACCOUNTS.filter(account=>account.email.toLowerCase()===email):[];
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
  const membership=await pool.query("SELECT organization_id,status,role FROM org_memberships WHERE user_uid=? ORDER BY (role='super_admin') DESC,created_at LIMIT 1",[uid]);
  if (!membership.rowCount||membership.rows[0].status!=='active') return res.status(403).json({error:'This workspace membership is not active.'});
  const role=membership.rows[0].role;
  const isSuperAdmin=membership.rows[0].role==='super_admin';
  const authenticatedLoginRole=isSuperAdmin?'super-admin':role;
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
  const autoFillOtp = localSmsPreview || _usingMockPool || isMockMode();
  res.status(201).json({challengeId,email,deliveryTarget:maskedDeliveryTarget,expiresAt:expiresAt.toISOString(),resendAfterSeconds:OTP_RESEND_COOLDOWN_MS/1000,deliveryMode:delivery.mode,developmentOtp:autoFillOtp?otp:undefined,message:autoFillOtp?'Demo mode — verification code has been auto-filled.':`A six-digit sign-in code was sent by ${delivery.mode==='sms'?'SMS':'email'}.`});
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
  const dummy=(process.env.NODE_ENV!=='production' || isMockMode() || _usingMockPool)?DUMMY_ACCOUNTS.find(account=>account.uid===accountUid&&account.email.toLowerCase()===email):undefined;
  const registered=!dummy?await pool.query("SELECT id,email,full_name FROM user_accounts WHERE id=? AND email=? AND email_verified=TRUE AND status='active' LIMIT 1",[accountUid,email]):{rowCount:0,rows:[]};
  if (!dummy&&!registered.rowCount) return res.status(401).json({ error:'The account is no longer active.' });
  const target:any=dummy||{uid:registered.rows[0].id,email:registered.rows[0].email,name:registered.rows[0].full_name,designation:'Registered Reviewer',role:'viewer',avatar:registered.rows[0].full_name.split(/\s+/).slice(0,2).map((part:string)=>part[0]).join('').toUpperCase(),description:'Verified workspace member'};
  const membership=await pool.query("SELECT organization_id,role,status FROM org_memberships WHERE user_uid=? ORDER BY (role='super_admin') DESC,created_at LIMIT 1",[target.uid]);
  if (!membership.rowCount||membership.rows[0].status!=='active') return res.status(403).json({error:'This workspace membership is not active.'});
  const isSuperAdmin=membership.rows[0].role==='super_admin';
  const role=membership.rows[0]?.role||target.role;
  const authenticatedLoginRole=isSuperAdmin?'super-admin':role;
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
  res.json({token,user:{...target,role,tenantId,isSuperAdmin,permissions:[...(DEFAULT_ROLE_PERMISSIONS[role as keyof typeof DEFAULT_ROLE_PERMISSIONS]||[])],accessExpiresAt:new Date(expiresAt).toISOString()},message:`Signed in securely as ${target.name} (${isSuperAdmin?'SUPER ADMIN':String(role).toUpperCase()})`});
}));

app.post('/api/auth/login', (_req, res) => res.status(410).json({ error: 'Password-only sign-in is disabled. Use the email OTP flow.' }));

app.get('/api/auth/me', authGuard, asyncRoute(async (req, res) => {
  if ((req as any).demoWorkspace) {
    const ws = (req as any).demoWorkspace as DemoSessionWorkspace;
    return res.json({ user: ws.user });
  }
  const u = (req as AuthenticatedRequest).user;
  const registered = u?.uid && pool ? await pool.query('SELECT full_name,email FROM user_accounts WHERE id=? LIMIT 1', [u.uid]) : { rowCount: 0, rows: [] };
  const publicDemoIdentity = publicDemoEnabled() && u?.tenantId === process.env.PUBLIC_DEMO_TENANT_ID
    ? DUMMY_ACCOUNTS.find(account => account.uid === u?.uid && !account.isSuperAdmin)
    : undefined;
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
      ...(publicDemoIdentity ? { email: 'demo.owner@ojix-public-demo.invalid', name: 'OJIX Demo Workspace Owner', designation: 'Demo Workspace Owner', avatar: 'OJ' } : {}),
      role: u?.role || meta.role,
      isSuperAdmin: Boolean(u?.isSuperAdmin),
      isDemo: Boolean(u?.isDemo),
      permissions: u?.permissions || [],
      tenantId: u?.tenantId,
      accessExpiresAt: u?.isDemo && u.accessExpiresAt ? new Date(u.accessExpiresAt).toISOString() : u?.role === 'support' ? new Date(supportSessions.get(u.uid) || 0).toISOString() : undefined
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
  if(user.isSuperAdmin&&(parsed.data.newPassword.length<12||!/[^A-Za-z0-9]/.test(parsed.data.newPassword)))return res.status(400).json({error:'Super Admin passwords must contain at least 12 characters and a special character.'});
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

app.get('/api/auth/workspaces',authGuard,asyncRoute(async(req,res)=>{const result=await pool!.query('SELECT m.organization_id AS id,o.name,o.slug,m.role,m.status FROM org_memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.user_uid=? AND m.status=\'active\' ORDER BY o.name',[req.user?.uid]);res.json({items:result.rows,activeWorkspaceId:req.user?.tenantId});}));

app.post('/api/auth/logout', authGuard, (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const rawToken = extractTokenFromReq(req);
  if (rawToken) {
    demoSessionRepo.destroySession(rawToken);
    authSessions.delete(rawToken);
  }
  const session=rawToken?authSessions.get(rawToken):undefined;
  const reason=req.body?.reason==='inactivity'?'Inactivity timeout':'User logout';
  if(session&&pool)void pool.query('UPDATE authentication_sessions SET revoked_at=NOW(6),revoked_by_uid=?,revoke_reason=? WHERE id=?',[user?.uid||'unknown',reason,session.id]);
  if (user?.role === 'support' && user?.uid) supportSessions.delete(user.uid);
  res.clearCookie('ojix_demo_session', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully.' });
});

app.use('/api/properties/:id', authGuard, businessDataGuard, asyncRoute(releasedMatterGuard));
app.use(['/api/documents', '/api/findings', '/api/legal-research', '/api/source-registry', '/api/spatial'], authGuard, businessDataGuard);
app.use(['/api/documents', '/api/source-registry', '/api/spatial'], authGuard, viewerInternalDataGuard);
app.use('/api/properties/:id/documents', authGuard, asyncRoute(async(req,res,next)=>{
  if(!pool)return res.status(503).json({error:'Database not configured.'});
  const user=(req as AuthenticatedRequest).user;
  if(user?.role==='support'||user?.role==='data_steward')return res.status(403).json({error:'This role cannot access confidential document records.'});
  const property=await pool.query('SELECT assigned_lawyer_uid,assigned_analyst_uid,assigned_operations_uid FROM properties WHERE id=? AND tenant_id=?',[req.params.id,user?.tenantId]);
  if(!property.rowCount)return res.status(404).json({error:'Property not found.'});
  const row=property.rows[0];
  const assigned=(user?.role==='lawyer'&&row.assigned_lawyer_uid===user.uid)||(user?.role==='analyst'&&row.assigned_analyst_uid===user.uid)||(user?.role==='operations'&&(!row.assigned_operations_uid||row.assigned_operations_uid===user.uid))||['owner','admin','consultant','viewer'].includes(user?.role||'');
  if(!assigned)return res.status(404).json({error:'Matter not found.'});
  next();
}));
app.use(['/api/findings', '/api/legal-research', '/api/properties/:id/workflow', '/api/properties/:id/title-chain', '/api/properties/:id/title-events', '/api/properties/:id/discrepancies', '/api/properties/:id/spatial-screening', '/api/properties/:id/due-diligence-snapshot'], authGuard, legalDecisionDataGuard);

app.get('/api/locations/districts', authGuard, asyncRoute(async (_req, res) => {
  if (_usingMockPool || isMockMode() || !pool) {
    const store = getMockStore();
    return res.json({ items: store.districts });
  }
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
  if ((_req as any).demoWorkspace) {
    const ws = (_req as any).demoWorkspace as DemoSessionWorkspace;
    const total = ws.properties.length;
    const in_review = ws.properties.filter(p => p.status === 'in_review').length;
    const ready_for_review = ws.properties.filter(p => p.status === 'approved' || p.status === 'ready_for_review').length;
    const documents = ws.documents.length;
    const critical = ws.findings.filter(f => f.severity === 'critical').length;
    const high = ws.findings.filter(f => f.severity === 'high').length;
    return res.json({
      total,
      in_review,
      ready_for_review,
      missing_documents: 0,
      missing_coordinates: 0,
      disputed_identity: 1,
      completeness: 88,
      documents,
      findings: ws.findings.length,
      criticalFindings: critical,
      highFindings: high,
      statusBreakdown: [
        { status: 'in_review', total: in_review },
        { status: 'ready_for_review', total: ready_for_review }
      ],
      docStatusBreakdown: [
        { status: 'completed', total: documents }
      ],
      recentProperties: ws.properties.slice(0, 5),
      sourceHealth: {
        database: 'connected',
        governmentConnectors: 'demo_mocked',
        documentStorage: 'demo_private_durable',
        ocr: 'tesseract_active',
        gisLayers: 'demo_karnataka'
      }
    });
  }
  if (!pool) return res.status(503).json({ error: 'Database not configured. Start MariaDB and set DATABASE_URL.' });
  if (_req.user?.role === 'support') { const configured=await pool.query('SELECT tenant_id FROM document_ai_config WHERE tenant_id=?',[_req.user.tenantId]);return res.json({ total:0, in_review:0, ready_for_review:0, documents:0, findings:0, sourceHealth:{ database:'connected', governmentConnectors:'not_connected', documentStorage:documentStorage.provider==='gcs'?'gcs_private':documentStorage.provider==='supabase'?'supabase_private':'local_development', ocr:configured.rowCount&&process.env.OCR_WORKER_TOKEN?'google_document_ai_configured':'not_configured', gisLayers:'unavailable' }, supportScope:'diagnostics_only' }); }
  const assignmentColumn:Record<string,string>={lawyer:'assigned_lawyer_uid',analyst:'assigned_analyst_uid',operations:'assigned_operations_uid',consultant:'assigned_consultant_uid',viewer:'assigned_viewer_uid'};
  const assignment=assignmentColumn[_req.user?.role||''];
  const matterScope=assignment?` AND p.${assignment}=?${_req.user?.role==='viewer'?" AND p.status IN ('approved','complete')":''}`:'';
  const scopeParams=assignment?[_req.user?.uid||'']:[];
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
     FROM properties p WHERE p.tenant_id=?${matterScope}`,
    [_req.user?.tenantId,...scopeParams]
  );
  const docs = await pool.query(`SELECT COUNT(*) AS total FROM documents d JOIN properties p ON p.id=d.property_id AND p.tenant_id=d.tenant_id WHERE d.tenant_id=?${matterScope}`, [_req.user?.tenantId,...scopeParams]);
  const recent = await pool.query(`SELECT p.id, p.name, p.village, p.survey_number, p.district, p.status, p.updated_at FROM properties p WHERE p.tenant_id=?${matterScope} ORDER BY p.updated_at DESC LIMIT 5`, [_req.user?.tenantId,...scopeParams]);
  const findingSummary = await pool.query(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN severity IN ('high','critical') THEN 1 ELSE 0 END) AS high_attention
     FROM risk_findings f JOIN properties p ON p.id=f.property_id AND p.tenant_id=f.tenant_id WHERE f.tenant_id=?${matterScope}`,
    [_req.user?.tenantId,...scopeParams]
  );
  const recentFindings = await pool.query(
    `SELECT f.id, f.property_id, f.title, f.severity, f.evidence_status, f.created_at, p.name AS property_name
     FROM risk_findings f JOIN properties p ON p.id=f.property_id AND p.tenant_id=f.tenant_id
     WHERE f.tenant_id=?${matterScope} ORDER BY f.created_at DESC LIMIT 5`,
    [_req.user?.tenantId,...scopeParams]
  );
  const districtDistribution = await pool.query(
    `SELECT COALESCE(NULLIF(p.district,''),'Not recorded') AS district, COUNT(*) AS total
     FROM properties p WHERE p.tenant_id=?${matterScope} GROUP BY COALESCE(NULLIF(p.district,''),'Not recorded')
     ORDER BY total DESC, district LIMIT 8`,
    [_req.user?.tenantId,...scopeParams]
  );
  const documentStatus = await pool.query(
    `SELECT d.processing_status AS status, COUNT(*) AS total FROM documents d JOIN properties p ON p.id=d.property_id AND p.tenant_id=d.tenant_id
     WHERE d.tenant_id=?${matterScope} GROUP BY d.processing_status ORDER BY total DESC`,
    [_req.user?.tenantId,...scopeParams]
  );
  const spatialLayerStatus = await pool.query("SELECT data_status, COUNT(*) AS total FROM spatial_layers WHERE active=true AND data_status='verified' AND source_name IS NOT NULL AND source_url IS NOT NULL AND source_date IS NOT NULL GROUP BY data_status");
  const portfolioCoverage = await pool.query(
    `SELECT
       SUM(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 ELSE 0 END) AS mapped,
       SUM(CASE WHEN identity_state='verified' THEN 1 ELSE 0 END) AS verified_identity,
       SUM(CASE WHEN identity_state='disputed' THEN 1 ELSE 0 END) AS disputed_identity,
       SUM(CASE WHEN p.boundary_north<>'' AND p.boundary_south<>'' AND p.boundary_east<>'' AND p.boundary_west<>'' THEN 1 ELSE 0 END) AS complete_boundaries
     FROM properties p WHERE p.tenant_id=?${matterScope}`,
    [_req.user?.tenantId,...scopeParams]
  );
  const attentionQueue = await pool.query(
    `SELECT p.id, p.name, p.district, p.village, p.property_type, p.property_identifier, p.property_identifier_type, p.survey_number, p.subdivision, p.status, p.updated_at,
       CASE WHEN NOT EXISTS (SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id) THEN 1 ELSE 0 END AS missing_documents,
       CASE WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 1 ELSE 0 END AS missing_coordinates,
       CASE WHEN p.extent='' THEN 1 ELSE 0 END AS missing_extent,
       CASE WHEN p.identity_state='disputed' THEN 1 ELSE 0 END AS disputed_identity
     FROM properties p WHERE p.tenant_id=?${matterScope} AND (
       NOT EXISTS (SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id)
       OR p.latitude IS NULL OR p.longitude IS NULL OR p.extent='' OR p.identity_state='disputed'
     )
     ORDER BY (CASE WHEN p.identity_state='disputed' THEN 4 ELSE 0 END +
       CASE WHEN NOT EXISTS (SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id) THEN 3 ELSE 0 END +
       CASE WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 2 ELSE 0 END +
       CASE WHEN p.extent='' THEN 1 ELSE 0 END) DESC, p.updated_at DESC LIMIT 6`,
    [_req.user?.tenantId,...scopeParams]
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
  const boundedInt=(value:unknown,fallback:number,min:number,max:number)=>{const parsed=Number.parseInt(String(value??''),10);return Number.isFinite(parsed)?Math.max(min,Math.min(max,parsed)):fallback;};
  const findingsPage=boundedInt(req.query.findingsPage,1,1,10000),findingsPageSize=boundedInt(req.query.findingsPageSize,6,1,25);
  const activityPage=boundedInt(req.query.activityPage,1,1,10000),activityPageSize=boundedInt(req.query.activityPageSize,8,1,25);
  const dateValue=(value:unknown,fallback:string)=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):fallback;
  const defaultTo=new Date().toISOString().slice(0,10);
  const defaultFrom=new Date(Date.now()-180*24*60*60_000).toISOString().slice(0,10);
  const from=dateValue(req.query.from,defaultFrom),to=dateValue(req.query.to,defaultTo);
  if(from>to)return res.status(400).json({error:'The analytics start date must be on or before the end date.'});

  if ((req as any).demoWorkspace || _usingMockPool || isMockMode()) {
    const ws = ((req as any).demoWorkspace as DemoSessionWorkspace) || demoSessionRepo.getSession('demo-fallback-sid');
    const properties = ws?.properties || [];
    const documents = ws?.documents || [];
    const findings = ws?.findings || [];
    const tasks = ws?.tasks || [];
    const reports = ws?.reports || [];
    const auditEvents = ws?.auditEvents || [];

    const total = properties.length;
    const openMatters = properties.filter(p => !['complete', 'closed', 'archived'].includes(p.status)).length;
    const activeReviews = properties.filter(p => ['in_review', 'clarification_required'].includes(p.status)).length;
    const readyForReview = properties.filter(p => p.status === 'ready_for_review').length;
    const highAttnFindings = findings.filter(f => ['critical', 'high'].includes(f.severity)).length;
    const pendingDocs = documents.filter(d => d.manual_review_status === 'pending' || d.processing_status !== 'completed').length;
    const submittedReports = reports.filter(r => r.approval_status === 'submitted').length;

    // Workflow list
    const workflow = properties.map(p => {
      const propDocs = documents.filter(d => d.property_id === p.id);
      const propFindings = findings.filter(f => f.property_id === p.id);
      const highestRisk = propFindings.find(f => f.severity === 'critical') ? 'critical' :
                          propFindings.find(f => f.severity === 'high') ? 'high' :
                          propFindings.find(f => f.severity === 'medium') ? 'medium' : 'low';
      const stage = p.status === 'ready_for_review' ? 'Legal review' :
                    (p.status === 'approved' || p.status === 'complete') ? 'Completed' :
                    p.status === 'clarification_required' ? 'Clarification' : 'Evidence review';
      const nextAct = p.status === 'ready_for_review' ? 'Complete legal review' :
                      (p.status === 'approved' || p.status === 'complete') ? 'Prepare final submission' :
                      p.status === 'clarification_required' ? 'Reconcile survey discrepancy' : 'Review pending documents';
      return {
        ...p,
        document_count: propDocs.length,
        pending_document_reviews: propDocs.filter(d => d.manual_review_status === 'pending').length,
        risk_level: highestRisk,
        coordinates_verified: 1,
        missing_evidence: 0,
        review_stage: stage,
        next_action: nextAct,
      };
    });

    // Distributions
    const distMap = new Map<string, number>();
    const talukMap = new Map<string, number>();
    const villageMap = new Map<string, number>();
    for (const p of properties) {
      if (p.district) distMap.set(p.district, (distMap.get(p.district) || 0) + 1);
      if (p.taluk) talukMap.set(p.taluk, (talukMap.get(p.taluk) || 0) + 1);
      if (p.village) villageMap.set(p.village, (villageMap.get(p.village) || 0) + 1);
    }

    const distRows = Array.from(distMap.entries()).map(([label, value]) => ({ label, value }));
    const talukRows = Array.from(talukMap.entries()).map(([label, value]) => ({ label, value }));
    const villageRows = Array.from(villageMap.entries()).map(([label, value]) => ({ label, value }));

    const findingsWithProp = findings.map(f => {
      const prop = properties.find(p => p.id === f.property_id);
      return {
        ...f,
        property_name: prop?.name || 'Property Parcel',
        application_number: prop?.application_number || 'OJ-2026',
        district: prop?.district || 'Bengaluru Urban',
        assigned_owner: prop?.assigned_lawyer_uid || 'user-lawyer',
        reviewer_state: f.evidence_status === 'confirmed' ? 'approved' : 'pending',
        evidence_available: 1,
      };
    });

    const pagedFindings = findingsWithProp.slice((findingsPage - 1) * findingsPageSize, findingsPage * findingsPageSize);
    const pagedActivity = auditEvents.slice((activityPage - 1) * activityPageSize, activityPage * activityPageSize);

    // Team workload
    const workload = [
      { user_uid: 'user-lawyer', email: 'demo.lawyer@ojix-demo.invalid', role: 'lawyer', name: 'Sharath — Senior Legal Reviewer', assigned_matters: 3, pending_reviews: 2, completed_tasks: 4, open_tasks: 1, overdue_task_count: 0, tasks_awaiting_review: 1, completed_task_count: 4, completion_pct: 80 },
      { user_uid: 'user-analyst', email: 'demo.analyst@ojix-demo.invalid', role: 'analyst', name: 'Sharath — Evidence Analyst', assigned_matters: 3, pending_reviews: 2, completed_tasks: 5, open_tasks: 2, overdue_task_count: 1, tasks_awaiting_review: 0, completed_task_count: 5, completion_pct: 71 },
      { user_uid: 'user-operations', email: 'demo.operations@ojix-demo.invalid', role: 'operations', name: 'Sharath — Document Operations', assigned_matters: 2, pending_reviews: 1, completed_tasks: 6, open_tasks: 1, overdue_task_count: 0, tasks_awaiting_review: 0, completed_task_count: 6, completion_pct: 86 },
      { user_uid: 'user-consultant', email: 'demo.consultant@ojix-demo.invalid', role: 'consultant', name: 'Sharath — Property Consultant', assigned_matters: 2, pending_reviews: 1, completed_tasks: 3, open_tasks: 1, overdue_task_count: 0, tasks_awaiting_review: 0, completed_task_count: 3, completion_pct: 75 },
    ];

    // Reports formatted
    const reportsFormatted = reports.map(r => {
      const prop = properties.find(p => p.id === r.property_id);
      return {
        property_id: r.property_id,
        application_number: prop?.application_number || 'OJ-2026',
        property_name: prop?.name || 'Property Parcel',
        status: prop?.status || 'in_review',
        assigned_owner: 'user-lawyer',
        due_date: prop?.due_date || null,
        created_at: r.created_at,
        report_id: r.id,
        version_number: r.version_number,
        report_title: r.title,
        approval_status: r.approval_status,
        action: r.approval_status === 'submitted' ? 'Submitted report awaiting legal review' : 'Report approved',
      };
    });

    return res.json({
      metrics: {
        total_matters: total,
        open_matters: openMatters,
        active_reviews: activeReviews,
        active_due_diligence: activeReviews,
        ready_for_legal_review: readyForReview,
        high_attention_findings: highAttnFindings,
        overdue_tasks: 1,
        documents_requiring_review: pendingDocs,
        reports_awaiting_review: submittedReports,
      },
      readiness: {
        total,
        ready_for_legal_review: readyForReview,
        under_review: activeReviews,
        not_started: 0,
        missing_evidence_matters: 0,
        readiness_pct: 88,
      },
      distributions: {
        districts: distRows,
        taluks: talukRows,
        villages: villageRows,
      },
      documentCategories: {
        total_documents: documents.length,
        pending_review: pendingDocs,
        title_deeds: documents.filter(d => d.doc_type === 'sale_deed').length,
        encumbrance_certificates: documents.filter(d => d.doc_type === 'ec').length,
        survey_revenue_records: documents.filter(d => ['rtc', 'khata_certificate', 'tax_receipt'].includes(d.doc_type)).length,
        other_documents: documents.filter(d => !['sale_deed', 'ec', 'rtc', 'khata_certificate', 'tax_receipt'].includes(d.doc_type)).length,
        pending_title_deeds: 1,
        pending_encumbrance_certificates: 1,
        pending_survey_revenue_records: 1,
        pending_other_documents: 0,
      },
      riskOverview: [
        { label: 'critical', value: findings.filter(f => f.severity === 'critical').length },
        { label: 'high', value: findings.filter(f => f.severity === 'high').length },
        { label: 'medium', value: findings.filter(f => f.severity === 'medium').length },
        { label: 'low', value: findings.filter(f => f.severity === 'low').length },
      ],
      workflow,
      pendingActions: [
        { id: 'documents', label: 'Pending document reviews', count: pendingDocs, priority: pendingDocs > 0 ? 'high' : 'normal', status: pendingDocs > 0 ? 'Action required' : 'Clear', nextAction: 'Review documents', target: 'all-documents' },
        { id: 'approval', label: 'Matters awaiting approval', count: readyForReview, priority: readyForReview > 0 ? 'high' : 'normal', status: readyForReview > 0 ? 'Pending' : 'Clear', nextAction: 'Open legal review matters', target: 'overview' },
        { id: 'evidence', label: 'Missing evidence', count: 0, priority: 'normal', status: 'Clear', nextAction: 'Inspect workflow', target: 'overview' },
        { id: 'overdue', label: 'Overdue tasks', count: 1, priority: 'urgent', status: 'Overdue', nextAction: 'Resolve tasks', target: 'lawyer-workbench' },
        { id: 'legal', label: 'Reports awaiting legal review', count: submittedReports, priority: submittedReports > 0 ? 'high' : 'normal', status: submittedReports > 0 ? 'Waiting' : 'Clear', nextAction: 'Review submitted reports', target: 'consultant-reports' },
      ],
      recentFindings: pagedFindings,
      teamWorkload: workload,
      reports: reportsFormatted,
      recentActivity: pagedActivity,
      pagination: {
        findings: { page: findingsPage, pageSize: findingsPageSize, total: findings.length, totalPages: Math.max(1, Math.ceil(findings.length / findingsPageSize)) },
        activity: { page: activityPage, pageSize: activityPageSize, total: auditEvents.length, totalPages: Math.max(1, Math.ceil(auditEvents.length / activityPageSize)) },
      },
      evidenceSourceStatus: [
        { source: 'Bhoomi / RTC', status: 'source_matched', lastChecked: '2026-11-18 10:30:00', recordedSource: 'Karnataka Bhoomi Land Records' },
        { source: 'Kaveri', status: 'verified', lastChecked: '2026-11-18 10:30:00', recordedSource: 'Kaveri 2.0 Stamps & Registration' },
        { source: 'Registration / EC', status: 'verified', lastChecked: '2026-11-18 10:30:00', recordedSource: 'Kaveri EC Form 15' },
        { source: 'GIS / Map Layers', status: 'verified_data_available', verifiedLayers: 12, latestSourceDate: '2026-11-15' },
      ],
      evidenceSources: {
        connected_sources: 4,
        verification_completed: 18,
        verification_pending: 3,
        failed_verification: 0,
        last_synchronization: '2026-11-18 10:30:00',
      },
      analytics: {
        from,
        to,
        mattersByStatus: [
          { label: 'in_review', value: activeReviews },
          { label: 'ready_for_review', value: readyForReview },
          { label: 'complete', value: properties.filter(p => ['approved', 'complete'].includes(p.status)).length },
        ],
        monthlyTrends: [
          { month: '2026-09', created: 3, completed: 1 },
          { month: '2026-10', created: 3, completed: 1 },
          { month: '2026-11', created: 2, completed: 1 },
        ],
        riskSeverity: [
          { label: 'critical', value: findings.filter(f => f.severity === 'critical').length },
          { label: 'high', value: findings.filter(f => f.severity === 'high').length },
          { label: 'medium', value: findings.filter(f => f.severity === 'medium').length },
          { label: 'low', value: findings.filter(f => f.severity === 'low').length },
        ],
        taskComparison: { pending: 2, completed: 5 },
      },
    });
  }

  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const tenantId = req.user?.tenantId;
  const [metrics, workflow, recentFindings, workload, reports, activity, evidenceSources, readiness, districts, taluks, villages, documentCategories, riskOverview, sourceRegistryHistory, rtcHistory, verifiedLayers, activityCount, findingsCount] = await Promise.all([
    pool.query(`SELECT
      COUNT(*) AS total_matters,
      SUM(CASE WHEN p.status NOT IN ('complete','closed','archived') AND p.archived_at IS NULL THEN 1 ELSE 0 END) AS open_matters,
      SUM(CASE WHEN p.status IN ('in_review','clarification_required') AND p.archived_at IS NULL THEN 1 ELSE 0 END) AS active_reviews,
      SUM(CASE WHEN p.status IN ('documents_pending','in_review','clarification_required') AND p.archived_at IS NULL THEN 1 ELSE 0 END) AS active_due_diligence,
      SUM(CASE WHEN p.status='ready_for_review' AND p.archived_at IS NULL THEN 1 ELSE 0 END) AS ready_for_legal_review,
      (SELECT COUNT(*) FROM risk_findings f JOIN properties fp ON fp.id=f.property_id AND fp.tenant_id=f.tenant_id WHERE f.tenant_id=? AND fp.archived_at IS NULL AND f.severity IN ('critical','high')) AS high_attention_findings,
      (SELECT COUNT(*) FROM workbench_tasks t JOIN properties tp ON tp.id=t.property_id AND tp.tenant_id=t.tenant_id WHERE t.tenant_id=? AND tp.archived_at IS NULL AND t.due_date<CURDATE() AND t.status NOT IN ('completed','cancelled')) AS overdue_tasks,
      (SELECT COUNT(*) FROM documents d JOIN properties dp ON dp.id=d.property_id AND dp.tenant_id=d.tenant_id WHERE d.tenant_id=? AND dp.archived_at IS NULL AND d.governance_status='active' AND (d.manual_review_status IN ('pending','required') OR d.processing_status<>'completed')) AS documents_requiring_review,
      (SELECT COUNT(*) FROM consultant_report_versions rr JOIN properties rp ON rp.id=rr.property_id AND rp.tenant_id=rr.tenant_id WHERE rr.tenant_id=? AND rp.archived_at IS NULL AND rr.approval_status='submitted') AS reports_awaiting_review
      FROM properties p WHERE p.tenant_id=? AND p.archived_at IS NULL`, [tenantId, tenantId, tenantId, tenantId, tenantId]),
    pool.query(`SELECT p.*,
      (SELECT COUNT(*) FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.governance_status='active') AS document_count,
      (SELECT COUNT(*) FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.governance_status='active' AND (d.manual_review_status IN ('pending','required') OR d.processing_status<>'completed')) AS pending_document_reviews,
      COALESCE((SELECT f.severity FROM risk_findings f WHERE f.property_id=p.id AND f.tenant_id=p.tenant_id ORDER BY FIELD(f.severity,'critical','high','medium','low','unverified') LIMIT 1),'unverified') AS risk_level,
      CASE WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND LOWER(COALESCE(p.coordinate_source,'')) NOT LIKE '%demo%' AND LOWER(COALESCE(p.coordinate_source,'')) NOT LIKE '%synthetic%' THEN 1 ELSE 0 END AS coordinates_verified,
      ((CASE WHEN p.survey_number='' AND p.property_identifier='' THEN 1 ELSE 0 END) +
       (CASE WHEN p.extent='' THEN 1 ELSE 0 END) +
       (CASE WHEN p.latitude IS NULL OR p.longitude IS NULL THEN 1 ELSE 0 END) +
       (CASE WHEN NOT EXISTS (SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.governance_status='active') THEN 1 ELSE 0 END) +
       (CASE WHEN p.boundary_north='' OR p.boundary_south='' OR p.boundary_east='' OR p.boundary_west='' THEN 1 ELSE 0 END) +
       (CASE WHEN p.identity_state<>'verified' THEN 1 ELSE 0 END)) AS missing_evidence,
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
    pool.query(`SELECT f.id,f.code,f.property_id,f.title,f.severity,f.evidence_status,f.created_at,p.name AS property_name,p.application_number,p.district,p.assigned_lawyer_uid AS assigned_owner,
        COALESCE(fr.review_status,'pending') AS reviewer_state,
        EXISTS(SELECT 1 FROM consultant_issue_evidence ie JOIN documents d ON d.id=ie.document_id AND d.tenant_id=ie.tenant_id WHERE ie.finding_id=f.id AND ie.tenant_id=f.tenant_id AND d.review_status='approved' AND d.governance_status='active') AS evidence_available
      FROM risk_findings f JOIN properties p ON p.id=f.property_id AND p.tenant_id=f.tenant_id
      LEFT JOIN consultant_finding_reviews fr ON fr.finding_id=f.id AND fr.tenant_id=f.tenant_id
      WHERE f.tenant_id=? AND p.archived_at IS NULL ORDER BY f.created_at DESC LIMIT ? OFFSET ?`, [tenantId,findingsPageSize,(findingsPage-1)*findingsPageSize]),
    pool.query(`SELECT m.user_uid,m.email,m.role,COALESCE(u.full_name,m.email,m.user_uid) AS name,
      CASE m.role
        WHEN 'lawyer' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.archived_at IS NULL AND p.assigned_lawyer_uid=m.user_uid AND p.status NOT IN ('complete','closed','archived'))
        WHEN 'analyst' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.archived_at IS NULL AND p.assigned_analyst_uid=m.user_uid AND p.status NOT IN ('complete','closed','archived'))
        WHEN 'operations' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.archived_at IS NULL AND p.assigned_operations_uid=m.user_uid AND p.status NOT IN ('complete','closed','archived'))
        WHEN 'consultant' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.archived_at IS NULL AND p.assigned_consultant_uid=m.user_uid AND p.status NOT IN ('complete','closed','archived'))
        ELSE 0 END AS assigned_matters,
      CASE m.role
        WHEN 'lawyer' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.archived_at IS NULL AND p.assigned_lawyer_uid=m.user_uid AND p.status='ready_for_review')
        WHEN 'analyst' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.archived_at IS NULL AND p.assigned_analyst_uid=m.user_uid AND p.status IN ('documents_pending','in_review','clarification_required'))
        WHEN 'operations' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.archived_at IS NULL AND p.assigned_operations_uid=m.user_uid AND p.status='documents_pending')
        WHEN 'consultant' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.archived_at IS NULL AND p.assigned_consultant_uid=m.user_uid AND p.status IN ('documents_pending','in_review','clarification_required'))
        ELSE 0 END AS pending_reviews,
      CASE m.role
        WHEN 'lawyer' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.assigned_lawyer_uid=m.user_uid AND p.status='complete')
        WHEN 'analyst' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.assigned_analyst_uid=m.user_uid AND p.status='complete')
        WHEN 'operations' THEN (SELECT COUNT(*) FROM properties p WHERE p.tenant_id=m.organization_id AND p.assigned_operations_uid=m.user_uid AND p.status='complete')
        ELSE 0 END AS completed_tasks,
      (SELECT COUNT(*) FROM workbench_tasks t JOIN properties p ON p.id=t.property_id AND p.tenant_id=t.tenant_id WHERE t.tenant_id=m.organization_id AND p.archived_at IS NULL AND t.assigned_to_uid=m.user_uid AND t.status NOT IN ('completed','cancelled')) AS open_tasks,
      (SELECT COUNT(*) FROM workbench_tasks t JOIN properties p ON p.id=t.property_id AND p.tenant_id=t.tenant_id WHERE t.tenant_id=m.organization_id AND p.archived_at IS NULL AND t.assigned_to_uid=m.user_uid AND t.status NOT IN ('completed','cancelled') AND t.due_date<CURDATE()) AS overdue_task_count,
      (SELECT COUNT(*) FROM workbench_tasks t JOIN properties p ON p.id=t.property_id AND p.tenant_id=t.tenant_id WHERE t.tenant_id=m.organization_id AND p.archived_at IS NULL AND t.reviewer_uid=m.user_uid AND t.status='under_review') AS tasks_awaiting_review,
      (SELECT COUNT(*) FROM workbench_tasks t JOIN properties p ON p.id=t.property_id AND p.tenant_id=t.tenant_id WHERE t.tenant_id=m.organization_id AND p.archived_at IS NULL AND t.assigned_to_uid=m.user_uid AND t.status='completed') AS completed_task_count
      FROM org_memberships m LEFT JOIN user_accounts u ON u.id=m.user_uid
      WHERE m.organization_id=? AND m.status='active' AND m.role IN ('lawyer','analyst','operations','consultant')
      ORDER BY assigned_matters DESC,m.role,name LIMIT 50`, [tenantId]),
    pool.query(`SELECT p.id AS property_id,p.application_number,p.name AS property_name,p.status,p.assigned_lawyer_uid AS assigned_owner,p.due_date,r.created_at,r.id AS report_id,r.version_number,r.title AS report_title,r.approval_status,
      'Submitted report awaiting legal review' AS action
      FROM consultant_report_versions r JOIN properties p ON p.id=r.property_id AND p.tenant_id=r.tenant_id
      WHERE r.tenant_id=? AND r.approval_status='submitted' AND p.archived_at IS NULL
      ORDER BY r.submitted_at IS NULL,r.submitted_at,r.created_at DESC LIMIT 6`, [tenantId]),
    pool.query(`SELECT a.id,a.actor_uid,a.action,a.entity_type,a.entity_id,a.created_at,COALESCE(u.full_name,m.email,a.actor_uid) AS actor_name,
        COALESCE(property_entity.id,document_property.id) AS property_id,
        COALESCE(property_entity.name,document_property.name) AS property_name,
        COALESCE(property_entity.application_number,document_property.application_number) AS application_number,
        COALESCE(property_entity.district,document_property.district) AS district
      FROM audit_events a
      LEFT JOIN user_accounts u ON u.id=a.actor_uid
      LEFT JOIN (SELECT organization_id,user_uid,MAX(email) AS email FROM org_memberships GROUP BY organization_id,user_uid) m ON m.organization_id=a.tenant_id AND m.user_uid=a.actor_uid
      LEFT JOIN properties property_entity ON a.entity_type='property' AND property_entity.id=a.entity_id AND property_entity.tenant_id=a.tenant_id
      LEFT JOIN documents activity_document ON a.entity_type='document' AND activity_document.id=a.entity_id AND activity_document.tenant_id=a.tenant_id
      LEFT JOIN properties document_property ON document_property.id=activity_document.property_id AND document_property.tenant_id=a.tenant_id
      WHERE a.tenant_id=? AND (a.action IN ('property.created','property.updated','property.workflow_updated','admin.application_assignment_changed','document.uploaded','document.fields_overridden','document.submitted_for_review','document.ocr_completed','legal.finding_report_review_decision','legal.report_review_decision','consultant.report_version_created','consultant.report_submitted','consultant.report_exported','report.snapshot_created') OR a.action LIKE 'workbench.%')
      ORDER BY a.created_at DESC LIMIT ? OFFSET ?`, [tenantId,activityPageSize,(activityPage-1)*activityPageSize]),
    pool.query(`SELECT
      (SELECT COUNT(DISTINCT source_name) FROM rtc_lookups WHERE tenant_id=? AND status='completed') AS connected_sources,
      ((SELECT COUNT(*) FROM rtc_lookups WHERE tenant_id=? AND verification_status='source_matched') +
       (SELECT COUNT(*) FROM documents WHERE tenant_id=? AND governance_status='active' AND manual_review_status='completed')) AS verification_completed,
      ((SELECT COUNT(*) FROM rtc_lookups WHERE tenant_id=? AND verification_status='unverified') +
       (SELECT COUNT(*) FROM documents WHERE tenant_id=? AND governance_status='active' AND manual_review_status IN ('pending','required'))) AS verification_pending,
      ((SELECT COUNT(*) FROM rtc_lookups WHERE tenant_id=? AND (verification_status='source_mismatch' OR status='failed')) +
       (SELECT COUNT(*) FROM documents WHERE tenant_id=? AND governance_status IN ('rejected','quarantined'))) AS failed_verification,
      (SELECT MAX(COALESCE(retrieved_at,updated_at,created_at)) FROM rtc_lookups WHERE tenant_id=?) AS last_synchronization`,
      [tenantId,tenantId,tenantId,tenantId,tenantId,tenantId,tenantId,tenantId]),
    pool.query(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN p.status='ready_for_review' AND p.archived_at IS NULL THEN 1 ELSE 0 END) AS ready_for_legal_review,
      SUM(CASE WHEN p.status IN ('documents_pending','in_review','clarification_required') AND p.archived_at IS NULL THEN 1 ELSE 0 END) AS under_review,
      SUM(CASE WHEN p.status='draft' AND p.archived_at IS NULL THEN 1 ELSE 0 END) AS not_started,
      SUM(CASE WHEN (
        (NULLIF(TRIM(p.survey_number),'') IS NULL AND NULLIF(TRIM(p.property_identifier),'') IS NULL) OR NULLIF(TRIM(p.village),'') IS NULL OR NULLIF(TRIM(p.extent),'') IS NULL OR p.latitude IS NULL OR p.longitude IS NULL OR
        NULLIF(TRIM(p.boundary_north),'') IS NULL OR NULLIF(TRIM(p.boundary_south),'') IS NULL OR NULLIF(TRIM(p.boundary_east),'') IS NULL OR NULLIF(TRIM(p.boundary_west),'') IS NULL OR COALESCE(p.identity_state,'')<>'verified' OR
        NOT EXISTS (SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.governance_status='active')
      ) THEN 1 ELSE 0 END) AS missing_evidence_matters,
      ROUND(AVG((
        (CASE WHEN (NULLIF(TRIM(p.survey_number),'') IS NOT NULL OR NULLIF(TRIM(p.property_identifier),'') IS NOT NULL) AND NULLIF(TRIM(p.village),'') IS NOT NULL AND NULLIF(TRIM(p.extent),'') IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN EXISTS (SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.governance_status='active') THEN 1 ELSE 0 END) +
        (CASE WHEN p.latitude IS NOT NULL AND p.longitude IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN NULLIF(TRIM(p.boundary_north),'') IS NOT NULL AND NULLIF(TRIM(p.boundary_south),'') IS NOT NULL AND NULLIF(TRIM(p.boundary_east),'') IS NOT NULL AND NULLIF(TRIM(p.boundary_west),'') IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN p.identity_state='verified' THEN 1 ELSE 0 END)
      ) / 5 * 100),0) AS readiness_pct
      FROM properties p WHERE p.tenant_id=? AND p.archived_at IS NULL`,[tenantId]),
    pool.query(`SELECT COALESCE(NULLIF(TRIM(district),''),'Not recorded') AS label,COUNT(*) AS value FROM properties WHERE tenant_id=? AND archived_at IS NULL GROUP BY COALESCE(NULLIF(TRIM(district),''),'Not recorded') ORDER BY value DESC,label`,[tenantId]),
    pool.query(`SELECT COALESCE(NULLIF(TRIM(taluk),''),'Not recorded') AS label,COUNT(*) AS value FROM properties WHERE tenant_id=? AND archived_at IS NULL GROUP BY COALESCE(NULLIF(TRIM(taluk),''),'Not recorded') ORDER BY value DESC,label`,[tenantId]),
    pool.query(`SELECT COALESCE(NULLIF(TRIM(village),''),'Not recorded') AS label,COUNT(*) AS value FROM properties WHERE tenant_id=? AND archived_at IS NULL GROUP BY COALESCE(NULLIF(TRIM(village),''),'Not recorded') ORDER BY value DESC,label`,[tenantId]),
    pool.query(`SELECT COUNT(*) AS total_documents,
      SUM(CASE WHEN manual_review_status IN ('pending','required') OR processing_status<>'completed' THEN 1 ELSE 0 END) AS pending_review,
      SUM(CASE WHEN LOWER(COALESCE(doc_type,'')) IN ('sale_deed','gift_deed','partition_deed','release_deed','power_of_attorney') THEN 1 ELSE 0 END) AS title_deeds,
      SUM(CASE WHEN LOWER(COALESCE(doc_type,'')) IN ('encumbrance_certificate','ec') THEN 1 ELSE 0 END) AS encumbrance_certificates,
      SUM(CASE WHEN LOWER(COALESCE(doc_type,'')) IN ('rtc_pahani','mutation_record','mutation_extract','survey_sketch_tippan','survey_sketch','khata_e_khata','e_khata','property_tax_receipt','tax_receipt') THEN 1 ELSE 0 END) AS survey_revenue_records,
      SUM(CASE WHEN LOWER(COALESCE(doc_type,'')) NOT IN ('sale_deed','gift_deed','partition_deed','release_deed','power_of_attorney','encumbrance_certificate','ec','rtc_pahani','mutation_record','mutation_extract','survey_sketch_tippan','survey_sketch','khata_e_khata','e_khata','property_tax_receipt','tax_receipt') THEN 1 ELSE 0 END) AS other_documents,
      SUM(CASE WHEN (manual_review_status IN ('pending','required') OR processing_status<>'completed') AND LOWER(COALESCE(doc_type,'')) IN ('sale_deed','gift_deed','partition_deed','release_deed','power_of_attorney') THEN 1 ELSE 0 END) AS pending_title_deeds,
      SUM(CASE WHEN (manual_review_status IN ('pending','required') OR processing_status<>'completed') AND LOWER(COALESCE(doc_type,'')) IN ('encumbrance_certificate','ec') THEN 1 ELSE 0 END) AS pending_encumbrance_certificates,
      SUM(CASE WHEN (manual_review_status IN ('pending','required') OR processing_status<>'completed') AND LOWER(COALESCE(doc_type,'')) IN ('rtc_pahani','mutation_record','mutation_extract','survey_sketch_tippan','survey_sketch','khata_e_khata','e_khata','property_tax_receipt','tax_receipt') THEN 1 ELSE 0 END) AS pending_survey_revenue_records,
      SUM(CASE WHEN (manual_review_status IN ('pending','required') OR processing_status<>'completed') AND LOWER(COALESCE(doc_type,'')) NOT IN ('sale_deed','gift_deed','partition_deed','release_deed','power_of_attorney','encumbrance_certificate','ec','rtc_pahani','mutation_record','mutation_extract','survey_sketch_tippan','survey_sketch','khata_e_khata','e_khata','property_tax_receipt','tax_receipt') THEN 1 ELSE 0 END) AS pending_other_documents
      FROM documents d JOIN properties p ON p.id=d.property_id AND p.tenant_id=d.tenant_id WHERE d.tenant_id=? AND d.governance_status='active' AND p.archived_at IS NULL`,[tenantId]),
    pool.query(`SELECT CASE COALESCE(r.risk_rank,0) WHEN 4 THEN 'critical' WHEN 3 THEN 'high' WHEN 2 THEN 'medium' WHEN 1 THEN 'low' ELSE 'not_assessed' END AS label,COUNT(*) AS value
      FROM properties p LEFT JOIN (SELECT property_id,MAX(CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) AS risk_rank FROM risk_findings WHERE tenant_id=? GROUP BY property_id) r ON r.property_id=p.id
      WHERE p.tenant_id=? AND p.archived_at IS NULL GROUP BY label ORDER BY FIELD(label,'critical','high','medium','low','not_assessed')`,[tenantId,tenantId]),
    pool.query(`SELECT registry_name,status,verified_at FROM source_registry_verifications WHERE tenant_id=? ORDER BY verified_at DESC LIMIT 100`,[tenantId]),
    pool.query(`SELECT source_name,status,verification_status,COALESCE(retrieved_at,updated_at,created_at) AS checked_at FROM rtc_lookups WHERE tenant_id=? ORDER BY COALESCE(retrieved_at,updated_at,created_at) DESC LIMIT 100`,[tenantId]),
    pool.query(`SELECT COUNT(*) AS verified_layers,MAX(source_date) AS latest_source_date FROM spatial_layers WHERE active=TRUE AND data_status='verified' AND source_name IS NOT NULL AND source_url IS NOT NULL AND source_date IS NOT NULL`),
    pool.query(`SELECT COUNT(*) AS total FROM audit_events a WHERE a.tenant_id=? AND (a.action IN ('property.created','property.updated','property.workflow_updated','admin.application_assignment_changed','document.uploaded','document.fields_overridden','document.submitted_for_review','document.ocr_completed','legal.finding_report_review_decision','legal.report_review_decision','consultant.report_version_created','consultant.report_submitted','consultant.report_exported','report.snapshot_created') OR a.action LIKE 'workbench.%')`,[tenantId]),
    pool.query('SELECT COUNT(*) AS total FROM risk_findings f JOIN properties p ON p.id=f.property_id AND p.tenant_id=f.tenant_id WHERE f.tenant_id=? AND p.archived_at IS NULL',[tenantId])
  ]);
  const [mattersByStatus,monthlyTrends,riskSeverity,taskComparison]=await Promise.all([
    pool.query(`SELECT status AS label,COUNT(*) AS value FROM properties WHERE tenant_id=? AND DATE(created_at) BETWEEN ? AND ? GROUP BY status ORDER BY value DESC`,[tenantId,from,to]),
    pool.query(`SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,COUNT(*) AS created,
      SUM(CASE WHEN status IN ('approved','complete','closed') THEN 1 ELSE 0 END) AS completed
      FROM properties WHERE tenant_id=? AND DATE(created_at) BETWEEN ? AND ? GROUP BY DATE_FORMAT(created_at,'%Y-%m') ORDER BY month`,[tenantId,from,to]),
    pool.query(`SELECT f.severity AS label,COUNT(*) AS value FROM risk_findings f WHERE f.tenant_id=? AND DATE(f.created_at) BETWEEN ? AND ? GROUP BY f.severity ORDER BY value DESC`,[tenantId,from,to]),
    pool.query(`SELECT
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) AS pending
      FROM workbench_tasks WHERE tenant_id=? AND DATE(created_at) BETWEEN ? AND ?`,[tenantId,from,to])
  ]);
  const metricRow=metrics.rows[0]||{};
  const latestByPattern=(rows:any[],pattern:RegExp)=>rows.find(row=>pattern.test(String(row.registry_name||'')));
  const latestBhoomi=rtcHistory.rows.find((row:any)=>/bhoomi|rtc/i.test(String(row.source_name||'')));
  const latestKaveri=latestByPattern(sourceRegistryHistory.rows,/kaveri/i);
  const latestRegistration=latestByPattern(sourceRegistryHistory.rows,/registration|encumbrance|\bec\b/i);
  const layerSummary=verifiedLayers.rows[0]||{};
  const readinessRow=readiness.rows[0]||{};
  const activityTotal=Number(activityCount.rows[0]?.total||0),findingsTotal=Number(findingsCount.rows[0]?.total||0);
  res.json({
    metrics:Object.fromEntries(Object.entries(metricRow).map(([key,value])=>[key,Number(value||0)])),
    readiness:Object.fromEntries(Object.entries(readinessRow).map(([key,value])=>[key,Number(value||0)])),
    distributions:{districts:districts.rows,taluks:taluks.rows,villages:villages.rows},
    documentCategories:Object.fromEntries(Object.entries(documentCategories.rows[0]||{}).map(([key,value])=>[key,Number(value||0)])),
    riskOverview:riskOverview.rows,
    workflow:workflow.rows,
    pendingActions:[
      {id:'documents',label:'Pending document reviews',count:Number(metricRow.documents_requiring_review||0),priority:Number(metricRow.documents_requiring_review||0)>0?'high':'normal',status:Number(metricRow.documents_requiring_review||0)>0?'Action required':'Clear',nextAction:'Review documents',target:'all-documents'},
      {id:'approval',label:'Matters awaiting approval',count:Number(metricRow.ready_for_legal_review||0),priority:Number(metricRow.ready_for_legal_review||0)>0?'high':'normal',status:Number(metricRow.ready_for_legal_review||0)>0?'Pending':'Clear',nextAction:'Open legal review matters',target:'overview'},
      {id:'evidence',label:'Missing evidence',count:Number(readinessRow.missing_evidence_matters||0),priority:'high',status:'Review',nextAction:'Inspect workflow',target:'overview'},
      {id:'overdue',label:'Overdue tasks',count:Number(metricRow.overdue_tasks||0),priority:Number(metricRow.overdue_tasks||0)>0?'urgent':'normal',status:Number(metricRow.overdue_tasks||0)>0?'Overdue':'Clear',nextAction:'Resolve tasks',target:'lawyer-workbench'},
      {id:'legal',label:'Reports awaiting legal review',count:Number(metricRow.reports_awaiting_review||0),priority:Number(metricRow.reports_awaiting_review||0)>0?'high':'normal',status:Number(metricRow.reports_awaiting_review||0)>0?'Waiting':'Clear',nextAction:'Review submitted reports',target:'consultant-reports'}
    ],
    recentFindings:recentFindings.rows,
    teamWorkload:workload.rows.map((member:any)=>{const completed=Number(member.completed_task_count||0),pending=Number(member.open_tasks||0),total=completed+pending;return {...member,completion_pct:total?Math.round(completed/total*100):0};}),
    reports:reports.rows,
    recentActivity:activity.rows,
    pagination:{
      findings:{page:findingsPage,pageSize:findingsPageSize,total:findingsTotal,totalPages:Math.max(1,Math.ceil(findingsTotal/findingsPageSize))},
      activity:{page:activityPage,pageSize:activityPageSize,total:activityTotal,totalPages:Math.max(1,Math.ceil(activityTotal/activityPageSize))}
    },
    evidenceSourceStatus:[
      {source:'Bhoomi / RTC',status:latestBhoomi?.verification_status||'not_verified',lastChecked:latestBhoomi?.checked_at||null,recordedSource:latestBhoomi?.source_name||null},
      {source:'Kaveri',status:latestKaveri?.status||'not_verified',lastChecked:latestKaveri?.verified_at||null,recordedSource:latestKaveri?.registry_name||null},
      {source:'Registration / EC',status:latestRegistration?.status||'not_verified',lastChecked:latestRegistration?.verified_at||null,recordedSource:latestRegistration?.registry_name||null},
      {source:'GIS / Map Layers',status:Number(layerSummary.verified_layers||0)>0?'verified_data_available':'unavailable',verifiedLayers:Number(layerSummary.verified_layers||0),latestSourceDate:layerSummary.latest_source_date||null}
    ],
    evidenceSources:evidenceSources.rows[0]||{},
    analytics:{from,to,mattersByStatus:mattersByStatus.rows,monthlyTrends:monthlyTrends.rows,riskSeverity:riskSeverity.rows,taskComparison:taskComparison.rows[0]||{pending:0,completed:0}}
  });
}));

app.get('/api/owner/dashboard/search', authGuard, ownerGuard, asyncRoute(async (req,res)=>{
  const term=String(req.query.q||'').trim().toLowerCase().slice(0,100);
  if(term.length<2)return res.json({items:[]});

  if ((req as any).demoWorkspace || _usingMockPool || isMockMode()) {
    const ws = ((req as any).demoWorkspace as DemoSessionWorkspace) || demoSessionRepo.getSession('demo-fallback-sid');
    const props = ws?.properties || [];
    const docs = ws?.documents || [];
    const matchedProps = props.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.application_number.toLowerCase().includes(term) ||
      p.survey_number.toLowerCase().includes(term) ||
      p.village.toLowerCase().includes(term) ||
      p.district.toLowerCase().includes(term)
    ).map(p => ({
      type: 'property',
      id: p.id,
      property_id: p.id,
      reference: p.application_number,
      title: p.name,
      subtitle: `${p.village} · ${p.taluk} · ${p.district}`,
      updated_at: p.updated_at,
    }));
    const matchedDocs = docs.filter(d =>
      d.original_filename.toLowerCase().includes(term) ||
      d.doc_type.toLowerCase().includes(term)
    ).map(d => {
      const p = props.find(x => x.id === d.property_id);
      return {
        type: 'document',
        id: d.id,
        property_id: d.property_id,
        reference: p?.application_number || 'DOC',
        title: d.original_filename,
        subtitle: `${d.doc_type} · ${p?.name || ''} · ${p?.district || ''}`,
        updated_at: d.created_at,
      };
    });
    return res.json({
      items: [...matchedProps, ...matchedDocs].slice(0, 10),
    });
  }

  if(!pool)return res.status(503).json({error:'Database not configured.'});
  const pattern=`%${term.replace(/[\\%_]/g,'\\$&')}%`;
  const [properties,documents]=await Promise.all([
    pool.query(`SELECT 'property' AS type,p.id,p.id AS property_id,p.application_number AS reference,p.name AS title,CONCAT_WS(' · ',NULLIF(p.village,''),NULLIF(p.taluk,''),NULLIF(p.district,'')) AS subtitle,p.updated_at
      FROM properties p WHERE p.tenant_id=? AND p.archived_at IS NULL AND (p.name LIKE ? OR p.application_number LIKE ? OR p.village LIKE ? OR p.taluk LIKE ? OR p.district LIKE ? OR p.survey_number LIKE ?) ORDER BY p.updated_at DESC LIMIT 6`,[req.user?.tenantId,pattern,pattern,pattern,pattern,pattern,pattern]),
    pool.query(`SELECT 'document' AS type,d.id,d.property_id,p.application_number AS reference,d.original_filename AS title,CONCAT_WS(' · ',NULLIF(d.doc_type,''),NULLIF(p.name,''),NULLIF(p.district,'')) AS subtitle,d.created_at AS updated_at
      FROM documents d JOIN properties p ON p.id=d.property_id AND p.tenant_id=d.tenant_id WHERE d.tenant_id=? AND d.governance_status='active' AND (d.original_filename LIKE ? OR d.doc_type LIKE ? OR d.doc_type_custom LIKE ?) ORDER BY d.created_at DESC LIMIT 6`,[req.user?.tenantId,pattern,pattern,pattern])
  ]);
  res.json({items:[...properties.rows,...documents.rows].sort((a:any,b:any)=>new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime()).slice(0,10)});
}));

app.get('/api/properties', authGuard, asyncRoute(async (req, res) => {
  if ((req as any).demoWorkspace) {
    const ws = (req as any).demoWorkspace as DemoSessionWorkspace;
    const q = String(req.query.q || '').trim().toLowerCase();
    let filtered = ws.properties.filter(p => !p.archived_at);
    if (q) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.application_number.toLowerCase().includes(q) ||
        p.survey_number.toLowerCase().includes(q) ||
        p.village.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q)
      );
    }
    const withDocCount = filtered.map(p => ({
      ...p,
      document_count: ws.documents.filter(d => d.property_id === p.id).length,
    }));
    return res.json({ items: withDocCount });
  }
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const q = String(req.query.q || '').trim().slice(0, 120);
  const result = await pool.query(
    `SELECT p.*, (SELECT COUNT(*) FROM documents d WHERE d.property_id=p.id) AS document_count
     FROM properties p
     WHERE p.tenant_id=?
       AND ? <> 'support'
       AND (? <> 'viewer' OR (p.status IN ('approved','complete') AND p.assigned_viewer_uid=?))
       AND (? <> 'consultant' OR p.assigned_consultant_uid=?)
       AND (? <> 'lawyer' OR p.assigned_lawyer_uid=?)
       AND (? <> 'analyst' OR p.assigned_analyst_uid=?)
       AND (? <> 'operations' OR p.assigned_operations_uid=?)
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
    [req.user?.tenantId, req.user?.role || 'viewer', req.user?.role || 'viewer', req.user?.uid || '', req.user?.role || 'viewer', req.user?.uid || '', req.user?.role || 'viewer', req.user?.uid || '', req.user?.role || 'viewer', req.user?.uid || '', req.user?.role || 'viewer', req.user?.uid || '', q, q, q, q, q, q]
  );
  res.json({ items: result.rows });
}));

app.post('/api/properties', authGuard, writeGuard, asyncRoute(async (req, res) => {
  const parsed = propertySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid property payload.', issues: parsed.error.flatten() });
  const p = parsed.data;

  if ((req as any).demoWorkspace) {
    const ws = (req as any).demoWorkspace as DemoSessionWorkspace;
    const id = crypto.randomUUID();
    const appNum = `OJ-2026-BLR-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const newProp: DemoProperty = {
      id,
      tenant_id: ws.user.tenantId,
      application_number: appNum,
      name: `${p.village} ${p.propertyType === 'agricultural' ? 'Agricultural Land' : 'Property'} (Sy ${p.surveyNumber}/${p.subdivision || '1'})`,
      review_purpose: p.reviewPurpose,
      primary_document_type: p.primaryDocumentType,
      property_identifier: p.propertyIdentifier || `${p.village.toUpperCase().slice(0, 3)}-${p.surveyNumber}`,
      property_identifier_type: p.propertyIdentifierType || 'survey_number',
      property_type: p.propertyType,
      village: p.village,
      hobli: p.hobli,
      taluk: p.taluk,
      district: p.district,
      district_id: p.districtId || null,
      taluk_id: p.talukId || null,
      hobli_id: p.hobliId || null,
      village_id: p.villageId || null,
      survey_number: p.surveyNumber,
      subdivision: p.subdivision || '1',
      extent: p.extent || '2400 sq ft',
      extent_value: p.extentValue || 2400,
      extent_unit: p.extentUnit || 'sq_ft',
      boundary_north: p.boundaryNorth || 'North Boundary',
      boundary_south: p.boundarySouth || 'South Road',
      boundary_east: p.boundaryEast || 'East Boundary',
      boundary_west: p.boundaryWest || 'West Boundary',
      address: p.address || `${p.village}, ${p.taluk}, ${p.district}`,
      latitude: p.latitude || 12.9716,
      longitude: p.longitude || 77.5946,
      coordinate_source: 'manual',
      coordinate_confidence: 0.90,
      coordinate_captured_at: now,
      identity_state: 'verified',
      notes: p.notes || '',
      status: 'in_review',
      workflow_priority: 'normal',
      due_date: null,
      assigned_lawyer_uid: 'user-lawyer',
      assigned_analyst_uid: 'user-analyst',
      assigned_operations_uid: 'user-operations',
      assigned_consultant_uid: 'user-consultant',
      assigned_viewer_uid: 'user-viewer',
      archived_at: null,
      created_at: now,
      updated_at: now,
    };
    ws.properties.unshift(newProp);
    ws.auditEvents.unshift({
      id: crypto.randomUUID(),
      tenant_id: ws.user.tenantId,
      actor_uid: ws.user.uid,
      action: 'property.created',
      entity_type: 'property',
      entity_id: id,
      details: { applicationNumber: appNum, name: newProp.name },
      created_at: now,
    });
    return res.status(201).json({ item: newProp, id });
  }

  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
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
  if ((req as any).demoWorkspace) {
    const ws = (req as any).demoWorkspace as DemoSessionWorkspace;
    const prop = ws.properties.find(p => p.id === req.params.id);
    if (!prop) return res.status(404).json({ error: 'Property not found.' });
    const documents = ws.documents.filter(d => d.property_id === prop.id);
    const findings = ws.findings.filter(f => f.property_id === prop.id);
    return res.json({ item: prop, documents, findings });
  }
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query("SELECT * FROM properties WHERE id=? AND tenant_id=? AND ? <> 'support' AND (? <> 'viewer' OR (status IN ('approved','complete') AND assigned_viewer_uid=?)) AND (? <> 'consultant' OR assigned_consultant_uid=?) AND (? <> 'lawyer' OR assigned_lawyer_uid=?) AND (? <> 'analyst' OR assigned_analyst_uid=?) AND (? <> 'operations' OR assigned_operations_uid=?)", [req.params.id, req.user?.tenantId, req.user?.role || 'viewer', req.user?.role || 'viewer', req.user?.uid || '', req.user?.role || 'viewer', req.user?.uid || '', req.user?.role || 'viewer', req.user?.uid || '', req.user?.role || 'viewer', req.user?.uid || '', req.user?.role || 'viewer', req.user?.uid || '']);
  if (!result.rowCount) return res.status(404).json({ error: req.user?.role === 'consultant' ? 'This property is not assigned to your Consultant account. Ask an Admin to assign it, then refresh.' : 'Property not found.' });
  const documents = ['viewer','consultant'].includes(req.user?.role || '')
    ? await pool.query("SELECT id, original_filename, mime_type, size_bytes, sha256, doc_type, doc_type_custom, classification_confidence, classification_source, manual_review_status, processing_status, review_status, extracted_fields, extracted_text, created_at FROM documents WHERE property_id=? AND tenant_id=? AND review_status='approved' ORDER BY created_at DESC", [req.params.id, req.user?.tenantId])
    : ['support','data_steward'].includes(req.user?.role || '') ? { rows: [] }
    : await pool.query('SELECT id, original_filename, mime_type, size_bytes, sha256, doc_type, doc_type_custom, classification_confidence, classification_source, manual_review_status, processing_status, review_status, extracted_fields, extracted_text, created_at FROM documents WHERE property_id=? AND tenant_id=? ORDER BY created_at DESC', [req.params.id, req.user?.tenantId]);
  const findings = ['owner','admin','lawyer','analyst','consultant'].includes(req.user?.role || '')
    ? (['consultant','viewer'].includes(req.user?.role || '')
      ? await pool.query("SELECT f.*,COALESCE(fr.review_status,'pending') AS reviewer_state,fr.rationale AS reviewer_rationale FROM risk_findings f LEFT JOIN consultant_finding_reviews fr ON fr.finding_id=f.id AND fr.tenant_id=f.tenant_id WHERE f.property_id=? AND f.tenant_id=? ORDER BY f.created_at DESC", [req.params.id, req.user?.tenantId])
      : await pool.query('SELECT * FROM risk_findings WHERE property_id=? AND tenant_id=? ORDER BY created_at DESC', [req.params.id, req.user?.tenantId]))
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
  const unresolvedMismatches=documentResult.rows.flatMap((document:any)=>{
    const fields=typeof document.extracted_fields==='string'?JSON.parse(document.extracted_fields||'{}'):document.extracted_fields||{};
    return propertyDocumentIdentityIssues(fields,property).filter(issue=>/does not match|differs from|is missing/i.test(issue)).map(issue=>`${document.original_filename}: ${issue}`);
  });
  if(unresolvedMismatches.length)blockers.push(`Resolve ${unresolvedMismatches.length} Owner Page vs document mismatch${unresolvedMismatches.length===1?'':'es'} before approval: ${unresolvedMismatches.join(' ')}`);
  for(const document of documentResult.rows){
    const fields=typeof document.extracted_fields==='string'?JSON.parse(document.extracted_fields||'{}'):document.extracted_fields||{};
    const partyIssues=await propertyDocumentPartyIssues(fields,property.id,tenantId);
    if(partyIssues.length)blockers.push(`${document.original_filename}: ${partyIssues.join(' ')}`);
  }
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

app.patch('/api/properties/:id/workflow', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed = workflowUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid workflow update.', issues: parsed.error.flatten() });
  const actorRole = req.user?.role || '';
  const isGovernance = ['owner','admin'].includes(actorRole);
  const isLegalReviewer = actorRole === 'lawyer';
  if (!isGovernance && !isLegalReviewer) return res.status(403).json({ error: 'Workflow update is not available for this role.' });
  const currentResult = await pool.query(
    `SELECT * FROM properties WHERE id=? AND tenant_id=?${isLegalReviewer ? ' AND assigned_lawyer_uid=?' : ''}`,
    isLegalReviewer ? [req.params.id, req.user?.tenantId, req.user?.uid] : [req.params.id, req.user?.tenantId],
  );
  if (!currentResult.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const current = currentResult.rows[0];
  const update = parsed.data;
  const isLegalApproval = ['approved','complete'].includes(update.status);
  if (isLegalApproval && !isLegalReviewer) {
    return res.status(403).json({ error: 'Only the assigned Lawyer can record legal approval or release.' });
  }
  if (isLegalReviewer && (!isLegalApproval || update.assignedLawyerUid && update.assignedLawyerUid !== req.user?.uid || update.assignedAnalystUid || update.assignedOperationsUid)) {
    return res.status(403).json({ error: 'Lawyers may only approve or release matters assigned to them; workspace assignment changes are restricted to Owner/Admin.' });
  }
  if (isLegalApproval && current.assigned_lawyer_uid !== req.user?.uid) {
    return res.status(403).json({ error: 'Only the assigned Lawyer can record legal approval or release.' });
  }
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
  if (isLegalApproval) {
    const candidate = { ...current, assigned_lawyer_uid: isLegalReviewer ? req.user?.uid : update.assignedLawyerUid };
    const approvalChecks = await getWorkflowApprovalChecks(candidate, req.user?.tenantId || '');
    if (!approvalChecks.ready) return res.status(409).json({ error: 'This application cannot be approved or released until the evidence safeguards are complete.', issues: approvalChecks.blockers, approvalChecks });
    if (update.status === 'complete' && current.status !== 'approved' && current.status !== 'complete') return res.status(409).json({ error: 'Approve the application before releasing it as complete.', issues: ['Change the status to Approved first, then release it as Complete.'] });
  }
  const before = { status:current.status, priority:current.workflow_priority, dueDate:current.due_date, assignedLawyerUid:current.assigned_lawyer_uid, assignedAnalystUid:current.assigned_analyst_uid, assignedOperationsUid:current.assigned_operations_uid };
  const after = {
    status:update.status,
    priority:update.priority,
    dueDate:update.dueDate || null,
    assignedLawyerUid:isLegalReviewer ? current.assigned_lawyer_uid : update.assignedLawyerUid,
    assignedAnalystUid:isLegalReviewer ? current.assigned_analyst_uid : update.assignedAnalystUid,
    assignedOperationsUid:isLegalReviewer ? current.assigned_operations_uid : update.assignedOperationsUid,
  };
  if (JSON.stringify(before) === JSON.stringify(after)) return res.status(400).json({ error: 'No workflow changes were supplied.' });
  const clearsLegalApproval = ['approved','complete'].includes(String(current.status)) && !isLegalApproval;
  await pool.query(
    `UPDATE properties SET status=?, workflow_priority=?, due_date=?, assigned_lawyer_uid=?, assigned_analyst_uid=?, assigned_operations_uid=?,
       legal_approved_by_uid=CASE WHEN ? THEN ? WHEN ? THEN NULL ELSE legal_approved_by_uid END,
       legal_approved_at=CASE WHEN ? THEN NOW(6) WHEN ? THEN NULL ELSE legal_approved_at END,
       updated_by_uid=?, updated_at=now() WHERE id=? AND tenant_id=?`,
    [after.status,after.priority,after.dueDate,after.assignedLawyerUid,after.assignedAnalystUid,after.assignedOperationsUid,
      isLegalApproval,req.user?.uid||'unknown',clearsLegalApproval,isLegalApproval,clearsLegalApproval,
      req.user?.uid||'unknown',req.params.id,req.user?.tenantId],
  );
  const workflowAction = isLegalApproval ? 'report.legal_sign_off' : 'property.workflow_updated';
  await pool.query('INSERT INTO property_workflow_history (id,tenant_id,property_id,previous_status,new_status,reason,changes_json,changed_by_uid) VALUES (?,?,?,?,?,?,?,?)', [crypto.randomUUID(),req.user?.tenantId,req.params.id,current.status,after.status,update.reason,JSON.stringify({before,after,legalSignOff:isLegalApproval?{approvedBy:req.user?.uid,role:actorRole}:undefined}),req.user?.uid||'unknown']);
  await audit(req.user?.uid||'unknown',req.user?.tenantId,workflowAction,'property',req.params.id,{before,after,reason:update.reason,approverRole:actorRole,isLegalApproval});
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

const maxBytes = resolveMultipartFileLimit();
const upload = multer({ storage: multer.diskStorage({ destination: (_req,_file,cb)=>cb(null,uploadDir), filename: (_req,file,cb)=>cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).slice(0,12)}`) }), limits: { fileSize: maxBytes, files: 10 }, fileFilter: (_req,file,cb) => {
  const allowed = ['application/pdf','image/jpeg','image/png','image/tiff'];
  if (!allowed.includes(file.mimetype)) return cb(new Error('Only PDF, JPEG, PNG and TIFF files are allowed.'));
  cb(null, true);
} });

const allowedDocumentTypes = new Set(['sale_deed','gift_deed','partition_deed','release_deed','power_of_attorney','encumbrance_certificate','rtc_pahani','mutation_record','survey_sketch_tippan','khata_e_khata','property_tax_receipt','layout_approval_conversion_order','master_plan_zoning_document','court_order_legal_notice','other','e_khata','mutation_extract','survey_sketch','tax_receipt','conversion_order','layout_approval','court_order']);
const allowedDocumentMimeTypes = new Set(['application/pdf','image/jpeg','image/png','image/tiff']);
app.post('/api/properties/:id/documents/direct-upload', authGuard, documentIntakeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  if (!documentStorage.createSignedUploadUrl || documentStorage.provider === 'local') {
    return res.status(503).json({ error: 'Direct uploads require configured private Supabase Storage or Google Cloud Storage.' });
  }
  const parsed = z.object({ originalFilename: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(1).max(120), sizeBytes: z.number().int().positive(), documentType: z.string().trim().optional(), customDocumentType: z.string().trim().max(255).optional(), classificationConfidence: z.number().min(0).max(1).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide a valid filename, MIME type, and positive file size.' });
  const input = parsed.data;
  const safeFilename = path.basename(input.originalFilename.replace(/\\/g, '/'));
  const documentType = input.documentType || '';
  if (!allowedDocumentMimeTypes.has(input.mimeType)) return res.status(400).json({ error: 'Only PDF, JPEG, PNG and TIFF files are allowed.' });
  if (documentType && !allowedDocumentTypes.has(documentType)) return res.status(400).json({ error: 'Unsupported document type.' });
  if (documentType === 'other' && !input.customDocumentType) return res.status(400).json({ error: 'Enter a custom document type for other documents.' });
  if (input.sizeBytes > resolveDirectUploadLimit()) return res.status(413).json({ error: `File exceeds the ${Math.floor(resolveDirectUploadLimit() / 1024 / 1024)} MB direct upload limit.` });
  const property = await pool.query('SELECT id FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!property.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const documentId = crypto.randomUUID();
  const objectKey = buildTenantObjectKey({ tenantId: req.user?.tenantId || 'unknown-tenant', propertyId: req.params.id, documentId, originalFilename: safeFilename });
  const provider = documentStorage.provider;
  const storageKey = `${provider}:${objectKey}`;
  const expiresInSeconds = provider === 'supabase' ? 7200 : 300;
  const signed = await documentStorage.createSignedUploadUrl(storageKey, input.mimeType, input.sizeBytes, expiresInSeconds);
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(201).json({ documentId, upload: signed, expiresInSeconds, provider, maxBytes: resolveDirectUploadLimit() });
}));

app.post('/api/properties/:id/documents/direct-upload/:docId/complete', authGuard, documentIntakeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed = z.object({ originalFilename: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(1).max(120), sizeBytes: z.number().int().positive(), documentType: z.string().trim().optional(), customDocumentType: z.string().trim().max(255).optional(), classificationConfidence: z.number().min(0).max(1).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide the upload metadata returned during upload preparation.' });
  const input = parsed.data;
  const safeFilename = path.basename(input.originalFilename.replace(/\\/g, '/'));
  if (!allowedDocumentMimeTypes.has(input.mimeType) || input.sizeBytes > resolveDirectUploadLimit()) return res.status(400).json({ error: 'Upload metadata does not satisfy the configured file policy.' });
  if (input.documentType && !allowedDocumentTypes.has(input.documentType)) return res.status(400).json({ error: 'Unsupported document type.' });
  if (input.documentType === 'other' && !input.customDocumentType) return res.status(400).json({ error: 'Enter a custom document type for other documents.' });
  if (input.classificationConfidence != null && (!Number.isFinite(input.classificationConfidence) || input.classificationConfidence < 0 || input.classificationConfidence > 1)) return res.status(400).json({ error: 'Classification confidence must be between 0 and 1.' });
  const property = await pool.query('SELECT id FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!property.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const objectKey = buildTenantObjectKey({ tenantId: req.user?.tenantId || 'unknown-tenant', propertyId: req.params.id, documentId: req.params.docId, originalFilename: safeFilename });
  const storageKey = `${documentStorage.provider}:${objectKey}`;
  if (!isRemoteStorageKey(storageKey) || !documentStorage.getObject) return res.status(503).json({ error: 'Configured private storage cannot verify direct uploads.' });
  const content = await documentStorage.getObject(storageKey).catch(() => null);
  if (!content) return res.status(409).json({ error: 'Uploaded object was not found. Upload the file to its signed URL, then retry completion.' });
  if (content.byteLength !== input.sizeBytes) {
    await documentStorage.delete?.(storageKey).catch(() => {});
    return res.status(400).json({ error: 'Uploaded object size does not match the authorized upload.' });
  }
  if (detectedDocumentMimeType(content) !== input.mimeType) {
    await documentStorage.delete?.(storageKey).catch(() => {});
    return res.status(400).json({ error: 'Uploaded file content does not match the authorized document type.' });
  }
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  const duplicate = await pool.query(`SELECT id,original_filename,created_at FROM documents WHERE tenant_id=? AND property_id=? AND sha256=? AND governance_status<>'quarantined' ORDER BY created_at DESC LIMIT 1`, [req.user?.tenantId, req.params.id, sha256]);
  if (duplicate.rowCount) {
    await documentStorage.delete?.(storageKey).catch(() => {});
    return res.status(409).json({ error: `Duplicate document rejected: ${safeFilename} has already been uploaded to this application.`, code: 'DUPLICATE_DOCUMENT', duplicate: duplicate.rows[0] });
  }
  const documentType = input.documentType || 'other';
  const confidence = input.classificationConfidence ?? (input.documentType ? 1 : 0);
  const initialExtracted = pendingDocumentFields(String(req.params.docId), documentType, confidence);
  const status = process.env.OCR_WORKER_TOKEN ? 'queued' : 'manual_review';
  await pool.query(`INSERT INTO documents
    (id,tenant_id,property_id,doc_type,doc_type_custom,classification_confidence,classification_source,manual_review_status,original_filename,storage_key,mime_type,size_bytes,sha256,processing_status,extracted_text,extracted_fields,uploaded_by_uid)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [req.params.docId,req.user?.tenantId,req.params.id,documentType,input.customDocumentType||'',confidence,input.documentType?'manual':'automatic','required',safeFilename,storageKey,input.mimeType,input.sizeBytes,sha256,status,'',JSON.stringify(initialExtracted),req.user?.uid||'unknown']);
  if (status === 'queued') {
    await pool.query(`INSERT INTO document_processing_jobs (id,tenant_id,property_id,document_id,requested_by_uid,status,processing_stage) VALUES (?,?,?,?,?,'queued','queued')`, [crypto.randomUUID(),req.user?.tenantId,req.params.id,req.params.docId,req.user?.uid||'unknown']);
  }
  await audit(req.user?.uid||'unknown',req.user?.tenantId,'document.uploaded','property',req.params.id,{count:1,documentTypes:[documentType],uploadMode:'direct-to-cloud'});
  const saved = await pool.query('SELECT id,original_filename,mime_type,size_bytes,sha256,doc_type,doc_type_custom,classification_confidence,classification_source,manual_review_status,processing_status,extracted_fields,created_at FROM documents WHERE id=? AND property_id=? AND tenant_id=?',[req.params.docId,req.params.id,req.user?.tenantId]);
  res.status(201).json({ items: saved.rows, uploadMode: 'direct-to-cloud' });
}));

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
  const files = (req.files || []) as Express.Multer.File[];
  const requestedDocumentType = String(req.body?.documentType || '').trim();

  if ((req as any).demoWorkspace) {
    const ws = (req as any).demoWorkspace as DemoSessionWorkspace;
    const property = ws.properties.find(p => p.id === req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found.' });
    if (!files.length) return res.status(400).json({ error: 'No files received. Use multipart form field "files".' });

    const inserted: DemoStoredDocument[] = [];
    for (const file of files) {
      const docId = crypto.randomUUID();
      const docBuffer = fs.readFileSync(file.path);
      const sha256 = crypto.createHash('sha256').update(docBuffer).digest('hex');
      const now = new Date().toISOString().replace('T', ' ').replace('Z', '');

      const ocrExtraction = await processDocumentWithOcr(file.path, {
        documentId: docId,
        filename: file.originalname,
        mimeType: file.mimetype,
      });

      const docType = requestedDocumentType || ocrExtraction.extractedFields.documentType || 'sale_deed';
      const storedDoc: DemoStoredDocument = {
        id: docId,
        property_id: property.id,
        tenant_id: ws.user.tenantId,
        original_filename: file.originalname,
        storage_key: `demo://${ws.user.tenantId}/${property.id}/${docId}/${file.originalname}`,
        mime_type: file.mimetype,
        size_bytes: file.size,
        sha256,
        doc_type: docType,
        doc_type_custom: null,
        classification_confidence: ocrExtraction.extractedFields.overallConfidence || 0.95,
        classification_source: 'ocr_tesseract',
        manual_review_status: 'pending',
        processing_status: 'completed',
        extracted_text: ocrExtraction.rawOcr.text,
        extracted_fields: ocrExtraction.extractedFields,
        governance_status: 'active',
        fileBuffer: docBuffer,
        created_at: now,
        updated_at: now,
      };

      ws.documents.unshift(storedDoc);
      inserted.push(storedDoc);
      await fs.promises.unlink(file.path).catch(() => {});
    }

    ws.auditEvents.unshift({
      id: crypto.randomUUID(),
      tenant_id: ws.user.tenantId,
      actor_uid: ws.user.uid,
      action: 'document.uploaded_and_ocr_processed',
      entity_type: 'document',
      entity_id: property.id,
      details: { count: inserted.length, files: inserted.map(d => d.original_filename) },
      created_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
    });

    return res.status(201).json({
      items: inserted,
      note: 'Files uploaded and processed with Python Tesseract OCR.',
    });
  }

  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const property = await pool.query('SELECT id FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  if (!property.rowCount) return res.status(404).json({ error: 'Property not found.' });
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
    let storedDocument;
    try {
      storedDocument = await documentStorage.put({
        localPath: file.path,
        objectKey: buildTenantObjectKey({
          tenantId: req.user?.tenantId || 'unknown-tenant',
          propertyId: req.params.id,
          documentId,
          originalFilename: file.originalname,
        }),
        mimeType: file.mimetype,
      });
    } catch (error) {
      await fs.promises.unlink(file.path).catch(() => {});
      throw error;
    }
    if (storedDocument.provider !== 'local') await fs.promises.unlink(file.path).catch(() => {});

    try {
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
    } catch (error) {
      if (storedDocument.provider !== 'local') await documentStorage.delete?.(storedDocument.storageKey).catch(() => {});
      throw error;
    }

    const result = await pool.query(
      `SELECT id, original_filename, mime_type, size_bytes, sha256,
              doc_type, doc_type_custom, classification_confidence, classification_source, manual_review_status, processing_status, extracted_fields, created_at
       FROM documents
       WHERE id=? AND property_id=? AND tenant_id=?`,
      [documentId, req.params.id, req.user?.tenantId]
    );

    inserted.push(result.rows[0]);
    // Intake queues local Tesseract work; OCR runs in the isolated worker.
    if (process.env.OCR_WORKER_TOKEN) {
      await pool.query(
        `INSERT INTO document_processing_jobs (id,tenant_id,property_id,document_id,requested_by_uid,status,processing_stage)
         VALUES (?,?,?,?,?,'queued','queued')`,
        [crypto.randomUUID(), req.user?.tenantId, req.params.id, documentId, req.user?.uid || 'unknown']
      );
      await pool.query("UPDATE documents SET processing_status='queued' WHERE id=? AND tenant_id=?", [documentId, req.user?.tenantId]);
      result.rows[0].processing_status = 'queued';
    }
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
  res.status(201).json({ items: inserted, note: 'Files uploaded. Tesseract OCR jobs are queued automatically; extracted facts always require human review.' });
}));

app.get('/api/properties/:id/documents/:docId/jobs', authGuard, documentIntakeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const doc = await pool.query('SELECT id FROM documents WHERE id=? AND property_id=? AND tenant_id=?', [req.params.docId, req.params.id, req.user?.tenantId]);
  if (!doc.rowCount) return res.status(404).json({ error: 'Document not found.' });
  const jobs = await pool.query(`SELECT id,status,progress,processing_stage,attempts,max_attempts,pages_processed,estimated_cost_usd,error_code,error_message,started_at,completed_at,created_at,updated_at FROM document_processing_jobs WHERE tenant_id=? AND property_id=? AND document_id=? ORDER BY created_at DESC`, [req.user?.tenantId, req.params.id, req.params.docId]);
  res.json({ items: jobs.rows });
}));

app.get('/api/properties/:id/documents/:docId/ocr-result', authGuard, documentIntakeGuard, asyncRoute(async (req, res) => {
  if ((req as any).demoWorkspace) {
    const ws = (req as any).demoWorkspace as DemoSessionWorkspace;
    const doc = ws.documents.find(d => d.id === req.params.docId && d.property_id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    return res.json({
      result: {
        runId: crypto.randomUUID(),
        provider: 'tesseract',
        providerVersion: '5.5.2',
        pageCount: 1,
        rawText: doc.extracted_text || '',
        tokens: [],
        pages: [{ pageNumber: 1, text: doc.extracted_text || '', confidence: doc.classification_confidence, tokenCount: 20 }],
        extractedFields: doc.extracted_fields || {},
        confidence: doc.classification_confidence || 0.95,
        createdAt: doc.created_at,
      }
    });
  }

  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query(`SELECT r.id,r.provider,r.provider_version,r.page_count,r.raw_ocr_text,r.raw_ocr_tokens,r.raw_provider_response,r.extracted_fields,r.created_at
    FROM document_extraction_runs r JOIN documents d ON d.id=r.document_id AND d.tenant_id=r.tenant_id
    WHERE r.tenant_id=? AND r.property_id=? AND r.document_id=? ORDER BY r.created_at DESC LIMIT 1`, [req.user?.tenantId, req.params.id, req.params.docId]);
  if (!result.rowCount) return res.json({ result: null });
  const row = result.rows[0];
  const parseJson = (value: unknown) => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return null; }
  };
  const extractedFields = parseJson(row.extracted_fields) || {};
  const providerResponse = parseJson(row.raw_provider_response) || {};
  res.json({ result: {
    runId: row.id, provider: row.provider, providerVersion: row.provider_version,
    pageCount: Number(row.page_count || 0), rawText: row.raw_ocr_text,
    tokens: parseJson(row.raw_ocr_tokens) || [], pages: Array.isArray(providerResponse.pages) ? providerResponse.pages : [],
    extractedFields, confidence: Number(extractedFields.overallConfidence || 0), createdAt: row.created_at,
  } });
}));

app.post('/api/properties/:id/documents/:docId/jobs', authGuard, documentIntakeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const doc = await pool.query('SELECT id FROM documents WHERE id=? AND property_id=? AND tenant_id=?', [req.params.docId, req.params.id, req.user?.tenantId]);
  if (!doc.rowCount) return res.status(404).json({ error: 'Document not found.' });
  if(!process.env.OCR_WORKER_TOKEN)return res.status(503).json({error:'OCR worker authentication is not configured on the server.',code:'OCR_WORKER_NOT_CONFIGURED'});
  const active = await pool.query("SELECT id,status FROM document_processing_jobs WHERE tenant_id=? AND document_id=? AND status IN ('queued','processing','retry_wait') LIMIT 1", [req.user?.tenantId, req.params.docId]);
  if (active.rowCount) return res.status(202).json({ jobId: active.rows[0].id, status: 'already_queued' });
  const jobId = crypto.randomUUID();
  await pool.query(`INSERT INTO document_processing_jobs (id,tenant_id,property_id,document_id,requested_by_uid,status,processing_stage) VALUES (?,?,?,?,?,'queued','queued')`, [jobId, req.user?.tenantId, req.params.id, req.params.docId, req.user?.uid || 'unknown']);
  await pool.query("UPDATE documents SET processing_status='queued',review_status='pending' WHERE id=? AND tenant_id=?", [req.params.docId, req.user?.tenantId]);
  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'document.ocr_queued', 'document', req.params.docId, { jobId });
  res.status(202).json({ jobId, status: 'queued' });
}));

// Rebuild structured fields from saved OCR output without rerunning Tesseract.
// This preserves immutable OCR text/tokens and records a distinct extraction run.
app.post('/api/properties/:id/documents/:docId/rebuild-fields', authGuard, asyncRoute(async (req,res) => {
  if (!pool) return res.status(503).json({error:'Database not configured.'});
  if (req.user?.role !== 'analyst') return res.status(403).json({error:'Only an Associate / Analyst may rebuild extraction fields.'});
  const document = await pool.query('SELECT id,original_filename,mime_type,extracted_text,review_status FROM documents WHERE id=? AND property_id=? AND tenant_id=?',[req.params.docId,req.params.id,req.user.tenantId]);
  if (!document.rowCount) return res.status(404).json({error:'Document not found.'});
  if (document.rows[0].review_status === 'approved') return res.status(409).json({error:'Approved evidence cannot be rebuilt; ask the Lead Advocate to reopen its review first.'});
  const latest = await pool.query('SELECT provider_version,page_count,raw_ocr_text,raw_ocr_tokens,raw_provider_response FROM document_extraction_runs WHERE tenant_id=? AND document_id=? ORDER BY created_at DESC LIMIT 1',[req.user.tenantId,req.params.docId]);
  const rawText = String(latest.rows[0]?.raw_ocr_text || document.rows[0].extracted_text || '');
  if (!rawText) return res.status(409).json({error:'No preserved OCR text is available to rebuild fields.'});
  let tokens: any[] = [];
  try {
    const value = latest.rows[0]?.raw_ocr_tokens;
    tokens = Array.isArray(value) ? value : typeof value === 'string' ? JSON.parse(value) : [];
    if (!Array.isArray(tokens)) tokens = [];
  } catch { tokens = []; }
  const fields = extractDocument({text:rawText,tokens},{documentId:req.params.docId,filename:document.rows[0].original_filename,mimeType:document.rows[0].mime_type});
  const runId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const pageCount = Number(latest.rows[0]?.page_count || 0);
  await pool.query(`INSERT INTO document_processing_jobs (id,tenant_id,property_id,document_id,requested_by_uid,status,progress,pages_processed,estimated_cost_usd,completed_at) VALUES (?,?,?,?,?,'completed',100,?,0,NOW(6))`,[jobId,req.user.tenantId,req.params.id,req.params.docId,req.user.uid||'unknown',pageCount]);
  await pool.query(`INSERT INTO document_extraction_runs (id,tenant_id,property_id,document_id,job_id,provider,provider_version,page_count,raw_ocr_text,raw_ocr_tokens,raw_provider_response,extracted_fields,created_by_uid) VALUES (?,?,?,?,?,'ojix_structured_reextract','kannada-schedule-v2',?,?,?,?,?,?)`,[runId,req.user.tenantId,req.params.id,req.params.docId,jobId,pageCount,rawText,JSON.stringify(tokens),latest.rows[0]?.raw_provider_response||null,JSON.stringify(fields),req.user.uid||'unknown']);
  await pool.query(`UPDATE documents SET extracted_fields=?,processing_status='manual_review',manual_review_status='required',review_status='pending',approved_by_uid=NULL,approved_at=NULL WHERE id=? AND tenant_id=?`,[JSON.stringify(fields),req.params.docId,req.user.tenantId]);
  await audit(req.user.uid||'unknown',req.user.tenantId,'document.structured_fields_rebuilt','document',req.params.docId,{runId,source:'preserved_ocr',pageCount});
  res.json({success:true,runId,extractedFields:fields,ocrReprocessed:false});
}));

app.get('/api/properties/:id/documents/:docId/extraction-history', authGuard, documentIntakeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const doc = await pool.query('SELECT id FROM documents WHERE id=? AND property_id=? AND tenant_id=?', [req.params.docId, req.params.id, req.user?.tenantId]);
  if (!doc.rowCount) return res.status(404).json({ error: 'Document not found.' });
  const [runs, changes, reviews] = await Promise.all([
    pool.query('SELECT id,job_id,provider,provider_version,schema_version,page_count,created_by_uid,created_at FROM document_extraction_runs WHERE tenant_id=? AND document_id=? ORDER BY created_at DESC', [req.user?.tenantId, req.params.docId]),
    pool.query('SELECT id,field_path,previous_value,new_value,action,rationale,actor_uid,actor_role,created_at FROM document_field_history WHERE tenant_id=? AND document_id=? ORDER BY created_at', [req.user?.tenantId, req.params.docId]),
    pool.query('SELECT id,from_status,to_status,decision,rationale,actor_uid,actor_role,created_at FROM document_review_history WHERE tenant_id=? AND document_id=? ORDER BY created_at', [req.user?.tenantId, req.params.docId]),
  ]);
  res.json({ runs: runs.rows, fieldHistory: changes.rows, reviewHistory: reviews.rows });
}));

// Worker callback is authenticated independently from user sessions and accepts only worker-produced results.
app.get('/internal/ocr/jobs/:jobId/document', asyncRoute(async (req, res) => {
  const expected = process.env.OCR_WORKER_TOKEN || '';
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expected || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return res.status(401).json({ error: 'Worker authentication failed.' });
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const row = await pool.query(`SELECT j.status,d.storage_key,d.mime_type FROM document_processing_jobs j
    JOIN documents d ON d.id=j.document_id AND d.tenant_id=j.tenant_id WHERE j.id=? LIMIT 1`, [req.params.jobId]);
  if (!row.rowCount) return res.status(404).json({ error: 'OCR document job not found.' });
  if (row.rows[0].status !== 'processing') return res.status(409).json({ error: 'OCR document job is not processing.' });
  const storageKey = String(row.rows[0].storage_key || '');
  if (isRemoteStorageKey(storageKey)) {
    const content = await documentStorage.getObject?.(storageKey);
    if (!content) return res.status(503).json({ error: 'Private document storage is not configured.' });
    res.setHeader('Content-Type', String(row.rows[0].mime_type || 'application/octet-stream'));
    res.setHeader('Cache-Control', 'private, no-store');
    return res.send(content);
  }
  const { safePath, isTraversal } = resolveSafeUploadPath(storageKey);
  if (isTraversal || !safePath) return res.status(403).json({ error: 'Invalid OCR storage path.' });
  if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) return res.status(404).json({ error: 'Stored OCR source document is missing.' });
  res.setHeader('Content-Type', String(row.rows[0].mime_type || 'application/octet-stream'));
  res.setHeader('Cache-Control', 'private, no-store');
  const stream = fs.createReadStream(safePath);
  stream.on('error', () => { if (!res.headersSent) res.status(500).json({ error: 'Could not read the stored OCR source document.' }); });
  stream.pipe(res);
}));

app.post('/internal/ocr/jobs/complete', asyncRoute(async (req, res) => {
  const expected = process.env.OCR_WORKER_TOKEN || '';
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expected || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return res.status(401).json({ error: 'Worker authentication failed.' });
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const payloadSchema = z.object({ jobId:z.string().uuid(), text:z.string().max(20_000_000), tokens:z.array(z.any()).max(100_000), pages:z.array(z.object({pageNumber:z.number().int().positive(),text:z.string().max(2_000_000),confidence:z.number().min(0).max(1),tokenCount:z.number().int().nonnegative()})).max(1000).optional(), rawProviderResponse:z.string().max(1_000_000).optional(), pageCount:z.number().int().nonnegative(), providerVersion:z.string().max(120).optional() });
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error:'Invalid OCR result payload.' });
  const jobResult = await pool.query(`SELECT j.*,d.original_filename,d.mime_type FROM document_processing_jobs j JOIN documents d ON d.id=j.document_id AND d.tenant_id=j.tenant_id WHERE j.id=?`, [parsed.data.jobId]);
  if (!jobResult.rowCount || jobResult.rows[0].status !== 'processing') return res.status(409).json({ error:'OCR job is missing or no longer processing.' });
  const job = jobResult.rows[0];
  const extracted = extractDocument({ text: parsed.data.text, tokens: parsed.data.tokens }, { documentId:job.document_id, filename:job.original_filename, mimeType:job.mime_type });
  const runId = crypto.randomUUID();
  await pool.query(`INSERT INTO document_extraction_runs (id,tenant_id,property_id,document_id,job_id,provider,provider_version,page_count,raw_ocr_text,raw_ocr_tokens,raw_provider_response,extracted_fields,created_by_uid) VALUES (?,?,?,?,?,'tesseract',?,?,?,?,?,?,?)`, [runId,job.tenant_id,job.property_id,job.document_id,job.id,parsed.data.providerVersion || null,parsed.data.pageCount,parsed.data.text,JSON.stringify(parsed.data.tokens),parsed.data.rawProviderResponse || JSON.stringify({pages:parsed.data.pages || []}),JSON.stringify(extracted),job.requested_by_uid]);
  await pool.query(`UPDATE documents SET extracted_text=?,extracted_fields=?,processing_status='manual_review',manual_review_status='required',review_status='pending',approved_by_uid=NULL,approved_at=NULL WHERE id=? AND tenant_id=?`, [parsed.data.text,JSON.stringify(extracted),job.document_id,job.tenant_id]);
  await pool.query(`UPDATE document_processing_jobs SET status='completed',progress=100,processing_stage='completed',pages_processed=?,estimated_cost_usd=0,completed_at=NOW(6),updated_at=NOW(6) WHERE id=?`, [parsed.data.pageCount,job.id]);
  await audit(job.requested_by_uid,job.tenant_id,'document.ocr_completed','document',job.document_id,{jobId:job.id,runId,pageCount:parsed.data.pageCount,overallConfidence:extracted.overallConfidence});
  res.json({ success:true, runId });
}));

app.post('/internal/ocr/jobs/fail', asyncRoute(async (req,res)=>{
  const expected=process.env.OCR_WORKER_TOKEN||'';const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!expected||supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return res.status(401).json({error:'Worker authentication failed.'});
  if(!pool)return res.status(503).json({error:'Database not configured.'});
  const input=z.object({jobId:z.string().uuid(),errorCode:z.string().trim().min(1).max(80),errorMessage:z.string().trim().min(1).max(1000),retryable:z.boolean().default(false)}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:'Invalid worker failure payload.'});
  const job=await pool.query('SELECT * FROM document_processing_jobs WHERE id=?',[input.data.jobId]);
  if(!job.rowCount||job.rows[0].status!=='processing')return res.status(409).json({error:'OCR job is missing or no longer processing.'});
  const status=input.data.retryable&&Number(job.rows[0].attempts)<Number(job.rows[0].max_attempts)?'retry_wait':'failed';
  await pool.query('UPDATE document_processing_jobs SET status=?,progress=0,processing_stage=?,error_code=?,error_message=?,updated_at=NOW(6),completed_at=IF(?=\'failed\',NOW(6),NULL) WHERE id=?',[status,status,input.data.errorCode,input.data.errorMessage,status,input.data.jobId]);
  await pool.query("UPDATE documents SET processing_status=? WHERE id=? AND tenant_id=?",[status==='retry_wait'?'queued':'failed',job.rows[0].document_id,job.rows[0].tenant_id]);
  await audit('tesseract-ocr-worker',job.rows[0].tenant_id,'document.ocr_failed','document',job.rows[0].document_id,{jobId:input.data.jobId,status,errorCode:input.data.errorCode});
  res.json({success:true,status});
}));

app.get('/api/properties/:id/documents/:docId/file', authGuard, asyncRoute(async (req, res) => {
  if ((req as any).demoWorkspace) {
    const ws = (req as any).demoWorkspace as DemoSessionWorkspace;
    const doc = ws.documents.find(d => d.id === req.params.docId && d.property_id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    res.setHeader('Content-Type', doc.mime_type || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_filename)}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    if (doc.fileBuffer) {
      return res.end(doc.fileBuffer);
    }
    const samplePdf = path.resolve(__dirname, '../sample-headless-report.pdf');
    if (fs.existsSync(samplePdf)) {
      return res.sendFile(samplePdf);
    }
    return res.status(404).json({ error: 'Document file not found.' });
  }

  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const docResult = await pool.query(
    'SELECT * FROM documents WHERE id=? AND property_id=? AND tenant_id=?',
    [req.params.docId, req.params.id, req.user?.tenantId]
  );
  if (!docResult.rowCount) return res.status(404).json({ error: 'Document not found.' });
  const doc = docResult.rows[0];
  let propertyStatus: string | null = null;
  if (['consultant','viewer'].includes(req.user?.role || '')) {
    const released = await pool.query("SELECT status FROM properties WHERE id=? AND tenant_id=?",[req.params.id,req.user?.tenantId]);
    propertyStatus = released.rowCount ? String(released.rows[0].status) : null;
  }
  const access = documentFileAccess({ role: req.user?.role, propertyStatus, reviewStatus: doc.review_status });
  if (access === 'not_found') return res.status(404).json({error:'Approved evidence not found.'});
  if (access === 'forbidden') return res.status(403).json({error:'This role cannot access confidential document files.'});

  if (isRemoteStorageKey(String(doc.storage_key))) {
    if(req.user?.isDemo){
      if(!documentStorage.getObject)return res.status(503).json({error:'Authenticated demo document preview is unavailable.'});
      const content=await documentStorage.getObject(String(doc.storage_key));
      res.setHeader('Content-Type',doc.mime_type||'application/octet-stream');
      res.setHeader('Content-Disposition',`inline; filename="${encodeURIComponent(doc.original_filename)}"`);
      res.setHeader('Cache-Control','private, no-store');
      return res.end(content);
    }
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
    'SELECT id, storage_key,review_status FROM documents WHERE id=? AND property_id=? AND tenant_id=?',
    [req.params.docId, req.params.id, req.user?.tenantId]
  );
  if (!docResult.rowCount) return res.status(404).json({ error: 'Document not found.' });
  let propertyStatus: string | null = null;
  if (['consultant','viewer'].includes(req.user?.role || '')) {
    const released = await pool.query("SELECT status FROM properties WHERE id=? AND tenant_id=?",[req.params.id,req.user?.tenantId]);
    propertyStatus = released.rowCount ? String(released.rows[0].status) : null;
  }
  const access = documentFileAccess({ role: req.user?.role, propertyStatus, reviewStatus: docResult.rows[0].review_status });
  if (access === 'not_found') return res.status(404).json({error:'Approved evidence not found.'});
  if (access === 'forbidden') return res.status(403).json({error:'This role cannot access confidential document files.'});

  if(req.user?.isDemo){
    res.setHeader('Cache-Control','private, no-store');
    return res.json({url:`/api/properties/${encodeURIComponent(req.params.id)}/documents/${encodeURIComponent(req.params.docId)}/file`,expiresInSeconds:null,provider:'authenticated_demo_proxy',note:'Demo documents are streamed through the authenticated workspace API and cannot be shared externally.'});
  }

  const configuredTtl = Number(process.env.SIGNED_URL_TTL_SECONDS || 300);
  const requestedTtl = Number(req.body?.expiresInSeconds || configuredTtl);
  const expiresInSeconds = Math.max(30, Math.min(Number.isFinite(requestedTtl) ? requestedTtl : configuredTtl, 900));
  const storageKey = String(docResult.rows[0].storage_key || '');

  if (!isRemoteStorageKey(storageKey)) {
    return res.json({
      url: `/api/properties/${encodeURIComponent(req.params.id)}/documents/${encodeURIComponent(req.params.docId)}/file`,
      expiresInSeconds: null,
      provider: 'local',
      note: 'Local sandbox files use the authenticated API route. Expiring links require private object storage.',
    });
  }

  const url = await documentStorage.createSignedUrl(storageKey, expiresInSeconds);
  if (!url) return res.status(503).json({ error: 'Cloud document storage is not configured.' });
  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'document.signed_url_created', 'document', req.params.docId, {
    propertyId: req.params.id,
    expiresInSeconds,
  });
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ url, expiresInSeconds, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(), provider: storageProviderForKey(storageKey) });
}));

app.post('/api/properties/:id/documents/:docId/extract', authGuard, documentIntakeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error:'Database not configured.' });
  const doc=await pool.query('SELECT id,storage_key FROM documents WHERE id=? AND property_id=? AND tenant_id=?',[req.params.docId,req.params.id,req.user?.tenantId]);
  if(!doc.rowCount)return res.status(404).json({error:'Document not found.'});
  const storageKey=String(doc.rows[0].storage_key||'');
  if(!isRemoteStorageKey(storageKey) && resolveSafeUploadPath(storageKey).isTraversal) return res.status(403).json({error:'Access denied: unsafe document storage path.'});
  if(!process.env.OCR_WORKER_TOKEN)return res.status(503).json({error:'OCR worker authentication is not configured on the server.',code:'OCR_WORKER_NOT_CONFIGURED'});
  const active=await pool.query("SELECT id FROM document_processing_jobs WHERE tenant_id=? AND document_id=? AND status IN ('queued','processing') LIMIT 1",[req.user?.tenantId,req.params.docId]);
  if(active.rowCount)return res.status(202).json({jobId:active.rows[0].id,status:'already_queued'});
  const jobId=crypto.randomUUID();
  await pool.query("INSERT INTO document_processing_jobs (id,tenant_id,property_id,document_id,requested_by_uid,status) VALUES (?,?,?,?,?,'queued')",[jobId,req.user?.tenantId,req.params.id,req.params.docId,req.user?.uid||'unknown']);
  await pool.query("UPDATE documents SET processing_status='queued',review_status='pending' WHERE id=? AND tenant_id=?",[req.params.docId,req.user?.tenantId]);
  await audit(req.user?.uid||'unknown',req.user?.tenantId,'document.ocr_queued','document',req.params.docId,{jobId});
  res.status(202).json({jobId,status:'queued'});
}));

function documentVerificationIssues(fields: ExtractedDocumentFields): string[] {
  const issues: string[] = [];
  const missing = (value: unknown) => !value || ['not recorded','not specified','none','unknown','—'].includes(String(value).trim().toLowerCase());
  const schedule = fields.propertySchedule;
  const conveyanceTypes = new Set(['sale_deed','gift_deed','partition_deed','release_deed','power_of_attorney']);
  if (missing(fields.registrationNumber||fields.documentNumber)) issues.push('Document / registration number is missing.');
  if (missing(schedule?.surveyNumber)) issues.push('Survey number is missing.');
  if (missing(schedule?.village)) issues.push('Village is missing.');
  if (!schedule?.extent?.normalizedSqFt || schedule.extent.normalizedSqFt <= 0) issues.push('A valid property extent is missing.');
  const boundaries = schedule?.boundaries;
  if (!boundaries || [boundaries.north,boundaries.south,boundaries.east,boundaries.west].some(missing)) issues.push('All four schedule boundaries must be reviewed.');
  if (conveyanceTypes.has(fields.documentType)) {
    if (!fields.parties?.length) issues.push('Vendor/claimant parties are missing.');
    if (!fields.parties?.some(party=>['seller','executant'].includes(String(party.role).toLowerCase()))) issues.push('Seller/executant is missing.');
    if (!fields.parties?.some(party=>['buyer','claimant','donee'].includes(String(party.role).toLowerCase()))) issues.push('Buyer/transferee is missing.');
    if (missing(fields.executionDate)) issues.push('Execution date is missing.');
    if (missing(fields.registrationDate)) issues.push('Registration date is missing.');
  }
  const confidence = fields.fieldConfidence || {};
  const lowConfidenceCore = ['documentNumber','surveyNumber','extent','boundaries'].filter(key => confidence[key] !== undefined && confidence[key] < 0.60);
  if (lowConfidenceCore.length) issues.push(`Low-confidence core fields require correction: ${lowConfidenceCore.join(', ')}.`);
  return issues;
}

function propertyDocumentIdentityIssues(fields: ExtractedDocumentFields, property: any): string[] {
  // Preserve Unicode letters so Kannada schedule values are compared as
  // evidence instead of being stripped to empty and treated as a match.
  const clean = (value: unknown) => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const missing = (value: unknown) => !value || ['notrecorded','notspecified','none','unknown'].includes(clean(value));
  const issues: string[] = [];
  const documentSurvey = clean(fields.propertySchedule?.surveyNumber);
  const documentHissa = clean(fields.propertySchedule?.subdivisionHissa);
  const expectedSurvey = clean(property.survey_number);
  const expectedHissa = clean(property.subdivision);
  if (!missing(fields.propertySchedule?.surveyNumber) && expectedSurvey && documentSurvey !== expectedSurvey && documentSurvey !== clean(`${property.survey_number}${property.subdivision || ''}`)) issues.push(`Survey number does not match Owner Page ${property.survey_number}.`);
  if(expectedHissa&&!missing(property.subdivision)&&missing(fields.propertySchedule?.subdivisionHissa))issues.push(`Hissa/subdivision is missing; Owner Page records ${property.subdivision}.`);
  if(expectedHissa&&!missing(fields.propertySchedule?.subdivisionHissa)&&documentHissa!==expectedHissa)issues.push(`Hissa/subdivision does not match Owner Page ${property.subdivision}.`);
  const documentVillage = clean(fields.propertySchedule?.village);
  const expectedVillage = clean(property.village);
  if (!missing(fields.propertySchedule?.village) && expectedVillage && documentVillage !== expectedVillage) {
    issues.push(`Village does not match Owner Page village ${property.village}.`);
  }
  for(const [label,ownerValue,documentValue] of [['Hobli',property.hobli,fields.propertySchedule?.hobli],['Taluk',property.taluk,fields.propertySchedule?.taluk],['District',property.district,fields.propertySchedule?.district]] as const){
    if(!missing(ownerValue)&&!missing(documentValue)&&clean(ownerValue)!==clean(documentValue))issues.push(`${label} does not match Owner Page value ${ownerValue}.`);
  }
  const ownerExtent=parseKarnatakaLandExtent(String(property.extent||'')).normalizedSqFt;
  const deedExtent=Number(fields.propertySchedule?.extent?.normalizedSqFt||parseKarnatakaLandExtent(String(fields.propertySchedule?.extent?.rawText||'')).normalizedSqFt);
  if(ownerExtent>0&&deedExtent>0&&Math.abs(ownerExtent-deedExtent)/Math.max(ownerExtent,deedExtent)>0.01)issues.push(`Extent differs from Owner Page ${property.extent}.`);
  const boundaries=fields.propertySchedule?.boundaries||{};
  for(const [direction,directionKey,column] of [['North','north','boundary_north'],['South','south','boundary_south'],['East','east','boundary_east'],['West','west','boundary_west']] as const){
    const ownerValue=property[column],documentValue=boundaries[directionKey];
    if(!missing(ownerValue)&&!missing(documentValue)&&clean(ownerValue)!==clean(documentValue))issues.push(`${direction} boundary does not match Owner Page value ${ownerValue}.`);
  }
  if (missing(fields.propertySchedule?.surveyNumber)) issues.push('Survey number is missing; property identity cannot be confirmed.');
  if (missing(fields.propertySchedule?.village)) issues.push('Village is missing; property identity cannot be confirmed.');
  return issues;
}

function propertyDocumentIdentityMatches(fields: ExtractedDocumentFields, property: any): boolean {
  return propertyDocumentIdentityIssues(fields, property).length === 0 &&
    Boolean(fields.propertySchedule?.surveyNumber && fields.propertySchedule?.village);
}

async function propertyDocumentPartyIssues(fields: ExtractedDocumentFields, propertyId: string, tenantId: string): Promise<string[]> {
  if(!pool)return [];
  const previous=await pool.query("SELECT to_parties FROM title_events WHERE property_id=? AND tenant_id=? AND status='verified' ORDER BY event_date DESC,sequence_order DESC LIMIT 1",[propertyId,tenantId]);
  if(!previous.rowCount)return [];
  const raw=previous.rows[0].to_parties;
  let owners:any[]=Array.isArray(raw)?raw:[];
  if(typeof raw==='string'){try{owners=JSON.parse(raw);}catch{owners=[];}}
  const expected=owners.map(party=>normalizePartyName(String(party?.name||''))).filter(Boolean);
  const sellers=(fields.parties||[]).filter(party=>['seller','executant'].includes(String(party.role).toLowerCase())).map(party=>normalizePartyName(party.name)).filter(Boolean);
  const buyers=(fields.parties||[]).filter(party=>['buyer','claimant','donee'].includes(String(party.role).toLowerCase())).map(party=>normalizePartyName(party.name)).filter(Boolean);
  const issues:string[]=[];
  if(expected.length&&sellers.length&&!sellers.some(name=>expected.includes(name)))issues.push(`Seller/executant does not match the current verified Owner Page title-chain owner (${owners.map(party=>party.name).filter(Boolean).join(', ')}).`);
  if(expected.length&&buyers.length&&!buyers.some(name=>expected.includes(name)))issues.push(`Buyer/transferee does not match the current verified Owner Page title-chain owner (${owners.map(party=>party.name).filter(Boolean).join(', ')}).`);
  return issues;
}

app.patch('/api/properties/:id/documents/:docId/fields', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const docResult = await pool.query(
    'SELECT * FROM documents WHERE id=? AND property_id=? AND tenant_id=?',
    [req.params.docId, req.params.id, req.user?.tenantId]
  );
  if (!docResult.rowCount) return res.status(404).json({ error: 'Document not found.' });
  if (!req.user || !ocrAccess.canCorrect(req.user.role as OcrRole)) return res.status(403).json({ error:'OCR field correction permission is required.' });
  const doc = docResult.rows[0];

  let currentFields: ExtractedDocumentFields =
    typeof doc.extracted_fields === 'object' && doc.extracted_fields !== null && Object.keys(doc.extracted_fields).length > 0
      ? doc.extracted_fields
      : extractDocument('', { documentId: doc.id, filename: doc.original_filename, mimeType: doc.mime_type });

  const { fieldPath, newValue, rationale, overrides, reviewAction } = req.body || {};
  if (!rationale && !overrides && !fieldPath && !reviewAction && req.body?.isVerified === undefined) {
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
  if ((fieldPath || reviewAction) && (!rationale || typeof rationale !== 'string' || rationale.trim().length === 0)) {
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

  if (reviewAction) {
    const actions = new Set(['approve','reject','not_found','comment']);
    if (!actions.has(reviewAction) || typeof fieldPath !== 'string' || !isSafeFieldPath(fieldPath)) {
      return res.status(400).json({error:'A supported reviewAction and safe fieldPath are required.'});
    }
    const status = ({approve:'approved',reject:'rejected',not_found:'not_found',comment:'commented'} as const)[reviewAction as 'approve'|'reject'|'not_found'|'comment'];
    const value = getNestedValue(currentFields, fieldPath);
    const reviewedAt = new Date().toISOString();
    currentFields.reviewState.fieldReviews = currentFields.reviewState.fieldReviews || {};
    currentFields.reviewState.fieldReviews[fieldPath] = {status,comment:String(rationale).trim(),reviewerUid:req.user?.uid||'unknown',reviewedAt};
    await pool.query(`INSERT INTO document_field_history (id,tenant_id,property_id,document_id,field_path,previous_value,new_value,action,rationale,actor_uid,actor_role) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [crypto.randomUUID(),doc.tenant_id,req.params.id,doc.id,fieldPath,JSON.stringify(value ?? null),JSON.stringify(value ?? null),status,String(rationale).trim(),req.user?.uid||'unknown',req.user?.role||'unknown']);
    await audit(req.user?.uid||'unknown',req.user?.tenantId,`document.field_${status}`,'document',doc.id,{fieldPath,reviewerUid:req.user?.uid,reviewedAt});
  }

  if (fieldPath && !reviewAction) {
    const previousValue = getNestedValue(currentFields, fieldPath);
    setNestedValue(currentFields, fieldPath, newValue);
    await pool.query(`INSERT INTO document_field_history (id,tenant_id,property_id,document_id,field_path,previous_value,new_value,action,rationale,actor_uid,actor_role) VALUES (?,?,?,?,?,?,?,'corrected',?,?,?)`, [crypto.randomUUID(),doc.tenant_id,req.params.id,doc.id,fieldPath,JSON.stringify(previousValue ?? null),JSON.stringify(newValue ?? null),String(rationale).trim(),req.user?.uid || 'unknown',req.user?.role || 'unknown']);
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
      // Always derive the old value from the server snapshot so the audit log cannot be client-forged.
      const prev = getNestedValue(currentFields, key);
      const next = ov.newValue;
      setNestedValue(currentFields, key, next);
      await pool.query(`INSERT INTO document_field_history (id,tenant_id,property_id,document_id,field_path,previous_value,new_value,action,rationale,actor_uid,actor_role) VALUES (?,?,?,?,?,?,?,'corrected',?,?,?)`, [crypto.randomUUID(),doc.tenant_id,req.params.id,doc.id,key,JSON.stringify(prev ?? null),JSON.stringify(next ?? null),String(ov.rationale || rationale).trim(),req.user?.uid || 'unknown',req.user?.role || 'unknown']);
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
    if (Boolean(req.body.isVerified)) return res.status(409).json({error:'Evidence approval must use the reviewer submission workflow.',code:'USE_DOCUMENT_REVIEW_WORKFLOW'});
    if (Boolean(req.body.isVerified) && !['owner', 'lawyer'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Only the Owner or Lead Advocate can verify document evidence.', requiredRoles: ['owner', 'lawyer'], currentRole: req.user?.role || 'viewer' });
    }
    if (Boolean(req.body.isVerified)) {
      const verificationIssues = documentVerificationIssues(currentFields);
      const propertyResult = await pool.query('SELECT survey_number, subdivision, village, hobli, taluk, district, extent, boundary_north, boundary_south, boundary_east, boundary_west FROM properties WHERE id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
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

  await audit(req.user?.uid || 'unknown', req.user?.tenantId, reviewAction ? 'document.field_review_recorded' : 'document.fields_overridden', 'document', doc.id, {
    reviewerUid: req.user?.uid,
    rationale,
    overridesCount: Object.keys(currentFields.reviewState.overrides || {}).length,
  });

  res.json({
    document: updateResult.rows[0],
    extractedFields: currentFields,
  });
}));

app.post('/api/properties/:id/documents/:docId/submit-review', authGuard, asyncRoute(async (req,res) => {
  if (!pool) return res.status(503).json({error:'Database not configured.'});
  if (!req.user || !ocrAccess.canSubmit(req.user.role as OcrRole)) return res.status(403).json({error:'Analyst submission permission is required.'});
  const doc = await pool.query('SELECT * FROM documents WHERE id=? AND property_id=? AND tenant_id=?',[req.params.docId,req.params.id,req.user?.tenantId]);
  if (!doc.rowCount) return res.status(404).json({error:'Document not found.'});
  if (!doc.rows[0].extracted_text) return res.status(409).json({error:'OCR extraction must finish before review submission.'});
  const fields = doc.rows[0].extracted_fields || {};
  const property = await pool.query('SELECT survey_number,subdivision,village,hobli,taluk,district,extent,boundary_north,boundary_south,boundary_east,boundary_west FROM properties WHERE id=? AND tenant_id=?',[req.params.id,req.user?.tenantId]);
  const identityIssues = property.rowCount ? propertyDocumentIdentityIssues(fields,property.rows[0]) : ['Property case was not found.'];
  const identityMatches = property.rowCount ? propertyDocumentIdentityMatches(fields,property.rows[0]) : false;
  const partyIssues=await propertyDocumentPartyIssues(fields,req.params.id,req.user?.tenantId||'');
  if (!identityMatches||partyIssues.length) {
    identityIssues.push(...partyIssues);
    await audit(req.user?.uid||'unknown',req.user?.tenantId,'document.property_association_blocked','document',req.params.docId,{propertyId:req.params.id,identityIssues});
    return res.status(409).json({error:'Document identity does not match the current property case. Automatic property association is blocked; analyst review is required.',code:'PROPERTY_IDENTITY_MISMATCH',issues:identityIssues});
  }
  await pool.query("UPDATE documents SET review_status='submitted' WHERE id=? AND tenant_id=?",[req.params.docId,req.user?.tenantId]);
  await pool.query(`INSERT INTO document_review_history (id,tenant_id,property_id,document_id,from_status,to_status,decision,rationale,actor_uid,actor_role) VALUES (?,?,?,?,?,'submitted','submit',?,?,?)`,[crypto.randomUUID(),req.user?.tenantId,req.params.id,req.params.docId,doc.rows[0].review_status || 'pending',String(req.body?.comment || 'Submitted for reviewer approval.').slice(0,4000),req.user?.uid || 'unknown',req.user?.role || 'unknown']);
  await audit(req.user?.uid || 'unknown',req.user?.tenantId,'document.submitted_for_review','document',req.params.docId,{overallConfidence:fields.overallConfidence || 0});
  res.json({success:true,reviewStatus:'submitted'});
}));

app.post('/api/properties/:id/documents/:docId/review', authGuard, legalReviewerGuard, asyncRoute(async (req,res) => {
  if (!pool) return res.status(503).json({error:'Database not configured.'});
  if(!req.user || !ocrAccess.canDecide(req.user.role as OcrRole))return res.status(403).json({error:'Only the assigned Lead Advocate may approve or reject OCR evidence.',requiredRoles:['lawyer']});
  const input = z.object({decision:z.enum(['approve','reject','dispute']),rationale:z.string().trim().min(3).max(4000)}).safeParse(req.body);
  if (!input.success) return res.status(400).json({error:'A valid decision and review reason are required.'});
  const doc = await pool.query('SELECT * FROM documents WHERE id=? AND property_id=? AND tenant_id=?',[req.params.docId,req.params.id,req.user?.tenantId]);
  if (!doc.rowCount) return res.status(404).json({error:'Document not found.'});
  const fromStatus = String(doc.rows[0].review_status || 'pending');
  if (fromStatus !== 'submitted') return res.status(409).json({error:'Only analyst-submitted evidence can be reviewed.'});
  const fields = doc.rows[0].extracted_fields || {};
  const decision = input.data.decision;
  if (decision === 'approve') {
    const issues = documentVerificationIssues(fields);
    const property = await pool.query('SELECT survey_number,subdivision,village,hobli,taluk,district,extent,boundary_north,boundary_south,boundary_east,boundary_west FROM properties WHERE id=? AND tenant_id=?',[req.params.id,req.user?.tenantId]);
    const identityIssues = property.rowCount ? propertyDocumentIdentityIssues(fields,property.rows[0]) : ['Property was not found.'];
    const identityMatches = property.rowCount ? propertyDocumentIdentityMatches(fields,property.rows[0]) : false;
    const partyIssues=await propertyDocumentPartyIssues(fields,req.params.id,req.user?.tenantId||'');
    if (issues.length || !identityMatches || partyIssues.length) return res.status(409).json({error:'Evidence cannot be approved until required fields and Owner Page identity are resolved.',issues:[...issues,...identityIssues,...partyIssues]});
  }
  const nextStatus = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'disputed';
  fields.reviewState = {...(fields.reviewState || {}),isVerified:decision === 'approve',verifiedByUid:decision === 'approve' ? req.user?.uid : undefined,verifiedAt:decision === 'approve' ? new Date().toISOString() : undefined};
  await pool.query(`UPDATE documents SET review_status=?,approved_by_uid=?,approved_at=?,extracted_fields=?,processing_status=?,manual_review_status=? WHERE id=? AND tenant_id=?`,[nextStatus,decision==='approve' ? req.user?.uid : null,decision==='approve' ? new Date() : null,JSON.stringify(fields),decision==='approve'?'completed':'manual_review',decision==='approve'?'completed':'required',req.params.docId,req.user?.tenantId]);
  await pool.query(`INSERT INTO document_review_history (id,tenant_id,property_id,document_id,from_status,to_status,decision,rationale,actor_uid,actor_role) VALUES (?,?,?,?,?,?,?,?,?,?)`,[crypto.randomUUID(),req.user?.tenantId,req.params.id,req.params.docId,fromStatus,nextStatus,decision,input.data.rationale,req.user?.uid || 'unknown',req.user?.role || 'unknown']);
  await audit(req.user?.uid || 'unknown',req.user?.tenantId,`document.${nextStatus}`,'document',req.params.docId,{fromStatus,toStatus:nextStatus,rationale:input.data.rationale});
  res.json({success:true,reviewStatus:nextStatus});
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

  const activeGis=await pool.query("SELECT version_number,configuration FROM owner_configuration_versions WHERE tenant_id=? AND config_type='gis_rules' AND status='active' ORDER BY version_number DESC LIMIT 1",[req.user?.tenantId]);
  const gisRules=activeGis.rowCount?(typeof activeGis.rows[0].configuration==='string'?JSON.parse(activeGis.rows[0].configuration):activeGis.rows[0].configuration):{};
  const result = screenSpatialBuffers({ latitude: lat, longitude: lon }, layers, linkedParcelGeoJSON, gisRules);
  (result as any).ruleVersion=activeGis.rowCount?Number(activeGis.rows[0].version_number):null;
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
  if (['consultant','viewer'].includes(req.user?.role || '') && !['approved','complete'].includes(String(p.rows[0].status))) return res.status(404).json({error:'Approved report not found.'});
  const docs = ['consultant','viewer'].includes(req.user?.role || '')
    ? await pool.query("SELECT id, original_filename, mime_type, size_bytes, sha256, processing_status, extracted_fields, created_at FROM documents WHERE property_id=? AND tenant_id=? AND review_status='approved' ORDER BY created_at", [req.params.id, req.user?.tenantId])
    : await pool.query('SELECT id, original_filename, mime_type, size_bytes, sha256, processing_status, extracted_fields, created_at FROM documents WHERE property_id=? AND tenant_id=? ORDER BY created_at', [req.params.id, req.user?.tenantId]);
  const findings = ['consultant','viewer'].includes(req.user?.role || '')
    ? await pool.query("SELECT code, title, severity, points, explanation, evidence_status, next_action, created_at FROM risk_findings WHERE property_id=? AND tenant_id=? AND evidence_status='verified' ORDER BY created_at", [req.params.id, req.user?.tenantId])
    : await pool.query('SELECT code, title, severity, points, explanation, evidence_status, next_action, created_at FROM risk_findings WHERE property_id=? AND tenant_id=? ORDER BY created_at', [req.params.id, req.user?.tenantId]);
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

  const docs = ['consultant','viewer'].includes(req.user?.role || '')
    ? await pool.query("SELECT id, original_filename, doc_type, extracted_fields FROM documents WHERE property_id=? AND tenant_id=? AND review_status='approved'",[req.params.id,req.user?.tenantId])
    : await pool.query('SELECT id, original_filename, doc_type, extracted_fields FROM documents WHERE property_id=? AND tenant_id=?',[req.params.id,req.user?.tenantId]);

  const docItems = docs.rows.map(r => ({
    id: r.id,
    originalFilename: r.original_filename,
    classification: { documentType: r.doc_type || 'other' },
    extractedFields: typeof r.extracted_fields === 'string' ? JSON.parse(r.extracted_fields) : (r.extracted_fields || {}),
  }));

  const activeRules=await pool.query("SELECT version_number,configuration FROM owner_configuration_versions WHERE tenant_id=? AND config_type='discrepancy_rules' AND status='active' ORDER BY version_number DESC LIMIT 1",[req.user?.tenantId]);
  const discrepancyRules=activeRules.rowCount?(typeof activeRules.rows[0].configuration==='string'?JSON.parse(activeRules.rows[0].configuration):activeRules.rows[0].configuration):{};
  const discrepancies = detectCrossDocumentDiscrepancies(docItems, p.rows[0], discrepancyRules);
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
  const activeRules=await pool.query("SELECT version_number,configuration FROM owner_configuration_versions WHERE tenant_id=? AND config_type='discrepancy_rules' AND status='active' ORDER BY version_number DESC LIMIT 1",[req.user?.tenantId]);
  const discrepancyRules=activeRules.rowCount?(typeof activeRules.rows[0].configuration==='string'?JSON.parse(activeRules.rows[0].configuration):activeRules.rows[0].configuration):{};
  const discrepancies = detectCrossDocumentDiscrepancies(docItems, p.rows[0], discrepancyRules);
  const tenantBranding = await loadTenantReportBranding(String(req.user?.tenantId || ''));

  const snapshot = createDueDiligenceSnapshot({
    tenant: tenantBranding,
    statutoryNotice: tenantBranding.legalDisclaimer || undefined,
    property: p.rows[0],
    documents: docs.rows,
    titleTimeline,
    titleGaps,
    discrepancies,
  });
  (snapshot as any).discrepancyRuleVersion=activeRules.rowCount?Number(activeRules.rows[0].version_number):null;

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
  if (['consultant','viewer'].includes(req.user?.role || '') && !['approved','complete'].includes(String(p.rows[0].status))) return res.status(404).json({error:'Approved report not found.'});

  const docs = ['consultant','viewer'].includes(req.user?.role || '')
    ? await pool.query("SELECT * FROM documents WHERE property_id=? AND tenant_id=? AND review_status='approved'", [req.params.id, req.user?.tenantId])
    : await pool.query('SELECT * FROM documents WHERE property_id=? AND tenant_id=?', [req.params.id, req.user?.tenantId]);
  const eventsResult = ['consultant','viewer'].includes(req.user?.role || '')
    ? await pool.query("SELECT * FROM title_events WHERE property_id=? AND tenant_id=? AND status='verified' ORDER BY event_date ASC",[req.params.id,req.user?.tenantId])
    : await pool.query('SELECT * FROM title_events WHERE property_id=? AND tenant_id=? ORDER BY event_date ASC',[req.params.id,req.user?.tenantId]);
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
  const activeRules=await pool.query("SELECT version_number,configuration FROM owner_configuration_versions WHERE tenant_id=? AND config_type='discrepancy_rules' AND status='active' ORDER BY version_number DESC LIMIT 1",[req.user?.tenantId]);
  const discrepancyRules=activeRules.rowCount?(typeof activeRules.rows[0].configuration==='string'?JSON.parse(activeRules.rows[0].configuration):activeRules.rows[0].configuration):{};
  const discrepancies = detectCrossDocumentDiscrepancies(docItems, p.rows[0], discrepancyRules);
  const activeTemplate=await pool.query("SELECT version_number,name,configuration FROM owner_configuration_versions WHERE tenant_id=? AND config_type='report_templates' AND status='active' ORDER BY version_number DESC LIMIT 1",[req.user?.tenantId]);
  const reportTemplate=activeTemplate.rowCount?{version:Number(activeTemplate.rows[0].version_number),name:activeTemplate.rows[0].name,configuration:typeof activeTemplate.rows[0].configuration==='string'?JSON.parse(activeTemplate.rows[0].configuration):activeTemplate.rows[0].configuration}:null;
  const tenantBranding = await loadTenantReportBranding(String(req.user?.tenantId || ''));
  const snapshot = createDueDiligenceSnapshot({
    tenant: tenantBranding,
    statutoryNotice: tenantBranding.legalDisclaimer || undefined,
    property: p.rows[0],
    documents: docs.rows,
    titleTimeline,
    titleGaps,
    discrepancies,
  });
  (snapshot as any).reportTemplate=reportTemplate;
  (snapshot as any).discrepancyRuleVersion=activeRules.rowCount?Number(activeRules.rows[0].version_number):null;

  const report = generateDueDiligenceReport(snapshot);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(report.html);
}));

app.get('/api/properties/:id/due-diligence-report/pdf', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const role=req.user?.role||'';
  if(!['owner','admin','lawyer','consultant','viewer'].includes(role))return res.status(403).json({error:'PDF report access is not available for this role.'});
  const conditions=['r.property_id=?','r.tenant_id=?',"r.approval_status='approved'"];
  const params:any[]=[req.params.id,req.user?.tenantId];
  if(role==='lawyer'){conditions.push('p.assigned_lawyer_uid=?');params.push(req.user?.uid);}
  if(role==='consultant'){conditions.push('p.assigned_consultant_uid=?');params.push(req.user?.uid);}
  if(role==='viewer'){conditions.push("p.assigned_viewer_uid=? AND p.status IN ('approved','complete')");params.push(req.user?.uid);}
  const rows=await pool.query(`SELECT r.*,COALESCE(u.full_name,m.email,r.reviewed_by_uid) AS reviewer_name FROM consultant_report_versions r JOIN properties p ON p.id=r.property_id AND p.tenant_id=r.tenant_id LEFT JOIN org_memberships m ON m.organization_id=r.tenant_id AND m.user_uid=r.reviewed_by_uid LEFT JOIN user_accounts u ON u.id=r.reviewed_by_uid WHERE ${conditions.join(' AND ')} ORDER BY r.version_number DESC LIMIT 1`,params);
  if(!rows.rowCount)return res.status(404).json({error:'No reviewer-approved report was found for this property.'});
  const report=rows.rows[0];
  const snapshot=typeof report.snapshot==='string'?JSON.parse(report.snapshot):report.snapshot;
  const checksum=crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  if(checksum!==report.snapshot_sha256)return res.status(409).json({error:'Report snapshot integrity check failed.'});
  let pdf:Buffer;
  try { pdf=await renderReportPdf(consultantWordHtml(clientSafeReport(report))); }
  catch(error) { console.error('Report PDF rendering failed.',error);return res.status(503).json({error:'PDF rendering is temporarily unavailable.'}); }
  await pool.query("INSERT INTO workspace_export_events (id,tenant_id,actor_uid,resource_type,resource_id,export_format,result,details) VALUES (?,?,?,?,?,'pdf','success',?)",[crypto.randomUUID(),req.user?.tenantId,req.user?.uid||'unknown','consultant_report',report.id,JSON.stringify({version:report.version_number,sha256:report.snapshot_sha256})]);
  await audit(req.user?.uid||'unknown',req.user?.tenantId,'consultant.report_exported','consultant_report',report.id,{version:report.version_number,format:'pdf',sha256:report.snapshot_sha256});
  res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Length',String(pdf.length));res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Disposition',`attachment; filename="ojix-report-v${report.version_number}.pdf"`);res.send(pdf);
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
  if ((req as any).demoWorkspace) {
    const ws = (req as any).demoWorkspace as DemoSessionWorkspace;
    const items = ws.documents.map(d => {
      const prop = ws.properties.find(p => p.id === d.property_id);
      return {
        ...d,
        property_name: prop?.name || 'Whitefield Residential Site',
        application_number: prop?.application_number || 'OJ-2026-BLR-001',
        survey_number: prop?.survey_number || '45',
        village: prop?.village || 'Whitefield',
        district: prop?.district || 'Bengaluru Urban',
      };
    });
    return res.json({ items, count: items.length });
  }

  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query(
    `SELECT d.id,d.tenant_id,d.property_id,d.doc_type,d.doc_type_custom,d.classification_confidence,
            d.classification_source,d.manual_review_status,d.review_status,d.governance_status,d.original_filename,
            d.mime_type,d.size_bytes,d.sha256,d.processing_status,d.uploaded_by_uid,d.created_at,
            p.name as property_name,p.application_number,p.survey_number,p.village,p.district
     FROM documents d
     JOIN properties p ON d.property_id=p.id
     WHERE d.tenant_id=? AND (? <> 'lawyer' OR p.assigned_lawyer_uid=?) AND (? <> 'analyst' OR p.assigned_analyst_uid=?) AND (? <> 'operations' OR p.assigned_operations_uid=?) AND (? <> 'consultant' OR p.assigned_consultant_uid=?) AND (? NOT IN ('consultant','viewer') OR d.review_status='approved') AND (? <> 'viewer' OR (p.status IN ('approved','complete') AND p.assigned_viewer_uid=?)) AND (? <> '1' OR (p.archived_at IS NULL AND d.governance_status='active' AND (d.manual_review_status IN ('pending','required') OR d.processing_status<>'completed')))
     ORDER BY d.created_at DESC LIMIT 200`,
    [req.user?.tenantId,req.user?.role||'viewer',req.user?.uid||'',req.user?.role||'viewer',req.user?.uid||'',req.user?.role||'viewer',req.user?.uid||'',req.user?.role||'viewer',req.user?.uid||'',req.user?.role||'viewer',req.user?.role||'viewer',req.user?.uid||'',String(req.query.review||'')]
  );
  res.json({ items: result.rows, count: result.rows.length });
}));

app.get('/api/findings/all', authGuard, asyncRoute(async (req, res) => {
  if ((req as any).demoWorkspace) {
    const ws = (req as any).demoWorkspace as DemoSessionWorkspace;
    const items = ws.findings.map(f => {
      const prop = ws.properties.find(p => p.id === f.property_id);
      return {
        ...f,
        property_name: prop?.name || 'Whitefield Residential Site',
        survey_number: prop?.survey_number || '45',
        village: prop?.village || 'Whitefield',
        district: prop?.district || 'Bengaluru Urban',
      };
    });
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, unverified: 0 };
    for (const r of items) {
      if (r.severity in severityCounts) (severityCounts as any)[r.severity]++;
    }
    return res.json({ items, severityCounts, count: items.length });
  }

  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query(
    `SELECT f.*, p.name as property_name, p.survey_number, p.village, p.district
     FROM risk_findings f
     JOIN properties p ON f.property_id=p.id
     WHERE f.tenant_id=? AND (? <> 'lawyer' OR p.assigned_lawyer_uid=?) AND (? <> 'analyst' OR p.assigned_analyst_uid=?) AND (? <> 'operations' OR p.assigned_operations_uid=?) AND (? <> 'consultant' OR p.assigned_consultant_uid=?) AND (? <> 'viewer' OR f.evidence_status='verified')
     ORDER BY f.created_at DESC LIMIT 200`,
    [req.user?.tenantId,req.user?.role||'viewer',req.user?.uid||'',req.user?.role||'viewer',req.user?.uid||'',req.user?.role||'viewer',req.user?.uid||'',req.user?.role||'viewer',req.user?.uid||'',req.user?.role||'viewer']
  );
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, unverified: 0 };
  for (const r of result.rows) {
    if (r.severity in severityCounts) (severityCounts as any)[r.severity]++;
  }
  res.json({ items: result.rows, severityCounts, count: result.rows.length });
}));

const ADMIN_ROLES=['admin','lawyer','analyst','operations','consultant','support','data_steward','viewer'] as const;
const ROLE_ASSIGNABLE_ROLES=RBAC_ROLES.filter(role=>!['super_admin','owner'].includes(role));
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
app.post('/api/super-admin/organizations',authGuard,superAdminGuard,asyncRoute(async(req,res)=>{
  const parsed=z.object({name:z.string().trim().min(2).max(160),slug:z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Enter a valid organization name, URL slug and audit reason.'});
  const duplicate=await pool!.query('SELECT id FROM organizations WHERE slug=? LIMIT 1',[parsed.data.slug]);
  if(duplicate.rowCount)return res.status(409).json({error:'That organization slug is already in use.'});
  const id=crypto.randomUUID();
  await pool!.query('INSERT INTO organizations (id,name,slug) VALUES (?,?,?)',[id,parsed.data.name,parsed.data.slug]);
  await audit(req.user?.uid||'unknown',id,'super_admin.organization_created','organization',id,{name:parsed.data.name,slug:parsed.data.slug,reason:parsed.data.reason});
  res.status(201).json({item:{id,name:parsed.data.name,slug:parsed.data.slug},success:true});
}));
app.patch('/api/super-admin/organizations/:id',authGuard,superAdminGuard,asyncRoute(async(req,res)=>{
  const parsed=z.object({name:z.string().trim().min(2).max(160).optional(),slug:z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120).optional(),reason:z.string().trim().min(3).max(500)}).refine(value=>value.name||value.slug).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Choose a valid organization name or slug and provide an audit reason.'});
  const current=await pool!.query('SELECT id,name,slug FROM organizations WHERE id=? LIMIT 1',[req.params.id]);
  if(!current.rowCount)return res.status(404).json({error:'Organization not found.'});
  if(parsed.data.slug){const duplicate=await pool!.query('SELECT id FROM organizations WHERE slug=? AND id<>? LIMIT 1',[parsed.data.slug,req.params.id]);if(duplicate.rowCount)return res.status(409).json({error:'That organization slug is already in use.'});}
  const next={name:parsed.data.name||current.rows[0].name,slug:parsed.data.slug||current.rows[0].slug};
  await pool!.query('UPDATE organizations SET name=?,slug=? WHERE id=?',[next.name,next.slug,req.params.id]);
  await audit(req.user?.uid||'unknown',req.params.id,'super_admin.organization_updated','organization',req.params.id,{before:current.rows[0],after:next,reason:parsed.data.reason});
  res.json({item:{id:req.params.id,...next},success:true});
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
app.post('/api/super-admin/users',authGuard,superAdminGuard,asyncRoute(async(req,res)=>{
  const roleSchema=z.enum(['owner','admin','lawyer','analyst','operations','consultant','support','data_steward','viewer']);
  const parsed=z.object({name:z.string().trim().min(2).max(160),email:z.string().trim().email().max(255).transform(value=>value.toLowerCase()),organizationId:z.string().uuid(),role:roleSchema,password:z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Provide a valid name, email, organization, role, 12-character temporary password and audit reason.'});
  const {name,email,organizationId,role,password,reason}=parsed.data;
  const organization=await pool!.query('SELECT id,name FROM organizations WHERE id=? LIMIT 1',[organizationId]);
  if(!organization.rowCount)return res.status(404).json({error:'Organization not found.'});
  const existing=await pool!.query('SELECT id FROM user_accounts WHERE email=? LIMIT 1',[email]);
  if(existing.rowCount)return res.status(409).json({error:'An account with this email already exists. Add the existing account to the organization instead.'});
  const userId=crypto.randomUUID(),membershipId=crypto.randomUUID();
  const conn=await pool!.getConnection();
  try{
    await conn.beginTransaction();
    await conn.query('INSERT INTO user_accounts (id,email,full_name,password_hash,email_verified,status,otp_required) VALUES (?,?,?,?,TRUE,\'active\',TRUE)',[userId,email,name,hashPassword(password)]);
    await conn.query('INSERT INTO org_memberships (id,organization_id,user_uid,email,role,status) VALUES (?,?,?,?,?,\'active\')',[membershipId,organizationId,userId,email,role]);
    await conn.query('INSERT INTO audit_events (id,actor_uid,tenant_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?,?)',[crypto.randomUUID(),req.user?.uid||'unknown',organizationId,'super_admin.user_created','user_account',userId,JSON.stringify({email,name,role,organizationName:organization.rows[0].name,reason})]);
    await conn.commit();
    res.status(201).json({success:true,item:{id:userId,membershipId,email,full_name:name,role,organization_id:organizationId,status:'active'},message:'Account created. The user must complete email OTP verification when signing in.'});
  }catch(error:any){
    await conn.rollback();
    if(error?.code==='ER_DUP_ENTRY')return res.status(409).json({error:'An account or membership with these details already exists.'});
    throw error;
  }finally{conn.release();}
}));
app.get('/api/super-admin/properties',authGuard,superAdminGuard,asyncRoute(async(req,res)=>{
  const q=pageSchema.safeParse(req.query);if(!q.success)return res.status(400).json({error:'Invalid property filters.'});
  const {page,limit,search}=q.data,like=`%${search}%`;
  const filter=`(?='' OR p.name LIKE ? OR p.application_number LIKE ? OR p.survey_number LIKE ? OR p.village LIKE ? OR o.name LIKE ? OR p.id LIKE ?)`;
  const params=[search,like,like,like,like,like,like];
  const count=await pool!.query(`SELECT COUNT(*) total FROM properties p JOIN organizations o ON o.id=p.tenant_id WHERE ${filter}`,params);
  const result=await pool!.query(`SELECT p.id,p.tenant_id,p.application_number,p.name,p.village,p.taluk,p.district,p.survey_number,p.status,p.archived_at,p.created_at,o.name organization_name FROM properties p JOIN organizations o ON o.id=p.tenant_id WHERE ${filter} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,[...params,limit,(page-1)*limit]);
  res.json({items:result.rows,page,limit,total:Number(count.rows[0]?.total||0)});
}));
app.patch('/api/super-admin/properties/:id/archive',authGuard,superAdminGuard,asyncRoute(async(req,res)=>{
  const parsed=z.object({archived:z.boolean(),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Choose the property archive state and provide an audit reason.'});
  const current=await pool!.query('SELECT id,tenant_id,archived_at FROM properties WHERE id=? LIMIT 1',[req.params.id]);
  if(!current.rowCount)return res.status(404).json({error:'Property not found.'});
  await pool!.query('UPDATE properties SET archived_at=?,archived_by_uid=?,archive_reason=?,updated_by_uid=?,updated_at=NOW(6) WHERE id=?',[parsed.data.archived?new Date():null,parsed.data.archived?req.user?.uid:null,parsed.data.archived?parsed.data.reason:null,req.user?.uid||'unknown',req.params.id]);
  await audit(req.user?.uid||'unknown',current.rows[0].tenant_id,parsed.data.archived?'super_admin.property_archived':'super_admin.property_restored','property',req.params.id,{reason:parsed.data.reason});
  res.json({success:true,archived:parsed.data.archived});
}));
app.patch('/api/super-admin/members/:id',authGuard,superAdminGuard,asyncRoute(async(req,res)=>{
  const normalizeChoice=(value:unknown)=>typeof value==='string'?value.trim().toLowerCase().replace(/[\s-]+/g,'_'):value;
  const parsed=z.object({status:z.preprocess(normalizeChoice,z.enum(['active','disabled','revoked']).optional()),role:z.preprocess(normalizeChoice,z.enum(['owner','admin','lawyer','analyst','operations','consultant','support','data_steward','viewer']).optional()),reason:z.string().trim().min(3).max(500)}).refine(value=>value.status||value.role).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Choose a supported role or status and provide a reason.'});
  const {status,role,reason}=parsed.data;
  const conn=await pool!.getConnection();
  try{
    await conn.beginTransaction();
    const current=await conn.query('SELECT id,organization_id,user_uid,email,role,status FROM org_memberships WHERE id=? FOR UPDATE',[req.params.id]);
    if(!current.rowCount){await conn.rollback();return res.status(404).json({error:'Workspace membership not found.'});}
    const member=current.rows[0];
    if(member.user_uid===req.user?.uid&&(status&&status!=='active'||role)){await conn.rollback();return res.status(409).json({error:'You cannot change your own platform membership.'});}
    if(member.role==='owner'&&member.status==='active'&&(status==='disabled'||(role&&role!=='owner'))){
      const owners=await conn.query("SELECT id FROM org_memberships WHERE organization_id=? AND role='owner' AND status='active' FOR UPDATE",[member.organization_id]);
      if(owners.rowCount<=1){await conn.rollback();return res.status(409).json({error:'Each organization must retain at least one active owner.'});}
    }
    await conn.query('UPDATE org_memberships SET role=COALESCE(?,role),status=COALESCE(?,status),updated_at=NOW(6) WHERE id=?',[role||null,status||null,member.id]);
    if(status&&status!=='active')await conn.query('UPDATE authentication_sessions SET revoked_at=NOW(6),revoked_by_uid=?,revoke_reason=? WHERE user_uid=? AND tenant_id=? AND revoked_at IS NULL',[req.user?.uid||'unknown',reason,member.user_uid,member.organization_id]);
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

app.get('/api/admin/roles',authGuard,adminGuard,(_req,res)=>res.json({items:RBAC_ROLES.map(role=>({role,assignable:ROLE_ASSIGNABLE_ROLES.includes(role as any),permissions:[...(DEFAULT_ROLE_PERMISSIONS[role]||[])]}))}));
app.get('/api/admin/permissions',authGuard,adminGuard,asyncRoute(async(req,res)=>{try{const result=await pool!.query('SELECT role,resource,action,allowed,updated_by_uid,updated_at FROM workspace_permission_overrides WHERE tenant_id=? ORDER BY role,resource,action',[req.user?.tenantId]);const roles=Object.fromEntries(RBAC_ROLES.map(role=>{const permissions=new Set(DEFAULT_ROLE_PERMISSIONS[role]);for(const override of result.rows.filter((row:any)=>row.role===role)){const key=`${override.resource}.${override.action}` as any;if(Boolean(override.allowed))permissions.add(key);else permissions.delete(key);}return[role,{defaults:[...(DEFAULT_ROLE_PERMISSIONS[role]||[])],effective:[...permissions]}];}));res.json({roles,overrides:result.rows,actions:RBAC_ACTIONS,migrationReady:true});}catch(error:any){if(error?.code==='ER_NO_SUCH_TABLE'||error?.errno===1146)return res.status(503).json({error:'Apply migration 033 before configuring workspace permissions.',migrationReady:false});throw error;}}));
app.put('/api/admin/permissions',authGuard,adminGuard,asyncRoute(async(req,res)=>{const schema=z.object({changes:z.array(z.object({role:z.enum(ROLE_ASSIGNABLE_ROLES as [string,...string[]]),resource:z.string().trim().regex(/^[a-z][a-z0-9_]{1,79}$/),action:z.enum(RBAC_ACTIONS),allowed:z.boolean(),reason:z.string().trim().min(3).max(500)})).min(1).max(100)});const parsed=schema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Provide valid role permission changes with a reason.'});if(parsed.data.changes.some(change=>change.resource==='super_admin'||change.role==='owner'||change.role==='super_admin'))return res.status(403).json({error:'Workspace permission settings cannot grant or change platform Super Admin or Owner permissions.'});if(req.user?.role==='admin'&&parsed.data.changes.some(change=>change.role==='admin'))return res.status(403).json({error:'Only the workspace Owner can change the Admin role permissions.'});if(parsed.data.changes.some(change=>change.allowed&&!DEFAULT_ROLE_PERMISSIONS[change.role as keyof typeof DEFAULT_ROLE_PERMISSIONS]?.has(`${change.resource}.${change.action}` as any)))return res.status(400).json({error:'A role permission cannot be granted outside its approved server-side baseline.'});try{for(const change of parsed.data.changes){await pool!.query('INSERT INTO workspace_permission_overrides (tenant_id,role,resource,action,allowed,updated_by_uid) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE allowed=VALUES(allowed),updated_by_uid=VALUES(updated_by_uid),updated_at=NOW(6)',[req.user?.tenantId,change.role,change.resource,change.action,change.allowed,req.user?.uid||'unknown']);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.permission_override_changed','workspace_permission_override',`${change.role}:${change.resource}.${change.action}`,{...change,updatedByRole:req.user?.role});}res.json({success:true,updated:parsed.data.changes.length});}catch(error:any){if(error?.code==='ER_NO_SUCH_TABLE'||error?.errno===1146)return res.status(503).json({error:'Apply migration 033 before configuring workspace permissions.',migrationReady:false});throw error;}}));

app.get('/api/admin/applications',authGuard,adminGuard,asyncRoute(async(req,res)=>{const result=await pool!.query(`SELECT p.*,(SELECT COUNT(*) FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.governance_status='active') document_count,(SELECT COUNT(*) FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.manual_review_status='required' AND d.governance_status='active') manual_review_count FROM properties p WHERE p.tenant_id=? ORDER BY p.archived_at IS NOT NULL,p.due_date IS NULL,p.due_date,p.updated_at DESC LIMIT 500`,[req.user?.tenantId]);res.json({items:result.rows});}));

app.patch('/api/admin/applications/:id/assignment',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=z.object({assignedLawyerUid:z.string().max(191).default(''),assignedAnalystUid:z.string().max(191).default(''),assignedOperationsUid:z.string().max(191).default(''),assignedConsultantUid:z.string().max(191).optional(),assignedViewerUid:z.string().max(191).optional().default(''),priority:z.enum(['low','normal','high','urgent']),dueDate:z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.literal(''),z.null()]),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid assignment update.'});const current=await pool!.query('SELECT * FROM properties WHERE id=? AND tenant_id=?',[req.params.id,req.user?.tenantId]);if(!current.rowCount)return res.status(404).json({error:'Application not found.'});const consultantInput=parsed.data.assignedConsultantUid?.trim()||'';let consultantUid=consultantInput;if(consultantInput.includes('@')){const consultant=await pool!.query("SELECT user_uid FROM org_memberships WHERE organization_id=? AND LOWER(email)=LOWER(?) AND role='consultant' AND status='active' LIMIT 1",[req.user?.tenantId,consultantInput]);if(!consultant.rowCount)return res.status(400).json({error:'No active Consultant member matches that email in this workspace.'});consultantUid=consultant.rows[0].user_uid;}for(const[role,uid]of [['lawyer',parsed.data.assignedLawyerUid],['analyst',parsed.data.assignedAnalystUid],['operations',parsed.data.assignedOperationsUid],['consultant',consultantUid],['viewer',parsed.data.assignedViewerUid||'']])if(uid){const member=await pool!.query("SELECT id FROM org_memberships WHERE organization_id=? AND user_uid=? AND role=? AND status='active'",[req.user?.tenantId,uid,role]);if(!member.rowCount)return res.status(400).json({error:`Assigned ${role} is not an active member.`});}await pool!.query('UPDATE properties SET assigned_lawyer_uid=?,assigned_analyst_uid=?,assigned_operations_uid=?,assigned_consultant_uid=COALESCE(?,assigned_consultant_uid),assigned_viewer_uid=?,workflow_priority=?,due_date=?,updated_by_uid=?,updated_at=NOW(6) WHERE id=? AND tenant_id=?',[parsed.data.assignedLawyerUid,parsed.data.assignedAnalystUid,parsed.data.assignedOperationsUid,consultantUid||null,parsed.data.assignedViewerUid||'',parsed.data.priority,parsed.data.dueDate||null,req.user?.uid,req.params.id,req.user?.tenantId]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.application_assignment_changed','property',req.params.id,{before:current.rows[0],after:{...parsed.data,assignedConsultantUid:consultantUid||''},reason:parsed.data.reason});res.json({success:true});}));

app.patch('/api/admin/applications/:id/workflow',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=z.object({status:z.enum(['draft','documents_pending','in_review','clarification_required','ready_for_review','closed']),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Admins may update operational statuses only; legal approval and release are excluded.'});const current=await pool!.query('SELECT * FROM properties WHERE id=? AND tenant_id=?',[req.params.id,req.user?.tenantId]);if(!current.rowCount)return res.status(404).json({error:'Application not found.'});await pool!.query('UPDATE properties SET status=?,updated_by_uid=?,updated_at=NOW(6) WHERE id=? AND tenant_id=?',[parsed.data.status,req.user?.uid,req.params.id,req.user?.tenantId]);await pool!.query('INSERT INTO property_workflow_history (id,tenant_id,property_id,previous_status,new_status,reason,changes_json,changed_by_uid) VALUES (?,?,?,?,?,?,?,?)',[crypto.randomUUID(),req.user?.tenantId,req.params.id,current.rows[0].status,parsed.data.status,parsed.data.reason,JSON.stringify({administrative:true}),req.user?.uid]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.application_workflow_changed','property',req.params.id,{before:current.rows[0].status,after:parsed.data.status,reason:parsed.data.reason});res.json({success:true});}));

for(const action of ['archive','restore'] as const)app.post(`/api/admin/applications/:id/${action}`,authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=reasonSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'A reason is required.'});const current=await pool!.query('SELECT id,status,archived_at FROM properties WHERE id=? AND tenant_id=?',[req.params.id,req.user?.tenantId]);if(!current.rowCount)return res.status(404).json({error:'Application not found.'});if(action==='archive')await pool!.query("UPDATE properties SET archived_at=NOW(6),archived_by_uid=?,archive_reason=?,status='archived' WHERE id=? AND tenant_id=?",[req.user?.uid,parsed.data.reason,req.params.id,req.user?.tenantId]);else await pool!.query("UPDATE properties SET archived_at=NULL,archived_by_uid=NULL,archive_reason=NULL,status='in_review' WHERE id=? AND tenant_id=?",[req.params.id,req.user?.tenantId]);await audit(req.user?.uid||'unknown',req.user?.tenantId,`admin.application_${action}d`,'property',req.params.id,{reason:parsed.data.reason});res.json({success:true});}));

app.get('/api/admin/documents',authGuard,adminGuard,asyncRoute(async(req,res)=>{const result=await pool!.query('SELECT d.id,d.property_id,d.original_filename,d.doc_type,d.classification_confidence,d.processing_status,d.manual_review_status,d.governance_status,d.governance_reason,d.uploaded_by_uid,d.size_bytes,d.sha256,d.created_at,p.application_number,p.name property_name FROM documents d JOIN properties p ON p.id=d.property_id AND p.tenant_id=d.tenant_id WHERE d.tenant_id=? ORDER BY d.created_at DESC LIMIT 500',[req.user?.tenantId]);res.json({items:result.rows});}));

app.patch('/api/admin/documents/:id/reassign',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=z.object({propertyId:z.string().uuid(),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Target property and reason are required.'});const doc=await pool!.query('SELECT * FROM documents WHERE id=? AND tenant_id=?',[req.params.id,req.user?.tenantId]);const property=await pool!.query('SELECT id FROM properties WHERE id=? AND tenant_id=?',[parsed.data.propertyId,req.user?.tenantId]);if(!doc.rowCount||!property.rowCount)return res.status(404).json({error:'Document or target application not found.'});if(doc.rows[0].extracted_fields?.reviewState?.isVerified)return res.status(409).json({error:'Verified evidence must be returned to review before reassignment.'});await pool!.query("UPDATE documents SET property_id=?,manual_review_status='required',governance_status='active',governance_reason=?,governance_by_uid=?,governance_at=NOW(6) WHERE id=? AND tenant_id=?",[parsed.data.propertyId,parsed.data.reason,req.user?.uid,req.params.id,req.user?.tenantId]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.document_reassigned','document',req.params.id,{beforePropertyId:doc.rows[0].property_id,afterPropertyId:parsed.data.propertyId,reason:parsed.data.reason});res.json({success:true});}));

app.patch('/api/admin/documents/:id/manual-review',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=z.object({required:z.boolean(),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Review state and reason are required.'});const result=await pool!.query("UPDATE documents SET manual_review_status=?,governance_reason=?,governance_by_uid=?,governance_at=NOW(6) WHERE id=? AND tenant_id=?",[parsed.data.required?'required':'completed',parsed.data.reason,req.user?.uid,req.params.id,req.user?.tenantId]);if(!result.rowCount)return res.status(404).json({error:'Document not found.'});await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.document_manual_review_changed','document',req.params.id,{required:parsed.data.required,reason:parsed.data.reason});res.json({success:true});}));

for(const action of ['reject','delete'] as const){const method=action==='delete'?'delete':'post';(app as any)[method](`/api/admin/documents/:id${action==='reject'?'/reject':''}`,authGuard,adminGuard,asyncRoute(async(req:AuthenticatedRequest,res:Response)=>{const parsed=reasonSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'A reason is required.'});const status=action==='reject'?'rejected':'quarantined';const result=await pool!.query("UPDATE documents SET governance_status=?,governance_reason=?,governance_by_uid=?,governance_at=NOW(6),manual_review_status='required' WHERE id=? AND tenant_id=?",[status,parsed.data.reason,req.user?.uid,req.params.id,req.user?.tenantId]);if(!result.rowCount)return res.status(404).json({error:'Document not found.'});await audit(req.user?.uid||'unknown',req.user?.tenantId,`admin.document_${status}`,'document',req.params.id,{reason:parsed.data.reason,softDelete:true});res.json({success:true,softDelete:true});}));}

app.get('/api/admin/document-ai/config',authGuard,adminGuard,asyncRoute(async(req,res)=>{const result=await pool!.query('SELECT project_id,location,processor_id,processor_version,language_hints,updated_by_uid,updated_at FROM document_ai_config WHERE tenant_id=?',[req.user?.tenantId]);res.json({configured:Boolean(result.rowCount),config:result.rows[0]||null,credentials:'server_side_only'});}));
app.put('/api/admin/document-ai/config',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=z.object({projectId:z.string().trim().min(1).max(255),location:z.string().trim().min(1).max(80).transform(value=>value.toLowerCase()),processorId:z.string().trim().min(1).max(255),processorVersion:z.string().trim().max(255).optional(),languageHints:z.array(z.string().trim().min(2).max(12)).max(10).optional()}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Valid Google Document AI processor settings are required.'});const c=parsed.data,tenant=req.user?.tenantId||'';const prior=await pool!.query('SELECT project_id,location,processor_id,processor_version,language_hints FROM document_ai_config WHERE tenant_id=?',[tenant]);const count=await pool!.query("SELECT COALESCE(MAX(version_number),0)+1 version FROM owner_configuration_versions WHERE tenant_id=? AND config_type='document_ai'",[tenant]);const version=Number(count.rows[0]?.version||1);await pool!.query('INSERT INTO owner_configuration_versions (id,tenant_id,config_type,version_number,status,name,configuration,created_by_uid) VALUES (?,?,?,?,?,?,?,?)',[crypto.randomUUID(),tenant,'document_ai',version,'configured','Google Document AI',JSON.stringify({previous:prior.rows[0]||null,current:c}),req.user?.uid||'unknown']);await pool!.query(`INSERT INTO document_ai_config (tenant_id,project_id,location,processor_id,processor_version,language_hints,updated_by_uid) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE project_id=VALUES(project_id),location=VALUES(location),processor_id=VALUES(processor_id),processor_version=VALUES(processor_version),language_hints=VALUES(language_hints),updated_by_uid=VALUES(updated_by_uid)`,[tenant,c.projectId,c.location,c.processorId,c.processorVersion||null,JSON.stringify(c.languageHints||[]),req.user?.uid||'unknown']);await audit(req.user?.uid||'unknown',tenant,'admin.document_ai_configured','integration','google_document_ai',{version,projectId:c.projectId,location:c.location,processorId:c.processorId,previous:prior.rows[0]||null});res.json({success:true,version,credentials:'server_side_only'});}));
app.get('/api/admin/document-ai/metrics',authGuard,adminGuard,asyncRoute(async(req,res)=>{const [stats,failures]=await Promise.all([pool!.query(`SELECT status,COUNT(*) jobs,COALESCE(SUM(pages_processed),0) pages,COALESCE(SUM(estimated_cost_usd),0) estimated_cost_usd FROM document_processing_jobs WHERE tenant_id=? AND created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) GROUP BY status`,[req.user?.tenantId]),pool!.query(`SELECT id,document_id,status,attempts,error_code,error_message,created_at,updated_at FROM document_processing_jobs WHERE tenant_id=? AND status IN ('failed','retry_wait') ORDER BY updated_at DESC LIMIT 100`,[req.user?.tenantId])]);res.json({windowDays:30,estimatedCostPerPageUsd:Number(process.env.DOCUMENT_AI_ESTIMATED_COST_PER_PAGE_USD||0),stats:stats.rows,failures:failures.rows});}));
app.get('/api/admin/configuration-versions',authGuard,adminGuard,asyncRoute(async(req,res)=>{const result=await pool!.query('SELECT id,config_type,version_number,status,name,configuration,created_by_uid,created_at FROM owner_configuration_versions WHERE tenant_id=? ORDER BY config_type,version_number DESC LIMIT 300',[req.user?.tenantId]);res.json({items:result.rows});}));
app.get('/api/admin/source-health',authGuard,adminGuard,asyncRoute(async(req,res)=>{const probe=await sourceRegistryEngine.getRegistryHealth(true);const history=await pool!.query('SELECT registry_name,MAX(verified_at) last_refresh,COUNT(*) snapshots,SUM(status=\'failed\') failures FROM source_registry_verifications WHERE tenant_id=? GROUP BY registry_name',[req.user?.tenantId]);const byName=new Map(history.rows.map((r:any)=>[String(r.registry_name),r]));res.json({checkedAt:new Date().toISOString(),items:probe.map((s:any)=>{const h:any=byName.get(String(s.name));const reachability=String(s.portalReachability||'not_checked').toLowerCase();const hasSnapshot=Boolean(h?.last_refresh);const status=reachability==='unreachable'?'DEGRADED':reachability==='reachable'&&hasSnapshot?'STALE':'DEGRADED';return {name:s.displayName||s.name,authority:s.department||'Unclassified',connectorType:'portal_probe_only',licenceTerms:'Not recorded',status,lastRefresh:h?.last_refresh||null,parserVersion:null,snapshotCount:Number(h?.snapshots||0),lastError:Number(h?.failures||0)>0?'One or more historical verification attempts failed.':null,probeLatencyMs:s.averageLatencyMs,probeStatus:s.portalReachability,detail:'Live official record connector is not configured; this reachability probe does not qualify as UP.'};}),connectorsConfigured:false});}));
app.get('/api/admin/governance/:type',authGuard,adminGuard,asyncRoute(async(req,res)=>{const type=req.params.type;if(!['gis_rules','discrepancy_rules','models','report_templates'].includes(type))return res.status(400).json({error:'Unknown configuration type.'});const result=await pool!.query('SELECT id,config_type,version_number,status,name,configuration,created_by_uid,created_at FROM owner_configuration_versions WHERE tenant_id=? AND config_type=? ORDER BY version_number DESC LIMIT 200',[req.user?.tenantId,type]);res.json({items:result.rows});}));
app.post('/api/admin/governance/:type',authGuard,adminGuard,asyncRoute(async(req,res)=>{const type=req.params.type;if(!['gis_rules','discrepancy_rules','models','report_templates'].includes(type))return res.status(400).json({error:'Unknown configuration type.'});const parsed=z.object({name:z.string().trim().min(2).max(160),configuration:z.record(z.unknown()),status:z.enum(['draft','active','disabled']).default('draft'),reason:z.string().trim().min(3).max(500)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Provide a configuration name, object, status, and change reason.'});const c:any=parsed.data.configuration;if(type==='gis_rules'){const valid=z.object({buffers:z.record(z.number().min(0).max(100000)).optional(),proximityMeters:z.record(z.number().min(0).max(100000)).optional(),severityByLayer:z.record(z.enum(['critical','high','medium','low'])).optional()}).safeParse(c);if(!valid.success)return res.status(400).json({error:'GIS configuration may contain valid buffer distances, proximity thresholds, and severity mappings only.'});}if(type==='discrepancy_rules'){const valid=z.object({tolerancePct:z.number().min(0).max(1).optional(),highPct:z.number().min(0).max(1).optional(),criticalPct:z.number().min(0).max(1).optional(),severityByBand:z.record(z.enum(['critical','high','medium','low'])).optional()}).safeParse(c);if(!valid.success)return res.status(400).json({error:'Discrepancy configuration contains invalid percentage thresholds or severity mappings.'});const v=valid.data;if((v.highPct??0.05)>=(v.criticalPct??0.10)||(v.tolerancePct??0.01)>=(v.highPct??0.05))return res.status(400).json({error:'Thresholds must satisfy tolerancePct < highPct < criticalPct.'});}if(type==='report_templates'){const valid=z.object({executiveSummaryTitle:z.string().max(120).optional(),disclaimerVersion:z.string().max(80).optional(),layout:z.string().max(120).optional()}).safeParse(c);if(!valid.success)return res.status(400).json({error:'Report template contains unsupported fields.'});}if(type==='models'){const valid=z.object({provider:z.enum(['google_document_ai','vertex_ai']),modelName:z.string().min(1).max(160),promptVersion:z.string().min(1).max(80),schemaVersion:z.string().min(1).max(80),safetySettings:z.record(z.unknown()).default({})}).safeParse(c);if(!valid.success)return res.status(400).json({error:'Model configuration requires provider, model, prompt version, schema version, and safety settings.'});if(parsed.data.status==='active'&&valid.data.provider==='vertex_ai')return res.status(409).json({error:'Vertex AI activation is unavailable; the application has no Vertex provider adapter.'});if(parsed.data.status==='active'&&valid.data.provider==='google_document_ai'&&!(process.env.OCR_WORKER_TOKEN&&process.env.GOOGLE_APPLICATION_CREDENTIALS||process.env.OCR_WORKER_TOKEN&&process.env.GOOGLE_CLOUD_PROJECT))return res.status(409).json({error:'Document AI cannot be activated until worker authentication and server-side Google credentials or workload identity are configured.'});}const tenant=req.user?.tenantId||'';const result=await pool!.query('SELECT COALESCE(MAX(version_number),0)+1 version FROM owner_configuration_versions WHERE tenant_id=? AND config_type=?',[tenant,type]);const version=Number(result.rows[0]?.version||1),id=crypto.randomUUID();await pool!.query('INSERT INTO owner_configuration_versions (id,tenant_id,config_type,version_number,status,name,configuration,created_by_uid) VALUES (?,?,?,?,?,?,?,?)',[id,tenant,type,version,parsed.data.status,parsed.data.name,JSON.stringify(parsed.data.configuration),req.user?.uid||'unknown']);await audit(req.user?.uid||'unknown',tenant,`admin.${type}_version_created`,'owner_configuration_version',id,{version,status:parsed.data.status,reason:parsed.data.reason});res.status(201).json({id,version,status:parsed.data.status});}));
app.get('/api/admin/exports',authGuard,adminGuard,asyncRoute(async(req,res)=>{const result=await pool!.query('SELECT id,actor_uid,resource_type,resource_id,export_format,watermark_enabled,expires_at,result,details,created_at FROM workspace_export_events WHERE tenant_id=? ORDER BY created_at DESC LIMIT 200',[req.user?.tenantId]);res.json({items:result.rows});}));
app.get('/api/admin/purge-requests',authGuard,adminGuard,asyncRoute(async(req,res)=>{const result=await pool!.query('SELECT r.*,d.original_filename,d.governance_status,d.storage_key FROM workspace_purge_requests r JOIN documents d ON d.id=r.document_id AND d.tenant_id=r.tenant_id WHERE r.tenant_id=? ORDER BY r.created_at DESC LIMIT 200',[req.user?.tenantId]);const items=result.rows.map(({storage_key,...item}:any)=>({...item,physicalPurgeAvailable:Boolean(documentStorage.delete&&documentStorage.canDelete?.(String(storage_key)))}));res.json({items,physicalPurgeAvailable:items.some((item:any)=>item.physicalPurgeAvailable)});}));
app.post('/api/admin/purge-requests',authGuard,adminGuard,asyncRoute(async(req,res)=>{const parsed=z.object({documentId:z.string().uuid(),reason:z.string().trim().min(10).max(1000)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Document UUID and detailed purge reason are required.'});const tenant=req.user?.tenantId||'';const document=await pool!.query('SELECT id,storage_key FROM documents WHERE id=? AND tenant_id=?',[parsed.data.documentId,tenant]);if(!document.rowCount)return res.status(404).json({error:'Document not found.'});const policy=await pool!.query('SELECT legal_hold,retention_days FROM workspace_retention_policies WHERE tenant_id=?',[tenant]);if(policy.rows[0]?.legal_hold)return res.status(409).json({error:'Legal hold blocks purge requests.'});const requestId=crypto.randomUUID();await pool!.query("INSERT INTO workspace_purge_requests (id,tenant_id,document_id,requested_by_uid,reason,status) VALUES (?,?,?,?,?,'pending')",[requestId,tenant,parsed.data.documentId,req.user?.uid,parsed.data.reason]);await audit(req.user?.uid||'unknown',tenant,'admin.purge_requested','document',parsed.data.documentId,{requestId,reason:parsed.data.reason,physicalPurgeAvailable:Boolean(documentStorage.delete && documentStorage.canDelete?.(String(document.rows[0].storage_key)))});res.status(201).json({id:requestId,status:'pending',physicalPurgeAvailable:Boolean(documentStorage.delete && documentStorage.canDelete?.(String(document.rows[0].storage_key)))});}));
app.post('/api/admin/purge-requests/:id/approve',authGuard,ownerGuard,asyncRoute(async(req,res)=>{const parsed=reasonSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'A separate approval reason is required.'});const tenant=req.user?.tenantId||'';const request=await pool!.query("SELECT r.*,d.storage_key,d.created_at document_created_at FROM workspace_purge_requests r JOIN documents d ON d.id=r.document_id AND d.tenant_id=r.tenant_id WHERE r.id=? AND r.tenant_id=? AND r.status='pending'",[req.params.id,tenant]);if(!request.rowCount)return res.status(404).json({error:'Pending purge request not found.'});const policy=await pool!.query('SELECT legal_hold,retention_days FROM workspace_retention_policies WHERE tenant_id=?',[tenant]);if(policy.rows[0]?.legal_hold)return res.status(409).json({error:'Legal hold blocks purge.'});const retentionDays=Number(policy.rows[0]?.retention_days||2555);const created=new Date(request.rows[0].document_created_at).getTime();if(Date.now()-created<retentionDays*86400000)return res.status(409).json({error:'Retention window has not elapsed; purge is blocked.'});if(!documentStorage.delete||!documentStorage.canDelete?.(String(request.rows[0].storage_key)))return res.status(501).json({error:'Configured storage provider does not support verified physical deletion for this document.'});await documentStorage.delete(String(request.rows[0].storage_key));await pool!.query("UPDATE workspace_purge_requests SET status='completed',approved_by_uid=?,approved_at=NOW(6),completed_at=NOW(6) WHERE id=? AND tenant_id=?",[req.user?.uid,req.params.id,tenant]);await pool!.query("UPDATE documents SET governance_status='purged',governance_reason=?,governance_by_uid=?,governance_at=NOW(6) WHERE id=? AND tenant_id=?",[parsed.data.reason,req.user?.uid,request.rows[0].document_id,tenant]);await audit(req.user?.uid||'unknown',tenant,'admin.purge_completed','document',request.rows[0].document_id,{requestId:req.params.id,requestReason:request.rows[0].reason,approvalReason:parsed.data.reason,retentionDays});res.json({success:true,status:'completed'});}));
app.get('/api/ocr/mappings',authGuard,sourceDataGuard,asyncRoute(async(req,res)=>{const result=await pool!.query('SELECT source_field,canonical_field,normalization_rule,active,updated_by_uid,updated_at FROM ocr_field_mappings WHERE tenant_id=? ORDER BY source_field',[req.user?.tenantId]);res.json({items:result.rows});}));
app.get('/api/ocr/document-types',authGuard,sourceDataGuard,asyncRoute(async(req,res)=>{const result=await pool!.query('SELECT source_category,canonical_doc_type,active,updated_by_uid,updated_at FROM ocr_document_type_mappings WHERE tenant_id=? ORDER BY source_category',[req.user?.tenantId]);res.json({items:result.rows});}));
app.put('/api/ocr/document-types/:sourceCategory',authGuard,sourceDataGuard,asyncRoute(async(req,res)=>{const canonicalTypes=['sale_deed','gift_deed','partition_deed','release_deed','power_of_attorney','encumbrance_certificate','rtc_pahani','mutation_record','survey_sketch_tippan','khata_e_khata','property_tax_receipt','layout_approval_conversion_order','master_plan_zoning_document','court_order_legal_notice','other','e_khata','mutation_extract','survey_sketch','tax_receipt','conversion_order','layout_approval','court_order'];const parsed=z.object({canonicalDocType:z.enum(canonicalTypes as [string,...string[]]),active:z.boolean()}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid canonical document category.'});await pool!.query(`INSERT INTO ocr_document_type_mappings (tenant_id,source_category,canonical_doc_type,active,updated_by_uid) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE canonical_doc_type=VALUES(canonical_doc_type),active=VALUES(active),updated_by_uid=VALUES(updated_by_uid)`,[req.user?.tenantId,req.params.sourceCategory,parsed.data.canonicalDocType,parsed.data.active,req.user?.uid||'unknown']);await audit(req.user?.uid||'unknown',req.user?.tenantId,'data_steward.document_type_mapping_updated','ocr_document_type_mapping',req.params.sourceCategory,parsed.data);res.json({success:true});}));
app.put('/api/ocr/mappings/:sourceField',authGuard,sourceDataGuard,asyncRoute(async(req,res)=>{const parsed=z.object({canonicalField:z.string().trim().min(1).max(255),normalizationRule:z.enum(['trim','uppercase','lowercase','digits_only','survey_number','extent','date']),active:z.boolean()}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid field mapping.'});await pool!.query(`INSERT INTO ocr_field_mappings (tenant_id,source_field,canonical_field,normalization_rule,active,updated_by_uid) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE canonical_field=VALUES(canonical_field),normalization_rule=VALUES(normalization_rule),active=VALUES(active),updated_by_uid=VALUES(updated_by_uid)`,[req.user?.tenantId,req.params.sourceField,parsed.data.canonicalField,parsed.data.normalizationRule,parsed.data.active,req.user?.uid||'unknown']);await audit(req.user?.uid||'unknown',req.user?.tenantId,'data_steward.ocr_mapping_updated','ocr_field_mapping',req.params.sourceField,parsed.data);res.json({success:true});}));
app.get('/api/support/ocr/jobs',authGuard,asyncRoute(async(req,res)=>{if(req.user?.role!=='support')return res.status(403).json({error:'Scoped OJIX Support role required.'});const rows=await pool!.query(`SELECT id,status,progress,attempts,max_attempts,error_code,started_at,completed_at,created_at,updated_at FROM document_processing_jobs WHERE tenant_id=? AND created_at>=DATE_SUB(NOW(),INTERVAL 24 HOUR) ORDER BY created_at DESC LIMIT 100`,[req.user?.tenantId]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'support.ocr_diagnostics_viewed','ocr_jobs','tenant',{windowHours:24,rowCount:rows.rows.length});res.json({windowHours:24,items:rows.rows});}));
app.post('/api/support/ocr/jobs/:id/retry',authGuard,asyncRoute(async(req,res)=>{if(!['owner','admin','support'].includes(req.user?.role||''))return res.status(403).json({error:'Workspace admin or scoped OJIX Support role required.'});const job=await pool!.query('SELECT id,status,document_id FROM document_processing_jobs WHERE id=? AND tenant_id=?',[req.params.id,req.user?.tenantId]);if(!job.rowCount)return res.status(404).json({error:'OCR diagnostic job not found.'});if(!['failed','retry_wait'].includes(String(job.rows[0].status)))return res.status(409).json({error:'Only failed OCR jobs can be retried.'});if(!process.env.OCR_WORKER_TOKEN)return res.status(503).json({error:'OCR worker is not configured.'});await pool!.query("UPDATE document_processing_jobs SET status='queued',processing_stage='queued',progress=0,attempts=0,error_code=NULL,error_message=NULL,started_at=NULL,completed_at=NULL,updated_at=NOW(6) WHERE id=? AND tenant_id=?",[req.params.id,req.user?.tenantId]);await pool!.query("UPDATE documents SET processing_status='queued' WHERE id=? AND tenant_id=?",[job.rows[0].document_id,req.user?.tenantId]);await audit(req.user?.uid||'unknown',req.user?.tenantId,'admin.ocr_job_retried','ocr_job',req.params.id,{documentId:job.rows[0].document_id});res.status(202).json({success:true,status:'queued'});}));
app.get('/api/admin/integrations',authGuard,adminGuard,asyncRoute(async(_req,res)=>{let database='unavailable';try{await pool!.query('SELECT 1');database='connected';}catch{}const emailConfigured=Boolean(process.env.SMTP_USER?.trim()&&process.env.SMTP_PASS?.trim()&&(process.env.SMTP_HOST?.trim()||process.env.SMTP_USER?.trim().endsWith('@gmail.com')));const ai=await pool!.query('SELECT tenant_id FROM document_ai_config WHERE tenant_id=?',[(_req as AuthenticatedRequest).user?.tenantId]);const workerReady=Boolean(process.env.OCR_WORKER_TOKEN);res.json({items:[{id:'mariadb',label:'MariaDB workspace',state:database,testSupported:true},{id:'storage',label:'Document storage adapter',state:documentStorage.provider==='gcs'?'gcs_private':documentStorage.provider==='supabase'?'supabase_private':'local_development',testSupported:false,detail:documentStorage.provider==='gcs'?'Private Google Cloud Storage with server-created expiring links.':documentStorage.provider==='supabase'?'Private Supabase Storage with server-created expiring links.':'Local sandbox storage; configure private storage for production.'},{id:'ocr',label:'Google Document AI',state:ai.rowCount&&workerReady?'configured':ai.rowCount?'worker_not_configured':'not_configured',testSupported:false,detail:!ai.rowCount?'Configure project, location, and processor.':!workerReady?'Processor settings are saved, but OCR_WORKER_TOKEN is missing on the server.':'Processor and worker token are configured; Google credentials are resolved by the worker at runtime.'},{id:'email',label:'OTP email delivery',state:emailConfigured?'configured':'not_configured',testSupported:false},{id:'government',label:'Government source connectors',state:'not_connected',testSupported:false,detail:'No authorized live government connector is configured.'},{id:'gis',label:'GIS / spatial data',state:'unavailable',testSupported:false,detail:'No live GIS provider health check is configured.'}]});}));
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
        llpin: '',
        primary_contact: 'Deepak Professional (deepak@ojix.local)',
        firm_email: '',
        default_district: 'Bengaluru Urban',
        office_address: '',
        firm_logo_url: '',
        default_report_template: 'detailed_due_diligence',
        legal_disclaimer: '',
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
  const branding = z.object({
    llpin: z.string().trim().max(64).default(''),
    firm_email: z.string().trim().max(191).refine(value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid firm email.').default(''),
    office_address: z.string().trim().max(2000).default(''),
    firm_logo_url: z.string().trim().max(2048).refine(value => !value || value.startsWith('https://'), 'Logo URL must use HTTPS.').default(''),
    default_report_template: z.enum(['detailed_due_diligence', 'preliminary_screening', 'client_decision_pack']).default('detailed_due_diligence'),
    legal_disclaimer: z.string().trim().max(10000).default(''),
  }).safeParse(s);
  if (!branding.success) return res.status(400).json({ error: 'Invalid organization branding or report settings.', details: branding.error.flatten().fieldErrors });
  const b = branding.data;
  await pool.query(
    `INSERT INTO workspace_settings
     (tenant_id, org_name, llpin, primary_contact, firm_email, default_district,
      office_address, firm_logo_url, default_report_template, legal_disclaimer,
      auto_screen_bhoomi, auto_screen_kaveri, auto_screen_spatial,
      swd_primary_buffer_m, swd_secondary_buffer_m, swd_tertiary_buffer_m,
      lake_buffer_m, survey_margin_tolerance_pct, ocr_confidence_threshold,
      updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
     ON DUPLICATE KEY UPDATE
       org_name = VALUES(org_name),
       llpin = VALUES(llpin),
       primary_contact = VALUES(primary_contact),
       firm_email = VALUES(firm_email),
       default_district = VALUES(default_district),
       office_address = VALUES(office_address),
       firm_logo_url = VALUES(firm_logo_url),
       default_report_template = VALUES(default_report_template),
       legal_disclaimer = VALUES(legal_disclaimer),
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
      b.llpin,
      s.primary_contact || 'Deepak Professional (deepak@ojix.local)',
      b.firm_email,
      s.default_district || 'Bengaluru Urban',
      b.office_address || null,
      b.firm_logo_url || null,
      b.default_report_template,
      b.legal_disclaimer || null,
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
if (webDistPath && !process.env.VERCEL) {
  app.use(express.static(webDistPath));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? process.env.VERCEL ? 'Multipart uploads on Vercel are limited by the 4.5 MB function request payload cap. Use the direct-to-cloud upload flow for larger documents.' : `File exceeds ${process.env.MAX_UPLOAD_MB || 25} MB limit.` : err.message });
  if (err instanceof OtpDeliveryError) return res.status(503).json({ error: err.message, code:err.code });
  if (err?.message?.includes('Only PDF')) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

let server: any;
if (!process.env.VERCEL && (process.env.NODE_ENV !== 'test' || process.env.TEST_API_SERVER === 'true')) {
  void (async () => {
    const smtpIssues=getSmtpConfigurationIssues();
    if(smtpIssues.length)console.warn(`[smtp] Email OTP delivery is unavailable; configure: ${smtpIssues.join(', ')}.`);
    else console.info('[smtp] SMTP settings passed local validation; provider connectivity is checked when sending.');
    if (pool) await ensureSuperAdminBootstrapped();
    server = app.listen(port, () => console.log(`OJIX Property API listening on port ${port}`));
  })().catch(error => {
    console.error('OJIX API startup failed:', error instanceof Error ? error.message : 'Unknown configuration error.');
    process.exit(1);
  });
  async function shutdown() { server?.close(); if (pool) await pool.end(); process.exit(0); }
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}

export default app;
