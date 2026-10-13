import fs from 'node:fs/promises';
import { z } from 'zod';

export const rtcSearchSchema = z.object({
  propertyId: z.string().uuid().optional(),
  district: z.string().trim().min(2).max(120),
  taluk: z.string().trim().min(2).max(120),
  hobli: z.string().trim().min(2).max(120),
  village: z.string().trim().min(2).max(120),
  districtId: z.string().uuid(),
  talukId: z.string().uuid(),
  hobliId: z.string().uuid(),
  villageId: z.string().uuid(),
  surveyNumber: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9][A-Za-z0-9/() ._-]*$/, 'Survey number contains unsupported characters.'),
  subdivision: z.string().trim().max(60).regex(/^[A-Za-z0-9/() ._-]*$/, 'Subdivision contains unsupported characters.').default('')
});

export type RtcSearchInput = z.infer<typeof rtcSearchSchema>;
export type RtcNormalizedRecord = {
  recordReference: string | null;
  district: string | null;
  taluk: string | null;
  hobli: string | null;
  village: string | null;
  surveyNumber: string | null;
  subdivision: string | null;
  landholders: string[];
  extentRaw: string | null;
  landClassification: string | null;
  tenancyDetails: string | null;
  cultivationDetails: string | null;
  mutationReferences: string[];
  recordDate: string | null;
  sourceUrl: string | null;
};

export type RtcRetrievalResult =
  | { status:'completed'; sourceName:string; sourceUrl:string|null; record:RtcNormalizedRecord; raw:unknown }
  | { status:'empty'; sourceName:string; sourceUrl:string|null; errorCode:'not_found'; message:string }
  | { status:'manual_required'; sourceName:string; sourceUrl:string|null; errorCode:'captcha_required'|'authorization_required'|'provider_not_configured'; message:string }
  | { status:'failed'; sourceName:string; sourceUrl:string|null; errorCode:'timeout'|'source_unavailable'|'invalid_source_response'; message:string };

const nullableText=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;
const stringList=(value:unknown)=>Array.isArray(value)?value.map(item=>String(item).trim()).filter(Boolean):[];

export function normalizeRtcRecord(payload:any, fallbackSourceUrl:string|null):RtcNormalizedRecord {
  const record=payload?.record&&typeof payload.record==='object'?payload.record:payload;
  return {
    recordReference:nullableText(record?.recordReference??record?.rtcNumber??record?.reference),
    district:nullableText(record?.district),taluk:nullableText(record?.taluk),hobli:nullableText(record?.hobli),village:nullableText(record?.village),
    surveyNumber:nullableText(record?.surveyNumber??record?.survey_no),subdivision:nullableText(record?.subdivision??record?.hissa),
    landholders:stringList(record?.landholders??record?.owners),extentRaw:nullableText(record?.extentRaw??record?.extent),
    landClassification:nullableText(record?.landClassification??record?.land_classification),tenancyDetails:nullableText(record?.tenancyDetails??record?.tenancy),
    cultivationDetails:nullableText(record?.cultivationDetails??record?.cultivation),mutationReferences:stringList(record?.mutationReferences??record?.mutations),
    recordDate:nullableText(record?.recordDate??record?.record_date),sourceUrl:nullableText(record?.sourceUrl)??fallbackSourceUrl
  };
}

const containsCaptcha=(text:string)=>/captcha|recaptcha|human verification|access denied|bot detection/i.test(text);

export async function retrieveRtc(input:RtcSearchInput, env:NodeJS.ProcessEnv=process.env):Promise<RtcRetrievalResult> {
  const mode=(env.RTC_PROVIDER_MODE||'disabled').toLowerCase();
  const sourceName=env.RTC_SOURCE_NAME||'Karnataka Bhoomi';
  const sourceUrl=env.RTC_SOURCE_URL||'https://landrecords.karnataka.gov.in/Service2/';
  if(mode==='disabled')return{status:'manual_required',sourceName,sourceUrl,errorCode:'provider_not_configured',message:'Automatic RTC retrieval is not configured. Open the official Bhoomi portal and import the downloaded RTC.'};
  if(mode==='fixture'){
    if(env.NODE_ENV!=='test'||!env.RTC_FIXTURE_PATH)return{status:'manual_required',sourceName,sourceUrl,errorCode:'authorization_required',message:'Fixture retrieval is restricted to automated tests.'};
    try{const payload=JSON.parse(await fs.readFile(env.RTC_FIXTURE_PATH,'utf8'));const record=normalizeRtcRecord(payload,sourceUrl);return{status:'completed',sourceName,sourceUrl,record,raw:payload};}
    catch{return{status:'failed',sourceName,sourceUrl,errorCode:'invalid_source_response',message:'The authorized RTC test fixture could not be read.'};}
  }
  if(mode!=='api'||!env.RTC_API_BASE_URL||!env.RTC_API_TOKEN)return{status:'manual_required',sourceName,sourceUrl,errorCode:'authorization_required',message:'Authorized RTC API credentials are required for automatic retrieval.'};
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),Number(env.RTC_REQUEST_TIMEOUT_MS||10000));
  try{
    const response=await fetch(env.RTC_API_BASE_URL,{method:'POST',headers:{Authorization:`Bearer ${env.RTC_API_TOKEN}`,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(input),signal:controller.signal});
    const text=await response.text();
    if(response.status===401||response.status===403)return{status:'manual_required',sourceName,sourceUrl,errorCode:'authorization_required',message:'The authorized RTC provider rejected the configured credentials.'};
    if(containsCaptcha(text))return{status:'manual_required',sourceName,sourceUrl,errorCode:'captcha_required',message:'The official source requires manual CAPTCHA or access verification.'};
    if(response.status===404)return{status:'empty',sourceName,sourceUrl,errorCode:'not_found',message:'No RTC record was returned for the supplied location and survey identity.'};
    if(!response.ok)return{status:'failed',sourceName,sourceUrl,errorCode:'source_unavailable',message:`The RTC source returned HTTP ${response.status}.`};
    let payload:any;try{payload=JSON.parse(text);}catch{return{status:'failed',sourceName,sourceUrl,errorCode:'invalid_source_response',message:'The RTC source returned an unreadable response.'};}
    if(payload?.captchaRequired)return{status:'manual_required',sourceName,sourceUrl,errorCode:'captcha_required',message:'The official source requires manual CAPTCHA completion.'};
    if(payload?.found===false)return{status:'empty',sourceName,sourceUrl,errorCode:'not_found',message:'No RTC record was returned for the supplied location and survey identity.'};
    return{status:'completed',sourceName,sourceUrl,record:normalizeRtcRecord(payload,sourceUrl),raw:payload};
  }catch(error){return(error as Error).name==='AbortError'?{status:'failed',sourceName,sourceUrl,errorCode:'timeout',message:'The RTC source did not respond before the configured timeout.'}:{status:'failed',sourceName,sourceUrl,errorCode:'source_unavailable',message:'The RTC source could not be reached.'};}
  finally{clearTimeout(timeout);}
}
