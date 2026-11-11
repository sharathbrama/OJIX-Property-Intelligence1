/**
 * OJIX Property Intelligence - Shared Domain Types (R1 - R5)
 * Interfaces matching PROJECT.md § Interface Contracts
 */

// ==========================================
// R1: Document Intelligence & Evidence Types
// ==========================================

export interface BoundingBox {
  ymin: number; // 0.0 to 1.0 (relative to page height)
  xmin: number; // 0.0 to 1.0 (relative to page width)
  ymax: number;
  xmax: number;
}

export interface EvidenceAnchor {
  documentId: string;
  pageNumber: number; // 1-indexed
  /** Present only when the OCR token coordinates could be matched to this evidence. */
  boundingBox?: BoundingBox;
  extractedSnippet: string;
  /** Mean matched Tesseract token confidence × token coverage. Omitted when unavailable. */
  confidenceScore?: number;
  locationSource?: 'ocr_tokens' | 'text_page';
}

export type KarnatakaDocumentType =
  | 'sale_deed'
  | 'gift_deed'
  | 'rtc_pahani'
  | 'encumbrance_certificate'
  | 'e_khata'
  | 'mutation_extract'
  | 'property_tax_receipt'
  | 'survey_sketch'
  | 'conversion_order'
  | 'other';

export interface ExtractedParty {
  name: string;
  normalizedName: string;
  role: 'seller' | 'buyer' | 'donor' | 'donee' | 'owner' | 'executant' | 'claimant' | 'occupant' | string;
  relationship?: string; // e.g., "S/o Ramaswamy", "W/o Krishna", "D/o Venkataraman"
  address?: string;
  age?: number;
  ownershipShare?: string;
  panOrId?: string;
  evidenceAnchor?: EvidenceAnchor;
}

export interface PropertyExtent {
  rawText: string;
  acres?: number;
  guntas?: number;
  sqFt?: number;
  sqMeters?: number;
  cents?: number;
  normalizedSqFt: number;
}

export interface FourSideBoundaries {
  north: string;
  south: string;
  east: string;
  west: string;
}

export interface PropertySchedule {
  surveyNumber: string;
  subdivisionHissa?: string;
  village: string;
  hobli?: string;
  taluk?: string;
  district?: string;
  khataNumber?: string;
  mutationReference?: string;
  propertyIdentificationNumber?: string;
  landClassification?: string;
  rtcYear?: string;
  landRevenue?: string;
  cropDetails?: string;
  cultivableExtent?: PropertyExtent;
  nonCultivableExtent?: PropertyExtent;
  description?: string;
  totalExtent?: PropertyExtent;
  transferredExtent?: PropertyExtent;
  extent: PropertyExtent;
  boundaries: FourSideBoundaries;
  evidenceAnchor?: EvidenceAnchor;
}

export interface Consideration {
  amount: number;
  currency: 'INR';
  marketValue?: number;
  evidenceAnchor?: EvidenceAnchor;
}

export interface ExtractedFinancialItem {
  category: 'sale_consideration' | 'stamp_duty' | 'registration_fee' | 'service_fee' | 'other_charge' | 'challan' | string;
  label: string;
  amount?: number;
  currency: 'INR';
  paymentDate?: string;
  reference?: string;
  certificate?: string;
  evidenceAnchor?: EvidenceAnchor;
}

export interface ExtractedOwnershipEvent {
  eventType: string;
  eventDate?: string;
  from?: string;
  to?: string;
  reference?: string;
  sourceStatus: 'mentioned_in_deed' | 'registered_document';
  evidenceAnchor?: EvidenceAnchor;
}

export interface EncumbranceEntry {
  entryDate: string;
  executant: string;
  claimant: string;
  nature: 'sale' | 'mortgage' | 'discharge' | 'lease' | 'gift' | string;
  amount?: number;
  docNumber: string;
  evidenceAnchor?: EvidenceAnchor;
}

export interface FieldOverride {
  previousValue: any;
  newValue: any;
  rationale: string;
  reviewerUid?: string;
  updatedAt?: string;
}

export interface ReviewState {
  isVerified: boolean;
  verifiedByUid?: string;
  verifiedAt?: string;
  overrides?: Record<string, FieldOverride>;
  fieldReviews?: Record<string, {
    status: 'approved' | 'rejected' | 'not_found' | 'commented';
    comment: string;
    reviewerUid: string;
    reviewedAt: string;
  }>;
}

export interface ExtractedDocumentFields {
  documentType: KarnatakaDocumentType;
  documentNumber: string;
  registrationNumber?: string;
  stampPaperNumber?: string;
  stampPaperDetails?: string;
  language?: string[];
  registrationDate?: string;
  executionDate?: string;
  subRegistrarOffice?: string;
  issuingAuthority?: string;
  parties: ExtractedParty[];
  propertySchedule: PropertySchedule;
  consideration?: Consideration;
  financialItems?: ExtractedFinancialItem[];
  ownershipEvents?: ExtractedOwnershipEvent[];
  encumbranceEntries?: EncumbranceEntry[];
  overallConfidence: number; // 0.0 to 1.0
  fieldConfidence: Record<string, number>;
  fieldAnchors?: Record<string, EvidenceAnchor>;
  extractionMetadata?: {
    source: 'pending' | 'ocr' | 'provider' | 'reviewer_supplied' | 'text';
    status: 'pending' | 'completed' | 'manual_review';
    extractedAt?: string;
    message?: string;
  };
  reviewState: ReviewState;
}

export interface OCRToken {
  text: string;
  pageNumber: number;
  bbox: BoundingBox;
  confidence: number;
}

export interface ExtractionInputOptions {
  documentId?: string;
  filename?: string;
  mimeType?: string;
}

// ==========================================
// R2: Title Chain & Ownership Graph Types
// ==========================================

export interface TitleEventParty {
  name: string;
  normalizedName: string;
}

export interface TitleEvent {
  id: string;
  propertyId: string;
  documentId: string;
  sequenceOrder: number;
  eventDate: string;
  registrationDate?: string;
  deedType: string;
  fromParties: TitleEventParty[];
  toParties: TitleEventParty[];
  extentSqFt: number;
  extentRaw: string;
  consideration: number;
  status: 'verified' | 'unverified' | 'disputed';
  disputeRationale?: string;
  reviewedBy?: string;
  encumbranceStatus?: 'active_mortgage' | 'discharged' | 'none';
}

export interface TitleGap {
  code:
    | 'TITLE_GAP_MISSING_PREDECESSOR'
    | 'TITLE_GAP_CHRONOLOGICAL_INVERSION'
    | 'TITLE_GAP_EXTENT_OVERCONVEYANCE'
    | 'TITLE_UNRELEASED_ENCUMBRANCE'
    | 'TITLE_REGISTRATION_DELAY_EXCEEDED';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  sourceEventIds: string[];
  points?: number;
}

// ==========================================
// R3: Spatial Screening & GIS Types
// ==========================================

export interface SpatialFinding {
  code: string;
  layerType: 'swd_primary' | 'swd_secondary' | 'swd_tertiary' | 'waterbody';
  distanceM: number;
  bufferM: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  isEncroached: boolean;
  isInsideBuffer: boolean;
}

export interface SpatialScreeningResult {
  drainClearanceStatus: 'clear' | 'buffer_zone' | 'encroached';
  lakeClearanceStatus: 'clear' | 'buffer_zone' | 'encroached';
  findings: SpatialFinding[];
  cadastralParcelGeoJSON?: any;
  georeferencedSnapshot?: {
    imagePngBase64: string;
    metadata: {
      center: [number, number];
      zoom: number;
      scaleText: string;
      hasNorthArrow: boolean;
      sources: string[];
      timestamp: string;
    };
  };
}

// ==========================================
// R4: Discrepancy & Risk Scoring Types
// ==========================================

export interface DiscrepancyDocInfo {
  id: string;
  name: string;
  type: string;
  value: string;
  anchor?: EvidenceAnchor;
}

export interface DiscrepancyFinding {
  id: string;
  code: string;
  ruleId: string;
  ruleVersion: string;
  statutoryCitation: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  points: number;
  field: 'extent' | 'ownership' | 'party' | 'boundary' | 'survey_number';
  docA: DiscrepancyDocInfo;
  docB: DiscrepancyDocInfo;
  deltaText: string;
  explanation: string;
  nextAction: string;
}

export interface RiskScoreResult {
  score: number; // 0 - 100 capped
  band: 'preliminary' | 'review_required' | 'high_attention';
  findings: DiscrepancyFinding[];
  severityCounts: { critical: number; high: number; medium: number; low: number };
}

// ==========================================
// R5: Due Diligence Report Snapshot Types
// ==========================================

export interface DueDiligenceReportSnapshot {
  reportId: string;
  reportVersion: string;
  snapshotTimestamp: string;
  property: any;
  documents: any[];
  titleTimeline: TitleEvent[];
  titleGaps: TitleGap[];
  discrepancies: DiscrepancyFinding[];
  spatialScreening: SpatialScreeningResult;
  riskSummary: RiskScoreResult;
  evidenceAppendix: EvidenceAnchor[];
  statutoryNotice: string;
}
