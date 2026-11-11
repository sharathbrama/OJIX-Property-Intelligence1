import React from 'react';
import { Activity, Coins, FileCheck, MapPin, UserRound, Compass, History } from 'lucide-react';
import type { ExtractedDocumentFields, ExtractedParty, EvidenceAnchor } from '../types';

type Props = {
  fields: ExtractedDocumentFields;
  readOnly: boolean;
  onEdit: (path: string, label: string, value: unknown) => void;
  onOpenPage: (page: number) => void;
  onReview: (path: string, action: 'approve'|'reject'|'not_found'|'comment', comment: string) => void;
};

const shown = (value: unknown) => value === undefined || value === null || String(value).trim() === '' ? 'Not identified' : String(value);
const confidence = (value?: number) => value === undefined ? <span className="confidence-tag neutral">Not available</span> : <span className={`confidence-tag ${value >= .85 ? 'green' : value >= .60 ? 'amber' : 'red'}`}>{value >= .85 ? 'High' : value >= .60 ? 'Medium' : 'Low'} · {Math.round(value * 100)}% OCR confidence</span>;
const evidence = (anchor?: EvidenceAnchor, onOpen?: (page: number) => void) => anchor && onOpen
  ? <button className="evidence-link" onClick={() => onOpen(anchor.pageNumber || 1)} title={anchor.extractedSnippet}>PDF p. {anchor.pageNumber || 1} ↗</button>
  : <span className="no-evidence">No page anchor</span>;

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="review-section structured-review-section"><div className="section-title">{icon}<span>{title}</span></div>{children}</section>;
}

function DataTable({ rows, onEdit, readOnly, onOpenPage, onReview, fields }: {
  rows: Array<{label:string; value:unknown; confidence?:number; anchor?:EvidenceAnchor; path?:string}>;
  onEdit: Props['onEdit']; readOnly: boolean; onOpenPage: Props['onOpenPage']; onReview: Props['onReview']; fields: ExtractedDocumentFields;
}) {
  return <div className="admin-table-wrap"><table className="data-table review-data-table"><thead><tr><th>Field</th><th>Extracted value</th><th>OCR confidence</th><th>Evidence / review action</th></tr></thead><tbody>{rows.map(row => {const review=row.path?fields.reviewState?.fieldReviews?.[row.path]:undefined;return <tr key={row.label}><td>{row.label}</td><td>{shown(row.value)}</td><td>{confidence(row.confidence)}</td><td>{evidence(row.anchor,onOpenPage)}{review&&<small className="field-review-state">{review.status.replace('_',' ')} · {review.comment}</small>}{!readOnly && row.path && <><button className="text-edit-btn" onClick={() => onEdit(row.path!,row.label,row.value)} aria-label={`Edit ${row.label}`}>Edit</button>{(['approve','reject','not_found','comment'] as const).map(action=><button key={action} className="text-edit-btn" onClick={()=>{const comment=window.prompt(`${action.replace('_',' ')} rationale / reviewer comment`);if(comment?.trim())onReview(row.path!,action,comment.trim());}}>{action==='not_found'?'Mark not found':action==='comment'?'Comment':action}</button>)}</>}</td></tr>;})}</tbody></table></div>;
}

function partyRows(parties: ExtractedParty[], group: 'seller'|'buyer', fields: ExtractedDocumentFields) {
  return parties.map((party, index) => ({ party, index })).filter(({party}) => group === 'seller'
    ? ['seller','executant','vendor','transferor'].includes(party.role.toLowerCase())
    : ['buyer','transferee','purchaser'].includes(party.role.toLowerCase()));
}

export function StructuredExtractionReview({ fields, readOnly, onEdit, onOpenPage, onReview }: Props) {
  const schedule = fields.propertySchedule;
  const sellers = partyRows(fields.parties,'seller',fields);
  const buyers = partyRows(fields.parties,'buyer',fields);
  const partiesTable = (records: ReturnType<typeof partyRows>, heading: 'Seller / Transferor'|'Buyer / Transferee') => <>
    <h4 className="structured-subheading">{heading}</h4>
    {!records.length ? <p className="muted-text">No {heading.toLowerCase()} identified in the saved extraction.</p> : <div className="admin-table-wrap"><table className="data-table review-data-table"><thead><tr><th>Name</th><th>Relationship</th><th>Age</th><th>Address</th><th>Document role / share</th><th>Confidence / evidence</th></tr></thead><tbody>{records.map(({party,index}) => <tr key={`${party.role}-${index}`}><td>{shown(party.name)}{!readOnly&&<button className="text-edit-btn" onClick={()=>onEdit(`parties.${index}.name`,'Party name',party.name)}>Edit</button>}</td><td>{shown(party.relationship)}</td><td>{party.age ? `${party.age} years` : 'Not identified'}</td><td>{shown(party.address)}</td><td>{party.role}{party.ownershipShare ? ` · ${party.ownershipShare}` : ''}</td><td>{confidence(party.evidenceAnchor?.confidenceScore ?? fields.fieldConfidence?.parties)} {evidence(party.evidenceAnchor,onOpenPage)}</td></tr>)}</tbody></table></div>}
  </>;
  const fieldConfidence = fields.fieldConfidence || {};
  const prop = (label: string, value: unknown, key: string, conf?: number) => ({label,value,path:`propertySchedule.${key}`,confidence:conf ?? fields.fieldConfidence?.[key],anchor:fields.fieldAnchors?.[key] || schedule.evidenceAnchor});
  const money = fields.financialItems || [];
  const events = fields.ownershipEvents || [];
  const documents = [fields.documentNumber].filter(Boolean);
  const acquisitionEvents = events.filter(event => /inheritance|mutation|sale|gift|partition|transfer|conveyance/i.test(event.eventType));

  return <div className="structured-sections">
    <Section title="1. Document Identification" icon={<FileCheck size={16}/> }>
      <DataTable readOnly={readOnly} fields={fields} onReview={onReview} onEdit={onEdit} onOpenPage={onOpenPage} rows={[
        {label:'Document type',value:fields.documentType,confidence:fieldConfidence.documentType,anchor:fields.fieldAnchors?.documentType,path:'documentType'},
        {label:'Document number',value:fields.documentNumber,confidence:fieldConfidence.documentNumber,anchor:fields.fieldAnchors?.documentNumber,path:'documentNumber'},
        {label:'Registration number',value:fields.registrationNumber,confidence:fieldConfidence.documentNumber,anchor:fields.fieldAnchors?.registrationNumber,path:'registrationNumber'},
        {label:'Execution date',value:fields.executionDate,confidence:fieldConfidence.executionDate,anchor:fields.fieldAnchors?.executionDate,path:'executionDate'},
        {label:'Registration date',value:fields.registrationDate,confidence:fieldConfidence.registrationDate,anchor:fields.fieldAnchors?.registrationDate,path:'registrationDate'},
        {label:'Sub-Registrar Office (SRO)',value:fields.subRegistrarOffice,confidence:fieldConfidence.subRegistrarOffice,anchor:fields.fieldAnchors?.subRegistrarOffice,path:'subRegistrarOffice'},
        {label:'Stamp paper / document sheet',value:fields.stampPaperDetails,confidence:fieldConfidence.stampPaperNumber,anchor:fields.fieldAnchors?.stampPaperNumber,path:'stampPaperDetails'},
        {label:'Language',value:(fields.language || []).join(', '),confidence:fieldConfidence.language,anchor:fields.fieldAnchors?.language,path:'language'},
      ]}/>
    </Section>
    <Section title={`2. Seller / Transferor Details (${sellers.length})`} icon={<UserRound size={16}/>}>{partiesTable(sellers,'Seller / Transferor')}</Section>
    <Section title={`3. Buyer / Transferee Details (${buyers.length})`} icon={<UserRound size={16}/>}>{partiesTable(buyers,'Buyer / Transferee')}</Section>
    <Section title="4. Property Schedule" icon={<MapPin size={16}/> }>
      <DataTable readOnly={readOnly} fields={fields} onReview={onReview} onEdit={onEdit} onOpenPage={onOpenPage} rows={[
        prop('District',schedule.district,'district'),prop('Taluk',schedule.taluk,'taluk'),prop('Hobli',schedule.hobli,'hobli'),prop('Village',schedule.village,'village',fieldConfidence.village),
        prop('Survey number',schedule.surveyNumber,'surveyNumber',fieldConfidence.surveyNumber),prop('Hissa / subdivision',schedule.subdivisionHissa,'subdivisionHissa',fieldConfidence.subdivisionHissa),
        prop('Khata number',schedule.khataNumber,'khataNumber',fieldConfidence.khataNumber),prop('Mutation reference',schedule.mutationReference,'mutationReference',fieldConfidence.mutationReference),
        prop('Total extent',schedule.totalExtent?.rawText,'totalExtent.rawText',fieldConfidence.totalExtent),prop('Transferred extent',schedule.transferredExtent?.rawText || schedule.extent?.rawText,'transferredExtent.rawText',fieldConfidence.extent),
        prop('Land classification',schedule.landClassification,'landClassification'),prop('Property identification number',schedule.propertyIdentificationNumber,'propertyIdentificationNumber'),prop('RTC year',schedule.rtcYear,'rtcYear'),prop('Land revenue',schedule.landRevenue,'landRevenue'),prop('Crop details',schedule.cropDetails,'cropDetails'),prop('Cultivable extent',schedule.cultivableExtent?.rawText,'cultivableExtent.rawText'),prop('Non-cultivable extent',schedule.nonCultivableExtent?.rawText,'nonCultivableExtent.rawText'),prop('Property description',schedule.description,'description'),
      ]}/>
    </Section>
    <Section title="5. Four-Side Boundaries" icon={<Compass size={16}/> }>
      <DataTable readOnly={readOnly} fields={fields} onReview={onReview} onEdit={onEdit} onOpenPage={onOpenPage} rows={(['east','west','north','south'] as const).map(direction=>prop(direction[0].toUpperCase()+direction.slice(1),schedule.boundaries?.[direction],`boundaries.${direction}`,fieldConfidence[`boundaries.${direction}`]))}/>
    </Section>
    <Section title="6. Financial Details" icon={<Coins size={16}/> }>
      {!money.length ? <p className="muted-text">No financial amounts or payment references were identified. Missing values are not inferred.</p> : <div className="admin-table-wrap"><table className="data-table review-data-table"><thead><tr><th>Payment item</th><th>Amount / reference</th><th>Payment date</th><th>Certificate / source</th><th>Confidence / evidence</th></tr></thead><tbody>{money.map((item,index)=><tr key={`${item.certificate}-${item.label}-${index}`}><td>{item.label}</td><td>{item.amount !== undefined ? `₹ ${item.amount.toLocaleString('en-IN')}` : shown(item.reference)}</td><td>{shown(item.paymentDate)}</td><td>{shown(item.certificate)}</td><td>{confidence(item.evidenceAnchor?.confidenceScore)} {evidence(item.evidenceAnchor,onOpenPage)}</td></tr>)}</tbody></table><p className="muted-text">Amounts remain grouped by their source certificate or deed recital. Certificate subtotals are not added to individual fees.</p></div>}
    </Section>
    <Section title={`7. Ownership History (${events.length} events identified)`} icon={<History size={16}/> }>
      {!events.length ? <p className="muted-text">No ownership events were extracted from the saved OCR. This does not establish a complete title history.</p> : <div className="admin-table-wrap"><table className="data-table review-data-table"><thead><tr><th>Date</th><th>Event</th><th>From → To</th><th>Reference / provenance</th><th>Evidence</th></tr></thead><tbody>{events.map((event,index)=><tr key={`${event.eventType}-${index}`}><td>{shown(event.eventDate)}</td><td>{event.eventType}</td><td>{shown(event.from)} → {shown(event.to)}</td><td>{shown(event.reference)} · {event.sourceStatus === 'mentioned_in_deed' ? 'Recital only; not independently verified' : 'Source document; approval pending'}</td><td>{evidence(event.evidenceAnchor,onOpenPage)}</td></tr>)}</tbody></table></div>}
      <p className="muted-text">Events described in this deed are recital claims until checked against independent source records.</p>
    </Section>
    <Section title="8. Transaction Analytics" icon={<Activity size={16}/> }>
      <div className="analytics-metrics"><div><strong>{acquisitionEvents.length}</strong><span>Ownership events extracted</span></div><div><strong>{documents.length}</strong><span>Registration identifiers in this document</span></div><div><strong>{Math.max(0,acquisitionEvents.length-1)}</strong><span>Previous acquisition events mentioned</span></div><div><strong>Unknown</strong><span>Missing historical records (no complete chain established)</span></div></div>
      <p className="muted-text">Document count and transfer event count are separate. A registration identifier does not itself establish a verified transaction or complete ownership history.</p>
    </Section>
    <p className="structured-data-note">Extraction values come from the saved OCR/provider response. “Not identified” means the source extraction supplied no value; no production sample values are inserted. Original OCR and PDF remain preserved.</p>
  </div>;
}
