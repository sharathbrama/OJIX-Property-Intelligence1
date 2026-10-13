import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRtcRecord, retrieveRtc, rtcSearchSchema } from '../src/rtc-retrieval-service.js';

const valid={district:'Mandya',taluk:'Pandavapura',hobli:'Kasaba 2',village:'Ganadahosuru',districtId:'11111111-1111-4111-8111-111111111111',talukId:'22222222-2222-4222-8222-222222222222',hobliId:'33333333-3333-4333-8333-333333333333',villageId:'44444444-4444-4444-8444-444444444444',surveyNumber:'45',subdivision:'2'};

test('RTC input rejects missing hierarchy and unsafe survey values',()=>{
  assert.equal(rtcSearchSchema.safeParse({...valid,village:''}).success,false);
  assert.equal(rtcSearchSchema.safeParse({...valid,surveyNumber:'45<script>'}).success,false);
  assert.equal(rtcSearchSchema.safeParse(valid).success,true);
});

test('disabled provider requires manual retrieval and never fabricates a record',async()=>{
  const result=await retrieveRtc(valid,{RTC_PROVIDER_MODE:'disabled'} as NodeJS.ProcessEnv);
  assert.equal(result.status,'manual_required');
  assert.equal('record' in result,false);
});

test('authorized fixture normalizes an RTC response in test mode',async()=>{
  const directory=path.dirname(fileURLToPath(import.meta.url));
  const result=await retrieveRtc(valid,{NODE_ENV:'test',RTC_PROVIDER_MODE:'fixture',RTC_FIXTURE_PATH:path.join(directory,'fixtures/rtc-authorized-response.json')} as NodeJS.ProcessEnv);
  assert.equal(result.status,'completed');
  if(result.status==='completed'){assert.equal(result.record.surveyNumber,'45');assert.deepEqual(result.record.landholders,['Authorized Test Holder']);}
});

test('normalizer preserves unavailable values as null',()=>{
  const result=normalizeRtcRecord({surveyNumber:'10'},null);
  assert.equal(result.surveyNumber,'10');assert.equal(result.extentRaw,null);assert.deepEqual(result.landholders,[]);
});
