/**
 * OJIX Property Intelligence — In-Memory Mock Data Store
 * 
 * This module provides a complete in-memory replacement for the MySQL database
 * when running in demo mode. It eliminates ALL external dependencies (Railway DB,
 * SMTP, Twilio) while preserving the full user journey.
 * 
 * Activated automatically when:
 *   - DATABASE_URL is not set or unreachable
 *   - DEMO_MODE=true is set in .env
 *   - The /api/health check would otherwise fail
 */

import crypto from 'node:crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MockUser {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  email_verified: boolean;
  status: string;
  phone_e164: string;
  phone_verified_at: string | null;
  created_at: string;
}

interface MockOrg {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
}

interface MockMembership {
  user_uid: string;
  organization_id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

interface MockSession {
  id: string;
  tenant_id: string;
  user_uid: string;
  token_hash: string;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_by_uid: string | null;
  revoke_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

interface MockOtpChallenge {
  id: string;
  email: string;
  account_uid: string;
  purpose: string;
  otp_hash: string;
  otp_salt: string;
  expires_at: string;
  consumed_at: string | null;
  attempts: number;
  created_at: string;
}

interface MockProperty {
  id: string;
  tenant_id: string;
  application_number: string;
  name: string;
  review_purpose: string;
  primary_document_type: string;
  property_identifier: string;
  property_identifier_type: string;
  property_type: string;
  village: string;
  hobli: string;
  taluk: string;
  district: string;
  district_id: string | null;
  taluk_id: string | null;
  hobli_id: string | null;
  village_id: string | null;
  survey_number: string;
  subdivision: string;
  extent: string;
  extent_value: number | null;
  extent_unit: string;
  boundary_north: string;
  boundary_south: string;
  boundary_east: string;
  boundary_west: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  coordinate_source: string;
  coordinate_confidence: number | null;
  coordinate_captured_at: string | null;
  identity_state: string;
  notes: string;
  status: string;
  workflow_priority: string;
  due_date: string | null;
  assigned_lawyer_uid: string | null;
  assigned_analyst_uid: string | null;
  assigned_operations_uid: string | null;
  assigned_consultant_uid: string | null;
  assigned_viewer_uid: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MockDocument {
  id: string;
  property_id: string;
  tenant_id: string;
  original_filename: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  doc_type: string;
  doc_type_custom: string | null;
  classification_confidence: number;
  classification_source: string;
  manual_review_status: string;
  processing_status: string;
  extracted_fields: any;
  governance_status: string;
  created_at: string;
  updated_at: string;
}

interface MockFinding {
  id: string;
  property_id: string;
  tenant_id: string;
  code: string;
  title: string;
  severity: string;
  points: number;
  explanation: string;
  evidence_status: string;
  next_action: string;
  created_at: string;
}

interface MockAuditEvent {
  id: string;
  tenant_id: string;
  actor_uid: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
}

interface MockTitleEvent {
  id: string;
  tenant_id: string;
  property_id: string;
  document_id: string | null;
  sequence_order: number;
  event_date: string;
  registration_date: string;
  deed_type: string;
  from_parties: any;
  to_parties: any;
  extent_sq_ft: number;
  extent_raw: string;
  consideration: number;
  status: string;
  dispute_rationale: string | null;
  reviewed_by: string | null;
  encumbrance_status: string;
  created_at: string;
}

interface MockTask {
  id: string;
  tenant_id: string;
  property_id: string;
  task_code: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_by_uid: string;
  assigned_to_uid: string;
  reviewer_uid: string | null;
  checklist: any;
  linked_document_id: string | null;
  linked_finding_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MockReport {
  id: string;
  tenant_id: string;
  property_id: string;
  version_number: number;
  report_type: string;
  title: string;
  approval_status: string;
  snapshot: any;
  snapshot_sha256: string;
  data_checked_at: string;
  created_by_uid: string;
  submitted_at: string | null;
  reviewed_by_uid: string | null;
  review_decision: string | null;
  review_rationale: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface MockPasswordOverride {
  user_uid: string;
  password_hash: string;
  changed_at: string;
  changed_by_uid: string;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function hashPasswordSync(password: string, salt?: string): string {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, s, 64).toString('hex');
  return `${s}:${derived}`;
}

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

// ─── Default Organization ────────────────────────────────────────────────────

const DEFAULT_ORG_ID = '11111111-1111-4111-8111-111111111111';
const DEFAULT_ORG: MockOrg = {
  id: DEFAULT_ORG_ID,
  name: 'OJIX Demo Workspace',
  slug: 'ojix-demo',
  status: 'active',
  created_at: '2026-01-01 00:00:00',
};

// ─── Seed Demo Users & Memberships ───────────────────────────────────────────

const DEMO_PASSWORDS: Record<string, string> = {
  'user-super-admin': process.env.DEMO_SUPER_ADMIN_PASSWORD || 'SuperAdmin@3126',
  'user-owner': process.env.DEMO_OWNER_PASSWORD || 'Owner@3126',
  'user-admin': process.env.DEMO_ADMIN_PASSWORD || 'Admin@3126',
  'user-lawyer': process.env.DEMO_LAWYER_PASSWORD || 'Lawyer@3126',
  'user-analyst': process.env.DEMO_ANALYST_PASSWORD || 'Analyst@3126',
  'user-operations': process.env.DEMO_OPERATIONS_PASSWORD || 'Operations@3126',
  'user-consultant': process.env.DEMO_CONSULTANT_PASSWORD || 'Consultant@3126',
  'user-support': process.env.DEMO_SUPPORT_PASSWORD || 'Support@3126',
  'user-data-steward': process.env.DEMO_DATA_STEWARD_PASSWORD || 'Steward@3126',
  'user-viewer': process.env.DEMO_VIEWER_PASSWORD || 'Viewer@3126',
};

const DEMO_ROLES: Record<string, string> = {
  'user-super-admin': 'super_admin',
  'user-owner': 'owner',
  'user-admin': 'admin',
  'user-lawyer': 'lawyer',
  'user-analyst': 'analyst',
  'user-operations': 'operations',
  'user-consultant': 'consultant',
  'user-support': 'support',
  'user-data-steward': 'data_steward',
  'user-viewer': 'viewer',
};

// ─── Seed Properties ─────────────────────────────────────────────────────────

function createSeedProperties(): MockProperty[] {
  const baseTime = '2026-09-15 10:00:00';
  return [
    {
      id: uuid(), tenant_id: DEFAULT_ORG_ID,
      application_number: 'OJ-2026-BLR-001', name: 'Whitefield Residential Site',
      review_purpose: 'purchase_due_diligence', primary_document_type: 'sale_deed',
      property_identifier: 'WF-SITE-2026-01', property_identifier_type: 'site_number',
      property_type: 'non_agricultural', village: 'Whitefield', hobli: 'Varthur',
      taluk: 'Bengaluru East', district: 'Bengaluru Urban',
      district_id: null, taluk_id: null, hobli_id: null, village_id: null,
      survey_number: '45', subdivision: '3A',
      extent: '2400 sq ft', extent_value: 2400, extent_unit: 'sq_ft',
      boundary_north: 'Site No. 44 — K. Ramesh', boundary_south: '30 ft road',
      boundary_east: 'Site No. 46 — M. Suresh', boundary_west: 'Common area',
      address: 'No. 45/3A, 2nd Cross, Whitefield Main Road, Bengaluru 560066',
      latitude: 12.9698, longitude: 77.7500, coordinate_source: 'manual',
      coordinate_confidence: 0.85, coordinate_captured_at: baseTime,
      identity_state: 'known', notes: 'Near ITPL junction, residential zoning confirmed',
      status: 'in_review', workflow_priority: 'high', due_date: '2026-12-01',
      assigned_lawyer_uid: 'user-lawyer', assigned_analyst_uid: 'user-analyst',
      assigned_operations_uid: 'user-operations', assigned_consultant_uid: 'user-consultant',
      assigned_viewer_uid: 'user-viewer', archived_at: null,
      created_at: baseTime, updated_at: baseTime,
    },
    {
      id: uuid(), tenant_id: DEFAULT_ORG_ID,
      application_number: 'OJ-2026-BLR-002', name: 'Jayanagar Agricultural Land',
      review_purpose: 'title_verification', primary_document_type: 'rtc',
      property_identifier: '', property_identifier_type: '',
      property_type: 'agricultural', village: 'Jayanagar', hobli: 'Bengaluru South',
      taluk: 'Bengaluru South', district: 'Bengaluru Urban',
      district_id: null, taluk_id: null, hobli_id: null, village_id: null,
      survey_number: '112', subdivision: '5',
      extent: '1 acre 20 guntas', extent_value: 63600, extent_unit: 'sq_ft',
      boundary_north: 'Govt. Tank bed', boundary_south: 'Survey No. 113',
      boundary_east: 'Village road', boundary_west: 'Survey No. 111',
      address: 'Survey 112/5, Jayanagar Village, Bengaluru South Taluk',
      latitude: 12.9250, longitude: 77.5938, coordinate_source: 'geocoded',
      coordinate_confidence: 0.72, coordinate_captured_at: baseTime,
      identity_state: 'disputed', notes: 'Extent mismatch between RTC and sale deed',
      status: 'in_review', workflow_priority: 'critical', due_date: '2026-11-30',
      assigned_lawyer_uid: 'user-lawyer', assigned_analyst_uid: 'user-analyst',
      assigned_operations_uid: 'user-operations', assigned_consultant_uid: 'user-consultant',
      assigned_viewer_uid: 'user-viewer', archived_at: null,
      created_at: baseTime, updated_at: baseTime,
    },
    {
      id: uuid(), tenant_id: DEFAULT_ORG_ID,
      application_number: 'OJ-2026-BLR-003', name: 'Hebbal Commercial Plot',
      review_purpose: 'investment_analysis', primary_document_type: 'khata_certificate',
      property_identifier: 'HBL-COM-2026-07', property_identifier_type: 'khata_number',
      property_type: 'non_agricultural', village: 'Hebbal', hobli: 'Yeshwanthpur',
      taluk: 'Bengaluru North', district: 'Bengaluru Urban',
      district_id: null, taluk_id: null, hobli_id: null, village_id: null,
      survey_number: '78', subdivision: '1',
      extent: '5000 sq ft', extent_value: 5000, extent_unit: 'sq_ft',
      boundary_north: 'Hebbal Flyover Road', boundary_south: 'Plot No. 79',
      boundary_east: 'Service Road', boundary_west: 'Plot No. 77',
      address: 'Plot 78/1, Outer Ring Road, Hebbal, Bengaluru 560024',
      latitude: 13.0358, longitude: 77.5970, coordinate_source: 'manual',
      coordinate_confidence: 0.90, coordinate_captured_at: baseTime,
      identity_state: 'verified', notes: 'All documents consistent, commercial zoning',
      status: 'approved', workflow_priority: 'normal', due_date: null,
      assigned_lawyer_uid: 'user-lawyer', assigned_analyst_uid: 'user-analyst',
      assigned_operations_uid: 'user-operations', assigned_consultant_uid: 'user-consultant',
      assigned_viewer_uid: 'user-viewer', archived_at: null,
      created_at: baseTime, updated_at: baseTime,
    },
    {
      id: uuid(), tenant_id: DEFAULT_ORG_ID,
      application_number: 'OJ-2026-MYS-004', name: 'Chamundi Hill Residential Layout',
      review_purpose: 'property_purchase_sale', primary_document_type: 'sale_deed',
      property_identifier: '', property_identifier_type: '',
      property_type: 'residential', village: 'Alanahalli', hobli: 'Varuna',
      taluk: 'Mysuru', district: 'Mysuru',
      district_id: null, taluk_id: null, hobli_id: null, village_id: null,
      survey_number: '45', subdivision: '2B',
      extent: '3200 sq ft', extent_value: 3200, extent_unit: 'sq_ft',
      boundary_north: 'Site No. 44', boundary_south: 'Main Road',
      boundary_east: 'Site No. 46', boundary_west: 'Cross Road',
      address: 'Plot 45/2B, Alanahalli Village, Mysuru 570028',
      latitude: 12.2958, longitude: 76.6852, coordinate_source: 'manual',
      coordinate_confidence: 0.88, coordinate_captured_at: baseTime,
      identity_state: 'verified', notes: 'Title documents and mutation extracts validated',
      status: 'ready_for_review', workflow_priority: 'normal', due_date: '2026-12-10',
      assigned_lawyer_uid: 'user-lawyer', assigned_analyst_uid: 'user-analyst',
      assigned_operations_uid: 'user-operations', assigned_consultant_uid: 'user-consultant',
      assigned_viewer_uid: 'user-viewer', archived_at: null,
      created_at: baseTime, updated_at: baseTime,
    },
  ];
}

// ─── Seed Documents ──────────────────────────────────────────────────────────

function createSeedDocuments(properties: MockProperty[]): MockDocument[] {
  const docs: MockDocument[] = [];
  const docTemplates = [
    { filename: 'Sale_Deed_2024.pdf', doc_type: 'sale_deed', size: 2456000, confidence: 0.94 },
    { filename: 'RTC_Extract_2026.pdf', doc_type: 'rtc', size: 456000, confidence: 0.97 },
    { filename: 'Encumbrance_Certificate.pdf', doc_type: 'ec', size: 890000, confidence: 0.91 },
    { filename: 'Khata_Certificate.pdf', doc_type: 'khata_certificate', size: 345000, confidence: 0.88 },
    { filename: 'Tax_Receipt_2025-26.pdf', doc_type: 'tax_receipt', size: 234000, confidence: 0.96 },
    { filename: 'Survey_Sketch.pdf', doc_type: 'survey_sketch', size: 1200000, confidence: 0.85 },
  ];
  for (const prop of properties) {
    const count = prop.status === 'approved' ? 4 : 3;
    for (let i = 0; i < count && i < docTemplates.length; i++) {
      const template = docTemplates[i];
      docs.push({
        id: uuid(), property_id: prop.id, tenant_id: DEFAULT_ORG_ID,
        original_filename: template.filename, storage_key: `local://${prop.id}/${template.filename}`,
        mime_type: 'application/pdf', size_bytes: template.size,
        sha256: crypto.createHash('sha256').update(`${prop.id}-${template.filename}`).digest('hex'),
        doc_type: template.doc_type, doc_type_custom: null,
        classification_confidence: template.confidence, classification_source: 'ai_classifier',
        manual_review_status: i === 0 ? 'verified' : 'pending',
        processing_status: 'completed',
        extracted_fields: {
          documentType: template.doc_type,
          documentNumber: `DOC-${prop.application_number}-${i + 1}`,
          parties: [{ name: 'Ramesh Kumar', role: 'seller' }, { name: 'Suresh Reddy', role: 'buyer' }],
          propertySchedule: {
            surveyNumber: prop.survey_number, village: prop.village,
            extent: { rawText: prop.extent, normalizedSqFt: prop.extent_value || 0 },
            boundaries: { north: prop.boundary_north, south: prop.boundary_south, east: prop.boundary_east, west: prop.boundary_west },
          },
          overallConfidence: template.confidence,
          fieldConfidence: { documentType: template.confidence, documentNumber: 0.9, parties: 0.85, surveyNumber: 0.92, extent: 0.88, boundaries: 0.80, dates: 0.95 },
          fieldAnchors: {},
          extractionMetadata: { source: 'mock', status: 'completed', message: 'Demo extraction completed successfully.' },
          reviewState: { isVerified: i === 0, overrides: {} },
        },
        governance_status: 'active',
        created_at: prop.created_at, updated_at: prop.updated_at,
      });
    }
  }
  return docs;
}

// ─── Seed Findings ───────────────────────────────────────────────────────────

function createSeedFindings(properties: MockProperty[]): MockFinding[] {
  const findings: MockFinding[] = [];
  const findingTemplates = [
    { code: 'TITLE-GAP-001', title: 'Title Chain Gap Detected', severity: 'critical', points: 25, explanation: 'Missing instrument between 2018 sale deed and 2015 gift deed. Chain of ownership cannot be verified without the intermediate transfer document.', evidence_status: 'pending_review', next_action: 'Request original deed from Sub-Registrar office' },
    { code: 'GIS-DRAIN-001', title: 'Storm Water Drain Proximity', severity: 'high', points: 15, explanation: 'Property boundary is within 15 meters of a mapped Rajakaluve (storm-water drain). BBMP buffer zone policy may restrict construction.', evidence_status: 'confirmed', next_action: 'Verify current BBMP SWD master plan revision' },
    { code: 'DISC-EXTENT-001', title: 'Extent Discrepancy', severity: 'medium', points: 10, explanation: 'Sale deed records 2400 sq ft but RTC extract shows 2200 sq ft. Difference of 200 sq ft needs reconciliation.', evidence_status: 'pending_review', next_action: 'Cross-reference with survey sketch measurements' },
    { code: 'GIS-LAKE-001', title: 'Waterbody Buffer Zone', severity: 'high', points: 20, explanation: 'Property is within 75m of a surveyed lake boundary. National Green Tribunal buffer norms may apply.', evidence_status: 'pending_review', next_action: 'Check NGT order and revenue survey records' },
    { code: 'DISC-BOUNDARY-001', title: 'Boundary Description Conflict', severity: 'low', points: 5, explanation: 'North boundary owner name differs between sale deed and mutation entry. Likely a recording variation.', evidence_status: 'dismissed', next_action: 'No action required — cosmetic variation confirmed' },
  ];
  for (const prop of properties) {
    const count = prop.status === 'approved' ? 2 : prop.workflow_priority === 'critical' ? 4 : 3;
    for (let i = 0; i < count && i < findingTemplates.length; i++) {
      const template = findingTemplates[i];
      findings.push({
        id: uuid(), property_id: prop.id, tenant_id: DEFAULT_ORG_ID,
        ...template, created_at: prop.created_at,
      });
    }
  }
  return findings;
}

// ─── Seed Title Events ───────────────────────────────────────────────────────

function createSeedTitleEvents(properties: MockProperty[]): MockTitleEvent[] {
  const events: MockTitleEvent[] = [];
  for (const prop of properties) {
    events.push(
      {
        id: uuid(), tenant_id: DEFAULT_ORG_ID, property_id: prop.id,
        document_id: null, sequence_order: 1,
        event_date: '2014-06-12', registration_date: '2014-06-15',
        deed_type: 'gift_deed',
        from_parties: JSON.stringify([{ name: 'G. Narayana Rao', role: 'donor' }]),
        to_parties: JSON.stringify([{ name: 'K. Ramesh Kumar', role: 'donee' }]),
        extent_sq_ft: prop.extent_value || 2400, extent_raw: prop.extent,
        consideration: 0, status: 'verified', dispute_rationale: null,
        reviewed_by: 'user-lawyer', encumbrance_status: 'clear',
        created_at: prop.created_at,
      },
      {
        id: uuid(), tenant_id: DEFAULT_ORG_ID, property_id: prop.id,
        document_id: null, sequence_order: 2,
        event_date: '2018-11-20', registration_date: '2018-11-22',
        deed_type: 'sale_deed',
        from_parties: JSON.stringify([{ name: 'K. Ramesh Kumar', role: 'vendor' }]),
        to_parties: JSON.stringify([{ name: 'S. Suresh Reddy', role: 'purchaser' }]),
        extent_sq_ft: prop.extent_value || 2400, extent_raw: prop.extent,
        consideration: 7500000, status: 'verified', dispute_rationale: null,
        reviewed_by: 'user-lawyer', encumbrance_status: 'clear',
        created_at: prop.created_at,
      },
      {
        id: uuid(), tenant_id: DEFAULT_ORG_ID, property_id: prop.id,
        document_id: null, sequence_order: 3,
        event_date: '2024-03-15', registration_date: '2024-03-16',
        deed_type: 'sale_deed',
        from_parties: JSON.stringify([{ name: 'S. Suresh Reddy', role: 'vendor' }]),
        to_parties: JSON.stringify([{ name: 'Current Client Applicant', role: 'purchaser' }]),
        extent_sq_ft: prop.extent_value || 2400, extent_raw: prop.extent,
        consideration: 9800000, status: prop.status === 'approved' ? 'verified' : 'pending',
        dispute_rationale: prop.status === 'approved' ? null : 'Pending final revenue survey tippe reconciliation.',
        reviewed_by: 'user-lawyer', encumbrance_status: 'clear',
        created_at: prop.created_at,
      }
    );
  }
  return events;
}

// ─── Seed Workbench Tasks ────────────────────────────────────────────────────

function createSeedTasks(properties: MockProperty[]): MockTask[] {
  const tasks: MockTask[] = [];
  for (const prop of properties) {
    tasks.push(
      {
        id: uuid(), tenant_id: DEFAULT_ORG_ID, property_id: prop.id,
        task_code: `TSK-${prop.application_number.slice(-3)}-01`,
        title: `Reconcile Revenue Extent for ${prop.name}`,
        description: `Verify Tippan sketch measurements (${prop.extent}) against registered sale deed schedule. Confirm whether boundary discrepancy affects marketable title.`,
        category: 'title_verification', priority: 'high',
        status: prop.status === 'approved' ? 'completed' : 'in_progress',
        due_date: '2026-12-05',
        assigned_by_uid: 'user-lawyer', assigned_to_uid: 'user-analyst',
        reviewer_uid: 'user-lawyer',
        checklist: JSON.stringify([
          { id: 'c1', label: 'Cross-reference Tippan boundaries with survey sketch', done: true },
          { id: 'c2', label: 'Verify Nil-Encumbrance Form 15 up to current date', done: prop.status === 'approved' },
          { id: 'c3', label: 'Confirm BBMP / Revenue Khata bifurcation status', done: prop.status === 'approved' },
        ]),
        linked_document_id: null, linked_finding_id: null,
        created_at: prop.created_at, updated_at: prop.updated_at,
      },
      {
        id: uuid(), tenant_id: DEFAULT_ORG_ID, property_id: prop.id,
        task_code: `TSK-${prop.application_number.slice(-3)}-02`,
        title: `Waterbody / Drain Buffer Compliance Screening`,
        description: `Check 75m lake buffer and 15m primary Rajakaluve SWD buffer for Survey ${prop.survey_number}/${prop.subdivision}.`,
        category: 'spatial_screening', priority: 'medium',
        status: prop.status === 'approved' ? 'completed' : 'pending',
        due_date: '2026-12-10',
        assigned_by_uid: 'user-owner', assigned_to_uid: 'user-operations',
        reviewer_uid: 'user-lawyer',
        checklist: JSON.stringify([
          { id: 'b1', label: 'Review Dishaank geospatial overlay', done: true },
          { id: 'b2', label: 'Inspect village survey map (Naksha)', done: prop.status === 'approved' },
        ]),
        linked_document_id: null, linked_finding_id: null,
        created_at: prop.created_at, updated_at: prop.updated_at,
      }
    );
  }
  return tasks;
}

// ─── Seed Consultant Reports ────────────────────────────────────────────────

function createSeedReports(properties: MockProperty[]): MockReport[] {
  const reports: MockReport[] = [];
  for (const prop of properties) {
    const isApproved = prop.status === 'approved';
    const snapshot = {
      property: prop,
      summary: `Title Intelligence & Due Diligence Dossier for ${prop.name}`,
      legalOpinion: isApproved ? 'Clear and marketable title confirmed based on 30-year flow.' : 'Conditional title verification in progress.',
    };
    reports.push({
      id: uuid(), tenant_id: DEFAULT_ORG_ID, property_id: prop.id,
      version_number: 1, report_type: 'comprehensive_title_report',
      title: `OJIX Legal Due Diligence Report — ${prop.name}`,
      approval_status: isApproved ? 'approved' : 'submitted',
      snapshot,
      snapshot_sha256: crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),
      data_checked_at: prop.created_at,
      created_by_uid: 'user-consultant',
      submitted_at: prop.created_at,
      reviewed_by_uid: isApproved ? 'user-lawyer' : null,
      review_decision: isApproved ? 'approve' : null,
      review_rationale: isApproved ? 'Complete conveyance link verified without unrecorded encumbrance.' : null,
      reviewed_at: isApproved ? prop.updated_at : null,
      created_at: prop.created_at,
    });
  }
  return reports;
}

// ─── Karnataka Location Data ─────────────────────────────────────────────────

const KARNATAKA_DISTRICTS = [
  { id: uuid(), name: 'Bengaluru Urban', code: 'BLR-U', active: 1 },
  { id: uuid(), name: 'Bengaluru Rural', code: 'BLR-R', active: 1 },
  { id: uuid(), name: 'Mysuru', code: 'MYS', active: 1 },
  { id: uuid(), name: 'Mangaluru', code: 'MNG', active: 1 },
  { id: uuid(), name: 'Tumakuru', code: 'TMK', active: 1 },
  { id: uuid(), name: 'Ramanagara', code: 'RMN', active: 1 },
];

const KARNATAKA_TALUKS = [
  { id: uuid(), district_id: KARNATAKA_DISTRICTS[0].id, name: 'Bengaluru North', code: 'BLR-N' },
  { id: uuid(), district_id: KARNATAKA_DISTRICTS[0].id, name: 'Bengaluru South', code: 'BLR-S' },
  { id: uuid(), district_id: KARNATAKA_DISTRICTS[0].id, name: 'Bengaluru East', code: 'BLR-E' },
  { id: uuid(), district_id: KARNATAKA_DISTRICTS[0].id, name: 'Anekal', code: 'ANK' },
];

const KARNATAKA_HOBLIS = [
  { id: uuid(), taluk_id: KARNATAKA_TALUKS[0].id, name: 'Yeshwanthpur', code: 'YWP' },
  { id: uuid(), taluk_id: KARNATAKA_TALUKS[0].id, name: 'Hesaraghatta', code: 'HSG' },
  { id: uuid(), taluk_id: KARNATAKA_TALUKS[1].id, name: 'Bengaluru South', code: 'BLR-S' },
  { id: uuid(), taluk_id: KARNATAKA_TALUKS[2].id, name: 'Varthur', code: 'VRT' },
  { id: uuid(), taluk_id: KARNATAKA_TALUKS[2].id, name: 'K.R. Puram', code: 'KRP' },
];

const KARNATAKA_VILLAGES = [
  { id: uuid(), hobli_id: KARNATAKA_HOBLIS[0].id, name: 'Hebbal' },
  { id: uuid(), hobli_id: KARNATAKA_HOBLIS[2].id, name: 'Jayanagar' },
  { id: uuid(), hobli_id: KARNATAKA_HOBLIS[3].id, name: 'Whitefield' },
  { id: uuid(), hobli_id: KARNATAKA_HOBLIS[3].id, name: 'Marathahalli' },
  { id: uuid(), hobli_id: KARNATAKA_HOBLIS[4].id, name: 'K.R. Puram' },
  { id: uuid(), hobli_id: KARNATAKA_HOBLIS[1].id, name: 'Hesaraghatta' },
];

// ─── Mock Data Store Class ───────────────────────────────────────────────────

export class MockDataStore {
  organizations: MockOrg[] = [DEFAULT_ORG];
  users: MockUser[] = [];
  memberships: MockMembership[] = [];
  passwordOverrides: MockPasswordOverride[] = [];
  sessions: MockSession[] = [];
  otpChallenges: MockOtpChallenge[] = [];
  properties: MockProperty[] = [];
  documents: MockDocument[] = [];
  findings: MockFinding[] = [];
  titleEvents: MockTitleEvent[] = [];
  tasks: MockTask[] = [];
  reports: MockReport[] = [];
  auditEvents: MockAuditEvent[] = [];
  districts = KARNATAKA_DISTRICTS;
  taluks = KARNATAKA_TALUKS;
  hoblis = KARNATAKA_HOBLIS;
  villages = KARNATAKA_VILLAGES;
  workspaceSettings: any = null;
  permissionOverrides: any[] = [];
  retentionPolicies: any[] = [];
  initialized = false;

  constructor() {
    this.seed();
  }

  private seed() {
    // Create password overrides for all dummy accounts
    for (const [uid, password] of Object.entries(DEMO_PASSWORDS)) {
      this.passwordOverrides.push({
        user_uid: uid,
        password_hash: hashPasswordSync(password),
        changed_at: now(),
        changed_by_uid: 'system',
      });
    }

    // Create memberships for all dummy accounts
    for (const [uid, role] of Object.entries(DEMO_ROLES)) {
      this.memberships.push({
        user_uid: uid,
        organization_id: DEFAULT_ORG_ID,
        email: 'mrsharath3126@gmail.com',
        role,
        status: 'active',
        created_at: '2026-01-01 00:00:00',
      });
    }

    // Seed properties
    this.properties = createSeedProperties();
    this.documents = createSeedDocuments(this.properties);
    this.findings = createSeedFindings(this.properties);
    this.titleEvents = createSeedTitleEvents(this.properties);
    this.tasks = createSeedTasks(this.properties);
    this.reports = createSeedReports(this.properties);

    // Workspace settings
    this.workspaceSettings = {
      tenant_id: DEFAULT_ORG_ID,
      org_name: 'OJIX Demo Workspace',
      llpin: 'ADA-1604',
      office_address: 'Ranga Rao Rd, Shankarapura, Bengaluru 560004',
      firm_logo_url: '/assets/ojix-primary-dark.png',
      firm_email: 'info@ojix.in',
      default_report_template: 'standard',
      legal_disclaimer: 'This report is generated for review purposes only and does not constitute legal advice.',
    };

    this.initialized = true;
  }

  // ─── Query helpers (mimic pool.query interface) ──────────────────────────

  findPasswordOverride(uid: string): MockPasswordOverride | undefined {
    return this.passwordOverrides.find(o => o.user_uid === uid);
  }

  findMembership(uid: string, orgId?: string): MockMembership | undefined {
    if (orgId) return this.memberships.find(m => m.user_uid === uid && m.organization_id === orgId);
    return this.memberships.find(m => m.user_uid === uid);
  }

  findMembershipsByUser(uid: string): MockMembership[] {
    return this.memberships.filter(m => m.user_uid === uid && m.status === 'active');
  }

  findUser(email: string): MockUser | undefined {
    return this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id: string): MockUser | undefined {
    return this.users.find(u => u.id === id);
  }

  createUser(user: Omit<MockUser, 'created_at'>): MockUser {
    const newUser: MockUser = { ...user, created_at: now() };
    this.users.push(newUser);
    return newUser;
  }

  createMembership(membership: Omit<MockMembership, 'created_at'>): MockMembership {
    const newMembership: MockMembership = { ...membership, created_at: now() };
    this.memberships.push(newMembership);
    return newMembership;
  }

  createOtpChallenge(challenge: Omit<MockOtpChallenge, 'consumed_at' | 'attempts' | 'created_at'>): MockOtpChallenge {
    const newChallenge: MockOtpChallenge = { ...challenge, consumed_at: null, attempts: 0, created_at: now() };
    this.otpChallenges.push(newChallenge);
    return newChallenge;
  }

  findOtpChallenge(id: string, email: string, purpose: string): MockOtpChallenge | undefined {
    return this.otpChallenges.find(c => c.id === id && c.email === email.toLowerCase() && c.purpose === purpose && !c.consumed_at);
  }

  consumeOtpChallenge(id: string): void {
    const challenge = this.otpChallenges.find(c => c.id === id);
    if (challenge) challenge.consumed_at = now();
  }

  invalidatePriorChallenges(uid: string, purpose: string): void {
    for (const c of this.otpChallenges) {
      if (c.account_uid === uid && c.purpose === purpose && !c.consumed_at) {
        c.consumed_at = now();
      }
    }
  }

  countRecentOtpRequests(uid: string, purpose: string, windowMinutes: number): { count: number; lastAt: number } {
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    const recent = this.otpChallenges.filter(c =>
      c.account_uid === uid && c.purpose === purpose && new Date(c.created_at).getTime() > cutoff
    );
    const lastAt = recent.length ? Math.max(...recent.map(c => new Date(c.created_at).getTime())) : 0;
    return { count: recent.length, lastAt };
  }

  createSession(session: MockSession): void {
    this.sessions.push(session);
  }

  revokeSession(id: string, byUid: string, reason: string): void {
    const session = this.sessions.find(s => s.id === id);
    if (session) {
      session.revoked_at = now();
      session.revoked_by_uid = byUid;
      session.revoke_reason = reason;
    }
  }

  revokeUserSessions(uid: string, exceptId: string, byUid: string, reason: string): void {
    for (const s of this.sessions) {
      if (s.user_uid === uid && s.id !== exceptId && !s.revoked_at) {
        s.revoked_at = now();
        s.revoked_by_uid = byUid;
        s.revoke_reason = reason;
      }
    }
  }

  findSessionByHash(hash: string): MockSession | undefined {
    return this.sessions.find(s => s.token_hash === hash && !s.revoked_at && new Date(s.expires_at).getTime() > Date.now());
  }

  addAuditEvent(event: Omit<MockAuditEvent, 'id' | 'created_at'>): void {
    this.auditEvents.push({ ...event, id: uuid(), created_at: now() });
  }

  findProperties(tenantId: string): MockProperty[] {
    return this.properties.filter(p => p.tenant_id === tenantId && !p.archived_at);
  }

  findPropertyById(id: string, tenantId: string): MockProperty | undefined {
    return this.properties.find(p => p.id === id && p.tenant_id === tenantId);
  }

  findDocumentsByProperty(propertyId: string, tenantId: string): MockDocument[] {
    return this.documents.filter(d => d.property_id === propertyId && d.tenant_id === tenantId);
  }

  findFindingsByProperty(propertyId: string, tenantId: string): MockFinding[] {
    return this.findings.filter(f => f.property_id === propertyId && f.tenant_id === tenantId);
  }

  findTitleEventsByProperty(propertyId: string, tenantId: string): MockTitleEvent[] {
    return this.titleEvents.filter(t => t.property_id === propertyId && t.tenant_id === tenantId);
  }

  findTasks(tenantId: string): MockTask[] {
    return this.tasks.filter(t => t.tenant_id === tenantId);
  }

  findTaskById(id: string): MockTask | undefined {
    return this.tasks.find(t => t.id === id);
  }

  findReports(tenantId: string): MockReport[] {
    return this.reports.filter(r => r.tenant_id === tenantId);
  }

  findReportById(id: string): MockReport | undefined {
    return this.reports.find(r => r.id === id);
  }

  getOverview(tenantId: string) {
    const props = this.findProperties(tenantId);
    const docs = this.documents.filter(d => d.tenant_id === tenantId);
    return {
      total: props.length,
      in_review: props.filter(p => p.status === 'in_review').length,
      ready_for_review: props.filter(p => p.status === 'approved').length,
      documents: docs.length,
    };
  }

  createProperty(prop: MockProperty): MockProperty {
    this.properties.unshift(prop);
    return prop;
  }

  updateProperty(id: string, updates: Partial<MockProperty>): MockProperty | undefined {
    const prop = this.properties.find(p => p.id === id);
    if (!prop) return undefined;
    Object.assign(prop, updates, { updated_at: now() });
    return prop;
  }

  deleteProperty(id: string): boolean {
    const prevLen = this.properties.length;
    this.properties = this.properties.filter(p => p.id !== id);
    return this.properties.length < prevLen;
  }

  createDocument(doc: MockDocument): MockDocument {
    this.documents.unshift(doc);
    return doc;
  }

  updateDocument(id: string, updates: Partial<MockDocument>): MockDocument | undefined {
    const doc = this.documents.find(d => d.id === id);
    if (!doc) return undefined;
    Object.assign(doc, updates, { updated_at: now() });
    return doc;
  }

  deleteDocument(id: string): boolean {
    const prevLen = this.documents.length;
    this.documents = this.documents.filter(d => d.id !== id);
    return this.documents.length < prevLen;
  }

  createFinding(finding: MockFinding): MockFinding {
    this.findings.unshift(finding);
    return finding;
  }

  createTask(task: MockTask): MockTask {
    this.tasks.unshift(task);
    return task;
  }

  updateTask(id: string, updates: Partial<MockTask>): MockTask | undefined {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return undefined;
    Object.assign(task, updates, { updated_at: now() });
    return task;
  }

  createTitleEvent(event: MockTitleEvent): MockTitleEvent {
    this.titleEvents.push(event);
    return event;
  }

  createReport(report: MockReport): MockReport {
    this.reports.unshift(report);
    return report;
  }

  updateReport(id: string, updates: Partial<MockReport>): MockReport | undefined {
    const report = this.reports.find(r => r.id === id);
    if (!report) return undefined;
    Object.assign(report, updates);
    return report;
  }

  updatePasswordOverride(uid: string, hash: string, byUid: string): void {
    const existing = this.passwordOverrides.find(o => o.user_uid === uid);
    if (existing) {
      existing.password_hash = hash;
      existing.changed_at = now();
      existing.changed_by_uid = byUid;
    } else {
      this.passwordOverrides.push({ user_uid: uid, password_hash: hash, changed_at: now(), changed_by_uid: byUid });
    }
  }

  updateUserPassword(id: string, hash: string): void {
    const user = this.users.find(u => u.id === id);
    if (user) user.password_hash = hash;
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _instance: MockDataStore | null = null;

export function getMockStore(): MockDataStore {
  if (!_instance) _instance = new MockDataStore();
  return _instance;
}

export function isMockMode(): boolean {
  // Explicit demo mode flag
  if (process.env.DEMO_MODE === 'true') return true;
  // No database configured
  if (!process.env.DATABASE_URL) return true;
  return false;
}

export { DEFAULT_ORG_ID, hashPasswordSync };
