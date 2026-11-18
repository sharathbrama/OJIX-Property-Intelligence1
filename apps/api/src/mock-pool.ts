/**
 * OJIX Property Intelligence — Mock Database Pool
 * 
 * Drop-in replacement for the MySQL pool that uses MockDataStore.
 * Returns the same { rows, rowCount } shape that server.ts expects.
 * This lets ALL existing routes work without modification.
 */

import crypto from 'node:crypto';
import { getMockStore, DEFAULT_ORG_ID, hashPasswordSync } from './mock-data-store.js';

interface DbResult {
  rows: any[];
  rowCount: number;
}

function uuid(): string { return crypto.randomUUID(); }
function now(): string { return new Date().toISOString().replace('T', ' ').replace('Z', ''); }

/**
 * Parse a SQL query and return mock results.
 * This handles the specific queries used in server.ts.
 */
function handleQuery(sql: string, params: any[] = []): DbResult {
  const store = getMockStore();
  const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

  // ─── Health check ──────────────────────────────────────────────────────
  if (normalizedSql.includes('select 1')) {
    return { rows: [{ '1': 1 }], rowCount: 1 };
  }

  // ─── Spatial probe ─────────────────────────────────────────────────────
  if (normalizedSql.includes('st_astext') && normalizedSql.includes('st_geomfromtext')) {
    return { rows: [{ spatial_probe: 'POINT(77.5946 12.9716)' }], rowCount: 1 };
  }

  // ─── Password overrides ────────────────────────────────────────────────
  if (normalizedSql.includes('account_password_overrides') && normalizedSql.includes('select')) {
    if (normalizedSql.includes('where user_uid in')) {
      const rows = params.map(uid => store.findPasswordOverride(uid)).filter(Boolean).map(o => ({
        user_uid: o!.user_uid,
        password_hash: o!.password_hash,
      }));
      return { rows, rowCount: rows.length };
    }
    if (normalizedSql.includes('where user_uid=')) {
      const override = store.findPasswordOverride(params[0]);
      return override ? { rows: [{ password_hash: override.password_hash }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
  }

  if (normalizedSql.includes('account_password_overrides') && normalizedSql.includes('insert')) {
    const uid = params[0];
    const hash = params[1];
    store.updatePasswordOverride(uid, hash, params[params.length - 1] || uid);
    return { rows: [], rowCount: 1 };
  }

  // ─── User accounts ────────────────────────────────────────────────────
  if (normalizedSql.includes('from user_accounts') && normalizedSql.includes('where email=')) {
    const user = store.findUser(params[0]);
    if (user) return { rows: [user], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }

  if (normalizedSql.includes('from user_accounts') && normalizedSql.includes('where id=')) {
    const user = store.findUserById(params[0]);
    if (user) return { rows: [user], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }

  if (normalizedSql.includes('insert into user_accounts')) {
    return { rows: [], rowCount: 1 };
  }

  if (normalizedSql.includes('update user_accounts')) {
    if (normalizedSql.includes('password_hash')) {
      store.updateUserPassword(params[params.length - 1], params[0]);
    }
    if (normalizedSql.includes('email_verified')) {
      const user = store.findUserById(params[params.length - 1]) || store.findUser(params[params.length - 1]);
      if (user) { user.email_verified = true; user.status = 'active'; }
    }
    return { rows: [], rowCount: 1 };
  }

  // ─── Org memberships ──────────────────────────────────────────────────
  if (normalizedSql.includes('from org_memberships') && normalizedSql.includes('where user_uid=')) {
    if (normalizedSql.includes('and organization_id=')) {
      const membership = store.findMembership(params[0], params[1]);
      return membership ? { rows: [membership], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    // The workspaces query joins organizations
    if (normalizedSql.includes('join organizations')) {
      const memberships = store.findMembershipsByUser(params[0]);
      const rows = memberships.map(m => {
        const org = store.organizations.find(o => o.id === m.organization_id);
        return { id: m.organization_id, organization_id: m.organization_id, name: org?.name || 'Demo Workspace', slug: org?.slug || 'demo', role: m.role, status: m.status, email: m.email };
      });
      return { rows, rowCount: rows.length };
    }
    // Count query
    if (normalizedSql.includes('count(*)')) {
      const count = store.findMembershipsByUser(params[0]).length;
      return { rows: [{ total: count }], rowCount: 1 };
    }
    const membership = store.findMembership(params[0]);
    return membership ? { rows: [{ ...membership, slug: 'ojix-demo' }], rowCount: 1 } : { rows: [], rowCount: 0 };
  }

  if (normalizedSql.includes('insert into org_memberships')) {
    return { rows: [], rowCount: 1 };
  }

  // ─── Organizations ────────────────────────────────────────────────────
  if (normalizedSql.includes('from organizations')) {
    return { rows: store.organizations, rowCount: store.organizations.length };
  }

  if (normalizedSql.includes('insert into organizations')) {
    const orgId = params[0] || uuid();
    store.organizations.push({ id: orgId, name: params[1] || 'New Workspace', slug: params[2] || 'new-workspace', status: 'active', created_at: now() });
    return { rows: [], rowCount: 1 };
  }

  // ─── OTP challenges ───────────────────────────────────────────────────
  if (normalizedSql.includes('from otp_challenges') && normalizedSql.includes('select')) {
    if (normalizedSql.includes('count(*)')) {
      const uid = params[0];
      const { count, lastAt } = store.countRecentOtpRequests(uid, 'login', 15);
      return { rows: [{ request_count: count, last_requested_at: lastAt ? new Date(lastAt).toISOString() : null }], rowCount: 1 };
    }
    if (normalizedSql.includes('where id=')) {
      const purpose = normalizedSql.includes("purpose='login'") ? 'login' : normalizedSql.includes("purpose='registration'") ? 'registration' : normalizedSql.includes("purpose='password_reset'") ? 'password_reset' : 'login';
      const challenge = store.findOtpChallenge(params[0], params[1], purpose);
      return challenge ? { rows: [challenge], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
  }

  if (normalizedSql.includes('insert into otp_challenges')) {
    store.createOtpChallenge({
      id: params[0], email: params[1], account_uid: params[2],
      purpose: params[3] || 'login', otp_hash: params[4] || params[3], otp_salt: params[5] || params[4],
      expires_at: params[6] ? new Date(params[6]).toISOString() : new Date(Date.now() + 600000).toISOString(),
    });
    return { rows: [], rowCount: 1 };
  }

  if (normalizedSql.includes('update otp_challenges')) {
    if (normalizedSql.includes('consumed_at') && normalizedSql.includes('where id=')) {
      store.consumeOtpChallenge(params[params.length - 1] || params[0]);
      return { rows: [], rowCount: 1 };
    }
    if (normalizedSql.includes('consumed_at') && normalizedSql.includes('where account_uid=')) {
      store.invalidatePriorChallenges(params[0], 'login');
      return { rows: [], rowCount: 1 };
    }
    if (normalizedSql.includes('attempts=attempts+1')) {
      const challenge = store.otpChallenges.find(c => c.id === params[0]);
      if (challenge) challenge.attempts++;
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  }

  // ─── Authentication sessions ──────────────────────────────────────────
  if (normalizedSql.includes('from authentication_sessions') && normalizedSql.includes('select')) {
    if (normalizedSql.includes('token_hash=')) {
      const hash = params[0];
      const session = store.findSessionByHash(hash);
      if (session) {
        const membership = store.findMembership(session.user_uid, session.tenant_id);
        return { rows: [{ ...session, email: membership?.email || '', role: membership?.role || 'viewer', full_name: '', slug: 'ojix-demo' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (normalizedSql.includes('where id=')) {
      const session = store.sessions.find(s => s.id === params[0] && !s.revoked_at);
      return session ? { rows: [session], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    // Admin session listing
    if (normalizedSql.includes('tenant_id=') && !normalizedSql.includes('where id=')) {
      const tenantId = params[0];
      const sessions = store.sessions.filter(s => s.tenant_id === tenantId);
      return { rows: sessions, rowCount: sessions.length };
    }
  }

  if (normalizedSql.includes('insert into authentication_sessions')) {
    store.createSession({
      id: params[0], tenant_id: params[1], user_uid: params[2],
      token_hash: params[3], created_at: now(), last_activity_at: now(),
      expires_at: params[4] instanceof Date ? params[4].toISOString() : String(params[4]),
      revoked_at: null, revoked_by_uid: null, revoke_reason: null,
      ip_address: params[5] || null, user_agent: params[6] || null,
    });
    return { rows: [], rowCount: 1 };
  }

  if (normalizedSql.includes('update authentication_sessions')) {
    if (normalizedSql.includes('revoked_at') && normalizedSql.includes('where id=')) {
      const idParam = params.find((_: any, i: number) => normalizedSql.indexOf('?') !== -1) || params[params.length - 1];
      store.revokeSession(params[2] || params[params.length - 1], params[0], params[1] || 'revoked');
      return { rows: [], rowCount: 1 };
    }
    if (normalizedSql.includes('last_activity_at')) {
      return { rows: [], rowCount: 1 };
    }
    if (normalizedSql.includes('revoked_at') && normalizedSql.includes('where user_uid=')) {
      store.revokeUserSessions(params[2] || params[0], params[3] || '', params[0], params[1] || 'Password changed');
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  }

  // ─── Audit events ─────────────────────────────────────────────────────
  if (normalizedSql.includes('insert into audit_events')) {
    store.addAuditEvent({
      tenant_id: params[1] || DEFAULT_ORG_ID, actor_uid: params[0] || 'system',
      action: params[2] || 'unknown', entity_type: params[3] || 'unknown',
      entity_id: params[4] || null, details: params[5] || null,
    });
    return { rows: [], rowCount: 1 };
  }

  if (normalizedSql.includes('from audit_events') && normalizedSql.includes('select')) {
    if (normalizedSql.includes('count(*)')) {
      return { rows: [{ total: store.auditEvents.length }], rowCount: 1 };
    }
    const tenantId = params[0] || DEFAULT_ORG_ID;
    const events = store.auditEvents.filter(e => e.tenant_id === tenantId).slice(0, 200);
    return { rows: events, rowCount: events.length };
  }

  // ─── Properties ───────────────────────────────────────────────────────
  if (normalizedSql.includes('from properties') && normalizedSql.includes('select')) {
    if (normalizedSql.includes('group by status')) {
      const tenantId = params[0] || DEFAULT_ORG_ID;
      const props = store.findProperties(tenantId);
      const counts: Record<string, number> = {};
      props.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
      const rows = Object.entries(counts).map(([label, value]) => ({ label, value }));
      if (!rows.length) rows.push({ label: 'in_review', value: 1 });
      return { rows, rowCount: rows.length };
    }
    if (normalizedSql.includes('month') && normalizedSql.includes('group by')) {
      return {
        rows: [
          { month: '2026-09', created: 2, completed: 1 },
          { month: '2026-10', created: 3, completed: 2 },
          { month: '2026-11', created: 4, completed: 2 },
        ],
        rowCount: 3
      };
    }
    if (normalizedSql.includes('where id=') && normalizedSql.includes('tenant_id=')) {
      const prop = store.findPropertyById(params[0], params[1]);
      if (prop) {
        const docs = store.findDocumentsByProperty(prop.id, prop.tenant_id);
        return { rows: [{ ...prop, document_count: docs.length }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (normalizedSql.includes('count(*)')) {
      const count = store.findProperties(params[0] || DEFAULT_ORG_ID).length;
      return { rows: [{ total: count, active: count, overdue: 0, missing_documents: 0 }], rowCount: 1 };
    }
    if (normalizedSql.includes('archived_at is not null')) {
      return { rows: [{ archived_count: 0 }], rowCount: 1 };
    }
    // List properties
    const tenantId = params[0] || DEFAULT_ORG_ID;
    const props = store.findProperties(tenantId);
    const withDocCount = props.map(p => ({
      ...p,
      document_count: store.findDocumentsByProperty(p.id, tenantId).length,
    }));
    return { rows: withDocCount, rowCount: withDocCount.length };
  }

  if (normalizedSql.includes('insert into properties')) {
    const id = params[0] || uuid();
    const tenantId = params[1] || DEFAULT_ORG_ID;
    const appNum = params[2] || `OJ-2026-BLR-${Math.floor(100 + Math.random() * 900)}`;
    const name = params[3] || 'Demo Property';
    store.createProperty({
      id,
      tenant_id: tenantId,
      application_number: appNum,
      name,
      review_purpose: params[4] || 'purchase_due_diligence',
      primary_document_type: params[6] || 'sale_deed',
      property_identifier: params[8] || 'DEMO-IDENTIFIER',
      property_identifier_type: params[9] || 'survey_number',
      property_type: params[10] || 'non_agricultural',
      village: params[11] || 'Whitefield',
      hobli: params[12] || 'Varthur',
      taluk: params[13] || 'Bengaluru East',
      district: params[14] || 'Bengaluru Urban',
      district_id: null, taluk_id: null, hobli_id: null, village_id: null,
      survey_number: params[19] || '45',
      subdivision: params[20] || '1',
      extent: params[21] || '2400 sq ft',
      extent_value: params[22] || 2400,
      extent_unit: params[23] || 'sq_ft',
      boundary_north: params[24] || 'Road',
      boundary_south: params[25] || 'Plot',
      boundary_east: params[26] || 'Plot',
      boundary_west: params[27] || 'Plot',
      address: params[28] || 'Bengaluru',
      latitude: params[29] || 12.9716,
      longitude: params[30] || 77.5946,
      coordinate_source: 'manual',
      coordinate_confidence: 0.9,
      coordinate_captured_at: now(),
      identity_state: 'verified',
      notes: params[34] || '',
      status: 'in_review',
      workflow_priority: 'normal',
      due_date: null,
      assigned_lawyer_uid: 'user-lawyer',
      assigned_analyst_uid: 'user-analyst',
      assigned_operations_uid: 'user-operations',
      assigned_consultant_uid: 'user-consultant',
      assigned_viewer_uid: 'user-viewer',
      archived_at: null,
      created_at: now(),
      updated_at: now(),
    });
    return { rows: [], rowCount: 1 };
  }

  if (normalizedSql.includes('update properties')) {
    const targetId = params[params.length - 2] || params[params.length - 1];
    if (normalizedSql.includes('archived_at')) {
      store.updateProperty(targetId, {
        archived_at: params[0] ? now() : null,
        status: params[0] ? 'archived' : 'in_review',
      });
    } else if (normalizedSql.includes('status=')) {
      store.updateProperty(targetId, { status: params[0] });
    }
    return { rows: [], rowCount: 1 };
  }

  if (normalizedSql.includes('delete from properties')) {
    store.deleteProperty(params[0]);
    return { rows: [], rowCount: 1 };
  }

  // ─── Documents ────────────────────────────────────────────────────────
  if (normalizedSql.includes('from documents') && normalizedSql.includes('select')) {
    if (normalizedSql.includes('where id=')) {
      const doc = store.documents.find(d => d.id === params[0]);
      return doc ? { rows: [doc], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (normalizedSql.includes('property_id=')) {
      const docs = store.findDocumentsByProperty(params[0], params[1] || DEFAULT_ORG_ID);
      return { rows: docs, rowCount: docs.length };
    }
    if (normalizedSql.includes('count(*)')) {
      const docs = store.documents.filter(d => d.tenant_id === (params[0] || DEFAULT_ORG_ID));
      return { rows: [{ total: docs.length, document_count: docs.length, size_bytes: docs.reduce((s, d) => s + d.size_bytes, 0), quarantined_count: 0, manual_review: 1, processing: 0 }], rowCount: 1 };
    }
    // All documents for tenant joined with properties
    const docs = store.documents.filter(d => d.tenant_id === (params[0] || DEFAULT_ORG_ID));
    const withPropertyInfo = docs.map(d => {
      const prop = store.properties.find(p => p.id === d.property_id);
      return {
        ...d,
        property_name: prop?.name || 'Whitefield Residential Site',
        application_number: prop?.application_number || 'OJ-2026-BLR-001',
        survey_number: prop?.survey_number || '45',
        village: prop?.village || 'Whitefield',
        district: prop?.district || 'Bengaluru Urban',
      };
    });
    return { rows: withPropertyInfo, rowCount: withPropertyInfo.length };
  }

  if (normalizedSql.includes('insert into documents')) {
    const docId = params[0] || uuid();
    const tenantId = params[1] || DEFAULT_ORG_ID;
    const propertyId = params[2] || '';
    store.createDocument({
      id: docId,
      property_id: propertyId,
      tenant_id: tenantId,
      doc_type: params[3] || 'sale_deed',
      doc_type_custom: params[4] || null,
      classification_confidence: params[5] || 0.95,
      classification_source: params[6] || 'automatic',
      manual_review_status: params[7] || 'pending',
      original_filename: params[8] || 'document.pdf',
      storage_key: params[9] || `local://${propertyId}/${docId}/doc.pdf`,
      mime_type: params[10] || 'application/pdf',
      size_bytes: params[11] || 1024,
      sha256: params[12] || crypto.createHash('sha256').update(docId).digest('hex'),
      processing_status: params[13] || 'completed',
      extracted_fields: typeof params[15] === 'string' ? JSON.parse(params[15]) : (params[15] || {}),
      governance_status: 'active',
      created_at: now(),
      updated_at: now(),
    });
    return { rows: [], rowCount: 1 };
  }

  if (normalizedSql.includes('update documents')) {
    const docId = params[params.length - 2] || params[params.length - 1];
    store.updateDocument(docId, { manual_review_status: 'verified', processing_status: 'completed' });
    return { rows: [], rowCount: 1 };
  }

  if (normalizedSql.includes('delete from documents')) {
    store.deleteDocument(params[0]);
    return { rows: [], rowCount: 1 };
  }

  // ─── Risk findings ────────────────────────────────────────────────────
  if (normalizedSql.includes('from risk_findings') && normalizedSql.includes('select')) {
    if (normalizedSql.includes('group by') && (normalizedSql.includes('severity') || normalizedSql.includes('f.severity'))) {
      const tenantId = params[0] || DEFAULT_ORG_ID;
      const findings = store.findings.filter(f => f.tenant_id === tenantId);
      const counts: Record<string, number> = {};
      findings.forEach(f => { counts[f.severity] = (counts[f.severity] || 0) + 1; });
      const rows = Object.entries(counts).map(([label, value]) => ({ label, value }));
      if (!rows.length) rows.push({ label: 'medium', value: 1 });
      return { rows, rowCount: rows.length };
    }
    if (normalizedSql.includes('count(*)')) {
      const count = store.findings.length;
      return { rows: [{ total: count, critical: 1, high: 2 }], rowCount: 1 };
    }
    if (normalizedSql.includes('property_id=')) {
      const findings = store.findFindingsByProperty(params[0], params[1] || DEFAULT_ORG_ID);
      return { rows: findings, rowCount: findings.length };
    }
    // All findings for tenant joined with properties
    const findings = store.findings.filter(f => f.tenant_id === (params[0] || DEFAULT_ORG_ID));
    const withPropertyInfo = findings.map(f => {
      const prop = store.properties.find(p => p.id === f.property_id);
      return {
        ...f,
        property_name: prop?.name || 'Whitefield Residential Site',
        application_number: prop?.application_number || 'OJ-2026-BLR-001',
        survey_number: prop?.survey_number || '45',
        village: prop?.village || 'Whitefield',
        district: prop?.district || 'Bengaluru Urban',
      };
    });
    return { rows: withPropertyInfo, rowCount: withPropertyInfo.length };
  }

  if (normalizedSql.includes('insert into risk_findings')) {
    store.createFinding({
      id: params[0] || uuid(),
      property_id: params[1] || '',
      tenant_id: params[2] || DEFAULT_ORG_ID,
      code: params[3] || 'FINDING-001',
      title: params[4] || 'Review Finding',
      severity: params[5] || 'medium',
      points: params[6] || 10,
      explanation: params[7] || 'Finding rationale',
      evidence_status: 'pending_review',
      next_action: '',
      created_at: now(),
    });
    return { rows: [], rowCount: 1 };
  }

  // ─── Karnataka locations ──────────────────────────────────────────────
  if (normalizedSql.includes('from karnataka_districts')) {
    return { rows: store.districts, rowCount: store.districts.length };
  }

  if (normalizedSql.includes('from karnataka_taluks')) {
    if (normalizedSql.includes('district_id=')) {
      const taluks = store.taluks.filter(t => t.district_id === params[0]);
      return { rows: taluks, rowCount: taluks.length };
    }
    return { rows: store.taluks, rowCount: store.taluks.length };
  }

  if (normalizedSql.includes('from karnataka_hoblis')) {
    if (normalizedSql.includes('taluk_id=')) {
      const hoblis = store.hoblis.filter(h => h.taluk_id === params[0]);
      return { rows: hoblis, rowCount: hoblis.length };
    }
    return { rows: store.hoblis, rowCount: store.hoblis.length };
  }

  if (normalizedSql.includes('from karnataka_villages')) {
    if (normalizedSql.includes('hobli_id=')) {
      const villages = store.villages.filter(v => v.hobli_id === params[0]);
      return { rows: villages, rowCount: villages.length };
    }
    return { rows: store.villages, rowCount: store.villages.length };
  }

  if (normalizedSql.includes('from karnataka_location_imports')) {
    return { rows: [{ source_name: 'Karnataka Kaveri', source_date: '2026-01-15', imported_at: '2026-01-15', completeness: 'districts,taluks,hoblis,villages', notes: 'Demo seed data' }], rowCount: 1 };
  }

  // ─── Workspace settings ───────────────────────────────────────────────
  if (normalizedSql.includes('from workspace_settings')) {
    return store.workspaceSettings ? { rows: [store.workspaceSettings], rowCount: 1 } : { rows: [], rowCount: 0 };
  }

  if (normalizedSql.includes('insert into workspace_settings') || normalizedSql.includes('update workspace_settings')) {
    return { rows: [], rowCount: 1 };
  }

  // ─── Permission overrides ─────────────────────────────────────────────
  if (normalizedSql.includes('from workspace_permission_overrides')) {
    return { rows: store.permissionOverrides, rowCount: store.permissionOverrides.length };
  }

  // ─── Retention policies ───────────────────────────────────────────────
  if (normalizedSql.includes('from workspace_retention_policies')) {
    return { rows: store.retentionPolicies.length ? store.retentionPolicies : [{ tenant_id: DEFAULT_ORG_ID, retention_days: 2555, archive_after_days: 365, legal_hold: false, automatic_cleanup_enabled: false }], rowCount: 1 };
  }

  if (normalizedSql.includes('insert into workspace_retention_policies') || normalizedSql.includes('update workspace_retention_policies')) {
    return { rows: [], rowCount: 1 };
  }

  // ─── Title events ─────────────────────────────────────────────────────
  if (normalizedSql.includes('from title_events')) {
    if (normalizedSql.includes('where property_id=')) {
      const propId = params[0];
      const tenantId = params[1] || DEFAULT_ORG_ID;
      const events = store.findTitleEventsByProperty(propId, tenantId);
      return { rows: events, rowCount: events.length };
    }
    return { rows: store.titleEvents, rowCount: store.titleEvents.length };
  }

  // ─── Title reviews ────────────────────────────────────────────────────
  if (normalizedSql.includes('from title_reviews')) {
    if (normalizedSql.includes('count(*)')) {
      return { rows: [{ total: 1, pending: 1 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // ─── Workbench tasks ──────────────────────────────────────────────────
  if (normalizedSql.includes('from workbench_tasks')) {
    if (normalizedSql.includes('count(*)') || normalizedSql.includes('sum(')) {
      const count = store.tasks.length;
      return { rows: [{ total: count, my_count: count, pending: 2, in_progress: 1, under_review: 0, overdue: 0, completed: 3 }], rowCount: 1 };
    }
    const tenantId = params[0] || DEFAULT_ORG_ID;
    const tasks = store.tasks.filter(t => t.tenant_id === tenantId);
    const withPropertyInfo = tasks.map(t => {
      const prop = store.properties.find(p => p.id === t.property_id);
      return {
        ...t,
        property_name: prop?.name || 'Whitefield Residential Site',
        application_number: prop?.application_number || 'OJ-2026-BLR-001',
        village: prop?.village || 'Whitefield',
        survey_number: prop?.survey_number || '45',
        subdivision: prop?.subdivision || '3A',
        assignee_name: 'Sharath — Evidence Analyst',
        assigner_name: 'Sharath — Legal Reviewer',
      };
    });
    return { rows: withPropertyInfo, rowCount: withPropertyInfo.length };
  }

  // ─── Consultant Reports ───────────────────────────────────────────────
  if (normalizedSql.includes('from consultant_report_versions')) {
    if (normalizedSql.includes('count(*)')) {
      return { rows: [{ reports_awaiting_review: 1, current_version: 1 }], rowCount: 1 };
    }
    const tenantId = params[0] || DEFAULT_ORG_ID;
    const reports = store.reports.filter(r => r.tenant_id === tenantId);
    const withPropertyInfo = reports.map(r => {
      const prop = store.properties.find(p => p.id === r.property_id);
      return {
        ...r,
        property_name: prop?.name || 'Hebbal Commercial Plot',
        application_number: prop?.application_number || 'OJ-2026-BLR-003',
        reviewer_name: 'Sharath — Legal Reviewer',
      };
    });
    return { rows: withPropertyInfo, rowCount: withPropertyInfo.length };
  }

  // ─── Workspace invitations ────────────────────────────────────────────
  if (normalizedSql.includes('from workspace_invitations')) {
    return { rows: [], rowCount: 0 };
  }

  // ─── Workspace export events ──────────────────────────────────────────
  if (normalizedSql.includes('from workspace_export_events')) {
    return { rows: [], rowCount: 0 };
  }

  // ─── Workspace purge requests ─────────────────────────────────────────
  if (normalizedSql.includes('from workspace_purge_requests')) {
    return { rows: [], rowCount: 0 };
  }

  // ─── Property workflow history ────────────────────────────────────────
  if (normalizedSql.includes('from property_workflow_history')) {
    return { rows: [], rowCount: 0 };
  }

  // ─── Owner configuration versions ─────────────────────────────────────
  if (normalizedSql.includes('from owner_configuration_versions')) {
    return { rows: [], rowCount: 0 };
  }

  // ─── OCR and Document AI ──────────────────────────────────────────────
  if (normalizedSql.includes('from ocr_') || normalizedSql.includes('from document_ai_')) {
    return { rows: [], rowCount: 0 };
  }

  // ─── Document review/field history ────────────────────────────────────
  if (normalizedSql.includes('from document_review_history') || normalizedSql.includes('from document_field_history')) {
    return { rows: [], rowCount: 0 };
  }

  // ─── Generic INSERT/UPDATE/DELETE fallback ────────────────────────────
  if (normalizedSql.startsWith('insert') || normalizedSql.startsWith('update') || normalizedSql.startsWith('delete')) {
    return { rows: [], rowCount: 1 };
  }

  // ─── Fallback: return empty ────────────────────────────────────────────
  console.warn(`[mock-pool] Unhandled query: ${sql.slice(0, 120)}...`);
  return { rows: [], rowCount: 0 };
}

// ─── Mock Pool (same interface as the real pool in server.ts) ────────────────

export function createMockPool() {
  return {
    async query(sql: string, params: any[] = []): Promise<DbResult> {
      return handleQuery(sql, params);
    },

    async end() {
      // No-op for mock
    },

    async getConnection() {
      return {
        async beginTransaction() { /* no-op */ },
        async commit() { /* no-op */ },
        async rollback() { /* no-op */ },
        async query(sql: string, params: any[] = []): Promise<DbResult> {
          return handleQuery(sql, params);
        },
        release() { /* no-op */ },
      };
    },
  };
}
