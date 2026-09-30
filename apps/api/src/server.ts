import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';
import { z } from 'zod';
import { calculateRisk, buildBaselineFindings, type RiskFinding } from './risk-engine.js';
import { extractDocument, type ExtractionInput } from './document-extractor.js';
import type { ExtractedDocumentFields } from './types.js';
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
import { sourceRegistryEngine, type RegistryName, type RegistryVerificationResult } from './source-registry-engine.js';


const { Pool } = pg;
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env'), override: false });
const app = express();
const port = Number(process.env.PORT || 4000);
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 }) : null;
if (pool) {
  try {
    await pool.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type varchar(50)');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS title_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
        sequence_order integer NOT NULL DEFAULT 1,
        event_date date NOT NULL,
        registration_date date,
        deed_type text NOT NULL,
        from_parties jsonb NOT NULL DEFAULT '[]'::jsonb,
        to_parties jsonb NOT NULL DEFAULT '[]'::jsonb,
        extent_sq_ft numeric NOT NULL DEFAULT 0,
        extent_raw text NOT NULL DEFAULT '',
        consideration numeric NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('verified','unverified','disputed')),
        dispute_rationale text,
        reviewed_by text,
        encumbrance_status text DEFAULT 'none' CHECK (encumbrance_status IN ('active_mortgage','discharged','none')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS title_events_property_idx ON title_events(tenant_id, property_id, event_date ASC);

      CREATE TABLE IF NOT EXISTS title_reviews (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        event_id uuid NOT NULL REFERENCES title_events(id) ON DELETE CASCADE,
        status text NOT NULL CHECK (status IN ('verified','disputed','unverified')),
        rationale text,
        reviewer_uid text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS title_reviews_event_idx ON title_reviews(tenant_id, event_id, created_at DESC);
    `);
  } catch (err) {
    console.warn('Idempotent column/table migration notice:', err);
  }
}
let firebaseAuth: any = null;
if (process.env.FIREBASE_PROJECT_ID) {
  try {
    const admin = (await import('firebase-admin')) as any;
    if (!admin.getApps().length) admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    firebaseAuth = admin.getAuth();
  } catch (e) { console.error('Firebase Auth initialisation failed; refusing production startup.', e); process.exit(1); }
}

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: corsOrigin.split(',').map(s => s.trim()), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

interface AuthenticatedRequest extends Request { user?: { uid: string; email?: string; tenantId?: string; role?: string }; }
async function authGuard(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  let identity: { uid: string; email?: string };
  if (!firebaseAuth) {
    if (process.env.NODE_ENV === 'production') return res.status(503).json({ error: 'Authentication is not configured.' });
    identity = { uid: 'local-developer', email: 'developer@localhost' };
  } else {
    const token = authReq.header('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Bearer token required.' });
    try { const decoded = await firebaseAuth.verifyIdToken(token); identity = { uid: decoded.uid, email: decoded.email }; }
    catch { return res.status(401).json({ error: 'Invalid or expired identity token.' }); }
  }
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const membership = await pool.query('SELECT organization_id, role FROM org_memberships WHERE user_uid=$1 ORDER BY created_at LIMIT 1', [identity.uid]);
  if (!membership.rowCount) return res.status(403).json({ error: 'No workspace membership exists for this account.' });
  authReq.user = { ...identity, tenantId: membership.rows[0].organization_id, role: membership.rows[0].role };
  next();
}
function writeGuard(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  if (!user || !['owner','admin','lawyer','analyst'].includes(user.role || '')) return res.status(403).json({ error: 'This workspace role is read-only or lacks write permission.' });
  next();
}
const asyncRoute = (fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req as AuthenticatedRequest, res, next)).catch(next);

const propertySchema = z.object({
  name: z.string().trim().min(2).max(160),
  village: z.string().trim().max(120).optional().default(''),
  hobli: z.string().trim().max(120).optional().default(''),
  taluk: z.string().trim().max(120).optional().default(''),
  district: z.string().trim().max(120).optional().default('Bengaluru Urban'),
  surveyNumber: z.string().trim().max(80).optional().default(''),
  subdivision: z.string().trim().max(80).optional().default(''),
  extent: z.string().trim().max(80).optional().default(''),
  address: z.string().trim().max(500).optional().default(''),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  notes: z.string().max(4000).optional().default('')
});

async function audit(userId: string, tenantId: string | undefined, action: string, entityType: string, entityId: string | null, details: unknown = {}) {
  if (!pool) return;
  await pool.query('INSERT INTO audit_events (actor_uid, tenant_id, action, entity_type, entity_id, details) VALUES ($1,$2,$3,$4,$5,$6)', [userId, tenantId || null, action, entityType, entityId, JSON.stringify(details)]);
}

app.get('/health', asyncRoute(async (_req, res) => {
  let database = 'not_configured';
  if (pool) { await pool.query('SELECT 1'); database = 'connected'; }
  res.json({ status: 'ok', service: 'ojix-property-api', version: '0.1.0', database, authentication: firebaseAuth ? 'firebase' : 'local-development-only' });
}));

app.get('/healthz', (_req, res) => {
  res.status(200).send('OK');
});

app.get('/readyz', asyncRoute(async (_req, res) => {
  if (!pool) return res.status(503).json({ status: 'not_ready', error: 'Database pool not initialized' });
  try {
    const dbRes = await pool.query('SELECT postgis_version()');
    res.json({
      status: 'ready',
      service: 'ojix-property-api',
      postgis: dbRes.rows[0]?.postgis_version,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(503).json({ status: 'not_ready', error: err.message });
  }
}));


app.get('/api/overview', authGuard, asyncRoute(async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured. Start PostgreSQL and set DATABASE_URL.' });
  const result = await pool.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE status='in_review')::int AS in_review, count(*) FILTER (WHERE status='ready_for_review')::int AS ready_for_review FROM properties WHERE tenant_id=$1`, [_req.user?.tenantId]);
  const docs = await pool.query('SELECT count(*)::int AS total FROM documents WHERE tenant_id=$1', [_req.user?.tenantId]);
  const recent = await pool.query(`SELECT id, name, village, survey_number, district, status, updated_at FROM properties WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT 5`, [_req.user?.tenantId]);
  res.json({ ...result.rows[0], documents: docs.rows[0].total, recent: recent.rows });
}));

app.get('/api/properties', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const q = String(req.query.q || '').trim().slice(0, 120);
  const result = await pool.query(`SELECT p.*, (SELECT count(*)::int FROM documents d WHERE d.property_id=p.id) AS document_count FROM properties p WHERE p.tenant_id=$2 AND ($1='' OR p.name ILIKE '%'||$1||'%' OR p.survey_number ILIKE '%'||$1||'%' OR p.village ILIKE '%'||$1||'%' OR p.address ILIKE '%'||$1||'%') ORDER BY p.updated_at DESC LIMIT 100`, [q, req.user?.tenantId]);
  res.json({ items: result.rows });
}));

app.post('/api/properties', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed = propertySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid property payload.', issues: parsed.error.flatten() });
  const p = parsed.data;
  const id = crypto.randomUUID();
  const result = await pool.query(`INSERT INTO properties (id, tenant_id, name, village, hobli, taluk, district, survey_number, subdivision, extent, address, latitude, longitude, notes, created_by_uid, updated_by_uid) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING *`, [id,req.user?.tenantId,p.name,p.village,p.hobli,p.taluk,p.district,p.surveyNumber,p.subdivision,p.extent,p.address,p.latitude ?? null,p.longitude ?? null,p.notes,req.user?.uid || 'unknown']);
  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'property.created', 'property', id, { name: p.name });
  res.status(201).json({ item: result.rows[0] });
}));

app.get('/api/properties/:id', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query('SELECT * FROM properties WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
  if (!result.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const documents = await pool.query('SELECT id, original_filename, mime_type, size_bytes, sha256, doc_type, processing_status, extracted_fields, created_at FROM documents WHERE property_id=$1 AND tenant_id=$2 ORDER BY created_at DESC', [req.params.id, req.user?.tenantId]);
  const findings = await pool.query('SELECT * FROM risk_findings WHERE property_id=$1 AND tenant_id=$2 ORDER BY created_at DESC', [req.params.id, req.user?.tenantId]);
  res.json({ item: result.rows[0], documents: documents.rows, findings: findings.rows });
}));

app.patch('/api/properties/:id', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const parsed = propertySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid property payload.', issues: parsed.error.flatten() });
  const allowed: Record<string,string> = { name:'name', village:'village', hobli:'hobli', taluk:'taluk', district:'district', surveyNumber:'survey_number', subdivision:'subdivision', extent:'extent', address:'address', latitude:'latitude', longitude:'longitude', notes:'notes' };
  const entries = Object.entries(parsed.data).filter(([key]) => allowed[key]);
  if (!entries.length) return res.status(400).json({ error: 'No supported fields supplied.' });
  const values: unknown[] = [req.params.id];
  const sets = entries.map(([key,value]) => { values.push(value); return `${allowed[key]}=$${values.length}`; });
  values.push(req.user?.uid || 'unknown'); sets.push(`updated_by_uid=$${values.length}`, 'updated_at=now()');
  values.push(req.user?.tenantId); const result = await pool.query(`UPDATE properties SET ${sets.join(',')} WHERE id=$1 AND tenant_id=$${values.length} RETURNING *`, values);
  if (!result.rowCount) return res.status(404).json({ error: 'Property not found.' });
  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'property.updated', 'property', req.params.id, { fields: entries.map(([k])=>k) });
  res.json({ item: result.rows[0] });
}));

app.post('/api/properties/:id/analyze', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const property = await pool.query('SELECT * FROM properties WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
  if (!property.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const p = property.rows[0];
  const docCount = await pool.query('SELECT count(*)::int AS count FROM documents WHERE property_id=$1 AND tenant_id=$2', [p.id, req.user?.tenantId]);
  const findings = buildBaselineFindings({ hasSurveyNumber: Boolean(p.survey_number), documentCount: docCount.rows[0].count, coordinatesPresent: p.latitude !== null && p.longitude !== null });
  // Query only explicitly imported spatial layers. No official layer is included in the starter seed.
  if (p.latitude !== null && p.longitude !== null) {
    const spatial = await pool.query(`SELECT id, layer_type, label, source_name, source_url, source_date, data_status, ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) AS distance_m FROM spatial_layers WHERE active=true AND geom && ST_Expand(ST_SetSRID(ST_MakePoint($1,$2),4326), 0.01) ORDER BY distance_m LIMIT 50`, [p.longitude, p.latitude]);
    for (const layer of spatial.rows) {
      findings.push({ code: `SPATIAL_${String(layer.layer_type).toUpperCase()}_${layer.id}`, title: `${layer.layer_type} layer nearby: ${layer.label}`, severity: 'unverified', points: 0, explanation: `A spatial dataset feature is approximately ${Math.round(Number(layer.distance_m))} metres from the entered map point. Proximity alone does not establish legal impact or boundary intersection. Source: ${layer.source_name || 'not recorded'}.`, evidenceStatus: layer.data_status === 'verified' ? 'verified' : layer.data_status === 'demo' ? 'demo' : 'unverified', nextAction: 'Review source metadata, geometry quality, applicable buffer rules and obtain confirmation from the competent authority.' } as RiskFinding);
    }
  }
  await pool.query('DELETE FROM risk_findings WHERE property_id=$1 AND tenant_id=$2', [p.id, req.user?.tenantId]);
  for (const f of findings) await pool.query(`INSERT INTO risk_findings (tenant_id, property_id, code, title, severity, points, explanation, evidence_status, next_action, created_by_uid) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [req.user?.tenantId,p.id,f.code,f.title,f.severity,f.points,f.explanation,f.evidenceStatus,f.nextAction,req.user?.uid || 'unknown']);
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

app.post('/api/properties/:id/documents', authGuard, writeGuard, upload.array('files', 10), asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const property = await pool.query('SELECT id FROM properties WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
  if (!property.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const files = (req.files || []) as Express.Multer.File[];
  if (!files.length) return res.status(400).json({ error: 'No files received. Use multipart form field "files".' });
  const inserted = [];
  for (const file of files) {
    const fileBuffer = fs.readFileSync(file.path);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const initialExtracted = extractDocument(
      { buffer: fileBuffer, text: fileBuffer.toString('utf-8').slice(0, 50000) },
      { filename: file.originalname, mimeType: file.mimetype }
    );
    const processingStatus = initialExtracted.overallConfidence >= 0.60 ? 'completed' : 'manual_review';
    const result = await pool.query(
      `INSERT INTO documents (tenant_id, property_id, doc_type, original_filename, storage_key, mime_type, size_bytes, sha256, processing_status, extracted_text, extracted_fields, uploaded_by_uid) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) 
       RETURNING id, original_filename, mime_type, size_bytes, sha256, doc_type, processing_status, extracted_fields, created_at`,
      [
        req.user?.tenantId,
        req.params.id,
        initialExtracted.documentType,
        file.originalname,
        path.basename(file.path),
        file.mimetype,
        file.size,
        sha256,
        processingStatus,
        fileBuffer.toString('utf-8').slice(0, 10000),
        JSON.stringify(initialExtracted),
        req.user?.uid || 'unknown',
      ]
    );
    inserted.push(result.rows[0]);
  }
  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'document.uploaded', 'property', req.params.id, { count: inserted.length });
  res.status(201).json({ items: inserted, note: 'Files uploaded and initial extraction completed.' });
}));

app.get('/api/properties/:id/documents/:docId/file', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const docResult = await pool.query(
    'SELECT * FROM documents WHERE id=$1 AND property_id=$2 AND tenant_id=$3',
    [req.params.docId, req.params.id, req.user?.tenantId]
  );
  if (!docResult.rowCount) return res.status(404).json({ error: 'Document not found.' });
  const doc = docResult.rows[0];

  const { safePath, isTraversal } = resolveSafeUploadPath(doc.storage_key);
  if (isTraversal || !safePath) {
    return res.status(403).json({ error: 'Access denied: invalid file path traversal.' });
  }

  if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
    return res.status(404).json({ error: 'Document file not found on disk.' });
  }

  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_filename)}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  const stream = fs.createReadStream(safePath);
  stream.on('error', (err) => {
    console.error('File stream error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to stream document file.' });
  });
  stream.pipe(res);
}));

app.post('/api/properties/:id/documents/:docId/extract', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const docResult = await pool.query(
    'SELECT * FROM documents WHERE id=$1 AND property_id=$2 AND tenant_id=$3',
    [req.params.docId, req.params.id, req.user?.tenantId]
  );
  if (!docResult.rowCount) return res.status(404).json({ error: 'Document not found.' });
  const doc = docResult.rows[0];

  const { safePath, isTraversal } = resolveSafeUploadPath(doc.storage_key);
  if (isTraversal) {
    return res.status(403).json({ error: 'Access denied: invalid file path traversal.' });
  }

  let fileBuffer: Buffer | undefined;
  if (safePath && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    try {
      fileBuffer = fs.readFileSync(safePath);
    } catch (e) {
      console.warn('Could not read file from storage:', e);
    }
  }

  const extractionInput: ExtractionInput = {
    text: req.body?.text || doc.extracted_text || undefined,
    tokens: req.body?.tokens || undefined,
    jsonPayload: req.body?.jsonPayload || undefined,
    buffer: fileBuffer,
  };

  const extracted = extractDocument(extractionInput, {
    documentId: doc.id,
    filename: doc.original_filename,
    mimeType: doc.mime_type,
  });

  const processingStatus = extracted.overallConfidence >= 0.60 ? 'completed' : 'manual_review';
  const extractedText = extractionInput.text || fileBuffer?.toString('utf-8').slice(0, 10000) || '';

  const updateResult = await pool.query(
    `UPDATE documents 
     SET doc_type = $1,
         extracted_fields = $2,
         extracted_text = COALESCE(NULLIF($3, ''), extracted_text),
         processing_status = $4
     WHERE id = $5 AND property_id = $6 AND tenant_id = $7
     RETURNING id, property_id, original_filename, mime_type, size_bytes, sha256, doc_type, processing_status, extracted_fields, created_at`,
    [
      extracted.documentType,
      JSON.stringify(extracted),
      extractedText,
      processingStatus,
      doc.id,
      req.params.id,
      req.user?.tenantId,
    ]
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

app.patch('/api/properties/:id/documents/:docId/fields', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const docResult = await pool.query(
    'SELECT * FROM documents WHERE id=$1 AND property_id=$2 AND tenant_id=$3',
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
  currentFields.reviewState.isVerified = true;
  currentFields.reviewState.verifiedByUid = req.user?.uid || 'unknown';
  currentFields.reviewState.verifiedAt = new Date().toISOString();
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
    currentFields.reviewState.isVerified = Boolean(req.body.isVerified);
  }

  const updatedDocType = currentFields.documentType || doc.doc_type || 'other';

  const updateResult = await pool.query(
    `UPDATE documents 
     SET doc_type = $1,
         extracted_fields = $2,
         processing_status = 'completed'
     WHERE id = $3 AND property_id = $4 AND tenant_id = $5
     RETURNING id, property_id, original_filename, mime_type, size_bytes, sha256, doc_type, processing_status, extracted_fields, created_at`,
    [
      updatedDocType,
      JSON.stringify(currentFields),
      doc.id,
      req.params.id,
      req.user?.tenantId,
    ]
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
  const propertyRes = await pool.query('SELECT * FROM properties WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
  if (!propertyRes.rowCount) return res.status(404).json({ error: 'Property not found.' });

  const eventsResult = await pool.query(
    'SELECT * FROM title_events WHERE property_id=$1 AND tenant_id=$2 ORDER BY event_date ASC, sequence_order ASC',
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
  } else {
    // Generate realistic demo fallback chain for this property workspace
    const extentStr = propertyRes.rows[0].extent || '1 Acre 20 Guntas';
    events = [
      {
        id: `demo-ev-1-${req.params.id.slice(0, 8)}`,
        propertyId: req.params.id,
        documentId: '',
        sequenceOrder: 1,
        eventDate: '1995-04-12',
        registrationDate: '1995-04-12',
        deedType: 'Absolute Sale Deed',
        fromParties: [{ name: 'Govindappa (S/o Late Muniswamappa)', normalizedName: 'GOVINDAPPA (S/O LATE MUNISWAMAPPA)' }],
        toParties: [{ name: 'Sri Muniyappa (S/o Govindappa)', normalizedName: 'MUNIYAPPA (S/O GOVINDAPPA)' }],
        extentSqFt: 65340,
        extentRaw: extentStr,
        consideration: 350000,
        status: 'verified',
        reviewedBy: 'legal_team',
      },
      {
        id: `demo-ev-2-${req.params.id.slice(0, 8)}`,
        propertyId: req.params.id,
        documentId: '',
        sequenceOrder: 2,
        eventDate: '2010-08-18',
        registrationDate: '2010-08-18',
        deedType: 'Gift Deed',
        fromParties: [{ name: 'Sri Muniyappa', normalizedName: 'MUNIYAPPA' }],
        toParties: [{ name: 'Suresh M (S/o Muniyappa)', normalizedName: 'SURESH M (S/O MUNIYAPPA)' }],
        extentSqFt: 65340,
        extentRaw: extentStr,
        consideration: 0,
        status: 'verified',
        reviewedBy: 'legal_team',
      },
      {
        id: `demo-ev-3-${req.params.id.slice(0, 8)}`,
        propertyId: req.params.id,
        documentId: '',
        sequenceOrder: 3,
        eventDate: '2021-11-05',
        registrationDate: '2021-11-05',
        deedType: 'Sale Deed',
        fromParties: [{ name: 'Suresh M', normalizedName: 'SURESH M' }],
        toParties: [{ name: 'Sri K. R. Ramesh (S/o Kadirappa)', normalizedName: 'RAMESH (S/O KADIRAPPA)' }],
        extentSqFt: 65340,
        extentRaw: extentStr,
        consideration: 9500000,
        status: 'unverified',
      },
    ];
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
  const propertyRes = await pool.query('SELECT id FROM properties WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
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
  const insertResult = await pool.query(
    `INSERT INTO title_events 
     (id, tenant_id, property_id, document_id, sequence_order, event_date, registration_date, deed_type, from_parties, to_parties, extent_sq_ft, extent_raw, consideration, status, dispute_rationale, encumbrance_status, reviewed_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
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

  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'title_event.created', 'property', req.params.id, {
    eventId: id,
    deedType: evData.deedType,
    eventDate: evData.eventDate,
  });

  res.status(201).json({ item: insertResult.rows[0] });
}));

app.post('/api/properties/:id/title-events/:eventId/review', authGuard, writeGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const eventRes = await pool.query(
    'SELECT * FROM title_events WHERE id=$1 AND property_id=$2 AND tenant_id=$3',
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

  const updateResult = await pool.query(
    `UPDATE title_events 
     SET status = $1,
         dispute_rationale = $2,
         reviewed_by = $3,
         updated_at = now()
     WHERE id = $4 AND tenant_id = $5
     RETURNING *`,
    [
      updatedEvent.status,
      updatedEvent.disputeRationale || null,
      updatedEvent.reviewedBy || null,
      req.params.eventId,
      req.user?.tenantId,
    ]
  );

  await pool.query(
    `INSERT INTO title_reviews (tenant_id, property_id, event_id, status, rationale, reviewer_uid)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
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
    'SELECT id, name, village, survey_number, latitude, longitude FROM properties WHERE id=$1 AND tenant_id=$2',
    [req.params.id, req.user?.tenantId]
  );
  if (!p.rowCount) return res.status(404).json({ error: 'Property not found.' });

  const prop = p.rows[0];
  const lat = prop.latitude !== null && prop.latitude !== undefined ? Number(prop.latitude) : 12.9716;
  const lon = prop.longitude !== null && prop.longitude !== undefined ? Number(prop.longitude) : 77.5946;

  // Retrieve spatial layers from PostGIS (Rajakaluve SWD and waterbody layers)
  const spatial = await pool.query(
    `SELECT id, layer_type, label, source_name, data_status,
            ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m
     FROM spatial_layers
     WHERE active=true AND layer_type IN ('swd_primary', 'swd_secondary', 'swd_tertiary', 'waterbody')
     ORDER BY distance_m LIMIT 50`,
    [lon, lat]
  );

  let layers: SpatialScreeningLayerInput[] = spatial.rows.map(r => ({
    id: r.id,
    layerType: r.layer_type as SpatialLayerType,
    label: r.label,
    distanceM: Math.round(Number(r.distance_m) * 10) / 10,
  }));

  // Fallback demo layers if empty
  if (layers.length === 0) {
    layers = [
      {
        id: 'demo_swd_primary',
        layerType: 'swd_primary',
        label: 'Koramangala Valley Primary SWD (Valakaluve)',
        coords: [lon + 0.00045, lat + 0.00035],
      },
      {
        id: 'demo_swd_secondary',
        layerType: 'swd_secondary',
        label: 'Secondary Feeder Halla Drain',
        coords: [lon - 0.00060, lat + 0.00050],
      },
      {
        id: 'demo_waterbody',
        layerType: 'waterbody',
        label: 'Bellandur-Varthur Catchment Waterbody Buffer',
        coords: [lon + 0.00085, lat - 0.00075],
      },
    ];
  }

  const result = screenSpatialBuffers({ latitude: lat, longitude: lon }, layers);
  if (result.cadastralParcelGeoJSON?.properties) {
    if (prop.survey_number) result.cadastralParcelGeoJSON.properties.surveyNumber = prop.survey_number;
    if (prop.village) result.cadastralParcelGeoJSON.properties.village = prop.village;
  }

  res.json(result);
}));

app.post('/api/spatial/screen-point', authGuard, asyncRoute(async (req, res) => {
  const { latitude, longitude } = req.body;
  const lat = Number(latitude || 12.887);
  const lon = Number(longitude || 77.596);

  let layers: SpatialScreeningLayerInput[] = [];
  if (pool) {
    try {
      const q = await pool.query(
        `SELECT id, layer_type, label, ST_X(ST_Centroid(geom)) as lon, ST_Y(ST_Centroid(geom)) as lat
         FROM spatial_layers WHERE active=true LIMIT 100`
      );
      layers = q.rows.map((r: any) => ({
        id: r.id,
        layerType: r.layer_type as SpatialLayerType,
        label: r.label,
        coords: [Number(r.lon), Number(r.lat)],
      }));
    } catch { /* fallback */ }
  }

  if (layers.length === 0) {
    layers = [
      {
        id: 'demo_swd_primary',
        layerType: 'swd_primary',
        label: 'Koramangala-Challaghatta Valley Primary SWD (Rajakaluve)',
        coords: [lon + 0.00055, lat + 0.00035],
      },
      {
        id: 'demo_swd_secondary',
        layerType: 'swd_secondary',
        label: 'Secondary Feeder Halla Drain',
        coords: [lon - 0.00060, lat + 0.00050],
      },
      {
        id: 'demo_waterbody',
        layerType: 'waterbody',
        label: 'Hulimavu Lake Periphery Wetland Buffer',
        coords: [lon + 0.0035, lat - 0.0025],
      },
    ];
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
  const p = await pool.query('SELECT id FROM properties WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
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
    ring = geojson.features[0].geometry.coordinates[0];
  } else if (geojson.type === 'Feature' && geojson.geometry?.coordinates) {
    ring = geojson.geometry.coordinates[0];
  } else if (geojson.type === 'Polygon' && geojson.coordinates) {
    ring = geojson.coordinates[0];
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

  if (lat !== null && lon !== null) {
    await pool.query(
      'UPDATE properties SET latitude=$1, longitude=$2, updated_at=now(), updated_by_uid=$3 WHERE id=$4 AND tenant_id=$5',
      [lat, lon, req.user?.uid || 'system', req.params.id, req.user?.tenantId]
    );
  }

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
  const p = await pool.query('SELECT * FROM properties WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
  if (!p.rowCount) return res.status(404).json({ error: 'Property not found.' });
  const docs = await pool.query('SELECT original_filename, mime_type, size_bytes, sha256, processing_status, created_at FROM documents WHERE property_id=$1 AND tenant_id=$2 ORDER BY created_at', [req.params.id, req.user?.tenantId]);
  const findings = await pool.query('SELECT code, title, severity, points, explanation, evidence_status, next_action, created_at FROM risk_findings WHERE property_id=$1 AND tenant_id=$2 ORDER BY created_at', [req.params.id, req.user?.tenantId]);
  const body = { reportVersion: '0.1', generatedAt: new Date().toISOString(), property: p.rows[0], documents: docs.rows, findings: findings.rows, reviewNotice: 'This report is an evidence-organising aid and is not a legal opinion, ownership certificate, encumbrance certificate, or government verification. Confirm findings against current official records and qualified professional advice.', dataLimitations: ['Government integrations are not enabled in the starter build.', 'Uploaded documents have not been OCR processed.', 'Any demo spatial layers are illustrative and non-authoritative.'] };
  res.setHeader('Content-Disposition', `attachment; filename="ojix-property-report-${p.rows[0].id}.json"`);
  res.type('application/json').send(JSON.stringify(body, null, 2));
}));

app.get('/api/map/layers', authGuard, asyncRoute(async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query(`SELECT id, layer_type, label, source_name, source_url, source_date, data_status, ST_AsGeoJSON(geom)::json AS geometry FROM spatial_layers WHERE active=true ORDER BY layer_type, label LIMIT 1000`);
  res.json({ type: 'FeatureCollection', features: result.rows.map((r:any) => ({ type: 'Feature', id: r.id, geometry: r.geometry, properties: { layerType: r.layer_type, label: r.label, sourceName: r.source_name, sourceUrl: r.source_url, sourceDate: r.source_date, dataStatus: r.data_status } })), disclaimer: 'Only datasets explicitly loaded into this workspace are shown. The seed layer is synthetic demonstration data, not an official land or Rajakaluve boundary.' });
}));

app.get('/api/properties/:id/discrepancies', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const p = await pool.query('SELECT * FROM properties WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
  if (!p.rowCount) return res.status(404).json({ error: 'Property not found.' });

  const docs = await pool.query(
    'SELECT id, original_filename, doc_type, extracted_fields FROM documents WHERE property_id=$1 AND tenant_id=$2',
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
  const p = await pool.query('SELECT * FROM properties WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
  if (!p.rowCount) return res.status(404).json({ error: 'Property not found.' });

  const docs = await pool.query('SELECT * FROM documents WHERE property_id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
  const eventsResult = await pool.query(
    'SELECT * FROM title_events WHERE property_id=$1 AND tenant_id=$2 ORDER BY event_date ASC',
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

  const lat = p.rows[0].latitude !== null && p.rows[0].latitude !== undefined ? Number(p.rows[0].latitude) : 12.9716;
  const lon = p.rows[0].longitude !== null && p.rows[0].longitude !== undefined ? Number(p.rows[0].longitude) : 77.5946;
  const spatialScreening = screenSpatialBuffers({ latitude: lat, longitude: lon }, []);

  const snapshot = createDueDiligenceSnapshot({
    property: p.rows[0],
    documents: docs.rows,
    titleTimeline,
    titleGaps,
    discrepancies,
    spatialScreening,
  });

  await audit(req.user?.uid || 'unknown', req.user?.tenantId, 'report.snapshot_created', 'property', req.params.id, {
    reportId: snapshot.reportId,
    score: snapshot.riskSummary.score,
  });

  res.status(201).json(snapshot);
}));

app.get('/api/properties/:id/due-diligence-report/html', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const p = await pool.query('SELECT * FROM properties WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
  if (!p.rowCount) return res.status(404).json({ error: 'Property not found.' });

  const docs = await pool.query('SELECT * FROM documents WHERE property_id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
  const eventsResult = await pool.query('SELECT * FROM title_events WHERE property_id=$1 AND tenant_id=$2 ORDER BY event_date ASC', [req.params.id, req.user?.tenantId]);
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
  const lat = p.rows[0].latitude !== null && p.rows[0].latitude !== undefined ? Number(p.rows[0].latitude) : 12.9716;
  const lon = p.rows[0].longitude !== null && p.rows[0].longitude !== undefined ? Number(p.rows[0].longitude) : 77.5946;
  const spatialScreening = screenSpatialBuffers({ latitude: lat, longitude: lon }, []);

  const snapshot = createDueDiligenceSnapshot({
    property: p.rows[0],
    documents: docs.rows,
    titleTimeline,
    titleGaps,
    discrepancies,
    spatialScreening,
  });

  const report = generateDueDiligenceReport(snapshot);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(report.html);
}));

app.get('/api/properties/:id/due-diligence-report/pdf', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const p = await pool.query('SELECT * FROM properties WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
  if (!p.rowCount) return res.status(404).json({ error: 'Property not found.' });

  const docs = await pool.query('SELECT * FROM documents WHERE property_id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
  const eventsResult = await pool.query('SELECT * FROM title_events WHERE property_id=$1 AND tenant_id=$2 ORDER BY event_date ASC', [req.params.id, req.user?.tenantId]);
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
  const lat = p.rows[0].latitude !== null && p.rows[0].latitude !== undefined ? Number(p.rows[0].latitude) : 12.9716;
  const lon = p.rows[0].longitude !== null && p.rows[0].longitude !== undefined ? Number(p.rows[0].longitude) : 77.5946;
  const spatialScreening = screenSpatialBuffers({ latitude: lat, longitude: lon }, []);

  const snapshot = createDueDiligenceSnapshot({
    property: p.rows[0],
    documents: docs.rows,
    titleTimeline,
    titleGaps,
    discrepancies,
    spatialScreening,
  });

  const report = generateDueDiligenceReport(snapshot);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="due-diligence-report-${p.rows[0].id}.pdf"`);
  res.send(report.pdfBytesMock);
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
  let q = 'SELECT b.*, p.name as property_name FROM legal_bookmarks b LEFT JOIN properties p ON b.property_id=p.id WHERE b.tenant_id=$1';
  const params: any[] = [req.user?.tenantId];
  if (propertyId) {
    q += ' AND b.property_id=$2';
    params.push(propertyId);
  }
  q += ' ORDER BY b.created_at DESC';
  const result = await pool.query(q, params);
  res.json({ items: result.rows });
}));

app.post('/api/legal-research/bookmarks', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const { actId, sectionNumber, title, notes, propertyId } = req.body;
  if (!actId || !sectionNumber || !title) return res.status(400).json({ error: 'actId, sectionNumber, and title are required.' });
  const result = await pool.query(
    `INSERT INTO legal_bookmarks (tenant_id, property_id, act_id, section_number, title, notes, created_by_uid)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.user?.tenantId, propertyId || null, actId, sectionNumber, title, notes || '', req.user?.uid || 'anonymous']
  );
  await audit(req.user?.uid || 'anon', req.user?.tenantId, 'create', 'legal_bookmark', result.rows[0].id, { actId, sectionNumber });
  res.status(201).json({ item: result.rows[0] });
}));

app.delete('/api/legal-research/bookmarks/:id', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  await pool.query('DELETE FROM legal_bookmarks WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
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
    allOperational: registries.every(r => r.status === 'operational'),
    liveProbe: probe,
    timestamp: new Date().toISOString()
  });
}));


app.get('/api/source-registry/properties/:id', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const p = await pool.query('SELECT * FROM properties WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
  if (!p.rows.length) return res.status(404).json({ error: 'Property not found.' });

  const verifications = await pool.query(
    'SELECT * FROM source_registry_verifications WHERE property_id=$1 AND tenant_id=$2 ORDER BY verified_at DESC',
    [req.params.id, req.user?.tenantId]
  );
  res.json({ items: verifications.rows });
}));

app.post('/api/source-registry/properties/:id/verify', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const p = await pool.query('SELECT * FROM properties WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
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
       (tenant_id, property_id, registry_name, status, query_params, matched_record, discrepancies, latency_ms, response_hash, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
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

app.post('/api/source-registry/properties/:id/verify/:registryName', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const regName = req.params.registryName as RegistryName;
  const p = await pool.query('SELECT * FROM properties WHERE id=$1 AND tenant_id=$2', [req.params.id, req.user?.tenantId]);
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
     (tenant_id, property_id, registry_name, status, query_params, matched_record, discrepancies, latency_ms, response_hash, verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
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

/* ==========================================================================
   Global Cross-Workspace Views & Settings Endpoints
   ========================================================================== */
app.get('/api/documents/all', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query(
    `SELECT d.*, p.name as property_name, p.survey_number, p.village, p.district
     FROM documents d
     JOIN properties p ON d.property_id=p.id
     WHERE d.tenant_id=$1
     ORDER BY d.created_at DESC LIMIT 200`,
    [req.user?.tenantId]
  );
  res.json({ items: result.rows, count: result.rows.length });
}));

app.get('/api/findings/all', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query(
    `SELECT f.*, p.name as property_name, p.survey_number, p.village, p.district
     FROM risk_findings f
     JOIN properties p ON f.property_id=p.id
     WHERE f.tenant_id=$1
     ORDER BY f.created_at DESC LIMIT 200`,
    [req.user?.tenantId]
  );
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, unverified: 0 };
  for (const r of result.rows) {
    if (r.severity in severityCounts) (severityCounts as any)[r.severity]++;
  }
  res.json({ items: result.rows, severityCounts, count: result.rows.length });
}));

app.get('/api/settings', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const result = await pool.query('SELECT * FROM workspace_settings WHERE tenant_id=$1', [req.user?.tenantId]);
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

app.post('/api/settings', authGuard, asyncRoute(async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database not configured.' });
  const s = req.body || {};
  const result = await pool.query(
    `INSERT INTO workspace_settings 
     (tenant_id, org_name, primary_contact, default_district, auto_screen_bhoomi, auto_screen_kaveri, auto_screen_spatial, 
      swd_primary_buffer_m, swd_secondary_buffer_m, swd_tertiary_buffer_m, lake_buffer_m, survey_margin_tolerance_pct, ocr_confidence_threshold, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
     ON CONFLICT (tenant_id) DO UPDATE SET
       org_name = EXCLUDED.org_name,
       primary_contact = EXCLUDED.primary_contact,
       default_district = EXCLUDED.default_district,
       auto_screen_bhoomi = EXCLUDED.auto_screen_bhoomi,
       auto_screen_kaveri = EXCLUDED.auto_screen_kaveri,
       auto_screen_spatial = EXCLUDED.auto_screen_spatial,
       swd_primary_buffer_m = EXCLUDED.swd_primary_buffer_m,
       swd_secondary_buffer_m = EXCLUDED.swd_secondary_buffer_m,
       swd_tertiary_buffer_m = EXCLUDED.swd_tertiary_buffer_m,
       lake_buffer_m = EXCLUDED.lake_buffer_m,
       survey_margin_tolerance_pct = EXCLUDED.survey_margin_tolerance_pct,
       ocr_confidence_threshold = EXCLUDED.ocr_confidence_threshold,
       updated_at = now()
     RETURNING *`,
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
      Number(s.ocr_confidence_threshold || 0.60)
    ]
  );
  await audit(req.user?.uid || 'anon', req.user?.tenantId, 'update_settings', 'organization', req.user?.tenantId || null, s);
  res.json({ settings: result.rows[0], message: 'Workspace settings updated successfully.' });
}));


app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? `File exceeds ${process.env.MAX_UPLOAD_MB || 25} MB limit.` : err.message });
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

