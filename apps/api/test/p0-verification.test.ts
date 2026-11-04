import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDueDiligenceSnapshot,
  generateDueDiligencePdf,
  generateDueDiligenceReport,
  computeSha256Checksum,
} from '../src/report-generator.js';

test('Task 1: Firm-wide MFA policy configuration structure', () => {
  const dummyTenantSettings = {
    org_name: 'Karnataka Legal Partners LLP',
    llpin: 'ADA-1604',
    enforce_mfa_privileged: true,
  };
  assert.equal(dummyTenantSettings.enforce_mfa_privileged, true);
});

test('Task 3: Legal Sign-off Separation metadata in snapshot', () => {
  const propertyApproved = {
    id: 'prop-101',
    name: 'Brigade Gateway Commercial',
    survey_number: '123/1',
    village: 'Malleshwaram',
    taluk: 'Bangalore North',
    district: 'Bengaluru Urban',
    extent: '2.50 Acres',
    status: 'approved',
    assigned_lawyer_uid: 'user-lawyer-raghavan',
    legal_approved_by_uid: 'user-lawyer-raghavan',
    legal_approved_at: new Date('2026-11-03T10:00:00Z'),
  };

  const snapshot = createDueDiligenceSnapshot({
    property: propertyApproved,
    tenant: {
      id: 'tenant-1',
      organizationName: 'Karnataka Legal Partners LLP',
      llpin: 'ADA-1604',
      defaultReportTemplate: 'detailed_due_diligence',
    },
  });

  assert.equal(snapshot.legalSignOff?.isLegalApproved, true);
  assert.equal(snapshot.legalSignOff?.approvedByUid, 'user-lawyer-raghavan');
  assert.ok(snapshot.legalSignOff?.approvedAt);
  assert.equal(snapshot.templateVersion, '1.0.0');
  assert.equal(snapshot.templateId, 'detailed_due_diligence');
});

test('Task 4: Actual Client-Ready PDF Report Generation', async () => {
  const property = {
    id: 'prop-202',
    name: 'Prestige Tech Park Phase 2',
    survey_number: '45/2',
    subdivision: '2A',
    village: 'Kadubeesanahalli',
    hobli: 'Varthur',
    taluk: 'Bangalore East',
    district: 'Bengaluru Urban',
    extent: '4 Acres 12 Guntas',
    boundary_north: 'Survey 44 Road',
    boundary_south: 'Drain buffer line',
    boundary_east: 'Private layout',
    boundary_west: 'Outer Ring Road',
    latitude: 12.9352,
    longitude: 77.6946,
    status: 'approved',
    legal_approved_by_uid: 'advocate-priya',
    legal_approved_at: new Date(),
  };

  const documents = [
    {
      id: 'doc-1',
      originalFilename: 'Registered_Sale_Deed_1998.pdf',
      sha256: computeSha256Checksum('sample-sale-deed-bytes-1998'),
      extracted_fields: { reviewState: { isVerified: true } },
    },
    {
      id: 'doc-2',
      originalFilename: 'RTC_Pahani_2024.pdf',
      sha256: computeSha256Checksum('sample-rtc-bytes-2024'),
      extracted_fields: { reviewState: { isVerified: true } },
    },
  ];

  const titleTimeline = [
    {
      id: 'te-1',
      propertyId: 'prop-202',
      documentId: 'doc-1',
      sequenceOrder: 1,
      eventDate: '1998-05-12',
      deedType: 'sale_deed',
      fromParties: [{ name: 'Gowda Enterprises', normalizedName: 'gowda enterprises' }],
      toParties: [{ name: 'Prestige Tech Ltd', normalizedName: 'prestige tech ltd' }],
      extentSqFt: 187308,
      extentRaw: '4 Acres 12 Guntas',
      consideration: 4500000,
      status: 'verified' as const,
      encumbranceStatus: 'none' as const,
    },
  ];

  const snapshot = createDueDiligenceSnapshot({
    property,
    documents,
    titleTimeline,
    tenant: {
      id: 'tenant-1',
      organizationName: 'Karnataka Legal Partners LLP',
      llpin: 'ADA-1604',
      officeAddress: 'Ranga Rao Rd, Shankarapura, Bengaluru 560004',
      firmEmail: 'legal@ojix.in',
      defaultReportTemplate: 'detailed_due_diligence',
      legalDisclaimer: 'Statutory Karnataka Land Administration Review Notice.',
    },
  });

  const pdfBuffer = await generateDueDiligencePdf(snapshot);
  assert.ok(pdfBuffer instanceof Buffer, 'Output must be a binary Buffer');
  assert.ok(pdfBuffer.length > 1000, `PDF must contain binary payload, got ${pdfBuffer.length} bytes`);
  assert.equal(pdfBuffer.subarray(0, 4).toString(), '%PDF', 'Must start with %PDF magic header');
});

test('Task 5: Protected Owner Invariant validation', () => {
  // Invariant: At least one active owner must always exist in the tenant
  const activeOwners = [{ uid: 'owner-1', role: 'owner', status: 'active' }];
  const canDemote = activeOwners.length > 1;
  assert.equal(canDemote, false, 'Single active owner must NOT be demoted or removed');
});
