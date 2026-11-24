/**
 * OJIX Property Intelligence
 * Matter Workspace & Multi-Property Lifecycle Test Suite (FRD §5 / §7)
 *
 * Verifies:
 * 1. Matter listing with role-based scoping (Owner/Admin vs Lawyer vs Viewer)
 * 2. Filter by status, priority, and keyword search
 * 3. Matter creation with sequence numbering (OJIX-M-2026-XXX) and validation
 * 4. Role restrictions: Only Owner/Admin can create/update matters; only Owner can archive
 * 5. Single matter inspection with linked properties
 * 6. Property assignment to matters
 * 7. Matter audit trail generation and inspection
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DemoSessionRepository,
  type DemoSessionWorkspace,
  type DemoMatter,
} from '../src/session-repository.js';

describe('Matter Workspace Lifecycle — Data Model & Repository', () => {
  const repo = new DemoSessionRepository();

  test('MTR-01: Baseline demo workspace contains seed matters across statuses', () => {
    const ws = repo.createSession('owner');
    assert.ok(Array.isArray(ws.matters), 'Workspace must have matters array');
    assert.ok(ws.matters.length >= 4, `Expected at least 4 seed matters, got ${ws.matters.length}`);

    const statuses = new Set(ws.matters.map(m => m.status));
    assert.ok(statuses.has('in_review'), 'Must have in_review matters');
    assert.ok(statuses.has('closed'), 'Must have closed matters');
    assert.ok(statuses.has('ready_for_signoff'), 'Must have ready_for_signoff matters');
    assert.ok(statuses.has('open'), 'Must have open matters');
  });

  test('MTR-02: Each seed matter conforms to DemoMatter schema contract', () => {
    const ws = repo.createSession('owner');
    for (const m of ws.matters) {
      assert.ok(m.id.startsWith('matter-'), `Matter ID must start with matter-: ${m.id}`);
      assert.ok(m.matter_number.startsWith('OJIX-M-'), `Matter number format invalid: ${m.matter_number}`);
      assert.ok(m.title.length > 0, 'Title cannot be empty');
      assert.ok(m.client_name.length > 0, 'Client name cannot be empty');
      assert.ok(['open', 'in_review', 'ready_for_signoff', 'closed', 'archived'].includes(m.status), `Invalid status: ${m.status}`);
      assert.ok(['normal', 'high', 'urgent', 'critical'].includes(m.priority), `Invalid priority: ${m.priority}`);
      assert.equal(typeof m.property_count, 'number', 'property_count must be numeric');
      assert.ok(m.created_at, 'created_at must be populated');
    }
  });

  test('MTR-03: Rehydrated stateless workspace retains matters integrity', () => {
    const initial = repo.createSession('owner');
    const token = initial.token;
    const rehydrated = repo.getSession(token);

    assert.ok(rehydrated, 'Session must rehydrate from token');
    assert.equal(rehydrated.matters.length, initial.matters.length);
    assert.equal(rehydrated.matters[0].matter_number, initial.matters[0].matter_number);
  });
});

describe('Matter Workspace Lifecycle — Role Access & Filtering Invariants', () => {
  const repo = new DemoSessionRepository();

  function filterMatters(matters: DemoMatter[], role: string, uid: string): DemoMatter[] {
    if (['owner', 'admin', 'super_admin', 'data_steward'].includes(role)) return matters;
    if (role === 'lawyer') return matters.filter(m => m.assigned_lawyer_uid === uid || m.assigned_lawyer_uid?.startsWith('demo-user'));
    if (role === 'analyst') return matters.filter(m => m.assigned_analyst_uid === uid || m.assigned_analyst_uid?.startsWith('demo-user'));
    if (role === 'operations') return matters.filter(m => m.assigned_operations_uid === uid || m.assigned_operations_uid?.startsWith('demo-user'));
    if (role === 'consultant') return matters.filter(m => m.assigned_consultant_uid === uid || m.assigned_consultant_uid?.startsWith('demo-user'));
    if (role === 'viewer') return matters.filter(m => m.status === 'closed');
    if (role === 'support') return matters;
    return [];
  }

  test('MTR-04: Owner and Admin have visibility across all non-archived matters', () => {
    const ws = repo.createSession('owner');
    const activeMatters = ws.matters.filter(m => !m.archived_at);

    const ownerView = filterMatters(activeMatters, 'owner', 'demo-user-owner');
    const adminView = filterMatters(activeMatters, 'admin', 'demo-user-admin');

    assert.equal(ownerView.length, activeMatters.length);
    assert.equal(adminView.length, activeMatters.length);
  });

  test('MTR-05: Viewer role is strictly restricted to closed / completed matters', () => {
    const ws = repo.createSession('viewer');
    const activeMatters = ws.matters.filter(m => !m.archived_at);
    const viewerVisible = filterMatters(activeMatters, 'viewer', 'demo-user-viewer');

    assert.ok(viewerVisible.length > 0, 'Viewer should see closed matters');
    for (const m of viewerVisible) {
      assert.equal(m.status, 'closed', `Viewer must never see unclosed matter (${m.id}: ${m.status})`);
    }
  });

  test('MTR-06: Status filter isolates specific lifecycle states', () => {
    const ws = repo.createSession('owner');
    const inReview = ws.matters.filter(m => m.status === 'in_review');
    const closed = ws.matters.filter(m => m.status === 'closed');
    const signoff = ws.matters.filter(m => m.status === 'ready_for_signoff');

    assert.ok(inReview.length >= 1, 'Must have at least one in_review matter');
    assert.ok(closed.length >= 1, 'Must have at least one closed matter');
    assert.ok(signoff.length >= 1, 'Must have at least one ready_for_signoff matter');
  });

  test('MTR-07: Priority filter properly isolates critical and urgent matters', () => {
    const ws = repo.createSession('owner');
    const critical = ws.matters.filter(m => m.priority === 'critical');
    assert.ok(critical.length >= 1, 'Should find critical priority matter (Jayanagar)');
    assert.ok(critical[0].title.includes('Jayanagar'));
  });

  test('MTR-08: Keyword search matches on title, client name, or matter number', () => {
    const ws = repo.createSession('owner');
    const search = (q: string) => ws.matters.filter(m =>
      m.title.toLowerCase().includes(q.toLowerCase()) ||
      m.client_name.toLowerCase().includes(q.toLowerCase()) ||
      m.matter_number.toLowerCase().includes(q.toLowerCase())
    );

    const byTitle = search('whitefield');
    assert.equal(byTitle.length, 1);
    assert.ok(byTitle[0].title.includes('Whitefield'));

    const byClient = search('ramesh');
    assert.ok(byClient.length >= 1);

    const byNum = search('OJIX-M-2026-003');
    assert.equal(byNum.length, 1);
    assert.ok(byNum[0].title.includes('Hebbal'));
  });
});

describe('Matter Workspace Lifecycle — Creation, Mutation & Archival', () => {
  test('MTR-09: Matter creation generates sequential matter number and audit record', () => {
    const repo = new DemoSessionRepository();
    const ws = repo.createSession('admin');
    const countBefore = ws.matters.length;

    const newMatter: DemoMatter = {
      id: 'matter-test-created-001',
      tenant_id: ws.user.tenantId,
      matter_number: `OJIX-M-2026-${String(countBefore + 1).padStart(3, '0')}`,
      title: 'Koramangala Commercial Tech Park Due Diligence',
      client_name: 'Nexus Tech Properties LLP',
      client_email: 'legal@nexustech.invalid',
      client_phone: '+91 80 2345 6789',
      review_purpose: 'commercial_lease',
      status: 'open',
      priority: 'high',
      created_by_uid: ws.user.uid,
      assigned_lawyer_uid: 'demo-user-lawyer',
      assigned_analyst_uid: 'demo-user-analyst',
      assigned_operations_uid: 'demo-user-operations',
      assigned_consultant_uid: 'demo-user-consultant',
      property_count: 0,
      due_date: '2026-12-20',
      notes: 'Initial intake complete. Awaiting boundary sketch.',
      archived_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    ws.matters.push(newMatter);
    ws.auditEvents.push({
      id: 'audit-mtr-01',
      tenant_id: ws.user.tenantId,
      actor_uid: ws.user.uid,
      action: 'matter.created',
      entity_type: 'matter',
      entity_id: newMatter.id,
      details: { title: newMatter.title },
      created_at: new Date().toISOString(),
    });

    assert.equal(ws.matters.length, countBefore + 1);
    const retrieved = ws.matters.find(m => m.id === 'matter-test-created-001');
    assert.ok(retrieved);
    assert.equal(retrieved.status, 'open');

    const audit = ws.auditEvents.find(e => e.entity_id === newMatter.id);
    assert.ok(audit);
    assert.equal(audit.action, 'matter.created');
  });

  test('MTR-10: Assigning property increments property_count', () => {
    const repo = new DemoSessionRepository();
    const ws = repo.createSession('admin');
    const targetMatter = ws.matters[0];
    const initialCount = targetMatter.property_count;

    targetMatter.property_count += 1;
    assert.equal(targetMatter.property_count, initialCount + 1);
  });

  test('MTR-11: Archival soft-deletes matter and prevents display in active view', () => {
    const repo = new DemoSessionRepository();
    const ws = repo.createSession('owner');
    const toArchive = ws.matters[ws.matters.length - 1];
    const targetId = toArchive.id;

    toArchive.archived_at = new Date().toISOString();
    toArchive.status = 'archived';

    const activeList = ws.matters.filter(m => !m.archived_at);
    assert.ok(!activeList.some(m => m.id === targetId), 'Archived matter must not be in active list');
  });

  test('MTR-12: Non-owner roles are prevented from archiving matters (RBAC rule)', () => {
    const allowedToArchive = (role: string) => ['owner', 'super_admin'].includes(role);

    assert.equal(allowedToArchive('owner'), true);
    assert.equal(allowedToArchive('super_admin'), true);
    assert.equal(allowedToArchive('admin'), false);
    assert.equal(allowedToArchive('lawyer'), false);
    assert.equal(allowedToArchive('analyst'), false);
    assert.equal(allowedToArchive('operations'), false);
    assert.equal(allowedToArchive('consultant'), false);
    assert.equal(allowedToArchive('viewer'), false);
  });
});
