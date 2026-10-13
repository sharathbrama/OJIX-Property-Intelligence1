import React, { useState, useEffect, useRef, useMemo } from 'react';
import { authFetch } from '../authFetch';
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
  propertyIdentity: { survey_number:string; subdivision:string; village:string; district:string; extent:string; boundary_north:string; boundary_south:string; boundary_east:string; boundary_west:string };
  doc: PropertyDoc;
  onClose: () => void;
  onDocumentUpdated?: (updatedDoc: PropertyDoc) => void;
  readOnly?: boolean;
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
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [documentLoadError, setDocumentLoadError] = useState<string>('');
  const verificationIssues = useMemo(() => getVerificationIssues(fields), [fields]);
  const identityAssessment = useMemo(() => {
    if (!fields) return {status:'unknown' as const, details:['Document extraction has not completed.']};
    const clean=(value:unknown)=>String(value||'').toLowerCase().replace(/guntas?/g,'gunta').replace(/[^a-z0-9]/g,'');
    const missing=(value:unknown)=>!value||['notrecorded','notspecified','none','unknown'].includes(clean(value));
    const expectedSurvey=clean(propertyIdentity.survey_number);
    const expectedHissa=clean(propertyIdentity.subdivision);
    const documentSurvey=clean(fields.propertySchedule?.surveyNumber);
    const documentHissa=clean(fields.propertySchedule?.subdivisionHissa);
    const expectedVillage=clean(propertyIdentity.village);
    const documentVillage=clean(fields.propertySchedule?.village);
    const conflicts:string[]=[];
    const confirmed:string[]=[];
    if (!missing(fields.propertySchedule?.surveyNumber)&&expectedSurvey) {
      const surveyMatches=documentSurvey===clean(`${propertyIdentity.survey_number}${propertyIdentity.subdivision||''}`)||(documentSurvey===expectedSurvey&&(!documentHissa||!expectedHissa||documentHissa===expectedHissa));
      const displayDocumentSurvey=`${fields.propertySchedule.surveyNumber}${fields.propertySchedule.subdivisionHissa&&!String(fields.propertySchedule.surveyNumber).includes('/')?`/${fields.propertySchedule.subdivisionHissa}`:''}`;
      (surveyMatches?confirmed:conflicts).push(`Survey/Hissa: application ${propertyIdentity.survey_number}${propertyIdentity.subdivision?`/${propertyIdentity.subdivision}`:''}, document ${displayDocumentSurvey}`);
    }
    if (!missing(fields.propertySchedule?.village)&&expectedVillage) (documentVillage===expectedVillage?confirmed:conflicts).push(`Village: application ${propertyIdentity.village}, document ${fields.propertySchedule.village}`);
    if (conflicts.length) return {status:'mismatch' as const,details:conflicts};
    if (confirmed.length) return {status:'match' as const,details:confirmed};
    return {status:'unknown' as const,details:['Survey/Hissa and village were not extracted, so this document cannot yet be linked confidently.']};
  },[fields,propertyIdentity]);
  const mirrorRows = useMemo(() => {
    const clean=(value:unknown)=>String(value||'').toLowerCase().replace(/guntas?/g,'gunta').replace(/[^a-z0-9]/g,'');
    const missing=(value:unknown)=>!value||['notrecorded','notspecified','none','unknown'].includes(clean(value));
    const row=(label:string,applicationValue:unknown,documentValue:unknown)=>({label,applicationValue:String(applicationValue||'Not entered'),documentValue:String(documentValue||'Not extracted'),status:missing(documentValue)?'missing':clean(applicationValue)===clean(documentValue)?'match':'mismatch'});
    const schedule=fields?.propertySchedule;
    const appSurvey=`${propertyIdentity.survey_number||''}${propertyIdentity.subdivision?`/${propertyIdentity.subdivision}`:''}`;
    const documentSurveyBase=schedule?.surveyNumber&&!missing(schedule.surveyNumber)?schedule.surveyNumber:'';
    const docSurvey=`${documentSurveyBase}${schedule?.subdivisionHissa&&!String(documentSurveyBase).includes('/')?`/${schedule.subdivisionHissa}`:''}`;
    return [
      row('Survey / Hissa',appSurvey,docSurvey),
      row('Village',propertyIdentity.village,schedule?.village),
      row('Extent',propertyIdentity.extent,schedule?.extent?.rawText),
      row('North boundary',propertyIdentity.boundary_north,schedule?.boundaries?.north),
      row('South boundary',propertyIdentity.boundary_south,schedule?.boundaries?.south),
      row('East boundary',propertyIdentity.boundary_east,schedule?.boundaries?.east),
      row('West boundary',propertyIdentity.boundary_west,schedule?.boundaries?.west),
    ];
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

  // If extracted_fields is missing, trigger extraction automatically on load
  useEffect(() => {
    if (!readOnly && !doc.extracted_fields) {
      handleTriggerExtraction();
    } else {
      setFields(doc.extracted_fields || null);
    }
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
      const res = await authFetch(`/api/properties/${propertyId}/documents/${doc.id}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to extract document metadata');
      }
      const data = await res.json();
      setFields(data.extractedFields);
      setSuccessNotice('Document extraction and classification completed successfully.');
      if (onDocumentUpdated) {
        onDocumentUpdated(data.document);
      }
    } catch (err: any) {
      setError(err.message || 'Error executing document extraction');
    } finally {
      setBusy(false);
    }
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

          {!readOnly&&<button className="secondary-btn" onClick={handleTriggerExtraction} disabled={busy}>
            <RefreshCw size={15} className={busy ? 'spin' : ''} /> Re-extract
          </button>}

          {!readOnly&&<button
            className={`primary-btn ${fields?.reviewState?.isVerified ? 'verified-btn' : ''}`}
            onClick={handleToggleVerification}
            disabled={busy || (!fields?.reviewState?.isVerified && (verificationIssues.length > 0||identityAssessment.status!=='match'))}
            title={!fields?.reviewState?.isVerified&&identityAssessment.status!=='match'?identityAssessment.details.join('; '):!fields?.reviewState?.isVerified&&verificationIssues.length?`Review required: ${verificationIssues.join(', ')}`:undefined}
          >
            {fields?.reviewState?.isVerified ? (
              <>
                <Check size={16} /> Verified
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Mark as Verified
              </>
            )}
          </button>}

          <button className="icon-btn close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div className="review-alert alert-error">
          <AlertTriangle size={16} /> <span>{error}</span>
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}
      {!fields?.reviewState?.isVerified&&verificationIssues.length>0&&<div className="review-alert alert-warning"><AlertTriangle size={15}/><span><strong>Verification blocked.</strong> Review or correct: {verificationIssues.join(', ')}.</span></div>}
      {fields?.extractionMetadata?.status==='manual_review'&&<div className="review-alert alert-warning"><AlertTriangle size={15}/><span><strong>Manual evidence review required.</strong> {fields.extractionMetadata.message||'Automatic extraction did not produce verified source facts.'}</span></div>}
      <div className={`review-alert identity-assessment ${identityAssessment.status}`}><MapPin size={15}/><span><strong>{identityAssessment.status==='match'?'Document identity matches this application':identityAssessment.status==='mismatch'?'Possible property mismatch':'Document ownership cannot yet be confirmed'}</strong> {identityAssessment.details.join(' · ')}</span></div>
      {successNotice && (
        <div className="review-alert alert-success">
          <Check size={16} /> <span>{successNotice}</span>
          <button onClick={() => setSuccessNotice('')}><X size={14} /></button>
        </div>
      )}

      {/* 50/50 Dual-Viewport Body */}
      <div className="review-body">
        {/* LEFT PANE: Document Viewer Canvas with Bounding Boxes */}
        <div className="review-pane left-pane" ref={canvasRef}>
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
        <div className="review-pane right-pane" ref={formRef}>
          <div className="form-header">
            <h3>Structured Document Evidence</h3>
            <p>Verify extracted facts against document anchors. Corrections are audited.</p>
          </div>

          {fields&&<section className="mirror-comparison"><div className="mirror-heading"><div><strong>Application ↔ document comparison</strong><span>Entered property facts are mirrored against this uploaded document.</span></div><span className={`mirror-overall ${identityAssessment.status}`}>{identityAssessment.status==='match'?'Identity match':identityAssessment.status==='mismatch'?'Possible mismatch':'Needs review'}</span></div><div className="mirror-table"><div className="mirror-table-head"><span>FIELD</span><span>APPLICATION</span><span>DOCUMENT</span><span>RESULT</span></div>{mirrorRows.map(item=><div className="mirror-row" key={item.label}><strong>{item.label}</strong><span>{item.applicationValue}</span><span>{item.documentValue}</span><em className={item.status}>{item.status==='match'?<><Check size={12}/>Match</>:item.status==='mismatch'?<><X size={12}/>Mismatch</>:<><AlertTriangle size={12}/>Missing</>}</em></div>)}</div><small>Mismatch means the extracted wording differs from the application. Review the source image before deciding whether the document belongs to another property.</small></section>}

          {!fields ? (
            <div className="empty-extraction">
              <Sparkles size={24} className="spin" />
              <p>Extracting metadata, entities and evidence coordinates…</p>
            </div>
          ) : (
            <div className="structured-sections">
              {/* SECTION 1: Document Classification */}
              <div className="review-section">
                <div className="section-title">
                  <FileCheck size={16} />
                  <span>Document Classification & Registry</span>
                </div>
                <div className="fields-grid">
                  <FormFieldRow
                    id="form-field-documentType"
                    label="Karnataka Document Type"
                    value={prettyDocType(fields.documentType)}
                    confidence={fields.fieldConfidence?.documentType}
                    isFocused={focusedFieldId === 'documentType'}
                    onClick={() => handleFieldFocus('documentType')}
                    onEdit={() => openOverrideDialog('documentType', 'Document Type', fields.documentType)}
                  />
                  <FormFieldRow
                    id="form-field-documentNumber"
                    label="Document / Reg. No."
                    value={fields.documentNumber}
                    confidence={fields.fieldConfidence?.documentNumber}
                    isFocused={focusedFieldId === 'documentNumber'}
                    onClick={() => handleFieldFocus('documentNumber')}
                    onEdit={() => openOverrideDialog('documentNumber', 'Document Number', fields.documentNumber)}
                  />
                  <FormFieldRow
                    id="form-field-executionDate"
                    label="Execution Date"
                    value={fields.executionDate || 'Not specified'}
                    confidence={fields.fieldConfidence?.dates}
                    isFocused={focusedFieldId === 'executionDate'}
                    onClick={() => handleFieldFocus('executionDate')}
                    onEdit={() => openOverrideDialog('executionDate', 'Execution Date', fields.executionDate)}
                  />
                  <FormFieldRow
                    id="form-field-registrationDate"
                    label="Registration Date"
                    value={fields.registrationDate || 'Not specified'}
                    confidence={fields.fieldConfidence?.dates}
                    isFocused={focusedFieldId === 'registrationDate'}
                    onClick={() => handleFieldFocus('registrationDate')}
                    onEdit={() => openOverrideDialog('registrationDate', 'Registration Date', fields.registrationDate)}
                  />
                  <FormFieldRow
                    id="form-field-sro"
                    label="Sub-Registrar Office / SRO"
                    value={fields.subRegistrarOffice || fields.issuingAuthority || 'Not recorded'}
                    confidence={0.88}
                    isFocused={focusedFieldId === 'sro'}
                    onClick={() => handleFieldFocus('sro')}
                    onEdit={() => openOverrideDialog('subRegistrarOffice', 'Sub-Registrar Office', fields.subRegistrarOffice)}
                  />
                </div>
              </div>

              {/* SECTION 2: Parties */}
              <div className="review-section">
                <div className="section-title">
                  <User size={16} />
                  <span>Parties & Entities ({fields.parties.length})</span>
                </div>
                {fields.parties.length === 0 ? (
                  <p className="muted-text">No parties identified in document text.</p>
                ) : (
                  fields.parties.map((party, idx) => (
                    <div
                      key={idx}
                      id={`form-field-party_${idx}`}
                      className={`party-card ${focusedFieldId === `party_${idx}` ? 'focused-card' : ''}`}
                      onClick={() => handleFieldFocus(`party_${idx}`)}
                    >
                      <div className="party-header">
                        <span className="party-role">{prettyRole(party.role)}</span>
                        <div className="party-actions">
                          <ConfidenceBadge conf={party.evidenceAnchor?.confidenceScore ?? 0.88} />
                          <button
                            className="text-edit-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openOverrideDialog(`parties.${idx}.name`, `${prettyRole(party.role)} Name`, party.name);
                            }}
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                        </div>
                      </div>
                      <div className="party-name">{party.name}</div>
                      {party.relationship && <div className="party-rel">{party.relationship}</div>}
                      <div className="party-norm">
                        <small>NORMALIZED:</small> <code>{party.normalizedName}</code>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* SECTION 3: Property Schedule */}
              <div className="review-section">
                <div className="section-title">
                  <MapPin size={16} />
                  <span>Property Schedule</span>
                </div>
                <div className="fields-grid">
                  <FormFieldRow
                    id="form-field-surveyNumber"
                    label="Survey Number"
                    value={fields.propertySchedule.surveyNumber}
                    confidence={fields.fieldConfidence?.surveyNumber}
                    isFocused={focusedFieldId === 'surveyNumber'}
                    onClick={() => handleFieldFocus('surveyNumber')}
                    onEdit={() => openOverrideDialog('propertySchedule.surveyNumber', 'Survey Number', fields.propertySchedule.surveyNumber)}
                  />
                  <FormFieldRow
                    id="form-field-hissa"
                    label="Subdivision / Hissa"
                    value={fields.propertySchedule.subdivisionHissa || 'None'}
                    confidence={fields.fieldConfidence?.surveyNumber}
                    isFocused={focusedFieldId === 'hissa'}
                    onClick={() => handleFieldFocus('hissa')}
                    onEdit={() => openOverrideDialog('propertySchedule.subdivisionHissa', 'Hissa', fields.propertySchedule.subdivisionHissa)}
                  />
                  <FormFieldRow
                    id="form-field-village"
                    label="Village"
                    value={fields.propertySchedule.village}
                    confidence={0.90}
                    isFocused={focusedFieldId === 'village'}
                    onClick={() => handleFieldFocus('village')}
                    onEdit={() => openOverrideDialog('propertySchedule.village', 'Village', fields.propertySchedule.village)}
                  />
                  <FormFieldRow
                    id="form-field-extent"
                    label="Extent (Raw & Normalized)"
                    value={
                      <div>
                        <strong>{fields.propertySchedule.extent.rawText || 'Not recorded'}</strong>
                        <div className="normalized-metric">
                          <Compass size={13} /> {fields.propertySchedule.extent.normalizedSqFt.toLocaleString('en-IN')} sq ft
                        </div>
                      </div>
                    }
                    confidence={fields.fieldConfidence?.extent}
                    isFocused={focusedFieldId === 'extent'}
                    onClick={() => handleFieldFocus('extent')}
                    onEdit={() => openOverrideDialog('propertySchedule.extent.rawText', 'Raw Extent', fields.propertySchedule.extent.rawText)}
                  />
                </div>
              </div>

              {/* SECTION 4: 4-Side Boundaries */}
              <div className="review-section">
                <div className="section-title">
                  <Compass size={16} />
                  <span>4-Side Schedule Boundaries</span>
                </div>
                <div className="boundaries-grid" id="form-field-boundaries" onClick={() => handleFieldFocus('boundaries')}>
                  <BoundaryCard
                    direction="North"
                    value={fields.propertySchedule.boundaries.north}
                    onEdit={() => openOverrideDialog('propertySchedule.boundaries.north', 'North Boundary', fields.propertySchedule.boundaries.north)}
                  />
                  <BoundaryCard
                    direction="South"
                    value={fields.propertySchedule.boundaries.south}
                    onEdit={() => openOverrideDialog('propertySchedule.boundaries.south', 'South Boundary', fields.propertySchedule.boundaries.south)}
                  />
                  <BoundaryCard
                    direction="East"
                    value={fields.propertySchedule.boundaries.east}
                    onEdit={() => openOverrideDialog('propertySchedule.boundaries.east', 'East Boundary', fields.propertySchedule.boundaries.east)}
                  />
                  <BoundaryCard
                    direction="West"
                    value={fields.propertySchedule.boundaries.west}
                    onEdit={() => openOverrideDialog('propertySchedule.boundaries.west', 'West Boundary', fields.propertySchedule.boundaries.west)}
                  />
                </div>
              </div>

              {/* SECTION 5: Consideration */}
              {fields.consideration && (
                <div className="review-section">
                  <div className="section-title">
                    <Coins size={16} />
                    <span>Financial Consideration</span>
                  </div>
                  <div className="fields-grid">
                    <FormFieldRow
                      id="form-field-consideration"
                      label="Sale Consideration"
                      value={`₹ ${fields.consideration.amount.toLocaleString('en-IN')}`}
                      confidence={fields.fieldConfidence?.consideration}
                      isFocused={focusedFieldId === 'consideration'}
                      onClick={() => handleFieldFocus('consideration')}
                      onEdit={() => openOverrideDialog('consideration.amount', 'Consideration Amount', fields.consideration?.amount)}
                    />
                  </div>
                </div>
              )}

              {/* SECTION 6: Reviewer Override Audit Trail */}
              {fields.reviewState?.overrides && Object.keys(fields.reviewState.overrides).length > 0 && (
                <div className="review-section overrides-section">
                  <div className="section-title">
                    <ShieldCheck size={16} />
                    <span>Reviewer Override History ({Object.keys(fields.reviewState.overrides).length})</span>
                  </div>
                  <div className="override-list">
                    {Object.entries(fields.reviewState.overrides).map(([key, ov]: [string, any], idx) => (
                      <div key={idx} className="override-entry">
                        <div className="override-meta">
                          <strong>{key}</strong>
                          <small>{ov.updatedAt ? new Date(ov.updatedAt).toLocaleString() : 'Recent'}</small>
                        </div>
                        <div className="override-delta">
                          <span className="prev-val">{String(ov.previousValue ?? 'empty')}</span>
                          <span>→</span>
                          <span className="next-val">{String(ov.newValue)}</span>
                        </div>
                        <div className="override-rationale">
                          <em>Rationale:</em> {ov.rationale}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
