# Project: OJIX Property Intelligence MVP

## Architecture
- **Monorepo Layout**:
  - `apps/api`: Express 4 with Node.js ESM, PostgreSQL 17 + PostGIS 3.6.4, direct `pg` Pool, Zod validation, Multer file upload, Helmet security headers, rate limiting.
  - `apps/web`: React 18, Vite 6, MapLibre GL 5, Lucide React, custom modern responsive CSS.
  - `infra/db`: PostgreSQL 17 schema (`schema.sql`) and seed data (`seed.sql`).
- **Core Modules**:
  1. `document-extractor.ts`: Classification of 6 Karnataka document types, regex & token extractors for parties, schedules, extents, consideration, boundaries, bounding box coordinate anchors `[ymin, xmin, ymax, xmax]`, and confidence metrics.
  2. `title-engine.ts`: Chronological DAG builder, Karnataka/South Indian alias normalizer (honorifics, initials, parentage), gap detection algorithms (30-yr lookback, inversions, over-conveyance, encumbrance), reviewer dispute and verification logging.
  3. `spatial-rules-engine.ts`: Geodesic PostGIS screening for Rajakaluve SWD (50m primary, 25m secondary, 15m tertiary) and lakes (30m), cadastral survey parcel geometry, and georeferenced cartographic snapshot generator with North arrow, scale bar, legend, and metadata.
  4. `discrepancy-engine.ts` & `risk-catalog.ts`: Karnataka land unit normalization (Acres, Guntas, Sq. Ft., Sq. Metres, Cents), cross-document comparison across Sale Deed, RTC, and e-Khata, explainable capped risk scoring (0-100 ceiling, severity weights: critical 35, high 25, medium 15, low 5) with statutory rule citations.
  5. `pdf-report-generator.ts`: Immutable snapshot model and server/client PDF generator with executive summary, property profile, title timeline, discrepancy matrix, GIS screening snapshots, and itemized evidence appendix.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Karnataka Document Classifier | Classifies 6 Karnataka document types (Sale Deed, Gift Deed, RTC/Pahani, EC, e-Khata, Mutation Extract) | M1 | Survey / FRD |
| 2 | Metadata Extractor | Extracts parties, dates, survey numbers, extent, boundaries, consideration | M1 | Survey / FRD |
| 3 | Evidence Anchor & Bounding Box Generator | Locates page-level bounding boxes `[ymin, xmin, ymax, xmax]` with confidence scores | M1 | Survey / FRD |
| 4 | Side-by-Side Review UI & File Streaming | Split-screen document viewer with bounding box overlay and verification controls | M1 | Survey / FRD |
| 5 | Ownership Graph DAG Builder | Connects conveyance deeds chronologically from root deed to current owner | M2 | Survey / FRD |
| 6 | South Indian / Karnataka Alias Normalizer | Strips honorifics, expands patronymic initials, parentage extraction, phonetic tolerance | M2 | Survey / FRD |
| 7 | Unbroken Chain Gap Detector | Flags conveyances missing registered acquisition deeds within 30-year window | M2 | Survey / FRD |
| 8 | Chronological Inversion Detector | Flags transfers executed before acquisition date or delayed registration | M2 | Survey / FRD |
| 9 | Extent Over-Conveyance Detector | Tracks cumulative conveyed extents against acquired extents per owner | M2 | Survey / FRD |
| 10 | Reviewer Dispute & Verification Engine | Allows legal reviewers to record dispute rationales and verification tags on title events | M2 | Survey / FRD |
| 11 | Rajakaluve 3-Tier Buffer Screening | PostGIS queries for Primary (50m), Secondary (25m), and Tertiary (15m) SWD buffers | M3 | Survey / FRD |
| 12 | Lake / Waterbody 30m Buffer Screening | Evaluates 30m statutory buffer around lakes and waterbodies | M3 | Survey / FRD |
| 13 | MapLibre Cadastral Parcel Visualizer | Renders village survey parcel polygons with dynamic buffer overlays & layer controls | M3 | Survey / FRD |
| 14 | Georeferenced Snapshot Exporter | Generates map image with True North Arrow, dynamic metric scale bar, legend, metadata | M3 | Survey / FRD |
| 15 | Karnataka Land Unit Normalizer | Converts compound Acres, Guntas, Sq. Ft., Sq. Meters, Cents to normalized Sq. Ft. | M4 | Survey / FRD |
| 16 | Cross-Document Extent Comparator | Compares normalized extents between Sale Deed, RTC, e-Khata, and Survey Sketch | M4 | Survey / FRD |
| 17 | Four-Side Boundary Comparator | Detects conflicting North, South, East, West boundary descriptions across instruments | M4 | Survey / FRD |
| 18 | Capped Explainable Risk Scorer & UI Matrix | Calculates 0-100 risk score citing rule version and evidence; interactive matrix UI | M4 | Survey / FRD |
| 19 | Immutable Due-Diligence Snapshotter | Freezes property state, document hashes, title events, and GIS analysis into read-only snapshot | M5 | Survey / FRD |
| 20 | Client-Ready PDF Report Generator | Produces professional due-diligence report with 7 mandatory sections | M5 | Survey / FRD |
| 21 | Itemized Evidence Appendix Generator | Formats document SHA-256 hashes, metadata, and visual bounding box excerpts | M5 | Survey / FRD |
| 22 | Tenant Isolation & Access Guard | Enforces workspace boundary checks on all property, document, and finding mutations | M1 | Survey / FRD |
| 23 | SHA-256 Cryptographic Checksumming | Computes and stores SHA-256 hash for every uploaded document file | M1 | Survey / FRD |
| 24 | Mutation Audit Logger | Records every property creation, update, upload, screening run, and report export | M1 | Survey / FRD |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Document Intelligence Pipeline & Review UI | R1: Document classification (6 types), metadata extraction, bounding box anchors, file streaming endpoint, and side-by-side review UI component | None | DONE |
| M2 | Title Chain & Ownership Graph Engine | R2: Chronological DAG builder, Karnataka alias normalizer, 30-yr lookback gap detector, inversion detector, over-conveyance detector, dispute rationale recording API & UI | M1 | DONE |
| M3 | GIS & Spatial Rules Engine with Buffer Screening | R3: Rajakaluve 50m/25m/15m buffer bands, 30m lake buffers, cadastral parcel overlays, MapLibre layer toggles, and georeferenced snapshot exporter | None | IN_PROGRESS |
| M4 | Cross-Document Discrepancy & Risk Scoring | R4: Karnataka unit conversions, cross-document extent/name/boundary comparators, versioned rule catalog with statutory citations, capped risk scoring (0-100), and discrepancy matrix UI | M1, M2, M3 | PLANNED |
| M5 | Reviewable Report & Evidence Appendix Generator | R5: Immutable snapshot model, client-ready legal due-diligence PDF generator, itemized evidence appendix with SHA-256 hashes, and download/preview UI | M1, M2, M3, M4 | PLANNED |
| M6 | Final Verification & E2E Hardening | Run and pass 100% of E2E test suite (Tiers 1-4) published by E2E Testing Track, followed by Tier 5 adversarial hardening | M1-M5, TEST_READY.md | PLANNED |

## Interface Contracts

### M1: Document Extractor ↔ Backend / DB
```typescript
export interface ExtractedDocumentFields {
  documentType: 'sale_deed' | 'gift_deed' | 'rtc_pahani' | 'encumbrance_certificate' | 'e_khata' | 'mutation_extract' | 'other';
  documentNumber: string;
  registrationDate?: string;
  executionDate?: string;
  subRegistrarOffice?: string;
  parties: Array<{
    name: string;
    normalizedName: string;
    role: string;
    relationship?: string;
    evidenceAnchor?: EvidenceAnchor;
  }>;
  propertySchedule: {
    surveyNumber: string;
    subdivisionHissa?: string;
    village: string;
    extent: {
      rawText: string;
      acres?: number;
      guntas?: number;
      sqFt?: number;
      normalizedSqFt: number;
    };
    boundaries: { north: string; south: string; east: string; west: string };
    evidenceAnchor?: EvidenceAnchor;
  };
  consideration?: { amount: number; currency: 'INR'; evidenceAnchor?: EvidenceAnchor };
  overallConfidence: number;
  fieldConfidence: Record<string, number>;
  reviewState: { isVerified: boolean; verifiedByUid?: string; verifiedAt?: string; overrides?: Record<string, any> };
}

export interface EvidenceAnchor {
  documentId: string;
  pageNumber: number;
  boundingBox: { ymin: number; xmin: number; ymax: number; xmax: number };
  extractedSnippet: string;
  confidenceScore: number;
}
```

### M2: Title Chain Engine ↔ M1 Extracted Documents
```typescript
export interface TitleEvent {
  id: string;
  propertyId: string;
  documentId: string;
  sequenceOrder: number;
  eventDate: string;
  registrationDate?: string;
  deedType: string;
  fromParties: Array<{ name: string; normalizedName: string }>;
  toParties: Array<{ name: string; normalizedName: string }>;
  extentSqFt: number;
  extentRaw: string;
  consideration: number;
  status: 'verified' | 'unverified' | 'disputed';
  disputeRationale?: string;
  reviewedBy?: string;
}

export interface TitleGap {
  code: 'TITLE_GAP_MISSING_PREDECESSOR' | 'TITLE_GAP_CHRONOLOGICAL_INVERSION' | 'TITLE_GAP_EXTENT_OVERCONVEYANCE' | 'TITLE_UNRELEASED_ENCUMBRANCE';
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  sourceEventIds: string[];
}
```

### M3: Spatial Rules Engine ↔ PostGIS / MapLibre GL
```typescript
export interface SpatialScreeningResult {
  drainClearanceStatus: 'clear' | 'buffer_zone' | 'encroached';
  lakeClearanceStatus: 'clear' | 'buffer_zone' | 'encroached';
  findings: Array<{
    code: string;
    layerType: 'swd_primary' | 'swd_secondary' | 'swd_tertiary' | 'waterbody';
    distanceM: number;
    bufferM: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    isEncroached: boolean;
    isInsideBuffer: boolean;
  }>;
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
```

### M4: Discrepancy & Risk Engine ↔ M1, M2, M3
```typescript
export interface DiscrepancyFinding {
  id: string;
  code: string;
  ruleId: string;
  ruleVersion: string;
  statutoryCitation: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  points: number;
  field: 'extent' | 'ownership' | 'boundary' | 'survey_number';
  docA: { id: string; name: string; type: string; value: string; anchor?: EvidenceAnchor };
  docB: { id: string; name: string; type: string; value: string; anchor?: EvidenceAnchor };
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
```

### M5: Due Diligence Report Snapshot & PDF ↔ M1, M2, M3, M4
```typescript
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
```

## Code Layout
- Backend:
  - `apps/api/src/server.ts`: API routes and HTTP middleware
  - `apps/api/src/types.ts`: Shared domain types across R1-R5
  - `apps/api/src/document-extractor.ts`: Classification, extraction, bounding boxes
  - `apps/api/src/title-engine.ts`: Title chain graph, alias normalizer, gap detector
  - `apps/api/src/spatial-rules-engine.ts`: 50m/25m/15m/30m buffer screening & snapshot generator
  - `apps/api/src/discrepancy-engine.ts`: Unit conversions, cross-doc comparators
  - `apps/api/src/risk-catalog.ts`: Versioned rules and statutory citations
  - `apps/api/src/risk-engine.ts`: Risk score calculation and aggregation
  - `apps/api/src/pdf-report-generator.ts`: Snapshot freezer & PDF generator
- Frontend:
  - `apps/web/src/types.ts`: UI state interfaces
  - `apps/web/src/components/SideBySideReview.tsx`: R1 split document review
  - `apps/web/src/components/TitleChainTimeline.tsx`: R2 title timeline and disputes
  - `apps/web/src/components/MapViewer.tsx`: R3 MapLibre cadastral & buffer map
  - `apps/web/src/components/DiscrepancyMatrix.tsx`: R4 cross-doc discrepancy matrix
  - `apps/web/src/components/ReportGenerator.tsx`: R5 PDF preview and download
  - `apps/web/src/App.tsx`: Navigation, tabs, and integrated state
- Database:
  - `infra/db/schema.sql`: Extended schema (title events, reviews, snapshots, cadastral geometries)
  - `infra/db/seed.sql`: Realistic Karnataka spatial seed data and test documents
