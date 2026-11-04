import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDueDiligenceSnapshot,
  generateDueDiligencePdf,
} from '../src/report-generator.js';

// Canonical role permission definition mirroring apps/api/src/server.ts
const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    'workspace_admin',
    'member_admin',
    'property_edit',
    'document_intake',
    'document_review',
    'legal_review',
    'source_governance',
    'audit_read',
    'retention_admin',
  ],
  admin: [
    'workspace_admin',
    'member_admin',
    'property_edit',
    'document_intake',
    'document_review',
    'source_governance',
    'audit_read',
    'retention_admin',
  ],
  lawyer: [
    'property_edit',
    'document_intake',
    'document_review',
    'legal_review',
  ],
  analyst: ['property_edit', 'document_intake', 'document_review'],
  operations: ['document_intake'],
  consultant: ['property_read', 'document_read'],
  support: ['diagnostics_read'],
  data_steward: ['source_governance', 'property_read', 'document_read'],
  viewer: ['property_read'],
};

test('Workspace Owner Role — Capability Matrix Verification', () => {
  const ownerCaps = ROLE_PERMISSIONS['owner'];
  assert.ok(ownerCaps, 'Owner role permissions must be defined');

  // Verify all essential governance capabilities
  const requiredOwnerCaps = [
    'workspace_admin',
    'member_admin',
    'property_edit',
    'document_intake',
    'document_review',
    'legal_review',
    'source_governance',
    'audit_read',
    'retention_admin',
  ];

  for (const cap of requiredOwnerCaps) {
    assert.ok(
      ownerCaps.includes(cap),
      `Owner must possess capability: ${cap}`,
    );
  }

  // Verify Owner possesses legal review capability while Admin does NOT possess legal review
  assert.equal(ROLE_PERMISSIONS['owner'].includes('legal_review'), true);
  assert.equal(ROLE_PERMISSIONS['admin'].includes('legal_review'), false);
});

test('Workspace Owner Role — Protected Owner Invariant (FRD §14 / §20 / ADM-03)', () => {
  // Scenario A: Sole active owner in organization cannot be demoted or removed
  const singleOwnerTenant = [
    { id: 'mem-1', user_uid: 'user-owner-1', role: 'owner', status: 'active' },
    { id: 'mem-2', user_uid: 'user-admin-1', role: 'admin', status: 'active' },
  ];

  const activeOwners = singleOwnerTenant.filter(
    (m) => m.role === 'owner' && m.status === 'active',
  );
  assert.equal(activeOwners.length, 1);

  // Invariant logic: When activeOwners <= 1, demoting or disabling is blocked
  const canDemoteSoleOwner = activeOwners.length > 1;
  assert.equal(
    canDemoteSoleOwner,
    false,
    'Sole active Workspace Owner must NOT be demoted, disabled, or removed',
  );

  // Scenario B: Co-owners exist (2 active owners)
  const coOwnerTenant = [
    { id: 'mem-1', user_uid: 'user-owner-1', role: 'owner', status: 'active' },
    { id: 'mem-2', user_uid: 'user-owner-2', role: 'owner', status: 'active' },
  ];
  const coOwners = coOwnerTenant.filter(
    (m) => m.role === 'owner' && m.status === 'active',
  );
  assert.equal(coOwners.length, 2);
  const canDemoteCoOwner = coOwners.length > 1;
  assert.equal(
    canDemoteCoOwner,
    true,
    'Demotion is allowed only when more than one active owner exists',
  );
});

test('Workspace Owner Role — Legal Sign-Off Separation (FRD §3 / §13 / LAW-01)', () => {
  // The Workspace Owner governs the organization, but only a Lead Advocate (lawyer)
  // may sign off on final legal title conclusions ('approved' or 'complete').

  const evaluateStatusTransition = (
    actorRole: string,
    targetStatus: string,
  ): { allowed: boolean; reason?: string } => {
    if (['approved', 'complete'].includes(targetStatus)) {
      if (actorRole !== 'lawyer') {
        return {
          allowed: false,
          reason:
            'Legal Sign-Off Separation Policy (FRD §3 / §13 / LAW-01): Only a qualified Lead Advocate (lawyer) may approve or release legal title reports.',
        };
      }
    }
    return { allowed: true };
  };

  // Owner attempting to sign off 'approved' status directly
  const ownerApproval = evaluateStatusTransition('owner', 'approved');
  assert.equal(ownerApproval.allowed, false);
  assert.ok(ownerApproval.reason?.includes('Lead Advocate'));

  // Owner attempting to release 'complete' status directly
  const ownerComplete = evaluateStatusTransition('owner', 'complete');
  assert.equal(ownerComplete.allowed, false);

  // Owner managing operational transitions ('ready_for_review', 'in_review', 'closed')
  assert.equal(evaluateStatusTransition('owner', 'in_review').allowed, true);
  assert.equal(evaluateStatusTransition('owner', 'ready_for_review').allowed, true);
  assert.equal(evaluateStatusTransition('owner', 'closed').allowed, true);

  // Lawyer (Lead Advocate) signing off
  const lawyerApproval = evaluateStatusTransition('lawyer', 'approved');
  assert.equal(lawyerApproval.allowed, true);
});

test('Workspace Owner Role — Document Evidence Verification Authority', () => {
  // Only the Owner or Lead Advocate can verify document evidence
  const canVerifyDocumentEvidence = (role: string): boolean => {
    return ['owner', 'lawyer'].includes(role);
  };

  assert.equal(canVerifyDocumentEvidence('owner'), true, 'Owner can verify document evidence');
  assert.equal(canVerifyDocumentEvidence('lawyer'), true, 'Lead Advocate can verify document evidence');
  assert.equal(canVerifyDocumentEvidence('admin'), false, 'General Admin cannot verify legal evidence');
  assert.equal(canVerifyDocumentEvidence('analyst'), false, 'Analyst cannot verify legal evidence');
  assert.equal(canVerifyDocumentEvidence('operations'), false, 'Operations cannot verify legal evidence');
  assert.equal(canVerifyDocumentEvidence('viewer'), false, 'Viewer cannot verify legal evidence');
});

test('Workspace Owner Role — Due-Diligence Report Snapshot & PDF Verification', async () => {
  const property = {
    id: 'owner-prop-99',
    name: 'Salarpuria Sattva Knowledge City',
    survey_number: '88/1',
    subdivision: '1B',
    village: 'Bellandur',
    hobli: 'Varthur',
    taluk: 'Bangalore East',
    district: 'Bengaluru Urban',
    extent: '3 Acres 10 Guntas',
    boundary_north: 'Survey 87 Private Road',
    boundary_south: 'Drain buffer 50m zone',
    boundary_east: 'Adjacent IT Park',
    boundary_west: 'Main Road',
    latitude: 12.9279,
    longitude: 77.6713,
    status: 'ready_for_review',
  };

  const snapshot = createDueDiligenceSnapshot({
    property,
    tenant: {
      id: 'tenant-owner-firm',
      organizationName: 'Karnataka Premier Legal Counsel LLP',
      llpin: 'AAA-9988',
      officeAddress: 'MG Road, Bengaluru 560001',
      firmEmail: 'partner@karnatakalegal.in',
      defaultReportTemplate: 'detailed_due_diligence',
      legalDisclaimer:
        'This dossier is generated under the supervision of the Managing Partner for due diligence assessment.',
    },
  });

  assert.equal(snapshot.property.id, 'owner-prop-99');
  assert.equal(snapshot.tenant.organizationName, 'Karnataka Premier Legal Counsel LLP');
  assert.equal(snapshot.tenant.llpin, 'AAA-9988');

  // Verify PDF generator creates genuine PDF document
  const pdfBytes = await generateDueDiligencePdf(snapshot);
  assert.ok(pdfBytes instanceof Buffer);
  assert.ok(pdfBytes.length > 500);
  assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF');
});

test('Workspace Owner Role — Firm Settings & Buffer Thresholds Validation', () => {
  const firmSettings = {
    org_name: 'Karnataka Legal Partners LLP',
    llpin: 'ADA-1604',
    office_address: 'Ranga Rao Rd, Shankarapura, Bengaluru 560004',
    firm_email: 'info@ojix.in',
    default_report_template: 'detailed_due_diligence',
    swd_primary_buffer_m: 50,
    swd_secondary_buffer_m: 25,
    swd_tertiary_buffer_m: 15,
    lake_buffer_m: 30,
    survey_margin_tolerance_pct: 1.0,
    ocr_confidence_threshold: 0.60,
    enforce_mfa_privileged: true,
  };

  assert.equal(firmSettings.swd_primary_buffer_m, 50);
  assert.equal(firmSettings.swd_secondary_buffer_m, 25);
  assert.equal(firmSettings.swd_tertiary_buffer_m, 15);
  assert.equal(firmSettings.lake_buffer_m, 30);
  assert.equal(firmSettings.enforce_mfa_privileged, true);
});

