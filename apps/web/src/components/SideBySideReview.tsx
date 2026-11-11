import React, { useState, useEffect, useRef, useMemo } from 'react';
import { authFetch } from '../authFetch';
import { StructuredExtractionReview } from './StructuredExtractionReview';
import './owner-document-comparison.css';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Edit3,
  Save,
  ShieldCheck,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Layers,
  Building,
  User,
  MapPin,
  Calendar,
  Hash,
  Coins,
  Compass,
  FileCheck,
  Check,
  RefreshCw,
  Activity,
  Download,
} from 'lucide-react';
import type {
  ExtractedDocumentFields,
  ExtractedParty,
  FieldOverride,
  PropertyDoc,
  KarnatakaDocumentType,
} from '../types';

interface SideBySideReviewProps {
  propertyId: string;
  propertyIdentity: { name?:string; survey_number:string; subdivision:string; village:string; district:string; taluk?:string; hobli?:string; extent:string; extent_value?:number|null; extent_unit?:string; boundary_north:string; boundary_south:string; boundary_east:string; boundary_west:string };
  doc: PropertyDoc;
  onClose: () => void;
  onDocumentUpdated?: (updatedDoc: PropertyDoc) => void;
  readOnly?: boolean;
  currentRole?: string;
}

interface ActiveBox {
  fieldId: string;
  label: string;
  pageNumber: number;
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  confidence?: number;
  snippet?: string;
}

type ReviewTab = 'document' | 'extracted' | 'history' | 'verification' | 'audit';
type ComparisonSection = 'comparison' | 'missing' | 'findings';
type ComparisonFilter = 'all' | 'match' | 'mismatch' | 'missing' | 'needs_review';

function getVerificationIssues(fields: ExtractedDocumentFields | null): string[] {
  if (!fields) return ['Document extraction has not completed.'];
  const issues: string[] = [];
  const missing = (value: unknown) => !value || ['not recorded','not specified','none','unknown','—'].includes(String(value).trim().toLowerCase());
  const schedule = fields.propertySchedule;
  const conveyanceTypes = new Set(['sale_deed','gift_deed','partition_deed','release_deed','power_of_attorney']);
  if (missing(fields.documentNumber)) issues.push('Document / registration number');
  if (missing(schedule?.surveyNumber)) issues.push('Survey number');
  if (missing(schedule?.village)) issues.push('Village');
  if (!schedule?.extent?.normalizedSqFt || schedule.extent.normalizedSqFt <= 0) issues.push('Valid property extent');
  const boundaries = schedule?.boundaries;
  if (!boundaries || [boundaries.north,boundaries.south,boundaries.east,boundaries.west].some(missing)) issues.push('Four-side boundaries');
  if (conveyanceTypes.has(fields.documentType)) {
    if (!fields.parties?.length) issues.push('Parties and entities');
    if (missing(fields.executionDate)) issues.push('Execution date');
    if (missing(fields.registrationDate)) issues.push('Registration date');
  }
  const confidence = fields.fieldConfidence || {};
  if (['documentNumber','surveyNumber','extent','boundaries'].some(key => confidence[key] !== undefined && confidence[key] < 0.60)) issues.push('Low-confidence core fields');
  return issues;
}

export const SideBySideReview: React.FC<SideBySideReviewProps> = ({
  propertyId,
  propertyIdentity,
  doc,
  onClose,
  onDocumentUpdated,
  readOnly = false,
  currentRole = 'analyst',
}) => {
  const [fields, setFields] = useState<ExtractedDocumentFields | null>(
    doc.extracted_fields || null
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string>('');
  const [job, setJob] = useState<any>(null);
  const [ocrPages, setOcrPages] = useState<any[]>([]);
  const [ocrSavedAt, setOcrSavedAt] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [rawText, setRawText] = useState((doc as any).extracted_text || '');
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [documentLoadError, setDocumentLoadError] = useState<string>('');
  const [titleHistory, setTitleHistory] = useState<any[]>([]);
  const [documentHistory, setDocumentHistory] = useState<any[]>([]);
  const [reviewHistory, setReviewHistory] = useState<any[]>([]);
  const [fieldHistory, setFieldHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<ReviewTab>('extracted');
  const [comparisonSection, setComparisonSection] = useState<ComparisonSection>('comparison');
  const [comparisonFilter, setComparisonFilter] = useState<ComparisonFilter>('all');
  const [selectedComparisonField, setSelectedComparisonField] = useState<any>(null);
  const verificationIssues = useMemo(() => getVerificationIssues(fields), [fields]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authFetch(`/api/properties/${propertyId}/title-chain`).then(r => r.ok ? r.json() : null),
      authFetch(`/api/properties/${propertyId}`).then(r => r.ok ? r.json() : null),
      authFetch(`/api/properties/${propertyId}/documents/${doc.id}/extraction-history`).then(r => r.ok ? r.json() : null),
    ]).then(([chain, documents, history]) => {
      if (cancelled) return;
      setTitleHistory(chain?.events || []);
      setDocumentHistory((documents?.documents || []).map((item:any)=>({id:item.id,type:item.doc_type,status:item.review_status,filename:item.original_filename})));
      setReviewHistory(history?.reviewHistory || []);
      setFieldHistory(history?.fieldHistory || []);
    }).catch(()=>{});
    return () => { cancelled = true; };
  }, [propertyId, doc.id]);

  useEffect(() => {
    let cancelled = false;
    const refreshResult = async () => {
      try {
        const response = await authFetch(`/api/properties/${propertyId}/documents/${doc.id}/ocr-result`);
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled || !data.result) return;
        setOcrPages(Array.isArray(data.result.pages) ? data.result.pages : []);
        setOcrSavedAt(data.result.createdAt || null);
        setRawText(data.result.rawText || '');
        setFields(data.result.extractedFields || null);
      } catch { /* OCR results may not exist yet. */ }
    };
    void refreshResult();
    return () => { cancelled = true; };
  }, [propertyId, doc.id]);
  const mirrorRows = useMemo(() => {
    const clean=(value:unknown)=>String(value||'').normalize('NFKC').toLowerCase().replace(/guntas?/g,'gunta').replace(/[^\p{L}\p{N}]/gu,'');
    const absent=(value:unknown)=>!value||['notrecorded','notspecified','none','unknown','notentered','notidentified'].includes(clean(value));
    const differentScripts=(ownerValue:unknown,documentValue:unknown)=>{
      const owner=String(ownerValue||''),document=String(documentValue||'');
      const ownerLatin=/[A-Za-z]/.test(owner),documentLatin=/[A-Za-z]/.test(document);
      const ownerKannada=/[\u0c80-\u0cff]/.test(owner),documentKannada=/[\u0c80-\u0cff]/.test(document);
      return (ownerLatin&&documentKannada&&!documentLatin)||(documentLatin&&ownerKannada&&!ownerLatin);
    };
    const row=(label:string,ownerValue:unknown,documentValue:unknown,anchor?:any,path?:string,knownMatch?:boolean)=>{
      const equivalent=knownMatch??(clean(ownerValue)===clean(documentValue));
      const status=absent(documentValue)?'missing':absent(ownerValue)?'needs_review':equivalent?'match':knownMatch===undefined&&differentScripts(ownerValue,documentValue)?'needs_review':'mismatch';
      return {label,applicationValue:String(ownerValue||'Not recorded on Owner Page'),documentValue:String(documentValue||'Not extracted'),status,anchor,path};
    };
    const schedule=fields?.propertySchedule;
    const unitFactor:Record<string,number>={acre:43560,gunta:1089,guntas:1089,gutta:1089,guttha:1089,gts:1089,sq_ft:1,sq_m:10.7639104,cent:435.6,hectare:107639.104};
    const ownerExtentSqFt=Number(propertyIdentity.extent_value||0)*(unitFactor[String(propertyIdentity.extent_unit||'').toLowerCase()]||0);
    const deedExtentSqFt=Number(schedule?.extent?.normalizedSqFt||0);
    const extentKnownMatch=ownerExtentSqFt>0&&deedExtentSqFt>0?Math.abs(ownerExtentSqFt-deedExtentSqFt)/Math.max(ownerExtentSqFt,deedExtentSqFt)<=0.01:undefined;
    const verifiedTitle=[...titleHistory].reverse().find((event:any)=>event.status==='verified'&&event.toParties?.length);
    const currentOwners=(verifiedTitle?.toParties||[]).map((party:any)=>party.name).filter(Boolean).join(', ');
    const seller=fields?.parties?.filter(party=>['seller','executant'].includes(String(party.role).toLowerCase())).map(party=>party.name).filter(Boolean).join(', ');
    const buyer=fields?.parties?.filter(party=>['buyer','claimant','donee'].includes(String(party.role).toLowerCase())).map(party=>party.name).filter(Boolean).join(', ');
    const partyPath=(roles:string[])=>{const index=fields?.parties?.findIndex(party=>roles.includes(String(party.role).toLowerCase()))??-1;return index<0?undefined:`parties.${index}.name`;};
    const anchors=fields?.fieldAnchors||{};
    return [
      row('Survey number',propertyIdentity.survey_number,schedule?.surveyNumber,anchors.surveyNumber,'propertySchedule.surveyNumber'),
      row('Hissa / subdivision',propertyIdentity.subdivision&&propertyIdentity.subdivision!=='*'?propertyIdentity.subdivision:'',schedule?.subdivisionHissa,anchors.subdivisionHissa,'propertySchedule.subdivisionHissa'),
      row('Village',propertyIdentity.village,schedule?.village,anchors.village,'propertySchedule.village'),
      row('Hobli',propertyIdentity.hobli,schedule?.hobli,anchors.hobli,'propertySchedule.hobli'),
      row('Taluk',propertyIdentity.taluk,schedule?.taluk,anchors.taluk,'propertySchedule.taluk'),
      row('District',propertyIdentity.district,schedule?.district,anchors.district,'propertySchedule.district'),
      row('Extent',propertyIdentity.extent,schedule?.extent?.rawText,anchors.extent,'propertySchedule.extent.rawText',extentKnownMatch),
      row('Owner name',currentOwners,fields?.parties?.filter(party=>['owner','buyer','donee'].includes(String(party.role).toLowerCase())).map(party=>party.name).filter(Boolean).join(', '),fields?.parties?.find(party=>['owner','buyer','donee'].includes(String(party.role).toLowerCase()))?.evidenceAnchor,partyPath(['owner','buyer','donee'])),
      row('Seller name','',seller,fields?.parties?.find(party=>['seller','executant'].includes(String(party.role).toLowerCase()))?.evidenceAnchor,partyPath(['seller','executant'])),
      row('Buyer name','',buyer,fields?.parties?.find(party=>['buyer','claimant','donee'].includes(String(party.role).toLowerCase()))?.evidenceAnchor,partyPath(['buyer','claimant','donee'])),
      row('Registration number','',fields?.registrationNumber||fields?.documentNumber,anchors.registrationNumber||anchors.documentNumber,'registrationNumber'),
      row('Execution date','',fields?.executionDate,anchors.executionDate,'executionDate'),
      row('Registration date','',fields?.registrationDate,anchors.registrationDate,'registrationDate'),
      row('North boundary',propertyIdentity.boundary_north,schedule?.boundaries?.north,anchors['boundaries.north'],'propertySchedule.boundaries.north'),
      row('South boundary',propertyIdentity.boundary_south,schedule?.boundaries?.south,anchors['boundaries.south'],'propertySchedule.boundaries.south'),
      row('East boundary',propertyIdentity.boundary_east,schedule?.boundaries?.east,anchors['boundaries.east'],'propertySchedule.boundaries.east'),
      row('West boundary',propertyIdentity.boundary_west,schedule?.boundaries?.west,anchors['boundaries.west'],'propertySchedule.boundaries.west'),
    ];
  },[fields,propertyIdentity,titleHistory]);
  const comparisonMismatchRows=mirrorRows.filter(item=>item.status==='mismatch');
  const comparisonMissingRows=mirrorRows.filter(item=>item.status==='missing');
  const comparisonNeedsReviewOnlyRows=mirrorRows.filter(item=>item.status==='needs_review');
  const comparisonNeedsReviewRows=[...comparisonMissingRows,...comparisonNeedsReviewOnlyRows];
  const comparisonCounts={total:mirrorRows.length,matched:mirrorRows.filter(item=>item.status==='match').length,mismatched:comparisonMismatchRows.length,missing:comparisonMissingRows.length,needsReview:comparisonNeedsReviewOnlyRows.length};
  const filteredComparisonRows=mirrorRows.filter(item=>comparisonFilter==='all'||item.status===comparisonFilter);
  const openComparisonReview=(item:any)=>{setSelectedComparisonField(item);if(item.anchor?.pageNumber){setCurrentPage(Math.max(1,Number(item.anchor.pageNumber)));setFocusedFieldId(item.path||item.label);}};
  const exportComparison=()=>{
    const quote=(value:unknown)=>`"${String(value??'').replace(/"/g,'""')}"`;
    const csv=[['Field','Owner Page value','Uploaded document value','Status','Source page','Evidence snippet'],...mirrorRows.map(item=>[item.label,item.applicationValue,item.documentValue,item.status,item.anchor?.pageNumber||'',item.anchor?.extractedSnippet||''])].map(row=>row.map(quote).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`owner-document-comparison-${doc.id}.csv`;link.click();URL.revokeObjectURL(url);
  };
  const criticalComparisonLabels=['Survey number','Hissa / subdivision','Village','Hobli','Taluk','District','Extent','Owner name','Seller name','Buyer name','North boundary','South boundary','East boundary','West boundary'];
  const comparisonBlocked=comparisonMismatchRows.length>0||comparisonNeedsReviewRows.some(item=>criticalComparisonLabels.includes(item.label)&&item.applicationValue!=='Not recorded on Owner Page');
  const identityAssessment=useMemo(()=>{
    if(!fields)return{status:'unknown' as const,details:['OCR extraction has not completed.']};
    const critical=mirrorRows.filter(item=>criticalComparisonLabels.includes(item.label));
    const mismatches=critical.filter(item=>item.status==='mismatch');
    if(mismatches.length)return{status:'mismatch' as const,details:mismatches.map(item=>`${item.label}: Owner Page ${item.applicationValue}; document ${item.documentValue}`)};
    const needsReview=critical.filter(item=>item.status==='needs_review'||(item.status==='missing'&&item.applicationValue!=='Not recorded on Owner Page'));
    if(needsReview.length)return{status:'unknown' as const,details:needsReview.map(item=>`${item.label} needs review`)};
    return{status:'match' as const,details:['No critical mismatch found in fields with values on both sides.']};
  },[fields,mirrorRows]);

  // Override dialog state
  const [overrideModal, setOverrideModal] = useState<{
    isOpen: boolean;
    fieldPath: string;
    fieldLabel: string;
    previousValue: any;
    newValue: string;
    rationale: string;
  }>({
    isOpen: false,
    fieldPath: '',
    fieldLabel: '',
    previousValue: null,
    newValue: '',
    rationale: '',
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Keep the shared backend job status visible while OCR runs.
  useEffect(() => {
    if (['consultant','data_steward','viewer'].includes(currentRole)) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await authFetch(`/api/properties/${propertyId}/documents/${doc.id}/jobs`);
        if (!response.ok) return;
        const data = await response.json();
        const latest=data.items?.[0] || null;
        if (!cancelled) setJob(latest);
        if(!cancelled && latest?.status==='completed'){
          const ocrResponse=await authFetch(`/api/properties/${propertyId}/documents/${doc.id}/ocr-result`);
          if(ocrResponse.ok){const ocrData=await ocrResponse.json();if(ocrData.result){setOcrPages(Array.isArray(ocrData.result.pages)?ocrData.result.pages:[]);setOcrSavedAt(ocrData.result.createdAt||null);setRawText(ocrData.result.rawText||'');setFields(ocrData.result.extractedFields||null);}}
          const propertyResponse=await authFetch(`/api/properties/${propertyId}`);
          if(propertyResponse.ok){const propertyData=await propertyResponse.json();const fresh=(propertyData.documents||[]).find((item:any)=>item.id===doc.id);if(fresh){setFields(fresh.extracted_fields||null);setRawText(fresh.extracted_text||'');if(onDocumentUpdated)onDocumentUpdated(fresh);}}
        }
      } catch { /* polling is best effort; explicit actions report their own errors */ }
    };
    void refresh();
    const timer = window.setInterval(refresh, 2500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [doc.id, propertyId, currentRole]);

  // OCR starts through the local Tesseract worker queue. Original files remain immutable.
  useEffect(() => {
    setFields(doc.extracted_fields || null);
    setRawText((doc as any).extracted_text || '');
  }, [doc.id, readOnly]);

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    setDocumentLoadError('');
    authFetch(`/api/properties/${propertyId}/documents/${doc.id}/file`)
      .then(async response => {
        if (!response.ok) throw new Error('The original document could not be loaded.');
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setDocumentUrl(objectUrl);
      })
      .catch(error => {
        if (!cancelled) setDocumentLoadError(error instanceof Error ? error.message : 'The original document could not be loaded.');
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.id, propertyId]);

  const handleTriggerExtraction = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(`/api/properties/${propertyId}/documents/${doc.id}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to extract document metadata');
      }
      const data = await res.json();
      setJob({ id: data.jobId, status: data.status || 'queued', processing_stage: 'queued', progress: 0 });
      setSuccessNotice('OCR job queued with the local Tesseract service.');
      if (onDocumentUpdated) {
        onDocumentUpdated({ ...doc, processing_status: data.status || 'queued' });
      }
    } catch (err: any) {
      setError(err.message || 'Error executing document extraction');
    } finally {
      setBusy(false);
    }
  };

  const handleRebuildFromSavedOcr = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(`/api/properties/${propertyId}/documents/${doc.id}/rebuild-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not rebuild fields from saved OCR text.');
      setFields(data.extractedFields);
      setJob((current:any) => current || { status:'completed', progress:100 });
      setSuccessNotice('Fields rebuilt from preserved OCR text. Tesseract was not rerun; verify every value against the source.');
      if (onDocumentUpdated) onDocumentUpdated({ ...doc, extracted_fields:data.extractedFields, extracted_text:rawText, processing_status:'manual_review', review_status:'pending' } as PropertyDoc);
    } catch (err:any) {
      setError(err.message || 'Could not rebuild fields from saved OCR text.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (identityAssessment.status !== 'match'||comparisonBlocked) {
      setError(identityAssessment.status === 'mismatch'
        ? `Automatic property association is blocked: ${identityAssessment.details.join('; ')}. Route this deed for analyst review against the correct case.`
        : comparisonMismatchRows.length?`Resolve Owner Page mismatches before review: ${comparisonMismatchRows.map(item=>item.label).join(', ')}.`:'Property identity is incomplete; confirm the Owner Page comparison before submitting this document for review.');
      return;
    }
    const comment=window.prompt('Add a note for the Lead Advocate:', 'Extraction complete; please review the highlighted evidence.');
    if(comment===null)return;
    setBusy(true); setError('');
    try {
      const res = await authFetch(`/api/properties/${propertyId}/documents/${doc.id}/submit-review`, { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({comment}) });
      const data = await res.json(); if(!res.ok) throw new Error(data.error||'Could not submit extraction.');
      setSuccessNotice('Extraction submitted to the Lead Advocate for review.');
      if(onDocumentUpdated) onDocumentUpdated({...doc,review_status:data.reviewStatus} as any);
    } catch(err:any){setError(err.message||'Could not submit extraction.');} finally{setBusy(false);}
  };

  const handleReviewDecision = async (decision:'approve'|'reject'|'dispute') => {
    const rationale = window.prompt(`Reason for ${decision}ing this extraction:`)?.trim();
    if(!rationale) return;
    setBusy(true);setError('');
    try {
      const res=await authFetch(`/api/properties/${propertyId}/documents/${doc.id}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,rationale})});
      const data=await res.json();if(!res.ok)throw new Error(data.error||'Review decision failed.');
      setFields(current=>current?{...current,reviewState:{...(current.reviewState||{overrides:{}}),isVerified:decision==='approve'}}:current);
      setSuccessNotice(`Evidence ${data.reviewStatus}.`);if(onDocumentUpdated)onDocumentUpdated({...doc,review_status:data.reviewStatus} as any);
    }catch(err:any){setError(err.message||'Review decision failed.');}finally{setBusy(false);}
  };

  // Compile all bounding boxes from extracted fields
  const getAllBoundingBoxes = (): ActiveBox[] => {
    if (!fields) return [];
    const boxes: ActiveBox[] = [];

    const documentNumberAnchor = fields.fieldAnchors?.documentNumber;
    if (documentNumberAnchor?.boundingBox) boxes.push({
      fieldId: 'documentNumber',
      label: 'Doc Number',
      pageNumber: documentNumberAnchor.pageNumber,
      ...documentNumberAnchor.boundingBox,
      confidence: documentNumberAnchor.confidenceScore,
      snippet: documentNumberAnchor.extractedSnippet,
    });

    // Parties
    fields.parties.forEach((party, idx) => {
      const anchor = party.evidenceAnchor;
      if (anchor?.boundingBox) boxes.push({
        fieldId: `party_${idx}`,
        label: `${prettyRole(party.role)}: ${party.name}`,
        pageNumber: anchor.pageNumber,
        ...anchor.boundingBox,
        confidence: anchor.confidenceScore,
        snippet: anchor.extractedSnippet,
      });
    });

    // Survey Number
    if (fields.propertySchedule) {
      const sched = fields.propertySchedule;
      const anchor = sched.evidenceAnchor;
      if (anchor?.boundingBox) boxes.push({
        fieldId: 'surveyNumber',
        label: `Survey No. ${sched.surveyNumber}`,
        pageNumber: anchor.pageNumber,
        ...anchor.boundingBox,
        confidence: anchor.confidenceScore,
        snippet: anchor.extractedSnippet,
      });
    }

    // Consideration
    if (fields.consideration) {
      const conAnchor = fields.consideration.evidenceAnchor;
      if (conAnchor?.boundingBox) boxes.push({
        fieldId: 'consideration',
        label: `Consideration: ₹ ${fields.consideration.amount.toLocaleString('en-IN')}`,
        pageNumber: conAnchor.pageNumber,
        ...conAnchor.boundingBox,
        confidence: conAnchor.confidenceScore,
        snippet: conAnchor.extractedSnippet,
      });
    }

    return boxes;
  };

  const allBoxes = getAllBoundingBoxes();

  // Dynamically calculate total pages from all bounding box anchors and explicit page count
  const totalPages = useMemo(() => {
    if (!allBoxes.length) return 1;
    const pageNumbers = allBoxes.map((b) => b.pageNumber || 1);
    const maxAnchorPage = Math.max(1, ...pageNumbers);
    const explicitPageCount = (fields as any)?.pageCount || (doc as any)?.page_count || 1;
    return Math.max(1, maxAnchorPage, explicitPageCount);
  }, [allBoxes, fields, doc]);

  // Keep currentPage within valid bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const pageBoxes = allBoxes.filter((b) => b.pageNumber === currentPage);

  // Confidence color helper
  const getConfidenceTone = (conf: number): { color: string; bg: string; label: string } => {
    if (conf >= 0.85) return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: 'High' };
    if (conf >= 0.60) return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', label: 'Medium' };
    return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', label: 'Low / Review' };
  };

  // Focus two-way binding: when clicking a bounding box
  const handleBoxClick = (fieldId: string) => {
    setFocusedFieldId(fieldId);
    const targetElement = document.getElementById(`form-field-${fieldId}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetElement.classList.add('flash-highlight');
      setTimeout(() => targetElement.classList.remove('flash-highlight'), 1200);
    }
  };

  // Focus two-way binding: when clicking a form field
  const handleFieldFocus = (fieldId: string) => {
    setFocusedFieldId(fieldId);
    const box = allBoxes.find((b) => b.fieldId === fieldId);
    if (box) {
      if (box.pageNumber !== currentPage) {
        setCurrentPage(box.pageNumber);
      }
      const boxElem = document.getElementById(`bbox-${fieldId}`);
      if (boxElem) {
        boxElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Open override modal
  const openOverrideDialog = (fieldPath: string, fieldLabel: string, previousValue: any) => {
    if (readOnly) return;
    setOverrideModal({
      isOpen: true,
      fieldPath,
      fieldLabel,
      previousValue,
      newValue: typeof previousValue === 'object' ? JSON.stringify(previousValue) : String(previousValue ?? ''),
      rationale: '',
    });
  };

  // Save reviewer override
  const handleSaveOverride = async () => {
    if (!overrideModal.rationale.trim()) {
      alert('A review rationale is mandatory when overriding extracted document fields.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      let parsedNewValue: any = overrideModal.newValue;
      if (overrideModal.fieldPath.endsWith('amount') || overrideModal.fieldPath.endsWith('SqFt')) {
        parsedNewValue = parseFloat(overrideModal.newValue) || overrideModal.newValue;
      }

      const res = await authFetch(`/api/properties/${propertyId}/documents/${doc.id}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldPath: overrideModal.fieldPath,
          newValue: parsedNewValue,
          rationale: overrideModal.rationale.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save field override');
      }

      const data = await res.json();
      setFields(data.extractedFields);
      setSuccessNotice(`Field "${overrideModal.fieldLabel}" corrected. The document still requires explicit reviewer verification.`);
      setOverrideModal({ isOpen: false, fieldPath: '', fieldLabel: '', previousValue: null, newValue: '', rationale: '' });
      if (onDocumentUpdated) {
        onDocumentUpdated(data.document);
      }
    } catch (err: any) {
      setError(err.message || 'Error saving field override');
    } finally {
      setBusy(false);
    }
  };

  const handleFieldReview = async (fieldPath: string, reviewAction: 'approve'|'reject'|'not_found'|'comment', rationale: string) => {
    try {
      const response = await authFetch(`/api/properties/${propertyId}/documents/${doc.id}/fields`, {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({fieldPath,reviewAction,rationale}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save field review.');
      setFields(data.extractedFields);
      setSuccessNotice(`Field review saved: ${reviewAction.replace('_',' ')}.`);
      if (onDocumentUpdated) onDocumentUpdated(data.document);
    } catch (error) {
      setError((error as Error).message);
    }
  };

  // Quick verify toggle
  const handleToggleVerification = async () => {
    if (!fields?.reviewState?.isVerified && (verificationIssues.length||identityAssessment.status!=='match'||comparisonBlocked)) {
      setError(comparisonMismatchRows.length?`Resolve Owner Page mismatches before verification: ${comparisonMismatchRows.map(item=>item.label).join(', ')}.`:`Review required before verification: ${[...verificationIssues,...comparisonNeedsReviewRows.map(item=>item.label)].join(', ')}.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const isVerified = !fields?.reviewState?.isVerified;
      const res = await authFetch(`/api/properties/${propertyId}/documents/${doc.id}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isVerified,
          rationale: isVerified ? 'Reviewer attested extraction accuracy.' : 'Verification revoked for further audit.',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update verification status');
      }
      const data = await res.json();
      setFields(data.extractedFields);
      setSuccessNotice(isVerified ? 'Document verified by legal reviewer.' : 'Document returned to unverified status.');
      if (onDocumentUpdated) {
        onDocumentUpdated(data.document);
      }
    } catch (err: any) {
      setError(err.message || 'Error updating verification');
    } finally {
      setBusy(false);
    }
  };

  const isImage = doc.mime_type.startsWith('image/');
  const isPdf = doc.mime_type === 'application/pdf';
  const jobStatusDescription=job?.status==='completed'?'OCR complete · extracted values await review':job?.status==='failed'?'OCR stopped · administrator action may be required':job?.status==='retry_wait'?'OCR retry scheduled':job?.status==='queued'?'Waiting for OCR worker':job?.status==='processing'?({loading_document:'Loading source document',tesseract_processing:'Running Kannada / English Tesseract OCR',persisting_results:'Saving OCR and extracted fields'} as Record<string,string>)[job.processing_stage]||'Processing OCR':'Preparing OCR';

  return (
    <div className={`side-by-side-overlay ${readOnly ? 'read-only' : ''}`}>
      {/* Top Navbar */}
      <header className="review-header">
        <div className="review-header-left">
          <button className="icon-btn back-btn" onClick={onClose} title="Back to documents">
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="review-title-row">
              <h2>{doc.original_filename}</h2>
              <span className={`doc-type-pill ${fields?.documentType || 'other'}`}>
                {prettyDocType(fields?.documentType || doc.doc_type || 'other')}
              </span>
              {fields?.reviewState?.isVerified ? (
                <span className="verified-badge">
                  <ShieldCheck size={14} /> Verified
                </span>
              ) : (
                <span className="unverified-badge">
                  <AlertTriangle size={14} /> Pending Review
                </span>
              )}
            </div>
            <div className="review-submeta">
              <span>Case: {propertyIdentity.village} · {propertyIdentity.taluk}, {propertyIdentity.district}</span>
              <span>•</span>
              <span>Survey {propertyIdentity.survey_number}{propertyIdentity.subdivision&&propertyIdentity.subdivision!=='*'?`/${propertyIdentity.subdivision}`:''} · {propertyIdentity.extent}</span>
              <span>•</span>
              <span>SHA-256: <code className="hash-code">{doc.sha256 ? `${doc.sha256.slice(0, 8)}...${doc.sha256.slice(-8)}` : 'Recorded'}</code></span>
              <span>•</span>
              <span>{formatBytes(doc.size_bytes)}</span>
              <span>•</span>
              <span>{doc.mime_type}</span>
            </div>
          </div>
        </div>

        <div className="review-header-actions">
          {fields && (
            <div className="confidence-pill" style={{ borderColor: getConfidenceTone(fields.overallConfidence).color }}>
              <span className="conf-dot" style={{ backgroundColor: getConfidenceTone(fields.overallConfidence).color }} />
              <strong>{Math.round(fields.overallConfidence * 100)}%</strong> Confidence
            </div>
          )}

          {(!readOnly&&['owner','admin','lawyer','analyst','operations'].includes(currentRole))&&<button className="secondary-btn" onClick={handleTriggerExtraction} disabled={busy || ['queued','processing'].includes(job?.status)}>
            <RefreshCw size={15} className={busy || job?.status==='processing' ? 'spin' : ''} /> {job?.status==='failed'||job?.status==='retry_wait'?'Retry OCR':'Process OCR'}
          </button>}
          {!readOnly&&currentRole==='analyst'&&Boolean(rawText)&&<button className="secondary-btn" onClick={handleRebuildFromSavedOcr} disabled={busy} title="Re-extract candidate fields from the saved OCR text without rerunning Tesseract">Rebuild fields from saved OCR</button>}
          {!readOnly&&currentRole==='analyst'&&<button className="primary-btn" onClick={handleSubmitForReview} disabled={busy||!fields||Boolean(job&&job.status!=='completed')||comparisonBlocked||identityAssessment.status!=='match'} title={comparisonBlocked?'Resolve critical comparison issues before submitting.':''}>Submit for review</button>}
          {currentRole==='lawyer'&&doc.review_status==='submitted'&&<><button className="secondary-btn" onClick={()=>void handleReviewDecision('dispute')} disabled={busy}>Dispute</button><button className="danger-btn" onClick={()=>void handleReviewDecision('reject')} disabled={busy}>Reject</button><button className="primary-btn" onClick={()=>void handleReviewDecision('approve')} disabled={busy}>Approve evidence</button></>}

          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
      </header>
      {job&&<div className={`review-alert ocr-job-summary ${job.status==='failed'?'alert-error':job.status==='retry_wait'?'alert-warning':job.status==='completed'?'alert-success':''}`}><Activity size={15}/><span><strong>{jobStatusDescription}</strong> · {job.progress||0}%{job.pages_processed?` · ${job.pages_processed} page(s)`:''}{job.attempts!=null?` · attempt ${job.attempts}/${job.max_attempts}`:''}{job.updated_at?` · updated ${new Date(job.updated_at).toLocaleString()}`:''}{job.error_message?` · ${job.error_message}`:''}</span></div>}
      <nav className="review-tabs" aria-label="Document review sections">{([['document','Document View'],['extracted','Extracted Information'],['verification','Property Comparison'],['history','Transaction History'],['audit','Audit Trail']] as [ReviewTab,string][]).map(([id,label])=><button key={id} className={activeTab===id?'active':''} onClick={()=>setActiveTab(id)}>{label}</button>)}<button className="ocr-toggle" onClick={()=>setShowRawText(v=>!v)}>{showRawText?'Hide':'Show'} Kannada OCR</button></nav>
      {showRawText&&<><pre className="review-raw-text">{redactSensitiveOcr(rawText)||'No OCR text has been saved yet.'}</pre><p className="ocr-preservation-note">Sensitive identifiers are masked in this view; the original OCR record remains preserved.</p></>}
      {ocrPages.length>0&&<section className="ocr-page-results"><h3>Page OCR results {ocrSavedAt&&<small>Saved {new Date(ocrSavedAt).toLocaleString()}</small>}</h3>{ocrPages.map((page:any)=><article key={page.pageNumber}><header><strong>Page {page.pageNumber}</strong><span>{Math.round(Number(page.confidence||0)*100)}% confidence · {page.tokenCount||0} tokens</span></header><pre>{redactSensitiveOcr(page.text)||'No text detected on this page.'}</pre></article>)}</section>}

      {/* Notifications */}
      {error && (
        <div className="review-alert alert-error">
          <AlertTriangle size={16} /> <span>{error}</span>
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}
      {!fields?.reviewState?.isVerified&&verificationIssues.length>0&&<div className="review-alert alert-warning"><AlertTriangle size={15}/><span><strong>Verification blocked.</strong> Review or correct: {verificationIssues.join(', ')}.</span></div>}
      {fields?.extractionMetadata?.status==='manual_review'&&<div className="review-alert alert-warning"><AlertTriangle size={15}/><span><strong>Manual evidence review required.</strong> {fields.extractionMetadata.message||'Automatic extraction did not produce verified source facts.'}</span></div>}
      <div className={`review-alert identity-assessment comparison-summary ${comparisonMismatchRows.length?'mismatch':comparisonBlocked?'unknown':'match'}`}><MapPin size={16}/><span><strong>{comparisonMismatchRows.length?`${comparisonMismatchRows.length} mismatch${comparisonMismatchRows.length===1?'':'es'} need resolution`:comparisonBlocked?'Critical fields need review':'No critical mismatches found'}</strong><small>{mirrorRows.filter(item=>item.status==='match').length} match · {comparisonMismatchRows.length} mismatch · {comparisonNeedsReviewRows.length} missing or needs review</small></span><button className="comparison-jump" onClick={()=>setActiveTab('verification')}>Review comparison</button></div>
      {successNotice && (
        <div className="review-alert alert-success">
          <Check size={16} /> <span>{successNotice}</span>
          <button onClick={() => setSuccessNotice('')}><X size={14} /></button>
        </div>
      )}

      {/* 50/50 Dual-Viewport Body */}
      <div className={`review-body ${activeTab==='document'?'tab-document':activeTab==='extracted'?'tab-extracted':activeTab==='history'?'tab-history':activeTab==='verification'?'tab-verification':'tab-audit'}`}>
        {/* LEFT PANE: Document Viewer Canvas with Bounding Boxes */}
          <div className={`review-pane left-pane ${activeTab==='document'?'document-focus':'visible-pane'}`} ref={canvasRef}>
          {/* Canvas Toolbar */}
          <div className="canvas-toolbar">
            <div className="page-nav">
              <button
                className="icon-btn-small"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                title="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="page-indicator">Page {currentPage} of {totalPages}</span>
              <button
                className="icon-btn-small"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                title="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="zoom-controls">
              <button className="icon-btn-small" onClick={() => setZoom(Math.max(0.6, zoom - 0.15))}>
                <ZoomOut size={16} />
              </button>
              <span className="zoom-label">{Math.round(zoom * 100)}%</span>
              <button className="icon-btn-small" onClick={() => setZoom(Math.min(2.0, zoom + 0.15))}>
                <ZoomIn size={16} />
              </button>
              <button className="icon-btn-small" onClick={() => setZoom(1.0)} title="Reset zoom">
                <RotateCcw size={16} />
              </button>
            </div>

            <label className="toggle-boxes-label">
              <input
                type="checkbox"
                checked={showBoxes}
                onChange={(e) => setShowBoxes(e.target.checked)}
              />
              <Layers size={14} /> Show Anchors ({pageBoxes.length})
            </label>

            <div className="legend-strip">
              <span title=">= 85% Confidence"><i style={{ backgroundColor: '#10b981' }} /> ≥85%</span>
              <span title="60% - 84% Confidence"><i style={{ backgroundColor: '#f59e0b' }} /> 60-84%</span>
              <span title="< 60% Confidence"><i style={{ backgroundColor: '#ef4444' }} /> &lt;60%</span>
            </div>
          </div>

          {/* Document Canvas Frame */}
          <div className="document-canvas-container">
            <div
              className="document-canvas"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
              }}
            >
              {/* Document Image Background if available */}
              {documentLoadError ? (
                <div className="document-load-state"><AlertTriangle size={24}/><strong>Original document unavailable</strong><span>{documentLoadError}</span></div>
              ) : !documentUrl ? (
                <div className="document-load-state"><RefreshCw className="spin" size={24}/><strong>Loading original document…</strong></div>
              ) : isImage ? (
                <img
                  src={documentUrl}
                  alt={doc.original_filename}
                  className="document-image-bg"
                />
              ) : isPdf ? (
                <iframe title={`Original document ${doc.original_filename}`} src={`${documentUrl}#page=${currentPage}&toolbar=0&navpanes=0`} className="document-pdf-frame" />
              ) : (
                <div className="text-canvas-mock">
                  <div className="mock-content-text">{doc.original_filename}</div>
                </div>
              )}

              {/* Overlaid Bounding Boxes */}
              {showBoxes &&
                pageBoxes.map((box) => {
                  const isFocused = focusedFieldId === box.fieldId;
                  const tone = getConfidenceTone(box.confidence ?? 0);
                  const confidenceLabel = box.confidence === undefined ? 'OCR confidence unavailable' : `${Math.round(box.confidence * 100)}% OCR confidence`;
                  return (
                    <div
                      key={box.fieldId}
                      id={`bbox-${box.fieldId}`}
                      className={`evidence-box ${isFocused ? 'focused' : ''}`}
                      style={{
                        top: `${box.ymin * 100}%`,
                        left: `${box.xmin * 100}%`,
                        width: `${(box.xmax - box.xmin) * 100}%`,
                        height: `${(box.ymax - box.ymin) * 100}%`,
                        borderColor: tone.color,
                        backgroundColor: isFocused ? 'rgba(59, 130, 246, 0.22)' : tone.bg,
                      }}
                      onClick={() => handleBoxClick(box.fieldId)}
                      title={`${box.label} (${confidenceLabel})`}
                    >
                      <span className="box-badge" style={{ backgroundColor: tone.color }}>
                        {box.label.slice(0, 24)} • {box.confidence === undefined ? 'N/A' : `${Math.round(box.confidence * 100)}%`}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Structured Inspection Form */}
        <div className={`review-pane right-pane ${activeTab==='document'?'document-summary':'visible-pane'}`} ref={formRef}>
          {activeTab==='extracted'&&<div className="form-header">
            <h3>Structured Document Evidence</h3>
            <p>Check each extracted value against its source page. Corrections are audited.</p>
            <button className="secondary-btn compare-owner-page" onClick={()=>setActiveTab('verification')}>Compare with Owner Page <ChevronRight size={14}/></button>
          </div>}

          {activeTab==='document'&&<section className="review-section document-summary-card"><div className="section-title"><FileCheck size={16}/><span>Document summary</span></div><p><strong>{prettyDocType(fields?.documentType||doc.doc_type||'other')}</strong></p><p>Review the source PDF on the left. {fields?.documentNumber?`Registry reference ${fields.documentNumber}.`:'Registry reference not identified.'}</p><p>Case parcel association is {identityAssessment.status==='mismatch'?'blocked pending analyst review':identityAssessment.status==='match'?'consistent with extracted village and survey':'unconfirmed'}.</p><button className="secondary-btn" onClick={()=>setActiveTab('extracted')}>Open extracted information</button></section>}

          {activeTab === 'history' && <section className="review-section transaction-analytics">
            <div className="section-title"><Activity size={16}/><span>Ownership / Transaction History</span></div>
            <div className="analytics-metrics"><div><strong>{titleHistory.length}</strong><span>Case title-chain events (recorded transfers)</span></div><div><strong>{new Set(documentHistory.map((item:any)=>item.id)).size}</strong><span>Uploaded documents (separate from transfers)</span></div><div><strong>{fields?.ownershipEvents?.length||0}</strong><span>Ownership events mentioned in this deed</span></div><div><strong>Unknown</strong><span>Unproduced historical record count</span></div></div>
            {!titleHistory.length&&!fields?.ownershipEvents?.length ? <p className="muted-text">No ownership events are recorded for this case or identified in this deed. A deed document alone is not counted as a completed transfer until the case title chain records that event.</p> : <div className="history-timeline">{titleHistory.map((event:any)=><div className="history-event" key={event.id}><span>{event.eventDate || 'Date not recorded'}</span><strong>{String(event.deedType || 'Ownership event').replace(/_/g,' ')}</strong><small>{(event.fromParties||[]).map((p:any)=>p.name).join(', ') || 'Prior owner not identified'} → {(event.toParties||[]).map((p:any)=>p.name).join(', ') || 'Successor not identified'} · Registered title-chain event · {event.status}</small></div>)}{fields?.ownershipEvents?.map((event:any,index:number)=><div className="history-event mentioned" key={`mentioned-${index}`}><span>{event.eventDate||'Date not specified'}</span><strong>{event.eventType}</strong><small>{event.from||'From not identified'} → {event.to||'To not identified'} · {event.reference||'No reference'} · Mentioned in deed, not independently verified</small><EvidenceLink anchor={event.evidenceAnchor} onOpen={setCurrentPage}/></div>)}</div>}
          </section>}

          {activeTab==='verification'&&<section className="owner-comparison-workspace">
            <div className="oc-title"><div><p>PROPERTY VERIFICATION</p><h2>Owner Page vs Document</h2><span>Compare recorded property facts against values extracted from this uploaded document.</span></div><strong className={`oc-overall ${comparisonBlocked?'blocked':comparisonCounts.needsReview||comparisonCounts.missing?'review':'clear'}`}>{!fields?'OCR pending':comparisonBlocked?'Blocked':comparisonCounts.needsReview||comparisonCounts.missing?'Review required':'No critical mismatch'}</strong></div>
            <div className="oc-summary" aria-label="Verification summary">
              {[['Total fields',comparisonCounts.total,'total'],['Matched',comparisonCounts.matched,'match'],['Mismatched',comparisonCounts.mismatched,'mismatch'],['Missing',comparisonCounts.missing,'missing'],['Needs review',comparisonCounts.needsReview,'needs_review']].map(([label,count,key]:any)=><div className={`oc-stat ${key}`} key={key}><span>{label}</span><strong>{count}</strong></div>)}
            </div>
            <nav className="oc-tabs" aria-label="Comparison sections">{([['comparison','Field Comparison'],['missing','Missing Information'],['findings','Findings & Recommendations']] as [ComparisonSection,string][]).map(([key,label])=><button key={key} className={comparisonSection===key?'active':''} onClick={()=>setComparisonSection(key)}>{label}{key==='missing'&&<small>{comparisonCounts.missing}</small>}</button>)}</nav>
            {comparisonSection==='comparison'&&<>
              <div className="oc-filter-row"><span>Verification status</span>{([['all','All',comparisonCounts.total],['match','Match',comparisonCounts.matched],['mismatch','Mismatch',comparisonCounts.mismatched],['missing','Missing',comparisonCounts.missing],['needs_review','Needs review',comparisonCounts.needsReview]] as [ComparisonFilter,string,number][]).map(([key,label,count])=><button key={key} className={comparisonFilter===key?'active':''} onClick={()=>setComparisonFilter(key)}>{label}<b>{count}</b></button>)}</div>
              <div className="oc-table-scroll"><table className="oc-table"><thead><tr><th>Field name</th><th>Existing Owner Page value</th><th>Uploaded document value</th><th>Status</th><th>Review</th></tr></thead><tbody>{filteredComparisonRows.map(item=><tr key={item.label} className={`oc-row-${item.status}`}><th scope="row">{item.label}</th><td>{item.applicationValue}</td><td><span>{item.documentValue}</span>{item.anchor&&<small className="oc-evidence-line">Page {item.anchor.pageNumber}{item.anchor.extractedSnippet?` · “${item.anchor.extractedSnippet}”`:''}</small>}</td><td><span className={`oc-status ${item.status}`}>{item.status==='needs_review'?'Needs review':item.status==='match'?'Match':item.status==='mismatch'?'Mismatch':'Missing'}</span></td><td><button className="oc-review-button" onClick={()=>openComparisonReview(item)}>Review</button></td></tr>)}{!filteredComparisonRows.length&&<tr><td colSpan={5} className="oc-empty">No fields in this status.</td></tr>}</tbody></table></div>
            </>}
            {comparisonSection==='missing'&&<div className="oc-missing-list">{comparisonMissingRows.length?comparisonMissingRows.map(item=><article key={item.label}><div><strong>{item.label}</strong><span>Owner Page: {item.applicationValue} · Uploaded document: Not extracted</span></div><button className="oc-review-button" onClick={()=>openComparisonReview(item)}>Review source</button></article>):<p className="oc-empty">No missing OCR values in the current comparison.</p>}<small>Missing OCR values remain Missing. They are not treated as mismatches.</small></div>}
            {comparisonSection==='findings'&&<div className="oc-findings">{comparisonMismatchRows.map(item=><article className="mismatch" key={item.label}><strong>{item.label}: values differ</strong><p>Owner Page: {item.applicationValue}. Uploaded document: {item.documentValue}.</p><button className="oc-review-button" onClick={()=>openComparisonReview(item)}>Review evidence</button></article>)}{comparisonNeedsReviewOnlyRows.map(item=><article className="review" key={item.label}><strong>{item.label}: comparison needs review</strong><p>{item.applicationValue==='Not recorded on Owner Page'?'No Owner Page baseline is recorded for this field.':'The values cannot be safely compared from the available text or evidence.'}</p><button className="oc-review-button" onClick={()=>openComparisonReview(item)}>Review evidence</button></article>)}{comparisonMissingRows.map(item=><article className="missing" key={item.label}><strong>{item.label}: not extracted</strong><p>Check the original document page. No mismatch is inferred from an absent OCR value.</p><button className="oc-review-button" onClick={()=>openComparisonReview(item)}>Review evidence</button></article>)}{!comparisonMismatchRows.length&&!comparisonNeedsReviewRows.length&&<p className="oc-empty">No comparison findings are currently recorded.</p>}</div>}
            <p className="oc-integrity-note">Values come from the property record and saved OCR extraction. OCR never updates Owner Page data. Corrections to extracted fields are recorded in the reviewer audit history.</p>
          </section>}
          {selectedComparisonField&&activeTab==='verification'&&<div className="oc-detail-backdrop" role="presentation" onClick={()=>setSelectedComparisonField(null)}><aside className="oc-detail-panel" role="dialog" aria-modal="true" aria-label={`${selectedComparisonField.label} evidence review`} onClick={event=>event.stopPropagation()}><header><div><small>FIELD EVIDENCE REVIEW</small><h3>{selectedComparisonField.label}</h3></div><button aria-label="Close field review" onClick={()=>setSelectedComparisonField(null)}><X size={18}/></button></header><span className={`oc-status ${selectedComparisonField.status}`}>{selectedComparisonField.status==='needs_review'?'Needs review':selectedComparisonField.status==='missing'?'Missing':selectedComparisonField.status==='mismatch'?'Mismatch':'Match'}</span><dl><div><dt>Existing Owner Page value</dt><dd>{selectedComparisonField.applicationValue}</dd></div><div><dt>Uploaded document value</dt><dd>{selectedComparisonField.documentValue}</dd></div></dl><div className="oc-source-evidence"><strong>Original document evidence</strong>{selectedComparisonField.anchor?<><span>Page {selectedComparisonField.anchor.pageNumber}{selectedComparisonField.anchor.confidenceScore!=null?` · ${Math.round(selectedComparisonField.anchor.confidenceScore*100)}% OCR confidence`:''}</span><blockquote>{selectedComparisonField.anchor.extractedSnippet||'No text snippet was saved for this field.'}</blockquote><small>{selectedComparisonField.anchor.boundingBox?`Evidence region: x ${Math.round(selectedComparisonField.anchor.boundingBox.xmin*100)}–${Math.round(selectedComparisonField.anchor.boundingBox.xmax*100)}%, y ${Math.round(selectedComparisonField.anchor.boundingBox.ymin*100)}–${Math.round(selectedComparisonField.anchor.boundingBox.ymax*100)}% of page.`:'Location coordinates were not saved for this extracted value.'}</small></>:<span>No OCR evidence anchor is available for this field. Use the page controls to inspect the source document.</span>}</div><footer><button className="secondary-btn" onClick={()=>{if(selectedComparisonField.anchor?.pageNumber)setCurrentPage(Math.max(1,Number(selectedComparisonField.anchor.pageNumber)));setFocusedFieldId(selectedComparisonField.path||selectedComparisonField.label);}}>Open page {selectedComparisonField.anchor?.pageNumber||'1'} in viewer</button>{currentRole==='analyst'&&!readOnly&&selectedComparisonField.path&&selectedComparisonField.status!=='match'&&<button className="primary-btn" onClick={()=>openOverrideDialog(selectedComparisonField.path,selectedComparisonField.label,selectedComparisonField.documentValue)}>Correct extracted value</button>}</footer></aside></div>}

          {activeTab==='extracted' && (!fields ? (
            <div className="empty-extraction"><Sparkles size={24} className="spin" /><p>Extracting metadata, entities and evidence coordinates…</p></div>
          ) : (
            <StructuredExtractionReview
              fields={fields}
              readOnly={readOnly || currentRole !== 'analyst'}
              onEdit={openOverrideDialog}
              onOpenPage={setCurrentPage}
              onReview={handleFieldReview}
            />
          ))}
          {activeTab==='audit'&&<section className="review-section"><div className="section-title"><ShieldCheck size={16}/><span>Audit Trail</span></div><h4>Field changes</h4>{fieldHistory.length?<div className="admin-table-wrap"><table className="data-table review-data-table"><thead><tr><th>Time</th><th>Field</th><th>Previous → New</th><th>Reviewer</th><th>Rationale</th></tr></thead><tbody>{fieldHistory.map((item:any)=><tr key={item.id}><td>{new Date(item.created_at).toLocaleString()}</td><td>{item.field_path}</td><td>{String(item.previous_value??'—')} → {String(item.new_value??'—')}</td><td>{item.actor_uid} · {item.actor_role}</td><td>{item.rationale}</td></tr>)}</tbody></table></div>:<p className="muted-text">No field corrections recorded.</p>}<h4>Review decisions</h4>{reviewHistory.length?<div className="admin-table-wrap"><table className="data-table review-data-table"><thead><tr><th>Time</th><th>Decision</th><th>Status</th><th>Reviewer</th><th>Rationale</th></tr></thead><tbody>{reviewHistory.map((item:any)=><tr key={item.id}><td>{new Date(item.created_at).toLocaleString()}</td><td>{item.decision}</td><td>{item.from_status} → {item.to_status}</td><td>{item.actor_uid} · {item.actor_role}</td><td>{item.rationale}</td></tr>)}</tbody></table></div>:<p className="muted-text">No review decisions recorded.</p>}</section>}
        </div>
      </div>

      {activeTab==='verification'&&<div className="oc-action-bar"><div className="oc-action-status"><strong>{comparisonBlocked?'Resolve critical comparison findings':comparisonCounts.missing||comparisonCounts.needsReview?'Review remaining evidence':'Comparison ready'}</strong><span>{comparisonCounts.matched} of {comparisonCounts.total} fields matched · {comparisonCounts.mismatched+comparisonCounts.missing+comparisonCounts.needsReview} require attention</span></div><div className="oc-action-buttons"><button className="secondary-btn" onClick={exportComparison}><Download size={15}/>Export Comparison</button><button className="secondary-btn" onClick={handleTriggerExtraction} disabled={busy||readOnly||!['analyst','owner','admin','lawyer','operations'].includes(currentRole)||['queued','processing'].includes(job?.status)}><RefreshCw size={15} className={busy||job?.status==='processing'?'spin':''}/>Re-run OCR</button><button className="primary-btn" onClick={handleSubmitForReview} disabled={busy||readOnly||currentRole!=='analyst'||!fields||Boolean(job&&job.status!=='completed')||comparisonBlocked||identityAssessment.status!=='match'} title={comparisonBlocked?'Resolve critical mismatches before legal submission.':identityAssessment.status!=='match'?'Confirm property identity before legal submission.':''}>Resolve &amp; Continue</button></div></div>}

      {/* Override Dialog Modal */}
      {overrideModal.isOpen && (
        <div className="modal-backdrop">
          <div className="override-dialog">
            <div className="modal-head">
              <h3>Override Field: {overrideModal.fieldLabel}</h3>
              <button className="icon-btn" onClick={() => setOverrideModal({ ...overrideModal, isOpen: false })}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Previous Extracted Value</label>
                <input
                  type="text"
                  disabled
                  value={String(overrideModal.previousValue ?? 'None / Unextracted')}
                  className="disabled-input"
                />
              </div>

              <div className="form-group">
                <label>New Corrected Value *</label>
                <input
                  type="text"
                  value={overrideModal.newValue}
                  onChange={(e) => setOverrideModal({ ...overrideModal, newValue: e.target.value })}
                  placeholder="Enter corrected value"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Mandatory Reviewer Rationale *</label>
                <textarea
                  rows={3}
                  value={overrideModal.rationale}
                  onChange={(e) => setOverrideModal({ ...overrideModal, rationale: e.target.value })}
                  placeholder="Explain why this value is being corrected (e.g., 'Corrected survey number from schedule in page 2 recital')."
                />
              </div>
            </div>
            <div className="modal-foot">
              <button
                className="secondary-btn"
                onClick={() => setOverrideModal({ ...overrideModal, isOpen: false })}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="primary-btn"
                onClick={handleSaveOverride}
                disabled={busy || !overrideModal.rationale.trim()}
              >
                <Save size={15} /> Save Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface FormFieldRowProps {
  id: string;
  label: string;
  value: React.ReactNode;
  confidence?: number;
  isFocused?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
}

const FormFieldRow: React.FC<FormFieldRowProps> = ({
  id,
  label,
  value,
  confidence,
  isFocused,
  onClick,
  onEdit,
}) => {
  return (
    <div id={id} className={`form-field-card ${isFocused ? 'focused' : ''}`} onClick={onClick}>
      <div className="field-top">
        <span className="field-label">{label}</span>
        <div className="field-right">
          {confidence !== undefined && <ConfidenceBadge conf={confidence} />}
          {onEdit && (
            <button
              className="text-edit-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Override value"
            >
              <Edit3 size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="field-val">{value}</div>
    </div>
  );
};

const BoundaryCard: React.FC<{ direction: string; value: string; onEdit: () => void }> = ({
  direction,
  value,
  onEdit,
}) => {
  return (
    <div className="boundary-card">
      <div className="boundary-head">
        <span>{direction}</span>
        <button
          className="text-edit-btn"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Edit3 size={12} />
        </button>
      </div>
      <div className="boundary-val">{value || 'Not specified'}</div>
    </div>
  );
};

const ConfidenceBadge: React.FC<{ conf: number }> = ({ conf }) => {
  const pct = Math.round(conf * 100);
  const tone = conf >= 0.85 ? 'green' : conf >= 0.60 ? 'amber' : 'red';
  return (
    <span className={`confidence-tag ${tone}`}>
      {pct}%
    </span>
  );
};

const EvidenceLink: React.FC<{anchor?:any;onOpen:(page:number)=>void;detailed?:boolean}> = ({anchor,onOpen,detailed=false}) => {if(!anchor)return <span className="no-evidence">No page anchor</span>;const box=anchor.boundingBox;const location=detailed&&box?` · x ${Math.round(Number(box.xmin||0)*100)}%, y ${Math.round(Number(box.ymin||0)*100)}%`:'';return <button className="evidence-link" onClick={()=>onOpen(Number(anchor.pageNumber)||1)} title={`${anchor.extractedSnippet||'Open source page'}${location}`}>PDF p. {anchor.pageNumber||1}{location} ↗</button>;};

const PartyEvidenceTable: React.FC<{parties:ExtractedParty[];allParties:ExtractedParty[];confidence:number;editable:boolean;onEdit:(path:string,label:string,value:any)=>void;onOpenPage:(page:number)=>void}> = ({parties,allParties,confidence,editable,onEdit,onOpenPage}) => <div className="admin-table-wrap party-table-wrap"><table className="data-table review-data-table"><thead><tr><th>Party / role</th><th>Relationship</th><th>Age</th><th>Address</th><th>Ownership share</th><th>Confidence / evidence</th></tr></thead><tbody>{parties.length?parties.map(party=>{const index=allParties.indexOf(party);return <tr key={`${party.role}-${index}`}><td>{party.name}<small>{prettyRole(party.role)}</small>{editable&&<button className="text-edit-btn" onClick={()=>onEdit(`parties.${index}.name`,'Party name',party.name)}><Edit3 size={11}/> Edit</button>}</td><td>{party.relationship||'Not identified'}{editable&&<button className="text-edit-btn" onClick={()=>onEdit(`parties.${index}.relationship`,'Relationship',party.relationship)}><Edit3 size={11}/></button>}</td><td>{party.age??'Not identified'}{editable&&<button className="text-edit-btn" onClick={()=>onEdit(`parties.${index}.age`,'Age',party.age)}><Edit3 size={11}/></button>}</td><td>{party.address||'Not identified'}{editable&&<button className="text-edit-btn" onClick={()=>onEdit(`parties.${index}.address`,'Address',party.address)}><Edit3 size={11}/></button>}</td><td>{party.ownershipShare||'Not identified'}{editable&&<button className="text-edit-btn" onClick={()=>onEdit(`parties.${index}.ownershipShare`,'Ownership share',party.ownershipShare)}><Edit3 size={11}/></button>}</td><td><ConfidenceBadge conf={party.evidenceAnchor?.confidenceScore??confidence}/><EvidenceLink anchor={party.evidenceAnchor} onOpen={onOpenPage}/></td></tr>}):<tr><td colSpan={6}>No parties in this role were identified in OCR.</td></tr>}</tbody></table></div>;

function prettyDocType(type: string): string {
  switch (type) {
    case 'sale_deed':
      return 'Sale Deed (Kraya Patra)';
    case 'gift_deed':
      return 'Gift Deed (Dhana Patra)';
    case 'rtc_pahani':
      return 'RTC / Pahani (Form 16)';
    case 'encumbrance_certificate':
      return 'Encumbrance Certificate (EC)';
    case 'e_khata':
      return 'e-Khata (Form 3 / 9 / 11)';
    case 'mutation_extract':
      return 'Mutation Extract (MR)';
    default:
      return 'Other Document';
  }
}

function prettyRole(role: string): string {
  switch (role) {
    case 'seller':
      return 'Vendor / Seller';
    case 'buyer':
      return 'Purchaser / Buyer';
    case 'donor':
      return 'Donor';
    case 'donee':
      return 'Donee';
    case 'owner':
      return 'Registered Owner / Khatedar';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function redactSensitiveOcr(text: string): string {
  return text
    .replace(/((?:ಅಕೌಂಟ್\s*(?:ನಂ|ನಂಬರ್)|account\s*(?:no\.?|number))\s*[:：.-]?\s*)[\dX* -]{6,}/giu, '$1[redacted]')
    .replace(/((?:ಆಧಾರ್\s*(?:ನಂ|ನಂಬರ್)?|aadhaar\s*(?:no\.?|number)?|aadhar\s*(?:no\.?|number)?)\s*[:：.-]?\s*)[\dX* -]{8,}/giu, '$1[redacted]')
    .replace(/((?:PAN)\s*[:：.-]?\s*)[A-Z]{5}[0-9]{4}[A-Z]/giu, '$1[redacted]');
}
