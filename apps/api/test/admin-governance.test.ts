import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool } from './mariadb-test-pool.js';

const base=process.env.TEST_API_URL||'http://127.0.0.1:4000';
const ownerHeaders={'x-user-uid':'user-owner','content-type':'application/json'};

after(async()=>{await pool.end();});

test('admin APIs require authentication and an administrator role',async()=>{
  const unauthenticated=await fetch(`${base}/api/admin/summary`);
  assert.equal(unauthenticated.status,401);
  const analyst=await fetch(`${base}/api/admin/summary`,{headers:{'x-user-uid':'user-analyst'}});
  assert.equal(analyst.status,403);
  const owner=await fetch(`${base}/api/admin/summary`,{headers:ownerHeaders});
  assert.equal(owner.status,200);
});

test('Owner dashboard aggregates match workspace database records and feed pagination',async()=>{
  const response=await fetch(`${base}/api/owner/dashboard`,{headers:ownerHeaders});
  assert.equal(response.status,200);
  const dashboard=await response.json();
  const tenant='11111111-1111-4111-8111-111111111111';
  const properties=await pool.query(`SELECT COUNT(*) total,
    SUM(CASE WHEN status IN ('in_review','clarification_required') AND archived_at IS NULL THEN 1 ELSE 0 END) active_reviews,
    SUM(CASE WHEN status='ready_for_review' AND archived_at IS NULL THEN 1 ELSE 0 END) ready
    FROM properties WHERE tenant_id=? AND archived_at IS NULL`,[tenant]);
  const documents=await pool.query(`SELECT COUNT(*) total,SUM(CASE WHEN d.manual_review_status IN ('pending','required') OR d.processing_status<>'completed' THEN 1 ELSE 0 END) pending
    FROM documents d JOIN properties p ON p.id=d.property_id AND p.tenant_id=d.tenant_id WHERE d.tenant_id=? AND d.governance_status='active' AND p.archived_at IS NULL`,[tenant]);
  const documentTypes=await pool.query(`SELECT
    SUM(LOWER(COALESCE(d.doc_type,'')) IN ('sale_deed','gift_deed','partition_deed','release_deed','power_of_attorney')) title_deeds,
    SUM(LOWER(COALESCE(d.doc_type,'')) IN ('encumbrance_certificate','ec')) encumbrance_certificates,
    SUM(LOWER(COALESCE(d.doc_type,'')) IN ('rtc_pahani','mutation_record','mutation_extract','survey_sketch_tippan','survey_sketch','khata_e_khata','e_khata','property_tax_receipt','tax_receipt')) survey_revenue_records,
    SUM(LOWER(COALESCE(d.doc_type,'')) NOT IN ('sale_deed','gift_deed','partition_deed','release_deed','power_of_attorney','encumbrance_certificate','ec','rtc_pahani','mutation_record','mutation_extract','survey_sketch_tippan','survey_sketch','khata_e_khata','e_khata','property_tax_receipt','tax_receipt')) other_documents
    FROM documents d JOIN properties p ON p.id=d.property_id AND p.tenant_id=d.tenant_id WHERE d.tenant_id=? AND d.governance_status='active' AND p.archived_at IS NULL`,[tenant]);
  const overdue=await pool.query("SELECT COUNT(*) total FROM workbench_tasks t JOIN properties p ON p.id=t.property_id AND p.tenant_id=t.tenant_id WHERE t.tenant_id=? AND p.archived_at IS NULL AND t.due_date<CURDATE() AND t.status NOT IN ('completed','cancelled')",[tenant]);
  const readiness=await pool.query(`SELECT COUNT(*) total,
    SUM(CASE WHEN status='ready_for_review' THEN 1 ELSE 0 END) ready,
    SUM(CASE WHEN status IN ('documents_pending','in_review','clarification_required') THEN 1 ELSE 0 END) under_review,
    SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) not_started,
    SUM((CASE WHEN (NULLIF(TRIM(survey_number),'') IS NOT NULL OR NULLIF(TRIM(property_identifier),'') IS NOT NULL) AND NULLIF(TRIM(village),'') IS NOT NULL AND NULLIF(TRIM(extent),'') IS NOT NULL THEN 1 ELSE 0 END+
      CASE WHEN EXISTS(SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.governance_status='active') THEN 1 ELSE 0 END+
      CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 ELSE 0 END+
      CASE WHEN NULLIF(TRIM(boundary_north),'') IS NOT NULL AND NULLIF(TRIM(boundary_south),'') IS NOT NULL AND NULLIF(TRIM(boundary_east),'') IS NOT NULL AND NULLIF(TRIM(boundary_west),'') IS NOT NULL THEN 1 ELSE 0 END+
      CASE WHEN identity_state='verified' THEN 1 ELSE 0 END)/5*100) score_sum
    FROM properties p WHERE tenant_id=? AND archived_at IS NULL`,[tenant]);
  const reports=await pool.query("SELECT COUNT(*) total FROM consultant_report_versions r JOIN properties p ON p.id=r.property_id AND p.tenant_id=r.tenant_id WHERE r.tenant_id=? AND r.approval_status='submitted' AND p.archived_at IS NULL",[tenant]);
  const highAttention=await pool.query("SELECT COUNT(*) total FROM risk_findings f JOIN properties p ON p.id=f.property_id AND p.tenant_id=f.tenant_id WHERE f.tenant_id=? AND p.archived_at IS NULL AND f.severity IN ('critical','high')",[tenant]);
  const missingEvidence=await pool.query(`SELECT COUNT(*) total FROM properties p WHERE p.tenant_id=? AND p.archived_at IS NULL AND (
    (NULLIF(TRIM(p.survey_number),'') IS NULL AND NULLIF(TRIM(p.property_identifier),'') IS NULL) OR NULLIF(TRIM(p.village),'') IS NULL OR NULLIF(TRIM(p.extent),'') IS NULL OR p.latitude IS NULL OR p.longitude IS NULL OR
    NULLIF(TRIM(p.boundary_north),'') IS NULL OR NULLIF(TRIM(p.boundary_south),'') IS NULL OR NULLIF(TRIM(p.boundary_east),'') IS NULL OR NULLIF(TRIM(p.boundary_west),'') IS NULL OR COALESCE(p.identity_state,'')<>'verified' OR
    NOT EXISTS(SELECT 1 FROM documents d WHERE d.property_id=p.id AND d.tenant_id=p.tenant_id AND d.governance_status='active'))`,[tenant]);
  const risks=await pool.query(`SELECT CASE COALESCE(r.risk_rank,0) WHEN 4 THEN 'critical' WHEN 3 THEN 'high' WHEN 2 THEN 'medium' WHEN 1 THEN 'low' ELSE 'not_assessed' END label,COUNT(*) value
    FROM properties p LEFT JOIN (SELECT property_id,MAX(CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) risk_rank FROM risk_findings WHERE tenant_id=? GROUP BY property_id) r ON r.property_id=p.id
    WHERE p.tenant_id=? AND p.archived_at IS NULL GROUP BY label`,[tenant,tenant]);
  const locations=await Promise.all(['district','taluk','village'].map(field=>pool.query(`SELECT COALESCE(NULLIF(TRIM(${field}),''),'Not recorded') label,COUNT(*) value FROM properties WHERE tenant_id=? AND archived_at IS NULL GROUP BY COALESCE(NULLIF(TRIM(${field}),''),'Not recorded') ORDER BY value DESC,label`,[tenant])));
  const teamTasks=await pool.query(`SELECT m.user_uid,
      COALESCE(t.open_tasks,0) open_tasks,COALESCE(t.completed_task_count,0) completed_task_count,
      COALESCE(t.overdue_task_count,0) overdue_task_count,COALESCE(r.tasks_awaiting_review,0) tasks_awaiting_review
    FROM org_memberships m
    LEFT JOIN (SELECT t.assigned_to_uid,
        SUM(t.status NOT IN ('completed','cancelled')) open_tasks,
        SUM(t.status='completed') completed_task_count,
        SUM(t.status NOT IN ('completed','cancelled') AND t.due_date<CURDATE()) overdue_task_count
      FROM workbench_tasks t JOIN properties p ON p.id=t.property_id AND p.tenant_id=t.tenant_id
      WHERE t.tenant_id=? AND p.archived_at IS NULL GROUP BY t.assigned_to_uid) t ON t.assigned_to_uid=m.user_uid
    LEFT JOIN (SELECT t.reviewer_uid,COUNT(*) tasks_awaiting_review FROM workbench_tasks t JOIN properties p ON p.id=t.property_id AND p.tenant_id=t.tenant_id
      WHERE t.tenant_id=? AND p.archived_at IS NULL AND t.status='under_review' GROUP BY t.reviewer_uid) r ON r.reviewer_uid=m.user_uid
    WHERE m.organization_id=? AND m.status='active' AND m.role IN ('lawyer','analyst','operations','consultant')`,[tenant,tenant,tenant]);
  const propertyCount=Number(properties.rows[0].total||0),documentCount=Number(documents.rows[0].total||0);
  assert.equal(dashboard.metrics.total_matters,propertyCount);
  assert.equal(dashboard.metrics.active_reviews,Number(properties.rows[0].active_reviews||0));
  assert.equal(dashboard.metrics.ready_for_legal_review,Number(properties.rows[0].ready||0));
  assert.equal(dashboard.metrics.documents_requiring_review,Number(documents.rows[0].pending||0));
  assert.equal(dashboard.metrics.overdue_tasks,Number(overdue.rows[0].total||0));
  assert.equal(dashboard.metrics.reports_awaiting_review,Number(reports.rows[0].total||0));
  assert.equal(dashboard.metrics.high_attention_findings,Number(highAttention.rows[0].total||0));
  assert.equal(dashboard.readiness.total,Number(readiness.rows[0].total||0));
  assert.equal(dashboard.readiness.ready_for_legal_review,Number(readiness.rows[0].ready||0));
  assert.equal(dashboard.readiness.under_review,Number(readiness.rows[0].under_review||0));
  assert.equal(dashboard.readiness.not_started,Number(readiness.rows[0].not_started||0));
  const expectedReadiness=Number(readiness.rows[0].total)?Math.round(Number(readiness.rows[0].score_sum)/Number(readiness.rows[0].total)):0;
  assert.equal(dashboard.readiness.readiness_pct,expectedReadiness);
  assert.equal(dashboard.documentCategories.total_documents,documentCount);
  for(const field of ['title_deeds','encumbrance_certificates','survey_revenue_records','other_documents']) assert.equal(dashboard.documentCategories[field],Number(documentTypes.rows[0]?.[field]||0));
  assert.equal(dashboard.distributions.districts.reduce((sum:number,row:any)=>sum+Number(row.value||0),0),propertyCount);
  assert.equal(dashboard.distributions.taluks.reduce((sum:number,row:any)=>sum+Number(row.value||0),0),propertyCount);
  assert.equal(dashboard.distributions.villages.reduce((sum:number,row:any)=>sum+Number(row.value||0),0),propertyCount);
  for(const [index,field] of ['districts','taluks','villages'].entries()){
    const normalize=(rows:any[])=>rows.map(row=>[String(row.label),Number(row.value)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
    assert.deepEqual(normalize(dashboard.distributions[field]),normalize(locations[index].rows));
  }
  assert.equal(dashboard.riskOverview.reduce((sum:number,row:any)=>sum+Number(row.value||0),0),propertyCount);
  assert.deepEqual(Object.fromEntries(dashboard.riskOverview.map((row:any)=>[row.label,Number(row.value||0)])),Object.fromEntries(risks.rows.map((row:any)=>[row.label,Number(row.value||0)])));
  const workloadByUser=new Map(dashboard.teamWorkload.map((row:any)=>[row.user_uid,row]));
  for(const row of teamTasks.rows){const actual:any=workloadByUser.get(row.user_uid);assert.ok(actual);for(const field of ['open_tasks','completed_task_count','overdue_task_count','tasks_awaiting_review'])assert.equal(Number(actual[field]||0),Number(row[field]||0));}
  assert.equal(dashboard.readiness.missing_evidence_matters,Number(missingEvidence.rows[0]?.total||0));
  assert.deepEqual(dashboard.evidenceSourceStatus.map((item:any)=>item.source),['Bhoomi / RTC','Kaveri','Registration / EC','GIS / Map Layers']);
  assert.equal(dashboard.pendingActions.find((item:any)=>item.id==='legal').count,Number(reports.rows[0].total||0));
  assert.equal(dashboard.pendingActions.find((item:any)=>item.id==='legal').target,'consultant-reports');
  assert.equal(dashboard.pendingActions.find((item:any)=>item.id==='approval').count,dashboard.metrics.ready_for_legal_review);
  assert.equal(dashboard.pendingActions.find((item:any)=>item.id==='evidence').count,dashboard.readiness.missing_evidence_matters);
  assert.equal(dashboard.pendingActions.find((item:any)=>item.id==='overdue').count,dashboard.metrics.overdue_tasks);
  const page=await fetch(`${base}/api/owner/dashboard?findingsPage=2&findingsPageSize=1&activityPage=2&activityPageSize=1`,{headers:ownerHeaders});
  assert.equal(page.status,200);
  const pageData=await page.json();
  assert.ok(pageData.recentFindings.length<=1);
  assert.ok(pageData.recentActivity.length<=1);
  assert.equal(pageData.pagination.findings.page,2);
  assert.equal(pageData.pagination.activity.page,2);
});

test('Owner dashboard metrics refresh after matter and document create, update, archive and delete operations',async()=>{
  const tenant='11111111-1111-4111-8111-111111111111';
  const propertyId=crypto.randomUUID(),documentId=crypto.randomUUID(),applicationNumber=`DASH-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const dashboard=async()=>{
    const response=await fetch(`${base}/api/owner/dashboard`,{headers:ownerHeaders});
    assert.equal(response.status,200);
    return response.json();
  };
  const initial=await dashboard();
  try{
    await pool.query("INSERT INTO properties (id,tenant_id,application_number,name,status,district,created_by_uid,updated_by_uid) VALUES (?,?,?,?,?,'',?,?)",[propertyId,tenant,applicationNumber,`Dashboard mutation ${applicationNumber}`,'in_review','dashboard-mutation-test','dashboard-mutation-test']);
    const created=await dashboard();
    assert.equal(created.metrics.total_matters,initial.metrics.total_matters+1);
    assert.equal(created.metrics.active_reviews,initial.metrics.active_reviews+1);
    assert.equal(created.readiness.total,initial.readiness.total+1);
    assert.equal(Number(created.distributions.districts.find((row:any)=>row.label==='Not recorded')?.value||0),Number(initial.distributions.districts.find((row:any)=>row.label==='Not recorded')?.value||0)+1);
    assert.equal(Number(created.distributions.villages.find((row:any)=>row.label==='Not recorded')?.value||0),Number(initial.distributions.villages.find((row:any)=>row.label==='Not recorded')?.value||0)+1);

    await pool.query("INSERT INTO documents (id,tenant_id,property_id,doc_type,manual_review_status,governance_status,original_filename,storage_key,mime_type,size_bytes,sha256,processing_status,review_status,extracted_fields,uploaded_by_uid) VALUES (?,?,?,'sale_deed','required','active',?,'dashboard-test/document.pdf','application/pdf',12,?,'queued','pending',JSON_OBJECT(),'dashboard-mutation-test')",[documentId,tenant,propertyId,`${applicationNumber}.pdf`,crypto.createHash('sha256').update(documentId).digest('hex')]);
    const uploaded=await dashboard();
    assert.equal(uploaded.metrics.documents_requiring_review,initial.metrics.documents_requiring_review+1);
    assert.equal(uploaded.documentCategories.total_documents,initial.documentCategories.total_documents+1);
    assert.equal(uploaded.documentCategories.title_deeds,initial.documentCategories.title_deeds+1);
    assert.equal(uploaded.documentCategories.pending_review,initial.documentCategories.pending_review+1);
    assert.equal(uploaded.pendingActions.find((row:any)=>row.id==='documents').count,uploaded.metrics.documents_requiring_review);

    await pool.query("UPDATE documents SET manual_review_status='completed',processing_status='completed' WHERE id=? AND tenant_id=?",[documentId,tenant]);
    const processed=await dashboard();
    assert.equal(processed.metrics.documents_requiring_review,initial.metrics.documents_requiring_review);
    assert.equal(processed.documentCategories.pending_review,initial.documentCategories.pending_review);

    await pool.query("UPDATE properties SET status='ready_for_review',updated_at=NOW(6) WHERE id=? AND tenant_id=?",[propertyId,tenant]);
    const ready=await dashboard();
    assert.equal(ready.metrics.active_reviews,initial.metrics.active_reviews);
    assert.equal(ready.metrics.ready_for_legal_review,initial.metrics.ready_for_legal_review+1);
    assert.equal(ready.readiness.ready_for_legal_review,initial.readiness.ready_for_legal_review+1);

    await pool.query('DELETE FROM documents WHERE id=? AND tenant_id=?',[documentId,tenant]);
    const documentDeleted=await dashboard();
    assert.equal(documentDeleted.documentCategories.total_documents,initial.documentCategories.total_documents);
    assert.equal(documentDeleted.metrics.documents_requiring_review,initial.metrics.documents_requiring_review);

    await pool.query('UPDATE properties SET archived_at=NOW(6),archived_by_uid=?,archive_reason=? WHERE id=? AND tenant_id=?',['dashboard-mutation-test','test fixture',propertyId,tenant]);
    const archived=await dashboard();
    assert.equal(archived.metrics.total_matters,initial.metrics.total_matters);
    assert.equal(archived.readiness.total,initial.readiness.total);
    await pool.query('DELETE FROM properties WHERE id=? AND tenant_id=?',[propertyId,tenant]);
    const deleted=await dashboard();
    assert.equal(deleted.metrics.total_matters,initial.metrics.total_matters);
    assert.equal(deleted.readiness.total,initial.readiness.total);
  }finally{
    await pool.query('DELETE FROM documents WHERE id=?',[documentId]);
    await pool.query('DELETE FROM properties WHERE id=?',[propertyId]);
  }
});

test('Owner dashboard global search is workspace-scoped across properties and documents',async()=>{
  const tenant='11111111-1111-4111-8111-111111111111';
  const otherTenant=crypto.randomUUID(),visibleProperty=crypto.randomUUID(),hiddenProperty=crypto.randomUUID();
  const token=`DS-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
  try{
    await pool.query('INSERT INTO organizations (id,name,slug) VALUES (?,?,?)',[otherTenant,'Dashboard Search Isolation',`dashboard-search-${Date.now()}`]);
    await pool.query('INSERT INTO properties (id,tenant_id,application_number,name,created_by_uid,updated_by_uid) VALUES (?,?,?,?,?,?)',[visibleProperty,tenant,token,`Visible ${token}`,'dashboard-search-test','dashboard-search-test']);
    await pool.query('INSERT INTO properties (id,tenant_id,application_number,name,created_by_uid,updated_by_uid) VALUES (?,?,?,?,?,?)',[hiddenProperty,otherTenant,`PRIVATE-${token}`,`Hidden ${token}`,'dashboard-search-test','dashboard-search-test']);
    const response=await fetch(`${base}/api/owner/dashboard/search?q=${encodeURIComponent(token)}`,{headers:ownerHeaders});
    assert.equal(response.status,200);
    const result=await response.json();
    assert.ok(result.items.some((item:any)=>item.id===visibleProperty));
    assert.equal(result.items.some((item:any)=>item.id===hiddenProperty),false);
    const denied=await fetch(`${base}/api/owner/dashboard/search?q=${encodeURIComponent(token)}`,{headers:{'x-user-uid':'user-admin'}});
    assert.equal(denied.status,403);
  }finally{
    await pool.query('DELETE FROM properties WHERE id IN (?,?)',[visibleProperty,hiddenProperty]);
    await pool.query('DELETE FROM organizations WHERE id=?',[otherTenant]);
  }
});

test('all ten memberships resolve their own role and only authorized dashboard surfaces',async()=>{
  const roles=['super-admin','owner','admin','lawyer','analyst','operations','consultant','support','data-steward','viewer'];
  for(const role of roles){
    const uid=role==='super-admin'?'user-super-admin':`user-${role}`;
    const me=await fetch(`${base}/api/auth/me`,{headers:{'x-user-uid':uid}});
    assert.equal(me.status,200,`${role} identity authenticates`);
    const identity=await me.json();
    const expected=role==='super-admin'?'super_admin':role.replaceAll('-','_');
    assert.equal(identity.user.role,expected,`${role} membership role is database-resolved`);
    if(role==='super-admin'){
      assert.equal((await fetch(`${base}/api/super-admin/overview`,{headers:{'x-user-uid':uid}})).status,200);
      assert.equal((await fetch(`${base}/api/overview`,{headers:{'x-user-uid':uid}})).status,403);
    }else assert.equal((await fetch(`${base}/api/overview`,{headers:{'x-user-uid':uid}})).status,200,`${role} workspace dashboard`);
  }
});

test('workspace selection accepts active memberships only and rejects unknown workspaces',async()=>{
  const headers={'x-user-uid':'user-owner'};
  const current=await fetch(`${base}/api/auth/workspaces`,{headers});
  assert.equal(current.status,200);
  const body=await current.json();
  assert.ok(body.items.some((item:any)=>item.id==='11111111-1111-4111-8111-111111111111'));
  const denied=await fetch(`${base}/api/properties`,{headers:{...headers,'x-ojix-workspace-id':crypto.randomUUID()}});
  assert.equal(denied.status,403);
  const allowed=await fetch(`${base}/api/properties`,{headers:{...headers,'x-ojix-workspace-id':'11111111-1111-4111-8111-111111111111'}});
  assert.equal(allowed.status,200);
});

test('disabled or unverified database accounts cannot use an active membership',async()=>{
  const uid=crypto.randomUUID(),email=`inactive-${uid}@example.test`;
  try{
    await pool.query("INSERT INTO user_accounts (id,email,full_name,password_hash,email_verified,status,otp_required) VALUES (?,?,?,'test-hash',TRUE,'disabled',TRUE)",[uid,email,'Inactive Test Account']);
    await pool.query("INSERT INTO org_memberships (id,organization_id,user_uid,email,role,status) VALUES (?,?,?,?,'viewer','active')",[crypto.randomUUID(),'11111111-1111-4111-8111-111111111111',uid,email]);
    const response=await fetch(`${base}/api/auth/me`,{headers:{'x-user-uid':uid}});
    assert.equal(response.status,403);
    assert.equal((await response.json()).code,'ACCOUNT_INACTIVE');
  }finally{
    await pool.query('DELETE FROM org_memberships WHERE user_uid=?',[uid]);
    await pool.query('DELETE FROM user_accounts WHERE id=?',[uid]);
  }
});

test('missing and invalid bearer tokens are rejected by protected APIs',async()=>{
  assert.equal((await fetch(`${base}/api/auth/me`)).status,401);
  assert.equal((await fetch(`${base}/api/properties`,{headers:{authorization:'Bearer invalid-firebase-token'}})).status,401);
});

test('Owner and Admin cannot escalate membership or enter the platform console',async()=>{
  for(const uid of ['user-owner','user-admin']){
    assert.equal((await fetch(`${base}/api/super-admin/overview`,{headers:{'x-user-uid':uid}})).status,403);
    const invite=await fetch(`${base}/api/admin/members/invite`,{method:'POST',headers:{'x-user-uid':uid,'content-type':'application/json'},body:JSON.stringify({name:'Escalation Attempt',email:`escalation-${uid}@example.test`,role:'super_admin'})});
    assert.equal(invite.status,400);
  }
  const blocked=await fetch(`${base}/api/properties`,{headers:{'x-user-uid':'user-super-admin','x-ojix-workspace-id':'11111111-1111-4111-8111-111111111111'}});
  assert.equal(blocked.status,403,'Platform Super Admin must not inherit workspace role access');
});

test('every Admin page data endpoint works for the Admin role',async()=>{
  const endpoints=['summary','members','roles','permissions','applications','documents','integrations','sessions','security-events','storage','retention','audit','source-health','configuration-versions','governance/gis_rules','governance/discrepancy_rules','governance/report_templates','exports'];
  for(const endpoint of endpoints){
    const response=await fetch(`${base}/api/admin/${endpoint}`,{headers:{'x-user-uid':'user-admin'}});
    assert.equal(response.status,200,`${endpoint} should load for Admin`);
    const body=await response.json();
    assert.equal(typeof body,'object');
    assert.equal(JSON.stringify(body).includes('invitation_token_hash'),false);
    assert.equal(JSON.stringify(body).includes('token_hash'),false);
  }
});

test('admin validation and Owner protections are enforced',async()=>{
  const invalid=await fetch(`${base}/api/admin/members/invite`,{method:'POST',headers:ownerHeaders,body:JSON.stringify({name:'Bad Role',email:'bad-role@example.test',role:'owner'})});
  assert.equal(invalid.status,400);
  const members=await fetch(`${base}/api/admin/members`,{headers:ownerHeaders}).then(response=>response.json());
  const owner=members.items.find((item:any)=>item.role==='owner');
  assert.ok(owner);
  const demotion=await fetch(`${base}/api/admin/members/${owner.id}/role`,{method:'PATCH',headers:ownerHeaders,body:JSON.stringify({role:'viewer',reason:'governance test'})});
  assert.equal(demotion.status,403);
});

test('invitation mutation is tenant-scoped, audited, and never exposes its token',async()=>{
  const email=`governance-${Date.now()}@example.test`;
  let invitationId='';
  try{
    const response=await fetch(`${base}/api/admin/members/invite`,{method:'POST',headers:ownerHeaders,body:JSON.stringify({name:'Governance Test',email,role:'viewer'})});
    assert.equal(response.status,201);
    const body=await response.json();
    invitationId=body.item.id;
    assert.equal(body.item.delivery_status,'not_configured');
    assert.equal(JSON.stringify(body).includes('token'),false);
    const audit=await pool.query("SELECT details FROM audit_events WHERE tenant_id=? AND entity_id=? AND action='admin.member_invited'",['11111111-1111-4111-8111-111111111111',invitationId]);
    assert.equal(audit.rowCount,1);
    assert.equal(JSON.stringify(audit.rows[0]).includes('invitation_token_hash'),false);
  }finally{
    if(invitationId){await pool.query('DELETE FROM audit_events WHERE entity_id=?',[invitationId]);await pool.query('DELETE FROM workspace_invitations WHERE id=?',[invitationId]);}
  }
});

test('admin list endpoints do not expose records from another tenant',async()=>{
  const tenantId=crypto.randomUUID(),propertyId=crypto.randomUUID(),auditId=crypto.randomUUID();
  try{
    await pool.query('INSERT INTO organizations (id,name,slug) VALUES (?,?,?)',[tenantId,'Isolation Test',`isolation-${Date.now()}`]);
    await pool.query("INSERT INTO properties (id,tenant_id,application_number,name,created_by_uid,updated_by_uid) VALUES (?,?,?,?,?,?)",[propertyId,tenantId,`PRIVATE-${Date.now()}`,'PRIVATE CROSS TENANT','isolation-user','isolation-user']);
    await pool.query('INSERT INTO audit_events (id,actor_uid,tenant_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?,?,?)',[auditId,'isolation-user',tenantId,'private.event','property',propertyId,'{}']);
    const applications=await fetch(`${base}/api/admin/applications`,{headers:ownerHeaders}).then(response=>response.json());
    assert.equal(applications.items.some((item:any)=>item.id===propertyId),false);
    const audit=await fetch(`${base}/api/admin/audit?search=private.event`,{headers:ownerHeaders}).then(response=>response.json());
    assert.equal(audit.items.some((item:any)=>item.id===auditId),false);
  }finally{
    await pool.query('DELETE FROM audit_events WHERE id=?',[auditId]);
    await pool.query('DELETE FROM properties WHERE id=?',[propertyId]);
    await pool.query('DELETE FROM organizations WHERE id=?',[tenantId]);
  }
});

test('Super Admin suspension, activation and revocation are individually audited',async()=>{
  const id=crypto.randomUUID(),uid=`rbac-lifecycle-${id}`;
  const headers={'x-user-uid':'user-super-admin','content-type':'application/json'};
  try{
    await pool.query('INSERT INTO org_memberships (id,organization_id,user_uid,email,role,status) VALUES (?,?,?,?,?,?)',[id,'11111111-1111-4111-8111-111111111111',uid,`${uid}@example.test`,'viewer','active']);
    for(const status of ['disabled','active','revoked']){
      const response=await fetch(`${base}/api/super-admin/members/${id}`,{method:'PATCH',headers,body:JSON.stringify({status,reason:`RBAC lifecycle test ${status}`})});
      assert.equal(response.status,200,`Super Admin may set ${status}`);
      const audit=await pool.query('SELECT id FROM audit_events WHERE entity_id=? AND action=\'super_admin.membership_updated\'',[id]);
      assert.equal(audit.rowCount,status==='disabled'?1:status==='active'?2:3);
    }
    const persisted=await pool.query('SELECT status FROM org_memberships WHERE id=?',[id]);
    assert.equal(persisted.rows[0].status,'revoked');
  }finally{
    await pool.query('DELETE FROM audit_events WHERE entity_id=?',[id]);
    await pool.query('DELETE FROM org_memberships WHERE id=?',[id]);
  }
});

test('Lawyer workspace is limited to assigned matters, evidence and findings',async()=>{
  const headers={'x-user-uid':'user-lawyer'};
  const propertiesResponse=await fetch(`${base}/api/properties`,{headers});
  assert.equal(propertiesResponse.status,200);
  const properties=await propertiesResponse.json();
  assert.ok(properties.items.every((item:any)=>item.assigned_lawyer_uid==='user-lawyer'));

  const unassigned=await pool.query("SELECT id FROM properties WHERE tenant_id=? AND (assigned_lawyer_uid IS NULL OR assigned_lawyer_uid<>?) LIMIT 1",['11111111-1111-4111-8111-111111111111','user-lawyer']);
  if(unassigned.rowCount){
    const direct=await fetch(`${base}/api/properties/${unassigned.rows[0].id}`,{headers});
    assert.equal(direct.status,404);
  }

  const documents=await fetch(`${base}/api/documents/all`,{headers}).then(response=>response.json());
  const assignedIds=new Set(properties.items.map((item:any)=>item.id));
  assert.ok(documents.items.every((item:any)=>assignedIds.has(item.property_id)));
  assert.equal(documents.items.some((item:any)=>'extracted_text' in item||'storage_key' in item),false);

  const findings=await fetch(`${base}/api/findings/all`,{headers}).then(response=>response.json());
  assert.ok(findings.items.every((item:any)=>assignedIds.has(item.property_id)));
});

test('Analyst workspace is limited to assigned applications and evidence',async()=>{
  const headers={'x-user-uid':'user-analyst'};
  const properties=await fetch(`${base}/api/properties`,{headers}).then(response=>response.json());
  assert.ok(properties.items.every((item:any)=>item.assigned_analyst_uid==='user-analyst'));
  const assignedIds=new Set(properties.items.map((item:any)=>item.id));

  const unassigned=await pool.query("SELECT id FROM properties WHERE tenant_id=? AND (assigned_analyst_uid IS NULL OR assigned_analyst_uid<>?) LIMIT 1",['11111111-1111-4111-8111-111111111111','user-analyst']);
  if(unassigned.rowCount){
    const direct=await fetch(`${base}/api/properties/${unassigned.rows[0].id}`,{headers});
    assert.equal(direct.status,404);
  }

  const documents=await fetch(`${base}/api/documents/all`,{headers}).then(response=>response.json());
  assert.ok(documents.items.every((item:any)=>assignedIds.has(item.property_id)));
  const findings=await fetch(`${base}/api/findings/all`,{headers}).then(response=>response.json());
  assert.ok(findings.items.every((item:any)=>assignedIds.has(item.property_id)));
});

test('Operations workspace is limited to assigned applications and evidence',async()=>{
  const headers={'x-user-uid':'user-operations'};
  const response=await fetch(`${base}/api/properties`,{headers});
  assert.equal(response.status,200);
  const properties=await response.json();
  assert.ok(properties.items.every((item:any)=>item.assigned_operations_uid==='user-operations'));
  const assignedIds=new Set(properties.items.map((item:any)=>item.id));

  const assignedElsewhere=await pool.query("SELECT id FROM properties WHERE tenant_id=? AND assigned_operations_uid IS NOT NULL AND assigned_operations_uid<>'' AND assigned_operations_uid<>? LIMIT 1",['11111111-1111-4111-8111-111111111111','user-operations']);
  if(assignedElsewhere.rowCount){
    const direct=await fetch(`${base}/api/properties/${assignedElsewhere.rows[0].id}`,{headers});
    assert.equal(direct.status,404);
  }

  const documents=await fetch(`${base}/api/documents/all`,{headers}).then(result=>result.json());
  assert.ok(documents.items.every((item:any)=>assignedIds.has(item.property_id)));
  assert.equal(documents.items.some((item:any)=>'extracted_text' in item||'storage_key' in item),false);
});

test('Consultant workspace is read-only and exposes sanitized evidence metadata',async()=>{
  const headers={'x-user-uid':'user-consultant','content-type':'application/json'};
  const propertiesResponse=await fetch(`${base}/api/properties`,{headers});
  assert.equal(propertiesResponse.status,200);
  const properties=await propertiesResponse.json();

  const create=await fetch(`${base}/api/properties`,{method:'POST',headers,body:'{}'});
  assert.equal(create.status,403);

  if(properties.items.length){
    const propertyId=properties.items[0].id;
    const analyze=await fetch(`${base}/api/properties/${propertyId}/analyze`,{method:'POST',headers,body:'{}'});
    assert.equal(analyze.status,403);
    const upload=await fetch(`${base}/api/properties/${propertyId}/documents`,{method:'POST',headers});
    assert.equal(upload.status,403);
  }

  const documents=await fetch(`${base}/api/documents/all`,{headers}).then(response=>response.json());
  assert.equal(documents.items.some((item:any)=>'extracted_text' in item||'storage_key' in item),false);
});

test('Support session exposes diagnostics but blocks every business-data surface',async()=>{
  const headers={'x-user-uid':'user-support','content-type':'application/json'};
  const overviewResponse=await fetch(`${base}/api/overview`,{headers});
  assert.equal(overviewResponse.status,200);
  const overview=await overviewResponse.json();
  assert.equal(overview.supportScope,'diagnostics_only');
  assert.equal(overview.total,0);
  assert.equal('recent' in overview,false);
  assert.equal('recentFindings' in overview,false);

  const properties=await fetch(`${base}/api/properties`,{headers}).then(response=>response.json());
  assert.deepEqual(properties.items,[]);

  const tenantProperty=await pool.query('SELECT id FROM properties WHERE tenant_id=? LIMIT 1',['11111111-1111-4111-8111-111111111111']);
  const blockedUrls=['/api/documents/all','/api/findings/all','/api/legal-research','/api/source-registry/status','/api/spatial/screen-point',...(tenantProperty.rowCount?[`/api/properties/${tenantProperty.rows[0].id}`]:[])];
  for(const url of blockedUrls){
    const spatial=url==='/api/spatial/screen-point';
    const response=await fetch(`${base}${url}`,{method:spatial?'POST':'GET',headers,body:spatial?JSON.stringify({latitude:12.9,longitude:77.6}):undefined});
    assert.equal(response.status,403,`${url} must be blocked for Support`);
  }
});

test('Data Steward can govern sources but cannot modify records or access legal decisions',async()=>{
  const headers={'x-user-uid':'user-data-steward','content-type':'application/json'};
  const propertiesResponse=await fetch(`${base}/api/properties`,{headers});
  assert.equal(propertiesResponse.status,200);
  const properties=await propertiesResponse.json();

  const documents=await fetch(`${base}/api/documents/all`,{headers}).then(response=>response.json());
  assert.equal(documents.items.some((item:any)=>'extracted_text' in item||'storage_key' in item),false);
  assert.equal((await fetch(`${base}/api/source-registry/status`,{headers})).status,200);
  assert.equal((await fetch(`${base}/api/findings/all`,{headers})).status,403);
  assert.equal((await fetch(`${base}/api/legal-research`,{headers})).status,403);
  assert.equal((await fetch(`${base}/api/properties`,{method:'POST',headers,body:'{}'})).status,403);

  if(properties.items.length){
    const propertyId=properties.items[0].id;
    const detail=await fetch(`${base}/api/properties/${propertyId}`,{headers});
    assert.equal(detail.status,200);
    assert.deepEqual((await detail.json()).findings,[]);
    assert.equal((await fetch(`${base}/api/properties/${propertyId}`,{method:'PATCH',headers,body:'{}'})).status,403);
    assert.equal((await fetch(`${base}/api/properties/${propertyId}/analyze`,{method:'POST',headers,body:'{}'})).status,403);
    assert.equal((await fetch(`${base}/api/properties/${propertyId}/title-chain`,{headers})).status,403);
  }
});

test('Viewer sees only assigned released matters and approved-output surfaces',async()=>{
  const headers={'x-user-uid':'user-viewer','content-type':'application/json'};
  const response=await fetch(`${base}/api/properties`,{headers});
  assert.equal(response.status,200);
  const properties=await response.json();
  assert.ok(properties.items.every((item:any)=>(item.status==='complete'||item.status==='approved')&&item.assigned_viewer_uid==='user-viewer'));

  const unreleased=await pool.query("SELECT id FROM properties WHERE tenant_id=? AND (status NOT IN ('complete','approved') OR assigned_viewer_uid<>?) LIMIT 1",['11111111-1111-4111-8111-111111111111','user-viewer']);
  if(unreleased.rowCount){
    const propertyId=unreleased.rows[0].id;
    assert.equal((await fetch(`${base}/api/properties/${propertyId}`,{headers})).status,404);
    assert.equal((await fetch(`${base}/api/properties/${propertyId}/report`,{headers})).status,404);
  }

  assert.equal((await fetch(`${base}/api/documents/all`,{headers})).status,403);
  assert.equal((await fetch(`${base}/api/findings/all`,{headers})).status,403);
  assert.equal((await fetch(`${base}/api/source-registry/status`,{headers})).status,403);
  assert.equal((await fetch(`${base}/api/spatial/screen-point`,{method:'POST',headers,body:JSON.stringify({latitude:12.9,longitude:77.6})})).status,403);
  assert.equal((await fetch(`${base}/api/properties`,{method:'POST',headers,body:'{}'})).status,403);

  if(properties.items.length){
    const propertyId=properties.items[0].id;
    const detailResponse=await fetch(`${base}/api/properties/${propertyId}`,{headers});
    assert.equal(detailResponse.status,200);
    const detail=await detailResponse.json();
    assert.deepEqual(detail.documents,[]);
    assert.deepEqual(detail.findings,[]);
    assert.equal((await fetch(`${base}/api/properties/${propertyId}/documents/not-a-document/file`,{headers})).status,403);
    assert.equal((await fetch(`${base}/api/properties/${propertyId}/workflow`,{headers})).status,403);
    assert.equal((await fetch(`${base}/api/properties/${propertyId}/title-chain`,{headers})).status,403);
    assert.equal((await fetch(`${base}/api/properties/${propertyId}/report`,{headers})).status,200);
  }
});
