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
 */

import crypto from 'node:crypto';
import { DEFAULT_ROLE_PERMISSIONS } from './rbac.js';

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

export interface DemoSessionWorkspace {
  sessionId: string;
  token: string;
  user: DemoSessionUser;
  properties: DemoProperty[];
  documents: DemoStoredDocument[];
  findings: DemoFinding[];
  auditEvents: DemoAuditEvent[];
  tasks: any[];
  reports: any[];
  titleEvents: any[];
  workspaceSettings: any;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
}

const DEMO_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours max session
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

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Creates seed synthetic Karnataka properties for a new demo session.
 */
function createBaselineProperties(tenantId: string): DemoProperty[] {
  const t = nowStr();
  return [
    {
      id: crypto.randomUUID(), tenant_id: tenantId,
      application_number: 'OJ-2026-BLR-001', name: 'Whitefield Residential Site (Sy 45/3A)',
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
      coordinate_confidence: 0.90, coordinate_captured_at: t,
      identity_state: 'verified', notes: 'Near ITPL junction, residential zoning confirmed.',
      status: 'in_review', workflow_priority: 'high', due_date: '2026-12-05',
      assigned_lawyer_uid: 'user-lawyer', assigned_analyst_uid: 'user-analyst',
      assigned_operations_uid: 'user-operations', assigned_consultant_uid: 'user-consultant',
      assigned_viewer_uid: 'user-viewer', archived_at: null,
      created_at: t, updated_at: t,
    },
    {
      id: crypto.randomUUID(), tenant_id: tenantId,
      application_number: 'OJ-2026-BLR-002', name: 'Jayanagar Agricultural Land (Sy 112/5)',
      review_purpose: 'title_verification', primary_document_type: 'rtc',
      property_identifier: 'JN-AGRI-112', property_identifier_type: 'survey_number',
      property_type: 'agricultural', village: 'Jayanagar', hobli: 'Bengaluru South',
      taluk: 'Bengaluru South', district: 'Bengaluru Urban',
      district_id: null, taluk_id: null, hobli_id: null, village_id: null,
      survey_number: '112', subdivision: '5',
      extent: '1 acre 20 guntas', extent_value: 65340, extent_unit: 'sq_ft',
      boundary_north: 'Govt. Tank bed buffer', boundary_south: 'Survey No. 113',
      boundary_east: 'Village access road', boundary_west: 'Survey No. 111',
      address: 'Survey 112/5, Jayanagar Village, Bengaluru South Taluk',
      latitude: 12.9250, longitude: 77.5938, coordinate_source: 'geocoded',
      coordinate_confidence: 0.75, coordinate_captured_at: t,
      identity_state: 'disputed', notes: 'Extent mismatch detected between RTC extract and sale deed.',
      status: 'in_review', workflow_priority: 'critical', due_date: '2026-11-30',
      assigned_lawyer_uid: 'user-lawyer', assigned_analyst_uid: 'user-analyst',
      assigned_operations_uid: 'user-operations', assigned_consultant_uid: 'user-consultant',
      assigned_viewer_uid: 'user-viewer', archived_at: null,
      created_at: t, updated_at: t,
    },
    {
      id: crypto.randomUUID(), tenant_id: tenantId,
      application_number: 'OJ-2026-BLR-003', name: 'Hebbal Commercial Plot (Sy 78/1)',
      review_purpose: 'investment_analysis', primary_document_type: 'khata_certificate',
      property_identifier: 'HBL-COM-2026-07', property_identifier_type: 'khata_number',
      property_type: 'non_agricultural', village: 'Hebbal', hobli: 'Yeshwanthpur',
      taluk: 'Bengaluru North', district: 'Bengaluru Urban',
      district_id: null, taluk_id: null, hobli_id: null, village_id: null,
      survey_number: '78', subdivision: '1',
      extent: '5000 sq ft', extent_value: 5000, extent_unit: 'sq_ft',
      boundary_north: 'Hebbal Ring Road', boundary_south: 'Plot No. 79',
      boundary_east: 'Service Road', boundary_west: 'Plot No. 77',
      address: 'Plot 78/1, Outer Ring Road, Hebbal, Bengaluru 560024',
      latitude: 13.0358, longitude: 77.5970, coordinate_source: 'manual',
      coordinate_confidence: 0.95, coordinate_captured_at: t,
      identity_state: 'verified', notes: 'All documents reconciled. Commercial zoning verified with BDA Master Plan.',
      status: 'approved', workflow_priority: 'normal', due_date: null,
      assigned_lawyer_uid: 'user-lawyer', assigned_analyst_uid: 'user-analyst',
      assigned_operations_uid: 'user-operations', assigned_consultant_uid: 'user-consultant',
      assigned_viewer_uid: 'user-viewer', archived_at: null,
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
    const count = prop.status === 'approved' ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const tmpl = templates[i];
      const docId = crypto.randomUUID();
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
        manual_review_status: i === 0 ? 'verified' : 'pending',
        processing_status: 'completed',
        extracted_text: `GOVERNMENT OF KARNATAKA\nREGISTRATION DEPARTMENT\nDOCUMENT NO: ${prop.application_number}/DOC/${i + 1}\nSURVEY NO: ${prop.survey_number}/${prop.subdivision}\nVILLAGE: ${prop.village}\nEXTENT: ${prop.extent}\nNORTH: ${prop.boundary_north}\nSOUTH: ${prop.boundary_south}\nEAST: ${prop.boundary_east}\nWEST: ${prop.boundary_west}`,
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
    const count = prop.status === 'approved' ? 1 : 3;
    for (let i = 0; i < count; i++) {
      const tmpl = templates[i];
      findings.push({
        id: crypto.randomUUID(),
        property_id: prop.id,
        tenant_id: prop.tenant_id,
        ...tmpl,
        created_at: prop.created_at,
      });
    }
  }
  return findings;
}

/**
 * Demo Session Repository managing all active demo workspaces.
 */
class DemoSessionRepository {
  private sessions = new Map<string, DemoSessionWorkspace>();
  private tokenToSessionId = new Map<string, string>();

  /**
   * Initializes or provisions a new isolated demo session.
   */
  createSession(requestedRole: string = 'owner'): DemoSessionWorkspace {
    const sessionId = crypto.randomUUID();
    const token = `ojix-demo-${crypto.randomBytes(24).toString('base64url')}`;
    const tenantId = `tenant-demo-${crypto.randomUUID().slice(0, 8)}`;
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

    const properties = createBaselineProperties(tenantId);
    const documents = createBaselineDocuments(properties);
    const findings = createBaselineFindings(properties);

    const workspace: DemoSessionWorkspace = {
      sessionId,
      token,
      user,
      properties,
      documents,
      findings,
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
      tasks: [],
      reports: [],
      titleEvents: [],
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
   * Retrieves an active session by token or cookie sessionId.
   */
  getSession(tokenOrId: string): DemoSessionWorkspace | undefined {
    let sessionId = this.tokenToSessionId.get(tokenOrId);
    if (!sessionId && this.sessions.has(tokenOrId)) sessionId = tokenOrId;
    if (!sessionId) return undefined;

    const ws = this.sessions.get(sessionId);
    if (!ws) return undefined;

    if (Date.now() > ws.expiresAt) {
      this.destroySession(sessionId);
      return undefined;
    }

    ws.lastActivityAt = Date.now();
    return ws;
  }

  /**
   * Switches the active role inside an existing demo session.
   */
  switchRole(tokenOrId: string, targetRole: string): DemoSessionUser | null {
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

    return ws.user;
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
