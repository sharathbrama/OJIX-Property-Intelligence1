import React, { useState, useEffect, useRef, useMemo } from 'react';
import { authFetch } from '../authFetch';
import { StructuredExtractionReview } from './StructuredExtractionReview';
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
  propertyIdentity: { survey_number:string; subdivision:string; village:string; district:string; taluk?:string; hobli?:string; extent:string; boundary_north:string; boundary_south:string; boundary_east:string; boundary_west:string };
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
  confidence: number;
  snippet?: string;
}

type ReviewTab = 'document' | 'extracted' | 'history' | 'verification' | 'audit';

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
  const [showRawText, setShowRawText] = useState(false);
  const [rawText, setRawText] = useState((doc as any).extracted_text || '');
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [documentLoadError, setDocumentLoadError] = useState<string>('');
  const [titleHistory, setTitleHistory] = useState<any[]>([]);
  const [documentHistory, setDocumentHistory] = useState<any[]>([]);
  const [reviewHistory, setReviewHistory] = useState<any[]>([]);
  const [fieldHistory, setFieldHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<ReviewTab>('extracted');
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
  const identityAssessment = useMemo(() => {
    if (!fields) return {status:'unknown' as const, details:['Document extraction has not completed.']};
    const clean=(value:unknown)=>String(value||'').normalize('NFKC').toLowerCase().replace(/guntas?/g,'gunta').replace(/[^\p{L}\p{N}]/gu,'');
    const missing=(value:unknown)=>!value||['notrecorded','notspecified','none','unknown'].includes(clean(value));
    const expectedSurvey=clean(propertyIdentity.survey_number);
    const expectedHissa=clean(propertyIdentity.subdivision==='*'?'':propertyIdentity.subdivision);
    const documentSurvey=clean(fields.propertySchedule?.surveyNumber);
    const documentHissa=clean(fields.propertySchedule?.subdivisionHissa);
    const expectedVillage=clean(propertyIdentity.village);
    const documentVillage=clean(fields.propertySchedule?.village);
    const conflicts:string[]=[];
    const confirmed:string[]=[];
    if (!missing(fields.propertySchedule?.surveyNumber)&&expectedSurvey) {
      const surveyMatches=documentSurvey===clean(`${propertyIdentity.survey_number}${propertyIdentity.subdivision&&propertyIdentity.subdivision!=='*'?propertyIdentity.subdivision:''}`)||(documentSurvey===expectedSurvey&&(!documentHissa||!expectedHissa||documentHissa===expectedHissa));
      const displayDocumentSurvey=`${fields.propertySchedule.surveyNumber}${fields.propertySchedule.subdivisionHissa&&!String(fields.propertySchedule.surveyNumber).includes('/')?`/${fields.propertySchedule.subdivisionHissa}`:''}`;
      (surveyMatches?confirmed:conflicts).push(`Survey/Hissa: application ${propertyIdentity.survey_number}${propertyIdentity.subdivision&&propertyIdentity.subdivision!=='*'?`/${propertyIdentity.subdivision}`:''}, document ${displayDocumentSurvey}`);
    }
    if (!missing(fields.propertySchedule?.village)&&expectedVillage) (documentVillage===expectedVillage?confirmed:conflicts).push(`Village: application ${propertyIdentity.village}, document ${fields.propertySchedule.village}`);
    const normalizeExtent=(value:string)=>value.toLowerCase().replace(/,/g,' ').replace(/\s+/g,' ').trim();
    const caseExtent=propertyIdentity.extent || '';
    const deedExtent=fields.propertySchedule?.extent?.rawText || '';
    if (caseExtent && deedExtent) (normalizeExtent(caseExtent)===normalizeExtent(deedExtent)?confirmed:conflicts).push(`Extent: case ${caseExtent}, deed ${deedExtent}`);
    if (missing(fields.propertySchedule?.subdivisionHissa)) conflicts.push(`Hissa/subdivision: not identified in deed (case ${propertyIdentity.subdivision && propertyIdentity.subdivision!=='*' ? propertyIdentity.subdivision : 'not specified'})`);
    if (conflicts.length) return {status:'mismatch' as const,details:conflicts};
    if (confirmed.length) return {status:'match' as const,details:confirmed};
    return {status:'unknown' as const,details:['Survey/Hissa and village were not extracted, so this document cannot yet be linked confidently.']};
  },[fields,propertyIdentity]);
  const mirrorRows = useMemo(() => {
    const clean=(value:unknown)=>String(value||'').normalize('NFKC').toLowerCase().replace(/guntas?/g,'gunta').replace(/[^\p{L}\p{N}]/gu,'');
    const missing=(value:unknown)=>!value||['notrecorded','notspecified','none','unknown'].includes(clean(value));
    const row=(label:string,applicationValue:unknown,documentValue:unknown,anchor?:any)=>({label,applicationValue:String(applicationValue||'Not entered'),documentValue:String(documentValue||'Not extracted'),status:missing(documentValue)?'missing':clean(applicationValue)===clean(documentValue)?'match':'mismatch',anchor});
    const schedule=fields?.propertySchedule;
    const appSurvey=`${propertyIdentity.survey_number||''}${propertyIdentity.subdivision&&propertyIdentity.subdivision!=='*'?`/${propertyIdentity.subdivision}`:''}`;
    const documentSurveyBase=schedule?.surveyNumber&&!missing(schedule.surveyNumber)?schedule.surveyNumber:'';
    const docSurvey=`${documentSurveyBase}${schedule?.subdivisionHissa&&!String(documentSurveyBase).includes('/')?`/${schedule.subdivisionHissa}`:''}`;
    const rows = [
      row('Survey No.',propertyIdentity.survey_number,documentSurveyBase,schedule?.evidenceAnchor),
      row('Hissa / subdivision',propertyIdentity.subdivision&&propertyIdentity.subdivision!=='*'?propertyIdentity.subdivision:'Not specified',schedule?.subdivisionHissa,schedule?.evidenceAnchor),
      row('Village',propertyIdentity.village,schedule?.village,schedule?.evidenceAnchor),
      row('Extent',propertyIdentity.extent,schedule?.extent?.rawText,schedule?.evidenceAnchor),
      row('North boundary',propertyIdentity.boundary_north,schedule?.boundaries?.north,schedule?.evidenceAnchor),
      row('South boundary',propertyIdentity.boundary_south,schedule?.boundaries?.south,schedule?.evidenceAnchor),
      row('East boundary',propertyIdentity.boundary_east,schedule?.boundaries?.east,schedule?.evidenceAnchor),
      row('West boundary',propertyIdentity.boundary_west,schedule?.boundaries?.west,schedule?.evidenceAnchor),
    ];
    return rows;
  },[fields,propertyIdentity]);

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
          const propertyResponse=await authFetch(`/api/properties/${propertyId}`);
          if(propertyResponse.ok){const propertyData=await propertyResponse.json();const fresh=(propertyData.documents||[]).find((item:any)=>item.id===doc.id);if(fresh){setFields(fresh.extracted_fields||null);setRawText(fresh.extracted_text||'');if(onDocumentUpdated)onDocumentUpdated(fresh);}}
        }
      } catch { /* polling is best effort; explicit actions report their own errors */ }
    };
    void refresh();
    const timer = window.setInterval(refresh, 2500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [doc.id, propertyId, currentRole]);

  // OCR starts only through the shared provider queue. Original files remain immutable.
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
      setJob({ id: data.jobId, status: data.status || 'queued', progress: 0 });
      setSuccessNotice('OCR job queued with the shared Google Document AI service.');
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
      setSuccessNotice('Fields rebuilt from preserved OCR text. Google OCR was not rerun; verify every value against the source.');
      if (onDocumentUpdated) onDocumentUpdated({ ...doc, extracted_fields:data.extractedFields, extracted_text:rawText, processing_status:'manual_review', review_status:'pending' } as PropertyDoc);
    } catch (err:any) {
      setError(err.message || 'Could not rebuild fields from saved OCR text.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (identityAssessment.status !== 'match') {
      setError(identityAssessment.status === 'mismatch'
        ? `Automatic property association is blocked: ${identityAssessment.details.join('; ')}. Route this deed for analyst review against the correct case.`
        : 'Property identity is incomplete; confirm the village and survey before submitting this document for case approval.');
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
    if (documentNumberAnchor) boxes.push({
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
      if (anchor) boxes.push({
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
      if (anchor) boxes.push({
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
      if (conAnchor) boxes.push({
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

  // Quick verify toggle
  const handleToggleVerification = async () => {
    if (!fields?.reviewState?.isVerified && (verificationIssues.length||identityAssessment.status!=='match')) {
      setError(identityAssessment.status==='mismatch'?`This document may belong to another property: ${identityAssessment.details.join('; ')}.`:`Review required before verification: ${verificationIssues.join(', ')}.`);
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

          {((!readOnly&&currentRole==='analyst')||currentRole==='operations')&&<button className="secondary-btn" onClick={handleTriggerExtraction} disabled={busy || ['queued','processing'].includes(job?.status)}>
            <RefreshCw size={15} className={busy || job?.status==='processing' ? 'spin' : ''} /> {job?.status==='failed'||job?.status==='retry_wait'?'Retry OCR':'Process OCR'}
          </button>}
          {!readOnly&&currentRole==='analyst'&&Boolean(rawText)&&<button className="secondary-btn" onClick={handleRebuildFromSavedOcr} disabled={busy} title="Re-extract candidate fields from the saved OCR text without calling Google Document AI">Rebuild fields from saved OCR</button>}
          {!readOnly&&currentRole==='analyst'&&<button className="primary-btn" onClick={handleSubmitForReview} disabled={busy||!fields||Boolean(job&&job.status!=='completed')}>Submit for review</button>}
          {currentRole==='lawyer'&&doc.review_status==='submitted'&&<><button className="secondary-btn" onClick={()=>void handleReviewDecision('dispute')} disabled={busy}>Dispute</button><button className="danger-btn" onClick={()=>void handleReviewDecision('reject')} disabled={busy}>Reject</button><button className="primary-btn" onClick={()=>void handleReviewDecision('approve')} disabled={busy}>Approve evidence</button></>}

          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
      </header>
      {job&&<div className="review-alert"><Activity size={15}/><span>OCR job: <strong>{job.status}</strong>{job.progress!=null?` · ${job.progress}%`:''}{job.error_message?` · ${job.error_message}`:''}</span></div>}
      <nav className="review-tabs" aria-label="Document review sections">{([['document','Document View'],['extracted','Extracted Information'],['history','Transaction History'],['verification','Verification & Issues'],['audit','Audit Trail']] as [ReviewTab,string][]).map(([id,label])=><button key={id} className={activeTab===id?'active':''} onClick={()=>setActiveTab(id)}>{label}</button>)}<button className="ocr-toggle" onClick={()=>setShowRawText(v=>!v)}>{showRawText?'Hide':'Show'} Kannada OCR</button></nav>
      {showRawText&&<><pre className="review-raw-text">{redactSensitiveOcr(rawText)||'No OCR text has been saved yet.'}</pre><p className="ocr-preservation-note">Sensitive identifiers are masked in this view; the original OCR record remains preserved.</p></>}

      {/* Notifications */}
      {error && (
        <div className="review-alert alert-error">
          <AlertTriangle size={16} /> <span>{error}</span>
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}
      {!fields?.reviewState?.isVerified&&verificationIssues.length>0&&<div className="review-alert alert-warning"><AlertTriangle size={15}/><span><strong>Verification blocked.</strong> Review or correct: {verificationIssues.join(', ')}.</span></div>}
      {fields?.extractionMetadata?.status==='manual_review'&&<div className="review-alert alert-warning"><AlertTriangle size={15}/><span><strong>Manual evidence review required.</strong> {fields.extractionMetadata.message||'Automatic extraction did not produce verified source facts.'}</span></div>}
      <div className={`review-alert identity-assessment ${identityAssessment.status}`}><MapPin size={15}/><span><strong>{identityAssessment.status==='match'?'Document identity matches this application':identityAssessment.status==='mismatch'?'Property association blocked — analyst review required':'Document ownership cannot yet be confirmed'}</strong> {identityAssessment.details.join(' · ')}</span></div>
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
                  const tone = getConfidenceTone(box.confidence);
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
                      title={`${box.label} (${Math.round(box.confidence * 100)}% Confidence)`}
                    >
                      <span className="box-badge" style={{ backgroundColor: tone.color }}>
                        {box.label.slice(0, 24)} • {Math.round(box.confidence * 100)}%
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
            <p>Verify extracted facts against document anchors. Corrections are audited.</p>
          </div>}

          {activeTab==='document'&&<section className="review-section document-summary-card"><div className="section-title"><FileCheck size={16}/><span>Document summary</span></div><p><strong>{prettyDocType(fields?.documentType||doc.doc_type||'other')}</strong></p><p>Review the source PDF on the left. {fields?.documentNumber?`Registry reference ${fields.documentNumber}.`:'Registry reference not identified.'}</p><p>Case parcel association is {identityAssessment.status==='mismatch'?'blocked pending analyst review':identityAssessment.status==='match'?'consistent with extracted village and survey':'unconfirmed'}.</p><button className="secondary-btn" onClick={()=>setActiveTab('extracted')}>Open extracted information</button></section>}

          {activeTab === 'history' && <section className="review-section transaction-analytics">
            <div className="section-title"><Activity size={16}/><span>Ownership / Transaction History</span></div>
            <div className="analytics-metrics"><div><strong>{titleHistory.length}</strong><span>Case title-chain events (recorded transfers)</span></div><div><strong>{new Set(documentHistory.map((item:any)=>item.id)).size}</strong><span>Uploaded documents (separate from transfers)</span></div><div><strong>{fields?.ownershipEvents?.length||0}</strong><span>Ownership events mentioned in this deed</span></div><div><strong>Unknown</strong><span>Unproduced historical record count</span></div></div>
            {!titleHistory.length&&!fields?.ownershipEvents?.length ? <p className="muted-text">No ownership events are recorded for this case or identified in this deed. A deed document alone is not counted as a completed transfer until the case title chain records that event.</p> : <div className="history-timeline">{titleHistory.map((event:any)=><div className="history-event" key={event.id}><span>{event.eventDate || 'Date not recorded'}</span><strong>{String(event.deedType || 'Ownership event').replace(/_/g,' ')}</strong><small>{(event.fromParties||[]).map((p:any)=>p.name).join(', ') || 'Prior owner not identified'} → {(event.toParties||[]).map((p:any)=>p.name).join(', ') || 'Successor not identified'} · Registered title-chain event · {event.status}</small></div>)}{fields?.ownershipEvents?.map((event:any,index:number)=><div className="history-event mentioned" key={`mentioned-${index}`}><span>{event.eventDate||'Date not specified'}</span><strong>{event.eventType}</strong><small>{event.from||'From not identified'} → {event.to||'To not identified'} · {event.reference||'No reference'} · Mentioned in deed, not independently verified</small><EvidenceLink anchor={event.evidenceAnchor} onOpen={setCurrentPage}/></div>)}</div>}
          </section>}

          {fields&&activeTab==='verification'&&<section className="mirror-comparison"><div className="mirror-heading"><div><strong>Key Verification & Alerts</strong><span>Case facts are read-only and are never overwritten by OCR.</span></div><span className={`mirror-overall ${identityAssessment.status}`}>{identityAssessment.status==='match'?'Identity match':identityAssessment.status==='mismatch'?'Review required':'Needs review'}</span></div><div className="mirror-table"><div className="mirror-table-head"><span>FIELD</span><span>CASE</span><span>SALE DEED</span><span>RESULT</span></div>{mirrorRows.map(item=><div className="mirror-row" key={item.label}><strong>{item.label}</strong><span>{item.applicationValue}</span><span>{item.documentValue} <EvidenceLink anchor={item.anchor} onOpen={setCurrentPage}/></span><em className={item.status}>{item.status==='match'?<><Check size={12}/>Match</>:item.status==='mismatch'?<><X size={12}/>Mismatch</>:<><AlertTriangle size={12}/>Not Identified</>}</em></div>)}</div><div className="verification-alerts">{identityAssessment.details.map((issue,i)=><div key={i} className="alert alert-warning"><AlertTriangle size={14}/><span>{issue}</span></div>)}</div></section>}

          {activeTab==='extracted' && (!fields ? (
            <div className="empty-extraction"><Sparkles size={24} className="spin" /><p>Extracting metadata, entities and evidence coordinates…</p></div>
          ) : (
            <StructuredExtractionReview
              fields={fields}
              readOnly={readOnly || currentRole !== 'analyst'}
              onEdit={openOverrideDialog}
              onOpenPage={setCurrentPage}
            />
          ))}
          {activeTab==='audit'&&<section className="review-section"><div className="section-title"><ShieldCheck size={16}/><span>Audit Trail</span></div><h4>Field changes</h4>{fieldHistory.length?<div className="admin-table-wrap"><table className="data-table review-data-table"><thead><tr><th>Time</th><th>Field</th><th>Previous → New</th><th>Reviewer</th><th>Rationale</th></tr></thead><tbody>{fieldHistory.map((item:any)=><tr key={item.id}><td>{new Date(item.created_at).toLocaleString()}</td><td>{item.field_path}</td><td>{String(item.previous_value??'—')} → {String(item.new_value??'—')}</td><td>{item.actor_uid} · {item.actor_role}</td><td>{item.rationale}</td></tr>)}</tbody></table></div>:<p className="muted-text">No field corrections recorded.</p>}<h4>Review decisions</h4>{reviewHistory.length?<div className="admin-table-wrap"><table className="data-table review-data-table"><thead><tr><th>Time</th><th>Decision</th><th>Status</th><th>Reviewer</th><th>Rationale</th></tr></thead><tbody>{reviewHistory.map((item:any)=><tr key={item.id}><td>{new Date(item.created_at).toLocaleString()}</td><td>{item.decision}</td><td>{item.from_status} → {item.to_status}</td><td>{item.actor_uid} · {item.actor_role}</td><td>{item.rationale}</td></tr>)}</tbody></table></div>:<p className="muted-text">No review decisions recorded.</p>}</section>}
        </div>
      </div>

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

const EvidenceLink: React.FC<{anchor?:any;onOpen:(page:number)=>void}> = ({anchor,onOpen}) => anchor ? <button className="evidence-link" onClick={()=>onOpen(Number(anchor.pageNumber)||1)} title={anchor.extractedSnippet||'Open source page'}>PDF p. {anchor.pageNumber||1} ↗</button> : <span className="no-evidence">No page anchor</span>;

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
