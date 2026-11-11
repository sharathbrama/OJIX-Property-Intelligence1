import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pool } from './mariadb-test-pool.js';

const base = process.env.TEST_API_URL || 'http://127.0.0.1:4000';
const fetchAsOwner = (input: RequestInfo | URL, init: RequestInit = {}) => fetch(input, { ...init, headers: { ...(init.headers as Record<string,string> || {}), 'x-user-uid': 'local-developer' } });

test('MariaDB location hierarchy filters, validates, and warns about duplicates', async () => {
  const districtId=crypto.randomUUID(), otherDistrictId=crypto.randomUUID(), talukId=crypto.randomUUID(), hobliId=crypto.randomUUID(), villageId=crypto.randomUUID();
  let propertyId: string | undefined;
  try {
    await pool.query('INSERT INTO karnataka_districts (id,name,code) VALUES (?,?,?),(?,?,?)', [districtId,'Test District','TEST-D',otherDistrictId,'Other District','OTHER-D']);
    await pool.query('INSERT INTO karnataka_taluks (id,district_id,name,code) VALUES (?,?,?,?)', [talukId,districtId,'Test Taluk','TEST-T']);
    await pool.query('INSERT INTO karnataka_hoblis (id,taluk_id,name,code) VALUES (?,?,?,?)', [hobliId,talukId,'Test Hobli','TEST-H']);
    await pool.query('INSERT INTO karnataka_villages (id,hobli_id,name,code) VALUES (?,?,?,?)', [villageId,hobliId,'Test Village','TEST-V']);

    const districts = await fetchAsOwner(`${base}/api/locations/districts`).then(r=>r.json());
    assert.ok(districts.items.some((x:any)=>x.id===districtId));
    const taluks = await fetchAsOwner(`${base}/api/locations/taluks?districtId=${districtId}`).then(r=>r.json());
    assert.deepEqual(taluks.items.map((x:any)=>x.id),[talukId]);
    const hoblis = await fetchAsOwner(`${base}/api/locations/hoblis?talukId=${talukId}`).then(r=>r.json());
    assert.deepEqual(hoblis.items.map((x:any)=>x.id),[hobliId]);
    const villages = await fetchAsOwner(`${base}/api/locations/villages?hobliId=${hobliId}`).then(r=>r.json());
    assert.deepEqual(villages.items.map((x:any)=>x.id),[villageId]);

    const invalid = await fetchAsOwner(`${base}/api/properties`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({name:'Invalid hierarchy',district:'Other District',taluk:'Test Taluk',hobli:'Test Hobli',village:'Test Village',districtId:otherDistrictId,talukId,hobliId,villageId,surveyNumber:'TEST-1'}) });
    assert.equal(invalid.status,400);

    const payload={name:'Location hierarchy test',district:'Test District',taluk:'Test Taluk',hobli:'Test Hobli',village:'Test Village',districtId,talukId,hobliId,villageId,surveyNumber:`TEST-${Date.now()}`,subdivision:''};
    const createdResponse=await fetchAsOwner(`${base}/api/properties`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    assert.equal(createdResponse.status,201);
    const created=await createdResponse.json(); propertyId=created.item.id;
    const duplicate=await fetchAsOwner(`${base}/api/properties`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    assert.equal(duplicate.status,409);
    const duplicateBody=await duplicate.json();
    assert.equal(duplicateBody.duplicate.id,propertyId);
  } finally {
    if(propertyId){await pool.query('DELETE FROM audit_events WHERE entity_id=?',[propertyId]);await pool.query('DELETE FROM properties WHERE id=?',[propertyId]);}
    await pool.query('DELETE FROM karnataka_villages WHERE id=?',[villageId]);
    await pool.query('DELETE FROM karnataka_hoblis WHERE id=?',[hobliId]);
    await pool.query('DELETE FROM karnataka_taluks WHERE id=?',[talukId]);
    await pool.query('DELETE FROM karnataka_districts WHERE id IN (?,?)',[districtId,otherDistrictId]);
    await pool.end();
  }
});
