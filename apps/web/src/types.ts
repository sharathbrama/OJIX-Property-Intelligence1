/**
 * OJIX Property Intelligence - Web Client Types
 */

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface EvidenceAnchor {
  documentId: string;
  pageNumber: number;
  boundingBox: BoundingBox;
  extractedSnippet: string;
  confidenceScore: number;
}

export type KarnatakaDocumentType =
  | 'sale_deed'
  | 'gift_deed'
  | 'rtc_pahani'
  | 'encumbrance_certificate'
  | 'e_khata'
  | 'mutation_extract'
  | 'other';

export interface ExtractedParty {
  name: string;
  normalizedName: string;
  role: string;
  relationship?: string;
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
  landClassification?: string;
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
  category: string;
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
  overallConfidence: number;
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

export interface PropertyDoc {
  id: string;
  property_id?: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sha256?: string;
  doc_type?: KarnatakaDocumentType | string;
  processing_status: string;
  review_status?: string;
  extracted_text?: string;
  extracted_fields?: ExtractedDocumentFields | null;
  created_at: string;
}

export type UserRole = 'owner' | 'admin' | 'lawyer' | 'analyst' | 'operations' | 'consultant' | 'support' | 'data_steward' | 'viewer';

export interface UserAccount {
  uid: string;
  email: string;
  name: string;
  designation: string;
  role: UserRole;
  avatar: string;
  description: string;
  tenantId?: string;
  accessExpiresAt?: string;
  isSuperAdmin?: boolean;
}
