import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool } from './mariadb-test-pool.js';

const base=process.env.TEST_API_URL||'http://127.0.0.1:4000';
const ownerHeaders={authorization:'Bearer dummy-token-user-owner','content-type':'application/json'};

after(async()=>{await pool.end();});

test('admin APIs require authentication and an administrator role',async()=>{
  const unauthenticated=await fetch(`${base}/api/admin/summary`);
  assert.equal(unauthenticated.status,401);
  const analyst=await fetch(`${base}/api/admin/summary`,{headers:{authorization:'Bearer dummy-token-user-analyst'}});
  assert.equal(analyst.status,403);
  const owner=await fetch(`${base}/api/admin/summary`,{headers:ownerHeaders});
  assert.equal(owner.status,200);
});

test('every Admin page data endpoint works for the Admin role',async()=>{
  const endpoints=['summary','members','roles','permissions','applications','documents','integrations','sessions','security-events','storage','retention','audit'];
  for(const endpoint of endpoints){
    const response=await fetch(`${base}/api/admin/${endpoint}`,{headers:{authorization:'Bearer dummy-token-user-admin'}});
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

test('Lawyer workspace is limited to assigned matters, evidence and findings',async()=>{
  const headers={authorization:'Bearer dummy-token-user-lawyer'};
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
  const headers={authorization:'Bearer dummy-token-user-analyst'};
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

test('Operations workspace includes its assignments and the shared unassigned intake queue',async()=>{
  const headers={authorization:'Bearer dummy-token-user-operations'};
  const response=await fetch(`${base}/api/properties`,{headers});
  assert.equal(response.status,200);
  const properties=await response.json();
  assert.ok(properties.items.every((item:any)=>!item.assigned_operations_uid||item.assigned_operations_uid==='user-operations'));
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
  const headers={authorization:'Bearer dummy-token-user-consultant','content-type':'application/json'};
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
  const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'support@ojix.local',uid:'user-support',password:'ojix123'})});
  assert.equal(login.status,200);
  const session=await login.json();
  const headers={authorization:`Bearer ${session.token}`,'content-type':'application/json'};
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
  const headers={authorization:'Bearer dummy-token-user-data-steward','content-type':'application/json'};
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

test('Viewer sees only released matters and approved-output surfaces',async()=>{
  const headers={authorization:'Bearer dummy-token-user-viewer','content-type':'application/json'};
  const response=await fetch(`${base}/api/properties`,{headers});
  assert.equal(response.status,200);
  const properties=await response.json();
  assert.ok(properties.items.every((item:any)=>item.status==='complete'));

  const unreleased=await pool.query("SELECT id FROM properties WHERE tenant_id=? AND status<>'complete' LIMIT 1",['11111111-1111-4111-8111-111111111111']);
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
