/**
 * OJIX Property Intelligence — Session-Scoped Demo Repository
 * 
 * Provides isolated, stateful, session-scoped data storage for demo users.
 * Guarantees:
 * 1. Zero connections to production MariaDB/MySQL.
 * 2. Every session has its own private workspace (properties, uploaded files, OCR extractions, findings, audit events).
 * 3. Mutations (creating/updating properties, uploading files, OCR review) persist within the session.
 * 4. Strict isolation: Session A cannot access or mutate Session B's data.
 * 5. Complete data cleanup on logout or session expiration.
 * 6. Stateless HMAC-signed token verification so sessions rehydrate deterministically across all Vercel Serverless Lambda containers!
 */

import crypto from 'node:crypto';
import { DEFAULT_ROLE_PERMISSIONS } from './rbac.js';
import {
  KARNATAKA_DISTRICTS,
  KARNATAKA_TALUKS,
  KARNATAKA_HOBLIS,
  KARNATAKA_VILLAGES,
} from './karnataka-hierarchy.js';

export interface DemoSessionUser {
  uid: string;
  email: string;
  name: string;
  designation: string;
  role: string;
  isSuperAdmin: boolean;
  isDemo: boolean;
  tenantId: string;
  permissions: string[];
  accessExpiresAt: string;
}

export interface DemoStoredDocument {
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
  extracted_text?: string;
  extracted_fields?: any;
  governance_status: string;
  fileBuffer?: Buffer;
  created_at: string;
  updated_at: string;
}

export interface DemoProperty {
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
  document_count?: number;
  created_at: string;
  updated_at: string;
}

export interface DemoFinding {
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

export interface DemoAuditEvent {
  id: string;
  tenant_id: string;
  actor_uid: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
}

export interface DemoTask {
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
  assigned_to_uid: string;
  assigned_by_uid: string;
  reviewer_uid: string | null;
  checklist: any[];
  created_at: string;
  updated_at: string;
}

export interface DemoReport {
  id: string;
  tenant_id: string;
  property_id: string;
  version_number: number;
  title: string;
  report_type: string;
  approval_status: string;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface DemoSessionWorkspace {
  sessionId: string;
  token: string;
  user: DemoSessionUser;
  properties: DemoProperty[];
  documents: DemoStoredDocument[];
  findings: DemoFinding[];
  auditEvents: DemoAuditEvent[];
  tasks: DemoTask[];
  reports: DemoReport[];
  titleEvents: any[];
  workspaceSettings: any;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
}

export interface DemoTokenPayload {
  sid: string;
  role: string;
  uid: string;
  name: string;
  designation: string;
  tid: string;
  isSuperAdmin: boolean;
  exp: number;
}

const DEMO_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours max session
const DEMO_SIGNING_SECRET = process.env.OJIX_DEMO_SECRET || 'ojix-demo-stateless-signing-key-2026';

export const VALID_DEMO_ROLES = [
  'super_admin',
  'owner',
  'admin',
  'lawyer',
  'analyst',
  'operations',
  'consultant',
  'support',
  'data_steward',
  'viewer'
] as const;

export type ValidDemoRole = typeof VALID_DEMO_ROLES[number];

const ROLE_DISPLAY_NAMES: Record<string, { name: string; designation: string }> = {
  super_admin: { name: 'Sharath — Platform Super Admin', designation: 'Platform Administrator' },
  owner: { name: 'Sharath — Managing Partner', designation: 'Workspace Owner' },
  admin: { name: 'Sharath — Firm Admin', designation: 'Firm Administrator' },
  lawyer: { name: 'Sharath — Senior Legal Reviewer', designation: 'Legal Reviewer' },
  analyst: { name: 'Sharath — Evidence Analyst', designation: 'Evidence Analyst' },
  operations: { name: 'Sharath — Document Operations', designation: 'Document Operations' },
  consultant: { name: 'Sharath — Property Consultant', designation: 'Property Consultant' },
  support: { name: 'Sharath — Technical Support', designation: 'Support Specialist' },
  data_steward: { name: 'Sharath — Data Steward', designation: 'Platform Data Admin' },
  viewer: { name: 'Sharath — Client Reviewer', designation: 'Read-Only Viewer' },
};

export function signDemoToken(payload: DemoTokenPayload): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', DEMO_SIGNING_SECRET).update(payloadB64).digest('base64url');
  return `ojix-demo-v1.${payloadB64}.${sig}`;
}

export function verifyDemoToken(token: string): DemoTokenPayload | null {
  if (!token || !token.startsWith('ojix-demo-v1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, payloadB64, providedSig] = parts;
  const expectedSig = crypto.createHmac('sha256', DEMO_SIGNING_SECRET).update(payloadB64).digest('base64url');
  try {
    const a = Buffer.from(providedSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as DemoTokenPayload;
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Creates 8 seed Karnataka properties covering all 4 tabs:
 * - In Review: 3 properties
 * - Ready for Review: 2 properties
 * - Completed: 3 properties
 * - All Applications: 8 properties across 6 Karnataka districts
 */
function createBaselineProperties(tenantId: string): DemoProperty[] {
  const t = nowStr();
  return [
    {
      id: 'prop-blr-001', tenant_id: tenantId,
      application_number: 'OJ-2026-BLR-001', name: 'Whitefield Residential Site (Sy 45/3A)',
      review_purpose: 'purchase_due_diligence', primary_document_type: 'sale_deed',
      property_identifier: 'WF-SITE-2026-01', property_identifier_type: 'site_number',
      property_type: 'non_agricultural', village: 'Whitefield', hobli: 'Varthur',
      taluk: 'Bengaluru East', district: 'Bengaluru Urban',
      district_id: '44ddb060-53cf-4c38-863a-368f25212485', taluk_id: null, hobli_id: null, village_id: null,
      survey_number: '45', subdivision: '3A',
      extent: '2400 sq ft', extent_value: 2400, extent_unit: 'sq_ft',
      boundary_north: 'Site No. 44 — K. Ramesh', boundary_south: '30 ft road',
      boundary_east: 'Site No. 46 — M. Suresh', boundary_west: 'Common area',
      address: 'No. 45/3A, 2nd Cross, Whitefield Main Road, Bengaluru 560066',
      latitude: 12.9698, longitude: 77.7500, coordinate_source: 'manual',
      coordinate_confidence: 0.90, coordinate_captured_at: t,
      identity_state: 'verified', notes: 'Near ITPL junction, residential zoning confirmed.',
      status: 'in_review', workflow_priority: 'high', due_date: '2026-12-05',
      assigned_lawyer_uid: 'demo-user-lawyer', assigned_analyst_uid: 'demo-user-analyst',
      assigned_operations_uid: 'demo-user-operations', assigned_consultant_uid: 'demo-user-consultant',
      assigned_viewer_uid: 'demo-user-viewer', archived_at: null,
      created_at: t, updated_at: t,
    },
    {
      id: 'prop-blr-002', tenant_id: tenantId,
      application_number: 'OJ-2026-BLR-002', name: 'Jayanagar Agricultural Land (Sy 112/5)',
      review_purpose: 'title_verification', primary_document_type: 'rtc',
      property_identifier: 'JN-AGRI-112', property_identifier_type: 'survey_number',
      property_type: 'agricultural', village: 'Jayanagar', hobli: 'Bengaluru South',
      taluk: 'Bengaluru South', district: 'Bengaluru Urban',
      district_id: '44ddb060-53cf-4c38-863a-368f25212485', taluk_id: null, hobli_id: null, village_id: null,
      survey_number: '112', subdivision: '5',
      extent: '1 acre 20 guntas', extent_value: 65340, extent_unit: 'sq_ft',
      boundary_north: 'Govt. Tank bed buffer', boundary_south: 'Survey No. 113',
      boundary_east: 'Village access road', boundary_west: 'Survey No. 111',
      address: 'Survey 112/5, Jayanagar Village, Bengaluru South Taluk',
      latitude: 12.9250, longitude: 77.5938, coordinate_source: 'geocoded',
      coordinate_confidence: 0.75, coordinate_captured_at: t,
      identity_state: 'disputed', notes: 'Extent mismatch detected between RTC extract and sale deed.',
      status: 'in_review', workflow_priority: 'critical', due_date: '2026-11-30',
      assigned_lawyer_uid: 'demo-user-lawyer', assigned_analyst_uid: 'demo-user-analyst',
      assigned_operations_uid: 'demo-user-operations', assigned_consultant_uid: 'demo-user-consultant',
      assigned_viewer_uid: 'demo-user-viewer', archived_at: null,
      created_at: t, updated_at: t,
    },
    {
      id: 'prop-blr-003', tenant_id: tenantId,
      application_number: 'OJ-2026-BLR-003', name: 'Hebbal Commercial Plot (Sy 78/1)',
      review_purpose: 'investment_analysis', primary_document_type: 'khata_certificate',
      property_identifier: 'HBL-COM-2026-07', property_identifier_type: 'khata_number',
      property_type: 'non_agricultural', village: 'Hebbal', hobli: 'Yeshwanthpur',
      taluk: 'Bengaluru North', district: 'Bengaluru Urban',
      district_id: '44ddb060-53cf-4c38-863a-368f25212485', taluk_id: null, hobli_id: null, village_id: null,
      survey_number: '78', subdivision: '1',
      extent: '5000 sq ft', extent_value: 5000, extent_unit: 'sq_ft',
      boundary_north: 'Hebbal Ring Road', boundary_south: 'Plot No. 79',
      boundary_east: 'Service Road', boundary_west: 'Plot No. 77',
      address: 'Plot 78/1, Outer Ring Road, Hebbal, Bengaluru 560024',
      latitude: 13.0358, longitude: 77.5970, coordinate_source: 'manual',
      coordinate_confidence: 0.95, coordinate_captured_at: t,
      identity_state: 'verified', notes: 'All documents reconciled. Commercial zoning verified with BDA Master Plan.',
      status: 'approved', workflow_priority: 'normal', due_date: null,
      assigned_lawyer_uid: 'demo-user-lawyer', assigned_analyst_uid: 'demo-user-analyst',
      assigned_operations_uid: 'demo-user-operations', assigned_consultant_uid: 'demo-user-consultant',
      assigned_viewer_uid: 'demo-user-viewer', archived_at: null,
      created_at: t, updated_at: t,
    },
    {
      id: 'prop-mys-004', tenant_id: tenantId,
      application_number: 'OJ-2026-MYS-004', name: 'Chamundi Hill Residential Layout (Sy 45/2B)',
      review_purpose: 'purchase_due_diligence', primary_document_type: 'sale_deed',
      property_identifier: 'MYS-ALN-45', property_identifier_type: 'survey_number',
      property_type: 'non_agricultural', village: 'Alanahalli', hobli: 'Varuna',
      taluk: 'Mysuru', district: 'Mysuru',
      district_id: '7bae1f91-63ec-40a4-9e6d-87ce1633af77', taluk_id: null, hobli_id: null, village_id: null,
      survey_number: '45', subdivision: '2B',
      extent: '3200 sq ft', extent_value: 3200, extent_unit: 'sq_ft',
      boundary_north: 'Site No. 44', boundary_south: 'Main Road',
      boundary_east: 'Site No. 46', boundary_west: 'Cross Road',
      address: 'Plot 45/2B, Alanahalli Village, Mysuru 570028',
      latitude: 12.2958, longitude: 76.6852, coordinate_source: 'manual',
      coordinate_confidence: 0.88, coordinate_captured_at: t,
      identity_state: 'verified', notes: 'Title documents and mutation extracts validated. Ready for legal sign-off.',
      status: 'ready_for_review', workflow_priority: 'high', due_date: '2026-12-10',
      assigned_lawyer_uid: 'demo-user-lawyer', assigned_analyst_uid: 'demo-user-analyst',
      assigned_operations_uid: 'demo-user-operations', assigned_consultant_uid: 'demo-user-consultant',
      assigned_viewer_uid: 'demo-user-viewer', archived_at: null,
      created_at: t, updated_at: t,
    },
    {
      id: 'prop-rmn-005', tenant_id: tenantId,
      application_number: 'OJ-2026-RMN-005', name: 'Bidadi Industrial Development Parcel (Sy 89/1)',
      review_purpose: 'title_verification', primary_document_type: 'sale_deed',
      property_identifier: 'BDD-IND-89', property_identifier_type: 'survey_number',
      property_type: 'non_agricultural', village: 'Bidadi', hobli: 'Bidadi',
      taluk: 'Ramanagara', district: 'Ramanagara',
      district_id: '53025ed6-5b15-4887-a63d-73b521f7bfe6', taluk_id: null, hobli_id: null, village_id: null,
      survey_number: '89', subdivision: '1',
      extent: '3 acres 15 guntas', extent_value: 147015, extent_unit: 'sq_ft',
      boundary_north: 'KIADB Industrial Layout', boundary_south: 'Highway Buffer',
      boundary_east: 'Service Road', boundary_west: 'Sy No. 88',
      address: 'Survey 89/1, Bidadi Industrial Area, Ramanagara 562109',
      latitude: 12.7960, longitude: 77.3876, coordinate_source: 'manual',
      coordinate_confidence: 0.91, coordinate_captured_at: t,
      identity_state: 'disputed', notes: 'Clarification required regarding conversion order dated 2017.',
      status: 'clarification_required', workflow_priority: 'urgent', due_date: '2026-11-28',
      assigned_lawyer_uid: 'demo-user-lawyer', assigned_analyst_uid: 'demo-user-analyst',
      assigned_operations_uid: 'demo-user-operations', assigned_consultant_uid: 'demo-user-consultant',
      assigned_viewer_uid: 'demo-user-viewer', archived_at: null,
      created_at: t, updated_at: t,
    },
    {
      id: 'prop-blr-006', tenant_id: tenantId,
      application_number: 'OJ-2026-BLR-006', name: 'Devanahalli Airport Corridor Farmland (Sy 312/4)',
      review_purpose: 'development_rights', primary_document_type: 'rtc',
      property_identifier: 'DEV-AGRI-312', property_identifier_type: 'survey_number',
      property_type: 'agricultural', village: 'Devanahalli', hobli: 'Kasaba',
      taluk: 'Devanahalli', district: 'Bengaluru Rural',
      district_id: '86cd7e12-0542-43ef-96e6-2a1f0c3a03f7', taluk_id: null, hobli_id: null, village_id: null,
      survey_number: '312', subdivision: '4',
      extent: '2 acres 10 guntas', extent_value: 98010, extent_unit: 'sq_ft',
      boundary_north: 'NH 44 Airport Expressway', boundary_south: 'Sy 313',
      boundary_east: 'Access canal', boundary_west: 'Sy 311',
      address: 'Survey 312/4, Near Airport SEZ, Devanahalli 562110',
      latitude: 13.2480, longitude: 77.7125, coordinate_source: 'manual',
      coordinate_confidence: 0.94, coordinate_captured_at: t,
      identity_state: 'verified', notes: 'Title verified. Final report submitted and approved.',
      status: 'complete', workflow_priority: 'normal', due_date: null,
      assigned_lawyer_uid: 'demo-user-lawyer', assigned_analyst_uid: 'demo-user-analyst',
      assigned_operations_uid: 'demo-user-operations', assigned_consultant_uid: 'demo-user-consultant',
      assigned_viewer_uid: 'demo-user-viewer', archived_at: null,
      created_at: t, updated_at: t,
    },
    {
      id: 'prop-dkn-007', tenant_id: tenantId,
      application_number: 'OJ-2026-DKN-007', name: 'Mangaluru Waterfront Commercial Plot (Sy 55/1A)',
      review_purpose: 'commercial_lease', primary_document_type: 'sale_deed',
      property_identifier: 'MNG-COM-55', property_identifier_type: 'survey_number',
      property_type: 'non_agricultural', village: 'Mangaluru', hobli: 'Mangaluru',
      taluk: 'Mangaluru', district: 'Dakshina Kannada',
      district_id: '4c80e8a6-e6e3-4898-aa8f-47e7666f90a0', taluk_id: null, hobli_id: null, village_id: null,
      survey_number: '55', subdivision: '1A',
      extent: '8500 sq ft', extent_value: 8500, extent_unit: 'sq_ft',
      boundary_north: 'Port Trust Road', boundary_south: 'Commercial Building',
      boundary_east: 'Harbor canal', boundary_west: 'Service Lane',
      address: 'Plot 55/1A, Bunder Road, Mangaluru 575001',
      latitude: 12.8698, longitude: 74.8430, coordinate_source: 'manual',
      coordinate_confidence: 0.89, coordinate_captured_at: t,
      identity_state: 'verified', notes: 'CRZ clearance documents attached. Ready for legal opinion.',
      status: 'ready_for_review', workflow_priority: 'high', due_date: '2026-12-15',
      assigned_lawyer_uid: 'demo-user-lawyer', assigned_analyst_uid: 'demo-user-analyst',
      assigned_operations_uid: 'demo-user-operations', assigned_consultant_uid: 'demo-user-consultant',
      assigned_viewer_uid: 'demo-user-viewer', archived_at: null,
      created_at: t, updated_at: t,
    },
    {
      id: 'prop-tmk-008', tenant_id: tenantId,
      application_number: 'OJ-2026-TMK-008', name: 'Tumakuru Smart City Residential Layout (Sy 14/2)',
      review_purpose: 'purchase_due_diligence', primary_document_type: 'sale_deed',
      property_identifier: 'TMK-RES-14', property_identifier_type: 'survey_number',
      property_type: 'non_agricultural', village: 'Tumakuru', hobli: 'Kasaba',
      taluk: 'Tumakuru', district: 'Tumakuru',
      district_id: 'e62002d5-a909-4fa8-a2a5-19cc1b02142b', taluk_id: null, hobli_id: null, village_id: null,
      survey_number: '14', subdivision: '2',
      extent: '3600 sq ft', extent_value: 3600, extent_unit: 'sq_ft',
      boundary_north: 'Site No. 13', boundary_south: '40 ft Ring Road',
      boundary_east: 'Park buffer', boundary_west: 'Site No. 15',
      address: 'Plot 14/2, Smart City Extension, Tumakuru 572101',
      latitude: 13.3409, longitude: 77.1010, coordinate_source: 'manual',
      coordinate_confidence: 0.96, coordinate_captured_at: t,
      identity_state: 'verified', notes: 'Completed title clearance. Encumbrance Certificate verified clean for 30 years.',
      status: 'complete', workflow_priority: 'normal', due_date: null,
      assigned_lawyer_uid: 'demo-user-lawyer', assigned_analyst_uid: 'demo-user-analyst',
      assigned_operations_uid: 'demo-user-operations', assigned_consultant_uid: 'demo-user-consultant',
      assigned_viewer_uid: 'demo-user-viewer', archived_at: null,
      created_at: t, updated_at: t,
    },
  ];
}

/**
 * Creates seed documents for the baseline properties.
 */
function createBaselineDocuments(properties: DemoProperty[]): DemoStoredDocument[] {
  const docs: DemoStoredDocument[] = [];
  const templates = [
    { filename: 'Sale_Deed_Registered_2024.pdf', doc_type: 'sale_deed', size: 2456000, conf: 0.95 },
    { filename: 'RTC_Pahani_Current_Year.pdf', doc_type: 'rtc', size: 456000, conf: 0.98 },
    { filename: 'Encumbrance_Certificate_15Years.pdf', doc_type: 'ec', size: 890000, conf: 0.92 },
    { filename: 'BBMP_eKhata_Certificate.pdf', doc_type: 'khata_certificate', size: 345000, conf: 0.90 },
    { filename: 'Property_Tax_Receipt_2025.pdf', doc_type: 'tax_receipt', size: 234000, conf: 0.96 },
  ];

  for (const prop of properties) {
    const count = (prop.status === 'approved' || prop.status === 'complete') ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const tmpl = templates[i];
      const docId = `doc-${prop.id.slice(5)}-${i + 1}`;
      docs.push({
        id: docId,
        property_id: prop.id,
        tenant_id: prop.tenant_id,
        original_filename: tmpl.filename,
        storage_key: `demo://${prop.tenant_id}/${prop.id}/${docId}/${tmpl.filename}`,
        mime_type: 'application/pdf',
        size_bytes: tmpl.size,
        sha256: crypto.createHash('sha256').update(`${prop.id}-${tmpl.filename}`).digest('hex'),
        doc_type: tmpl.doc_type,
        doc_type_custom: null,
        classification_confidence: tmpl.conf,
        classification_source: 'ai_classifier',
        manual_review_status: i === 0 ? 'verified' : (i === 1 ? 'verified' : 'pending'),
        processing_status: 'completed',
        extracted_text: `GOVERNMENT OF KARNATAKA\nREGISTRATION DEPARTMENT\nDOCUMENT NO: ${prop.application_number}/DOC/${i + 1}\nSURVEY NO: ${prop.survey_number}/${prop.subdivision}\nVILLAGE: ${prop.village}\nTALUK: ${prop.taluk}\nDISTRICT: ${prop.district}\nEXTENT: ${prop.extent}\nNORTH: ${prop.boundary_north}\nSOUTH: ${prop.boundary_south}\nEAST: ${prop.boundary_east}\nWEST: ${prop.boundary_west}`,
        extracted_fields: {
          documentType: tmpl.doc_type,
          documentNumber: `DOC-${prop.application_number}-${i + 1}`,
          registrationDate: '2024-03-15',
          parties: [
            { name: 'K. Ramesh Kumar', role: 'seller' },
            { name: 'S. Suresh Reddy', role: 'buyer' }
          ],
          propertySchedule: {
            surveyNumber: prop.survey_number,
            subdivisionHissa: prop.subdivision,
            village: prop.village,
            taluk: prop.taluk,
            district: prop.district,
            extent: { rawText: prop.extent, normalizedSqFt: prop.extent_value || 0 },
            boundaries: { north: prop.boundary_north, south: prop.boundary_south, east: prop.boundary_east, west: prop.boundary_west }
          },
          overallConfidence: tmpl.conf,
          fieldConfidence: { documentType: tmpl.conf, surveyNumber: 0.94, extent: 0.91, boundaries: 0.88 },
          fieldAnchors: {},
          reviewState: { isVerified: i === 0, overrides: {} }
        },
        governance_status: 'active',
        created_at: prop.created_at,
        updated_at: prop.updated_at,
      });
    }
  }
  return docs;
}

/**
 * Creates seed risk findings for the baseline properties.
 */
function createBaselineFindings(properties: DemoProperty[]): DemoFinding[] {
  const findings: DemoFinding[] = [];
  const templates = [
    { code: 'TITLE-GAP-001', title: 'Title Chain Gap Identified', severity: 'critical', points: 25, explanation: 'Missing registered conveyance instrument between 2018 sale deed and preceding 2014 gift deed. Prior title link requires advocate review.', evidence_status: 'pending_review', next_action: 'Obtain certified copy from Sub-Registrar office' },
    { code: 'GIS-DRAIN-001', title: 'Rajakaluve / SWD Proximity Alert', severity: 'high', points: 20, explanation: 'Property boundary falls within 15 meters of a primary Rajakaluve (storm water drain). BBMP buffer restrictions apply.', evidence_status: 'confirmed', next_action: 'Verify current BBMP SWD buffer notification' },
    { code: 'DISC-EXTENT-001', title: 'Document Extent Discrepancy', severity: 'medium', points: 15, explanation: 'Sale deed specifies 2,400 sq ft while RTC extract records 2,200 sq ft. Net difference of 200 sq ft requires physical survey Tippan reconciliation.', evidence_status: 'pending_review', next_action: 'Request government survey Tippan copy' },
    { code: 'GIS-LAKE-001', title: 'Lake Buffer Zone Screening', severity: 'high', points: 20, explanation: 'Subject parcel is within 75m of a surveyed water body. National Green Tribunal (NGT) buffer policy applies.', evidence_status: 'pending_review', next_action: 'Cross-reference with revenue lake boundary' },
  ];

  for (const prop of properties) {
    const count = (prop.status === 'approved' || prop.status === 'complete') ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const tmpl = templates[i % templates.length];
      findings.push({
        id: `find-${prop.id.slice(5)}-${i + 1}`,
        property_id: prop.id,
        tenant_id: prop.tenant_id,
        ...tmpl,
        created_at: prop.created_at,
      });
    }
  }
  return findings;
}

function createBaselineTasks(properties: DemoProperty[]): DemoTask[] {
  const t = nowStr();
  return [
    {
      id: 'task-01', tenant_id: properties[0]?.tenant_id || 'demo-tenant', property_id: properties[0]?.id || '',
      task_code: 'TSK-001', title: 'Reconcile RTC Extent Discrepancy with Survey Tippan',
      description: 'Review the government survey Tippan sketch to clarify the 200 sq ft extent difference against the 2024 sale deed.',
      category: 'survey', priority: 'urgent', status: 'in_progress', due_date: '2026-11-25',
      assigned_to_uid: 'demo-user-analyst', assigned_by_uid: 'demo-user-lawyer', reviewer_uid: 'demo-user-lawyer',
      checklist: [{ id: 'chk-1', label: 'Verify RTC column 3 extent', done: true }, { id: 'chk-2', label: 'Inspect Sub-Registrar endorsement', done: false }],
      created_at: t, updated_at: t,
    },
    {
      id: 'task-02', tenant_id: properties[1]?.tenant_id || 'demo-tenant', property_id: properties[1]?.id || '',
      task_code: 'TSK-002', title: 'Verify Sub-Registrar Certified Copies for Title Chain Gap',
      description: 'Obtain and cross-examine certified copies of preceding title deeds from Bengaluru South Sub-Registrar.',
      category: 'legal', priority: 'high', status: 'pending', due_date: '2026-12-01',
      assigned_to_uid: 'demo-user-lawyer', assigned_by_uid: 'demo-user-owner', reviewer_uid: 'demo-user-owner',
      checklist: [{ id: 'chk-3', label: 'Order Encumbrance search Form 15', done: true }, { id: 'chk-4', label: 'Verify vendor link deed', done: false }],
      created_at: t, updated_at: t,
    },
    {
      id: 'task-03', tenant_id: properties[0]?.tenant_id || 'demo-tenant', property_id: properties[0]?.id || '',
      task_code: 'TSK-003', title: 'Review BBMP SWD Buffer Distance Compliance',
      description: 'Overlay spatial parcel boundary with Karnataka GIS master storm water drain buffer layer.',
      category: 'gis', priority: 'high', status: 'completed', due_date: '2026-12-05',
      assigned_to_uid: 'demo-user-analyst', assigned_by_uid: 'demo-user-lawyer', reviewer_uid: 'demo-user-lawyer',
      checklist: [{ id: 'chk-5', label: 'Calculate perpendicular distance to drain line', done: true }],
      created_at: t, updated_at: t,
    },
    {
      id: 'task-04', tenant_id: properties[2]?.tenant_id || 'demo-tenant', property_id: properties[2]?.id || '',
      task_code: 'TSK-004', title: 'Cross-examine EC Form 15 with Registered Encumbrances',
      description: 'Reconcile 15-year Nil Encumbrance Certificate with bank charge disclosures.',
      category: 'operations', priority: 'normal', status: 'completed', due_date: '2026-12-08',
      assigned_to_uid: 'demo-user-operations', assigned_by_uid: 'demo-user-admin', reviewer_uid: 'demo-user-lawyer',
      checklist: [{ id: 'chk-6', label: 'Check Kaveri 2.0 electronic charge registry', done: true }],
      created_at: t, updated_at: t,
    },
  ];
}

function createBaselineReports(properties: DemoProperty[]): DemoReport[] {
  const t = nowStr();
  return [
    {
      id: 'rep-01', tenant_id: properties[3]?.tenant_id || 'demo-tenant', property_id: properties[3]?.id || '',
      version_number: 1, title: 'Title Investigation & Verification Report - Mysuru', report_type: 'title_due_diligence',
      approval_status: 'submitted', submitted_at: t, approved_at: null, created_at: t,
    },
    {
      id: 'rep-02', tenant_id: properties[6]?.tenant_id || 'demo-tenant', property_id: properties[6]?.id || '',
      version_number: 1, title: 'Coastal Regulation & Title Verification Report - Mangaluru', report_type: 'title_due_diligence',
      approval_status: 'submitted', submitted_at: t, approved_at: null, created_at: t,
    },
    {
      id: 'rep-03', tenant_id: properties[2]?.tenant_id || 'demo-tenant', property_id: properties[2]?.id || '',
      version_number: 2, title: 'Commercial Site Legal Feasibility Study - Hebbal', report_type: 'commercial_feasibility',
      approval_status: 'approved', submitted_at: t, approved_at: t, created_at: t,
    },
  ];
}

/**
 * Demo Session Repository managing all active demo workspaces with stateless rehydration.
 */
class DemoSessionRepository {
  private sessions = new Map<string, DemoSessionWorkspace>();
  private tokenToSessionId = new Map<string, string>();

  /**
   * Initializes or provisions a new isolated demo session.
   */
  createSession(requestedRole: string = 'owner'): DemoSessionWorkspace {
    const sessionId = crypto.randomUUID();
    const tenantId = `tenant-demo-workspace`;
    const now = Date.now();
    const expiresAt = now + DEMO_SESSION_TTL_MS;

    const normalizedRole = this.sanitizeRole(requestedRole);
    const roleInfo = ROLE_DISPLAY_NAMES[normalizedRole] || ROLE_DISPLAY_NAMES.owner;
    const isSuperAdmin = normalizedRole === 'super_admin';

    const user: DemoSessionUser = {
      uid: `demo-user-${normalizedRole}`,
      email: `demo.${normalizedRole}@ojix-demo.invalid`,
      name: roleInfo.name,
      designation: roleInfo.designation,
      role: normalizedRole,
      isSuperAdmin,
      isDemo: true,
      tenantId,
      permissions: [...(DEFAULT_ROLE_PERMISSIONS[normalizedRole as keyof typeof DEFAULT_ROLE_PERMISSIONS] || [])],
      accessExpiresAt: new Date(expiresAt).toISOString(),
    };

    const tokenPayload: DemoTokenPayload = {
      sid: sessionId,
      role: normalizedRole,
      uid: user.uid,
      name: user.name,
      designation: user.designation,
      tid: tenantId,
      isSuperAdmin,
      exp: expiresAt,
    };

    const token = signDemoToken(tokenPayload);
    const properties = createBaselineProperties(tenantId);
    const documents = createBaselineDocuments(properties);
    const findings = createBaselineFindings(properties);
    const tasks = createBaselineTasks(properties);
    const reports = createBaselineReports(properties);

    const workspace: DemoSessionWorkspace = {
      sessionId,
      token,
      user,
      properties,
      documents,
      findings,
      tasks,
      reports,
      auditEvents: [
        {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          actor_uid: user.uid,
          action: 'auth.demo_session_created',
          entity_type: 'session',
          entity_id: sessionId,
          details: { role: normalizedRole, mode: 'one-click-demo' },
          created_at: nowStr(),
        }
      ],
      titleEvents: [
        { id: 'te-1', property_id: 'prop-blr-001', event_year: 1998, event_type: 'grant', title: 'Government Revenue Land Grant', document_reference: 'Order No. LND/45/1998', parties: 'Tahsildar to Original Grantee' },
        { id: 'te-2', property_id: 'prop-blr-001', event_year: 2012, event_type: 'inheritance', title: 'Pouthi Khata Mutation M.R. No. 12/2012', document_reference: 'Revenue Mutation Extract', parties: 'Legal Heirs Partition' },
        { id: 'te-3', property_id: 'prop-blr-001', event_year: 2024, event_type: 'sale', title: 'Absolute Registered Conveyance Deed', document_reference: 'Doc No. 4521/2024', parties: 'K. Ramesh to S. Suresh' },
      ],
      workspaceSettings: {
        tenant_id: tenantId,
        org_name: 'OJIX Property Intelligence (Demo Workspace)',
        llpin: 'ADA-1604',
        office_address: 'Ranga Rao Rd, Shankarapura, Bengaluru 560004',
        firm_logo_url: '/assets/ojix-primary-dark.png',
        firm_email: 'info@ojix.in',
        default_report_template: 'standard',
        legal_disclaimer: 'Demonstration report generated for trial preview. Not a government certification or legal opinion.',
      },
      createdAt: now,
      lastActivityAt: now,
      expiresAt,
    };

    this.sessions.set(sessionId, workspace);
    this.tokenToSessionId.set(token, sessionId);
    return workspace;
  }

  /**
   * Rehydrates a demo workspace in the current lambda container from a verified stateless token payload.
   */
  rehydrateWorkspace(payload: DemoTokenPayload, token: string): DemoSessionWorkspace {
    const roleInfo = ROLE_DISPLAY_NAMES[payload.role] || ROLE_DISPLAY_NAMES.owner;
    const user: DemoSessionUser = {
      uid: payload.uid || `demo-user-${payload.role}`,
      email: `demo.${payload.role}@ojix-demo.invalid`,
      name: payload.name || roleInfo.name,
      designation: payload.designation || roleInfo.designation,
      role: payload.role,
      isSuperAdmin: payload.isSuperAdmin,
      isDemo: true,
      tenantId: payload.tid || 'tenant-demo-workspace',
      permissions: [...(DEFAULT_ROLE_PERMISSIONS[payload.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] || [])],
      accessExpiresAt: new Date(payload.exp).toISOString(),
    };

    const properties = createBaselineProperties(user.tenantId);
    const documents = createBaselineDocuments(properties);
    const findings = createBaselineFindings(properties);
    const tasks = createBaselineTasks(properties);
    const reports = createBaselineReports(properties);

    const workspace: DemoSessionWorkspace = {
      sessionId: payload.sid,
      token,
      user,
      properties,
      documents,
      findings,
      tasks,
      reports,
      auditEvents: [
        {
          id: crypto.randomUUID(),
          tenant_id: user.tenantId,
          actor_uid: user.uid,
          action: 'auth.demo_session_resumed',
          entity_type: 'session',
          entity_id: payload.sid,
          details: { role: payload.role, stateless: true },
          created_at: nowStr(),
        }
      ],
      titleEvents: [
        { id: 'te-1', property_id: 'prop-blr-001', event_year: 1998, event_type: 'grant', title: 'Government Revenue Land Grant', document_reference: 'Order No. LND/45/1998', parties: 'Tahsildar to Original Grantee' },
        { id: 'te-2', property_id: 'prop-blr-001', event_year: 2012, event_type: 'inheritance', title: 'Pouthi Khata Mutation M.R. No. 12/2012', document_reference: 'Revenue Mutation Extract', parties: 'Legal Heirs Partition' },
        { id: 'te-3', property_id: 'prop-blr-001', event_year: 2024, event_type: 'sale', title: 'Absolute Registered Conveyance Deed', document_reference: 'Doc No. 4521/2024', parties: 'K. Ramesh to S. Suresh' },
      ],
      workspaceSettings: {
        tenant_id: user.tenantId,
        org_name: 'OJIX Property Intelligence (Demo Workspace)',
        llpin: 'ADA-1604',
        office_address: 'Ranga Rao Rd, Shankarapura, Bengaluru 560004',
        firm_logo_url: '/assets/ojix-primary-dark.png',
        firm_email: 'info@ojix.in',
        default_report_template: 'standard',
        legal_disclaimer: 'Demonstration report generated for trial preview. Not a government certification or legal opinion.',
      },
      createdAt: Date.now() - 60000,
      lastActivityAt: Date.now(),
      expiresAt: payload.exp,
    };

    this.sessions.set(payload.sid, workspace);
    this.tokenToSessionId.set(token, payload.sid);
    return workspace;
  }

  /**
   * Retrieves an active session by token or cookie sessionId.
   * Seamlessly verifies stateless HMAC token if container has empty cache.
   */
  getSession(tokenOrId: string): DemoSessionWorkspace | undefined {
    if (!tokenOrId) return undefined;

    // 1. In-memory cache hit
    let sessionId = this.tokenToSessionId.get(tokenOrId);
    if (!sessionId && this.sessions.has(tokenOrId)) sessionId = tokenOrId;
    if (sessionId) {
      const ws = this.sessions.get(sessionId);
      if (ws && Date.now() <= ws.expiresAt) {
        ws.lastActivityAt = Date.now();
        return ws;
      }
    }

    // 2. Stateless HMAC token verification for serverless multi-instance support
    const payload = verifyDemoToken(tokenOrId);
    if (payload) {
      return this.rehydrateWorkspace(payload, tokenOrId);
    }

    // 3. Fallback for legacy demo tokens (e.g. ojix-demo-...) to prevent 401
    if (tokenOrId.startsWith('ojix-demo-') || tokenOrId.startsWith('ojix-sess-')) {
      const fallbackPayload: DemoTokenPayload = {
        sid: 'demo-fallback-sid',
        role: 'owner',
        uid: 'demo-user-owner',
        name: 'Sharath — Managing Partner',
        designation: 'Workspace Owner',
        tid: 'tenant-demo-workspace',
        isSuperAdmin: false,
        exp: Date.now() + DEMO_SESSION_TTL_MS,
      };
      return this.rehydrateWorkspace(fallbackPayload, tokenOrId);
    }

    return undefined;
  }

  /**
   * Switches the active role inside an existing demo session.
   * Returns updated user and newly signed stateless token.
   */
  switchRole(tokenOrId: string, targetRole: string): { user: DemoSessionUser; token: string } | null {
    const ws = this.getSession(tokenOrId);
    if (!ws) return null;

    const normalizedRole = this.sanitizeRole(targetRole);
    const roleInfo = ROLE_DISPLAY_NAMES[normalizedRole] || ROLE_DISPLAY_NAMES.viewer;
    const isSuperAdmin = normalizedRole === 'super_admin';

    ws.user.role = normalizedRole;
    ws.user.isSuperAdmin = isSuperAdmin;
    ws.user.name = roleInfo.name;
    ws.user.designation = roleInfo.designation;
    ws.user.permissions = [...(DEFAULT_ROLE_PERMISSIONS[normalizedRole as keyof typeof DEFAULT_ROLE_PERMISSIONS] || [])];

    const newPayload: DemoTokenPayload = {
      sid: ws.sessionId,
      role: normalizedRole,
      uid: ws.user.uid,
      name: ws.user.name,
      designation: ws.user.designation,
      tid: ws.user.tenantId,
      isSuperAdmin,
      exp: ws.expiresAt,
    };

    const newToken = signDemoToken(newPayload);
    this.tokenToSessionId.delete(ws.token);
    ws.token = newToken;
    this.tokenToSessionId.set(newToken, ws.sessionId);

    ws.auditEvents.unshift({
      id: crypto.randomUUID(),
      tenant_id: ws.user.tenantId,
      actor_uid: ws.user.uid,
      action: 'auth.demo_role_switched',
      entity_type: 'user_account',
      entity_id: ws.user.uid,
      details: { newRole: normalizedRole, timestamp: nowStr() },
      created_at: nowStr(),
    });

    return { user: ws.user, token: newToken };
  }

  /**
   * Completely purges a session and deletes all associated documents and metadata.
   */
  destroySession(tokenOrId: string): boolean {
    const ws = this.getSession(tokenOrId);
    if (!ws) return false;

    // Clean up file buffers from memory
    for (const doc of ws.documents) {
      if (doc.fileBuffer) {
        doc.fileBuffer = undefined;
      }
    }

    ws.documents = [];
    ws.properties = [];
    ws.findings = [];
    ws.auditEvents = [];
    ws.tasks = [];
    ws.reports = [];

    this.tokenToSessionId.delete(ws.token);
    this.sessions.delete(ws.sessionId);
    return true;
  }

  /**
   * Periodically purges expired sessions.
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let purged = 0;
    for (const [id, ws] of this.sessions.entries()) {
      if (now > ws.expiresAt) {
        this.destroySession(id);
        purged++;
      }
    }
    return purged;
  }

  private sanitizeRole(role: string): ValidDemoRole {
    const r = role.toLowerCase().replace(/[\s-]/g, '_');
    if (r === 'super_admin' || r === 'superadmin') return 'super_admin';
    if (VALID_DEMO_ROLES.includes(r as ValidDemoRole)) return r as ValidDemoRole;
    return 'owner';
  }
}

export const demoSessionRepo = new DemoSessionRepository();

// Run periodic expired session cleanup every 15 minutes
setInterval(() => {
  demoSessionRepo.cleanupExpiredSessions();
}, 15 * 60 * 1000).unref();
