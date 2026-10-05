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
  registrationDate?: string;
  executionDate?: string;
  subRegistrarOffice?: string;
  issuingAuthority?: string;
  parties: ExtractedParty[];
  propertySchedule: PropertySchedule;
  consideration?: Consideration;
  overallConfidence: number;
  fieldConfidence: Record<string, number>;
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
  extracted_fields?: ExtractedDocumentFields | null;
  created_at: string;
}

export type UserRole = 'owner' | 'admin' | 'lawyer' | 'analyst' | 'viewer';

export interface UserAccount {
  uid: string;
  email: string;
  name: string;
  designation: string;
  role: UserRole;
  avatar: string;
  description: string;
  tenantId?: string;
}

