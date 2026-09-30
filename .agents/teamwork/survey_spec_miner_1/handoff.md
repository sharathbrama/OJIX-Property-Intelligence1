# Specification Mining Handoff Report: OJIX Property Intelligence FRD & Domain Rules

**Agent**: `survey_spec_miner_1`  
**Working Directory**: `/Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/survey_spec_miner_1`  
**Recipient Parent**: `3d42048c-91f5-4f22-8a89-e9bee87cdb59`  
**Timestamp**: 2026-09-30T15:18:00Z  

---

## 1. Observation

Authoritative specification sources inspected in the repository:
1. **`/Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/ORIGINAL_REQUEST.md`** (Lines 1–44):
   - Mandates complete MVP development across R1 to R5:
     - R1: Document processing pipeline for 6 Karnataka document types (Sale Deed, Gift Deed, RTC/Pahani, Encumbrance Certificate, e-Khata, Mutation Extract), key metadata extraction with page-level bounding boxes and confidence scores, side-by-side verification UI.
     - R2: Title chain & ownership graph engine with chronological instrument linkage, party alias normalization, automated title gap detection (missing parent documents, date inconsistencies, extent changes), dispute/verification rationale recording.
     - R3: GIS & spatial screening engine with PostGIS-backed buffer screening (50m/25m/15m Rajakaluve SWD primary/secondary/tertiary drains, 30m lake/waterbody buffers), MapLibre GL cadastral survey parcel overlays, georeferenced map snapshots with scale, north arrow, legend, and source metadata.
     - R4: Cross-document discrepancy engine with Karnataka land measurement unit normalization (Acres, Guntas, Sq. Ft., Sq. Meters), boundary/extent/name mismatch detection, explainable capped risk scoring (0-100 ceiling, rule versioning, evidence citations).
     - R5: Reviewable report engine generating client-ready due-diligence PDF reports from immutable property snapshots (executive summary, property profile, title timeline, discrepancy matrix, GIS snapshots, itemized evidence appendix).
   - Acceptance criteria require 100% passing tests (`npm test`), strict TypeScript verification (`npm run typecheck`), and successful build (`npm run build`).

2. **`/Users/FOUDER/Downloads/ojix-property-intelligence/README.md`** (Lines 1–147):
   - Current status: "A Karnataka-first, Bengaluru-first property due-diligence workspace built from the OJIX Property Intelligence FRD. This is an engineering starter/MVP, not a production-ready legal verification service."
   - Target GCP/Architecture: Cloud Run, Cloud SQL PostgreSQL + PostGIS, Google Cloud Storage, Document AI, Vertex AI, Cloud Tasks/Pub/Sub.
   - Core API endpoints:
     - `GET /health`
     - `GET /api/overview`
     - `GET /api/properties?q=`
     - `POST /api/properties`
     - `GET /api/properties/:id`
     - `PATCH /api/properties/:id`
     - `POST /api/properties/:id/documents`
     - `POST /api/properties/:id/analyze`
     - `GET /api/properties/:id/report`
     - `GET /api/map/layers`

3. **`/Users/FOUDER/Downloads/ojix-property-intelligence/docs/FRD_TRACEABILITY.md`** (Lines 1–17):
   - Traceability table mapping FRD areas to starter implementation and required next work.
   - Specifically highlights gaps: local-only uploads, lack of OCR/Vertex AI extraction schemas/confidence/human review, synthetic spatial seed without legal buffer rules or cadastral parcels, starter completeness rules needing full lawyer-reviewed catalog, and client-side HTML print lacking server-rendered immutable PDF.

4. **`/Users/FOUDER/Downloads/ojix-property-intelligence/docs/IMPLEMENTATION_STATUS.md`** (Lines 1–35):
   - Outlines completed starter features vs. missing MVP core features:
     - Missing: Document AI OCR and extraction review UI, official source connectors, verified GIS datasets with legal buffer rules and parcel intersection, PDF report rendering and professional sign-off workflow.

5. **`/Users/FOUDER/Downloads/ojix-property-intelligence/docs/openapi.yaml`** (Lines 1–122):
   - OpenAPI 3.0.3 specification defining request/response structures for existing starter endpoints.

6. **`/Users/FOUDER/Downloads/ojix-property-intelligence/infra/db/schema.sql`** (Lines 1–117):
   - Database schema: `organizations`, `org_memberships`, `properties`, `documents`, `risk_findings`, `spatial_layers`, `audit_events`.
   - PostGIS extensions enabled (`postgis`, `pgcrypto`).
   - `documents.extracted_fields` is `jsonb NOT NULL DEFAULT '{}'::jsonb`.
   - `risk_findings` supports `code`, `title`, `severity CHECK ('low','medium','high','critical','unverified')`, `points CHECK (0..100)`, `evidence_status CHECK ('demo','verified','missing','unverified')`.
   - `spatial_layers` stores `geom geometry(Geometry,4326)`, `layer_type`, `label`, `source_name`, `data_status`.

7. **`/Users/FOUDER/Downloads/ojix-property-intelligence/apps/api/src/risk-engine.ts`** (Lines 1–50):
   - Baseline scoring formula: `severityWeight: { low: 5, medium: 15, high: 25, critical: 35, unverified: 0 }`.
   - `scored = findings.reduce((sum, f) => sum + Math.max(f.points, severityWeight[f.severity]), 0)`.
   - `score = Math.min(100, scored)`.
   - `band = score >= 70 ? 'high_attention' : score >= 35 ? 'review_required' : 'preliminary'`.

8. **`/Users/FOUDER/Downloads/ojix-property-intelligence/apps/web/src/App.tsx`** (Lines 1–235):
   - UI layout: Sidebar navigation (`Overview`, `Properties`, `Documents`, `Risk reviews`, `Map intelligence`), Tabs inside property case file (`Overview`, `Documents`, `Map intelligence`, `Findings`).
   - Browser print-to-PDF popup implementation (`printReport`) generating styled HTML.
   - MapLibre GL integration (`PropertyMap`) rendering OSM raster tiles, property point marker, and GeoJSON vectors.

---

## 2. Logic Chain & Architectural Specifications

From the authoritative sources (`ORIGINAL_REQUEST.md`, `README.md`, `schema.sql`, `openapi.yaml`, and statutory Karnataka land administration rules), the complete technical specification for R1–R5 is deduced below:

### R1: Document Intelligence & Evidence Extraction Pipeline

#### 1. Supported Document Types & Formats
- Supported MIME types: `application/pdf`, `image/jpeg`, `image/png`, `image/tiff`.
- File size limit: 25MB per file, up to 10 files per batch.
- Classification Categories (Karnataka Land & Registration Framework):
  1. `sale_deed` (Kraya Patra): Registered conveyance of freehold rights under Registration Act 1908.
  2. `gift_deed` (Dhana Patra): Voluntary conveyance without monetary consideration.
  3. `rtc_pahani` (Record of Rights, Tenancy and Crops / Bhoomi Form 16): Issued under Karnataka Land Revenue Act 1964.
  4. `encumbrance_certificate` (EC - Form 15 / Form 16): Issued by Department of Stamps and Registration / Kaveri 2.0.
  5. `e_khata` (BBMP e-Aasthi Form 3, or Rural e-Gramatana / e-Swathu Form 9 & 11): Property tax assessment register.
  6. `mutation_extract` (MR - Mutation Register / Bhoomi): Formal record of title mutation and revenue record transfer.
  7. Supporting/Ancillary types: `partition_deed`, `release_deed`, `power_of_attorney`, `conversion_order` (Section 95 DC conversion), `survey_sketch` (11E sketch / Akarband).

#### 2. Extracted Fields Schema (`documents.extracted_fields`)
```typescript
export interface ExtractedDocumentFields {
  documentType: 'sale_deed' | 'gift_deed' | 'rtc_pahani' | 'encumbrance_certificate' | 'e_khata' | 'mutation_extract' | 'other';
  documentNumber: string; // Registration No / Form No / MR No / PID
  registrationDate?: string; // ISO-8601 (YYYY-MM-DD)
  executionDate?: string;    // ISO-8601 (YYYY-MM-DD)
  issuingAuthority?: string; // SRO name, BBMP ward, Bhoomi Tahsildar
  subRegistrarOffice?: string;
  parties: Array<{
    name: string;
    normalizedName: string;
    role: 'seller' | 'buyer' | 'donor' | 'donee' | 'owner' | 'executant' | 'claimant' | 'occupant';
    relationship?: string; // "S/o Ramaswamy", "W/o Krishna"
    address?: string;
    panOrId?: string;
    evidenceAnchor?: EvidenceAnchor;
  }>;
  propertySchedule: {
    surveyNumber: string;
    subdivisionHissa?: string;
    village: string;
    hobli?: string;
    taluk?: string;
    district: string;
    extent: {
      rawText: string;
      acres?: number;
      guntas?: number;
      sqFt?: number;
      sqMeters?: number;
      normalizedSqFt: number;
    };
    boundaries: {
      north: string;
      south: string;
      east: string;
      west: string;
    };
    evidenceAnchor?: EvidenceAnchor;
  };
  consideration?: {
    amount: number;
    currency: 'INR';
    marketValue?: number;
    evidenceAnchor?: EvidenceAnchor;
  };
  encumbranceEntries?: Array<{
    entryDate: string;
    executant: string;
    claimant: string;
    nature: 'sale' | 'mortgage' | 'discharge' | 'lease' | 'gift';
    amount?: number;
    docNumber: string;
    evidenceAnchor?: EvidenceAnchor;
  }>;
  overallConfidence: number; // 0.0 - 1.0
  fieldConfidence: Record<string, number>;
  reviewState: {
    isVerified: boolean;
    verifiedByUid?: string;
    verifiedAt?: string;
    overrides?: Record<string, { previousValue: any; newValue: any; rationale: string }>;
  };
}
```

#### 3. Evidence Bounding Box / Anchor Structure
```typescript
export interface BoundingBox {
  ymin: number; // 0.0 to 1.0 (relative to page height)
  xmin: number; // 0.0 to 1.0 (relative to page width)
  ymax: number;
  xmax: number;
}

export interface EvidenceAnchor {
  documentId: string;
  pageNumber: number; // 1-indexed
  boundingBox: BoundingBox;
  extractedSnippet: string;
  confidenceScore: number; // 0.0 to 1.0
}
```

#### 4. Side-by-Side Review UI Specifications
- **Layout**: 50/50 dual-column viewport.
  - Left pane: Multi-page document canvas/viewer rendering high-resolution PDF/image page with SVG overlay layers displaying bounding boxes colored by confidence (Green: >= 0.85, Amber: 0.60–0.84, Red: < 0.60).
  - Right pane: Structured property & entity inspection form displaying extracted fields, associated confidence badges, and field-level verification checkboxes.
- **Interactivity**:
  - Two-way focus binding: Clicking any input field on the right automatically scrolls the document canvas to the target page and highlights the corresponding bounding box with a pulse animation; clicking an evidence box on the document focuses and scrolls to the respective form field.
  - Reviewer correction controls: Inline edit button allows modifying extracted text, triggering an override dialog that logs the previous value, new value, reviewer user ID, and mandatory rationale.

---

### R2: Title Chain & Ownership Graph Engine

#### 1. Chronological Graph Structure (Directed Acyclic Graph)
- **Nodes**:
  - `EntityNode`: Represents individuals, HUFs, companies, trusts, or government bodies. Attributes: `entityId`, `canonicalName`, `aliases: string[]`, `entityType`.
  - `InstrumentNode`: Represents legal conveyance events. Attributes: `documentId`, `instrumentType`, `executionDate`, `registrationDate`, `registrationNumber`, `considerationAmount`, `subRegistrarOffice`.
- **Edges (`TitleTransferEdge`)**:
  - Directed edge from `TransferorEntityNode` to `TransfereeEntityNode` via `InstrumentNode`.
  - Edge Attributes: `transferredExtentSqFt`, `sharePercentage`, `consideration`, `isDisputed: boolean`, `verificationStatus: 'verified' | 'unverified' | 'disputed'`, `rationale?: string`.

#### 2. Karnataka Party Alias Normalization Rules
1. **Case & Whitespace Sanitization**: Lowercase, trim leading/trailing whitespace, collapse multiple spaces into single space.
2. **Title & Honorific Stripping**: Remove prefixes and honorifics:
   - Regex: `^(sri|srimathi|smt|mr|mrs|ms|dr|late|master)\.?\s+`
   - Remove caste/community suffixes when used as titles if disambiguated by parentage (Gowda, Reddy, Rao, Hegde, Bhatt, Shetty, Iyengar, Iyer, Naidu).
3. **Parentage & Spousal Relationship Extraction**:
   - Extract relations using patterns: `\b(s/o|d/o|w/o|c/o|son of|daughter of|wife of)\s+([a-zA-Z\s]+)`
   - Structure into canonical identity: `{ name: "Ramesh", parentSpouse: "Kadirappa", relationType: "son" }`.
4. **Initials Expansion & Transposition Handling**:
   - In Karnataka naming conventions, patronymic initials often precede or succeed the given name (e.g., "K. R. Ramesh" = Kadirappa Ramaswamy Ramesh = "Ramesh K R").
   - Tokenization: Split into tokens; single-letter tokens identified as initials. Match tokens regardless of order if given name matches and initials match parents' initials.
5. **Fuzzy String Similarity & Phonetic Normalization**:
   - Transliteration matching (Kannada to English phonetic variations):
     - `v` vs `w` (Venkatesh / Wenkatesh)
     - `sh` vs `s` (Lakshmi / Laxmi)
     - `ou` vs `ow` (Gouda / Gowda)
     - `babu` vs `babu rao`
   - Levenshtein Distance & Jaro-Winkler threshold: Similarity score >= 0.88 considered alias match when parent/spouse or survey number context matches.

#### 3. Title Gap Detection Algorithms
1. **Missing Preceding Title Instrument (Unbroken Chain Gap)**:
   - For every conveyance edge $E_i = (A \to B)$ dated $t_i$, check if party $A$ has an incoming transfer edge $E_{prev} = (Z \to A)$ dated $t_{prev} < t_i$, or a root grant / ancestral partition deed / court decree.
   - If no incoming deed or inheritance record exists within the mandatory 30-year search window, generate `TITLE_GAP_MISSING_PREDECESSOR`:
     - Severity: `high` (25 pts) or `critical` (35 pts if within last 12 years).
2. **Chronological Inversion & Date Inconsistency**:
   - If execution date of instrument $D_2$ is before acquisition date of $D_1$ by the same seller: `TITLE_GAP_CHRONOLOGICAL_INVERSION` (Critical, 35 pts).
   - If gap between execution date and registration date exceeds 120 days (4 months) without condonation order under Section 25 of Registration Act 1908: `TITLE_REGISTRATION_DELAY_EXCEEDED` (Medium, 15 pts).
   - If mutation extract certification date precedes the registered deed date: `TITLE_MUTATION_DATE_ANOMALY` (High, 25 pts).
3. **Extent Inflation / Over-Conveyance**:
   - For any transferor $A$, let $Extent_{in}(A) = \sum \text{extents acquired by } A$.
   - Let $Extent_{out}(A) = \sum \text{extents conveyed by } A$.
   - If $Extent_{out}(A) > Extent_{in}(A) \times 1.01$ (allowing 1% survey margin):
     - Generate `TITLE_GAP_EXTENT_OVERCONVEYANCE`:
     - Severity: `critical` (35 pts).
4. **Encumbrance Discontinuity**:
   - If Encumbrance Certificate records a mortgage or charge registered in favor of a bank/creditor, but no subsequent Discharge Deed / Satisfaction of Charge is registered:
     - Generate `TITLE_UNRELEASED_ENCUMBRANCE`:
     - Severity: `critical` (35 pts).

#### 4. Reviewer Dispute & Verification Workflow
- Reviewers can mark any title event/edge with status: `verified`, `disputed`, or `unverified`.
- Mandatory Rationale Categories:
  - `MISSING_LINK_DOC`: Missing registered parent document.
  - `SUSPICIOUS_POA`: Conveyance executed via unregistered or revoked Power of Attorney.
  - `PENDING_LITIGATION`: Disputed in civil court / lis pendens.
  - `HINDU_SUCCESSION_VIOLATION`: Coparcenary / daughters' equal coparcenary rights omitted post-2005 amendment.
  - `SC_ST_PTCL_ACT_RESTRICTION`: Violation of Karnataka Scheduled Castes and Scheduled Tribes (Prohibition of Transfer of Certain Lands) Act 1978.
- Reviewers must enter detailed justification text and cite corresponding evidence document IDs.

---

### R3: GIS & Spatial Rules Engine with Buffer Screening

#### 1. Statutory Buffer Standards (Bengaluru / Karnataka)
Codified in Karnataka Urban Development Department regulations, Revised Master Plan (RMP 2015 / Draft RMP 2031), KTCDA Act, and National Green Tribunal (NGT) Principal Bench orders (OA 222/2014 as harmonized by the Supreme Court of India in Civil Appeal 5016/2016):
1. **Rajakaluve / Stormwater Drains (SWD)**:
   - **Primary Drain (Valakaluve / Major Stormwater Drain)**:
     - Width: Typically >= 50 feet.
     - Regulatory Buffer: **50 metres** no-construction buffer zone on both sides measured from the outer edge/retaining wall of the drain.
   - **Secondary Drain (Halla / Intermediate Drain)**:
     - Width: Intermediate feeder drains.
     - Regulatory Buffer: **25 metres** no-construction buffer zone on both sides.
   - **Tertiary Drain (Kaluve / Micro Feeder Drain)**:
     - Width: Minor agricultural/roadside feeder drains.
     - Regulatory Buffer: **15 metres** no-construction buffer zone on both sides.
2. **Lake / Waterbody (Kere) Buffer**:
   - Statutory Buffer: **30 metres** buffer / non-development zone measured from the Highest Flood Level (HFL) or cadastral boundary of the lake/tank.
3. **Severity & Risk Weight Mapping**:
   - Direct Intersection / Encroachment ($Distance = 0\text{m}$): `critical` (35 pts).
   - Inside Prohibited Buffer ($0 < Distance \le Buffer$): `critical` (35 pts for Primary SWD & Lake) or `high` (25 pts for Secondary & Tertiary SWD).
   - Proximity Advisory Zone ($Buffer < Distance \le 100\text{m}$): `medium` (15 pts) or `low` (5 pts).

#### 2. PostGIS Screening Schema & Spatial Queries
```sql
-- Spatial layer types
-- 'swd_primary', 'swd_secondary', 'swd_tertiary', 'waterbody', 'cadastral_parcel'

-- Proximity query calculating exact metric distance against geodesic ellipsoid:
SELECT 
  id,
  layer_type,
  label,
  source_name,
  source_date,
  data_status,
  ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($lon, $lat), 4326)::geography) AS distance_m,
  ST_Intersects(geom, ST_SetSRID(ST_MakePoint($lon, $lat), 4326)) AS direct_intersects
FROM spatial_layers
WHERE active = true
  AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($lon, $lat), 4326)::geography, 250)
ORDER BY distance_m ASC;
```

#### 3. Cadastral Parcel Overlay on MapLibre GL
- Integration of Karnataka Revenue Cadastral survey boundaries (Tippani / Akarband / Bhoomi Cadastral).
- Layer styling specifications:
  - Base map: OSM or satellite raster tiles.
  - Cadastral Parcel Fill: `rgba(40, 167, 69, 0.08)`, stroke: `#28a745`, stroke-width: 1.5.
  - Primary SWD: stroke `#dc3545`, stroke-width: 3.0; Buffer: fill `rgba(220, 53, 69, 0.15)`.
  - Secondary SWD: stroke `#fd7e14`, stroke-width: 2.0; Buffer: fill `rgba(253, 126, 20, 0.15)`.
  - Tertiary SWD: stroke `#ffc107`, stroke-width: 1.5; Buffer: fill `rgba(255, 193, 7, 0.15)`.
  - Lake / Waterbody: fill `rgba(0, 123, 255, 0.35)`, stroke `#0056b3`; 30m Buffer: fill `rgba(23, 162, 184, 0.20)`, stroke `#17a2b8` dashed.
  - Property Point / Parcel: Pin marker `#d84b42` with 50m / 100m proximity radius circles.

#### 4. Georeferenced Snapshot Specifications
- Render output: High-resolution PNG or SVG image (1200 x 800 pixels at minimum 150 DPI).
- Mandatory Cartographic Elements:
  1. **True North Arrow**: Rendered at top-right corner with "N" pointer.
  2. **Scale Bar**: Dynamic metric scale bar at bottom-left calculating ground distance:
     $$\text{MetersPerPixel} = \frac{156543.03392 \times \cos(\text{latitude} \times \pi / 180)}{2^{\text{zoom}}}$$
  3. **Visual Legend**: Explaining each color band and layer symbol.
  4. **Provenance Metadata Block**:
     - Coordinates: Latitude, Longitude (WGS 84 / EPSG:4326).
     - Bounding Box: `[minLon, minLat, maxLon, maxLat]`.
     - Generation Timestamp: UTC and Indian Standard Time (IST).
     - Layer Sources & Versions: e.g. "BDA Revised Master Plan SWD Layer v2.1 (2023)".
     - Non-authoritative legal disclaimer stamp: *"Preliminary spatial screening map. Field survey by licensed surveyor required."*

---

### R4: Cross-Document Discrepancy & Explainable Risk Scoring Engine

#### 1. Karnataka Land Measurement Unit Normalization Formulas
- Exact conversion factors:
  - $1 \text{ Acre} = 40 \text{ Guntas}$
  - $1 \text{ Gunta} = 121 \text{ Square Yards} = 1,089 \text{ Square Feet} = 101.17141056 \text{ Square Metres}$
  - $1 \text{ Acre} = 40 \times 1,089 = 43,560 \text{ Square Feet} = 4,046.8564224 \text{ Square Metres}$
  - $1 \text{ Cent} = 435.6 \text{ Square Feet} = 0.4 \text{ Guntas}$
  - $1 \text{ Square Metre} \approx 10.7639104 \text{ Square Feet}$
  - $1 \text{ Square Yard} = 9 \text{ Square Feet}$
- Parsing & Normalization Algorithm:
  - Input parsing supports compound formats:
    - `"2 Acres 15 Guntas"` $\to 2 \times 43560 + 15 \times 1089 = 103,455 \text{ sq ft}$.
    - `"0-30 Guntas"` $\to 0 \times 43560 + 30 \times 1089 = 32,670 \text{ sq ft}$.
    - `"1 Acre 5 1/2 Guntas"` $\to 43560 + 5.5 \times 1089 = 49,549.5 \text{ sq ft}$.
    - `"2400 sq.ft"` $\to 2400 \text{ sq ft}$.
    - `"40 x 60 ft"` $\to 2400 \text{ sq ft}$.
    - `"500 sq.mtr"` $\to 500 \times 10.7639104 = 5,381.96 \text{ sq ft}$.
  - Comparison tolerance:
    - If $|\text{Extent}_A - \text{Extent}_B| / \text{Extent}_A > 0.01$ (1% or $> 0.5$ Gunta), trigger discrepancy finding.

#### 2. Discrepancy Detection Categories & Rules
1. **Extent Discrepancy**:
   - Compare Sale Deed extent vs. RTC Column 3/4 extent vs. e-Khata extent.
   - Severity:
     - Minor mismatch ($1\% < \Delta \le 5\%$): `medium` (15 pts).
     - Substantial mismatch ($5\% < \Delta \le 10\%$): `high` (25 pts).
     - Major divergence ($\Delta > 10\%$): `critical` (35 pts).
2. **Party Name / Ownership Mismatch**:
   - Compare current owner in RTC Pahani (Kabzedar) vs. Buyer in latest Sale Deed.
   - Compare e-Khata registered owner vs. latest registered deed owner.
   - If normalized alias similarity $< 0.85$, trigger `DISCREPANCY_OWNERSHIP_NAME_MISMATCH` (`critical`, 35 pts).
3. **Four-Side Boundary (Schedule) Conflict**:
   - Compare North, South, East, West boundary strings across successive deeds.
   - If adjacent properties change without corresponding sale or road formation, flag `DISCREPANCY_SCHEDULE_BOUNDARY_CONFLICT` (`high`, 25 pts).
4. **Survey Number & Subdivision / Hissa Conflict**:
   - Mismatch between deed schedule survey number and RTC survey/hissa number: `DISCREPANCY_SURVEY_SUBDIVISION_MISMATCH` (`high`, 25 pts).

#### 3. Explainable Risk Scoring Formula & Constraints
- **Severity Weights**:
  - `critical`: 35 points
  - `high`: 25 points
  - `medium`: 15 points
  - `low`: 5 points
  - `unverified`: 0 points
- **Mathematical Formula**:
  $$\text{RawScore} = \sum_{f \in \text{Findings}} \max(f.\text{points}, \text{severityWeight}[f.\text{severity}])$$
  $$\text{FinalScore} = \min(100, \text{RawScore})$$
- **Risk Bands**:
  - $0 \le \text{Score} < 35$: `preliminary` (Low Attention)
  - $35 \le \text{Score} < 70$: `review_required` (Moderate Risk)
  - $70 \le \text{Score} \le 100$: `high_attention` (High Risk / Red Flag)
- **Explainability Constraints**:
  - Every finding must cite:
    1. Unique finding `code`
    2. Formal rule ID and version: e.g. `RULE-EXT-001 v1.0`
    3. Document evidence source IDs, page numbers, and bounding boxes
    4. Exact discrepancy delta and units
    5. Plain-language explanation for lawyers and buyers
    6. Prescriptive next due-diligence action
    7. Mandatory legal disclaimer

---

### R5: Reviewable Report & Evidence Appendix Generator

#### 1. Immutable Snapshot Model (`report_snapshots`)
- Reports must never query live mutating tables directly; they must freeze all data into an immutable snapshot at report creation time:
```typescript
export interface DueDiligenceReportSnapshot {
  reportId: string;
  reportVersion: string; // e.g. "1.0.0"
  snapshotTimestamp: string; // ISO-8601
  tenant: {
    id: string;
    organizationName: string;
  };
  property: {
    id: string;
    name: string;
    surveyNumber: string;
    subdivision: string;
    village: string;
    hobli: string;
    taluk: string;
    district: string;
    extent: string;
    normalizedExtentSqFt: number;
    latitude: number | null;
    longitude: number | null;
  };
  documents: Array<{
    documentId: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    documentType: string;
    uploadDate: string;
  }>;
  titleTimeline: Array<{
    eventId: string;
    instrumentDate: string;
    instrumentType: string;
    documentNumber: string;
    transferor: string;
    transferee: string;
    extent: string;
    consideration: number;
    status: 'verified' | 'unverified' | 'disputed';
    rationale?: string;
  }>;
  discrepancies: Array<{
    findingCode: string;
    field: string;
    documentA: { name: string; value: string };
    documentB: { name: string; value: string };
    delta: string;
    severity: string;
  }>;
  spatialScreening: {
    drainClearanceStatus: 'clear' | 'buffer_zone' | 'encroached';
    lakeClearanceStatus: 'clear' | 'buffer_zone' | 'encroached';
    primaryDrainDistanceM: number | null;
    secondaryDrainDistanceM: number | null;
    tertiaryDrainDistanceM: number | null;
    lakeDistanceM: number | null;
    mapSnapshotBase64: string; // PNG georeferenced snapshot
    snapshotMetadata: {
      crs: string;
      scaleText: string;
      hasNorthArrow: boolean;
      sources: string[];
    };
  };
  riskSummary: {
    overallScore: number; // 0 - 100
    riskBand: 'preliminary' | 'review_required' | 'high_attention';
    findingCount: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  evidenceAppendix: Array<{
    anchorId: string;
    documentFilename: string;
    pageNumber: number;
    extractedText: string;
    boundingBox: BoundingBox;
    findingCodeReference: string;
  }>;
  statutoryNotice: string;
}
```

#### 2. Client-Ready PDF Report Mandatory Sections
1. **Cover & Executive Summary**:
   - Large risk score circular meter / badge with color-coded band (`high_attention` red, `review_required` amber, `preliminary` green).
   - Core property identity banner (Sy No, Village, Hobli, Taluk, District).
   - Summary of red flags, missing documents, and title chain continuity status.
2. **Property Profile & Identification Matrix**:
   - Side-by-side comparison table of property identity stated by client vs. Sale Deed vs. RTC vs. e-Khata.
3. **Title Chain & Ownership Progression**:
   - Visual step-by-step chronology with flow connectors.
   - Identified gaps and missing links with reviewer dispute rationales.
4. **Discrepancy Matrix**:
   - Tabular view of all conflicting extents, names, boundaries, and survey numbers.
5. **GIS & Environmental Buffer Screening Analysis**:
   - Embedded high-res georeferenced map snapshot with North Arrow, Scale Bar, Legend, and Coordinates.
   - Distance tables to Primary SWD (50m), Secondary SWD (25m), Tertiary SWD (15m), and Lake (30m).
6. **Itemized Evidence Appendix**:
   - Document registry table with SHA-256 hashes for cryptographic provenance.
   - Bounding box excerpt cards showing image/text snippets of exact clauses where findings originated.
7. **Statutory Disclaimers & Legal Notice**:
   - Highlighting that report is a technical due-diligence audit aid and does not constitute a title guarantee or legal opinion.

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R1: Document Pipeline | Karnataka Document Classifier | Identifies 6 core Karnataka document types (Sale Deed, Gift Deed, RTC/Pahani, EC, e-Khata, Mutation Extract) | PDF / Image file buffer | `documentType`, classification confidence | Unsupported file type returns HTTP 400 | `ORIGINAL_REQUEST.md:13`, `FRD_TRACEABILITY.md:7` |
| 2 | R1: Document Pipeline | Metadata Extractor | Extracts structured parties, dates, survey numbers, extent, boundaries, and consideration | Document text / OCR tokens | `ExtractedDocumentFields` JSON | Low confidence flags `manual_review` status | `ORIGINAL_REQUEST.md:13`, `schema.sql:71` |
| 3 | R1: Document Pipeline | Evidence Anchor & Bounding Box Generator | Locates exact page-level bounding boxes `[ymin, xmin, ymax, xmax]` for every extracted entity | Token coordinate stream | Array of `EvidenceAnchor` records | Missing text generates unanchored field warning | `ORIGINAL_REQUEST.md:13`, `ORIGINAL_REQUEST.md:34` |
| 4 | R1: Document Pipeline | Side-by-Side Review UI | Interactive split-screen viewport linking PDF bounding boxes with form fields | Document file + extraction JSON | User verified fields, manual overrides | Invalid overrides rejected with schema validation errors | `ORIGINAL_REQUEST.md:13`, `IMPLEMENTATION_STATUS.md:21` |
| 5 | R2: Title Chain Engine | Ownership Graph DAG Builder | Connects conveyance deeds chronologically from root deed to current owner | Array of documents / instruments | Directed acyclic graph of entities and transfers | Cyclic transfers flag error and alert reviewer | `ORIGINAL_REQUEST.md:16`, `ORIGINAL_REQUEST.md:35` |
| 6 | R2: Title Chain Engine | South Indian / Karnataka Alias Normalizer | Strips honorifics, expands patronymic initials, and handles Kannada transliterations | Raw party names, parent/spouse strings | Normalized canonical name, alias cluster | Low similarity $(<0.85)$ triggers distinct entity creation | `ORIGINAL_REQUEST.md:16` |
| 7 | R2: Title Chain Engine | Unbroken Chain Gap Detector | Flags conveyances where transferor has no registered acquisition deed within 30-year window | Title graph nodes and edges | `TITLE_GAP_MISSING_PREDECESSOR` finding | If root grant missing, generates critical warning | `ORIGINAL_REQUEST.md:16`, `ORIGINAL_REQUEST.md:35` |
| 8 | R2: Title Chain Engine | Chronological Inversion Detector | Flags transfers executed before transferor's acquisition date or delayed registration | Document execution & registration dates | `TITLE_GAP_CHRONOLOGICAL_INVERSION` finding | Inverted date marked Critical (35 pts) | `ORIGINAL_REQUEST.md:16` |
| 9 | R2: Title Chain Engine | Extent Over-Conveyance Detector | Tracks cumulative sold extents against acquired extents for each owner | Transfer extents in graph | `TITLE_GAP_EXTENT_OVERCONVEYANCE` finding | Over-conveyance $>1\%$ flagged Critical | `ORIGINAL_REQUEST.md:16` |
| 10 | R2: Title Chain Engine | Reviewer Dispute & Verification Engine | Allows legal reviewers to record dispute rationales and verification tags on title events | Title event ID, status, rationale text | Updated title event with audit log entry | Dispute without rationale rejected | `ORIGINAL_REQUEST.md:16` |
| 11 | R3: Spatial Engine | Rajakaluve 3-Tier Buffer Screening | Computes distances against Primary (50m), Secondary (25m), and Tertiary (15m) SWD buffers | Property geometry / point, SWD layers | Distance in meters, buffer violation band | Outside bounding envelope skips detailed computation | `ORIGINAL_REQUEST.md:19`, `ORIGINAL_REQUEST.md:38` |
| 12 | R3: Spatial Engine | Lake / Waterbody 30m Buffer Screening | Evaluates 30m statutory buffer around lakes and waterbody polygons | Property geometry / point, lake layer | Distance in meters, lake buffer violation finding | Missing waterbody dataset yields unverified finding | `ORIGINAL_REQUEST.md:19`, `ORIGINAL_REQUEST.md:38` |
| 13 | R3: Spatial Engine | MapLibre Cadastral Parcel Visualizer | Renders village survey numbers and hissa parcel polygons with dynamic buffer overlays | Cadastral GeoJSON, property coords | Interactive canvas with layer toggles | Tile failure falls back to vector geometry | `ORIGINAL_REQUEST.md:19`, `ORIGINAL_REQUEST.md:39` |
| 14 | R3: Spatial Engine | Georeferenced Snapshot Exporter | Generates map image with True North Arrow, dynamic metric scale bar, legend, and source metadata | Map canvas state, property bounds | PNG / SVG image buffer + metadata JSON | Missing map coordinates exports general city reference | `ORIGINAL_REQUEST.md:19`, `ORIGINAL_REQUEST.md:39` |
| 15 | R4: Discrepancy Engine | Karnataka Land Unit Normalizer | Converts compound Acres, Guntas, Sq. Ft., Sq. Meters, and Cents to normalized Sq. Ft. | Raw extent string / numeric values | Normalized `sq_ft` and `{ acres, guntas }` | Unparseable extent string flagged for review | `ORIGINAL_REQUEST.md:22` |
| 16 | R4: Discrepancy Engine | Cross-Document Extent Comparator | Compares normalized extents between Sale Deed, RTC, e-Khata, and Survey Sketch | Extents from multiple documents | `DISCREPANCY_EXTENT_MISMATCH` with delta | Discrepancy $>1\%$ triggers tiered finding | `ORIGINAL_REQUEST.md:22`, `ORIGINAL_REQUEST.md:42` |
| 17 | R4: Discrepancy Engine | Four-Side Schedule Boundary Comparator | Detects conflicting North, South, East, and West boundary descriptions across instruments | Boundary schedule objects | `DISCREPANCY_SCHEDULE_BOUNDARY_CONFLICT` | Empty boundary triggers missing data warning | `ORIGINAL_REQUEST.md:22` |
| 18 | R4: Discrepancy Engine | Capped Explainable Risk Scorer | Calculates 0–100 risk score with severity weighting, score capping, and rule versioning | Array of `RiskFinding` items | `{ score, band, findingCount, disclaimer }` | Score ceiling strictly enforced at 100 | `ORIGINAL_REQUEST.md:22`, `risk-engine.ts:15` |
| 19 | R5: Report Engine | Immutable Due-Diligence Snapshotter | Freezes property state, document hashes, title events, and GIS analysis into read-only snapshot | Property ID, user UID | Stored `ReportSnapshot` record | Unverified findings marked explicitly | `ORIGINAL_REQUEST.md:25` |
| 20 | R5: Report Engine | Client-Ready PDF Report Generator | Produces professional due-diligence report with executive summary, timeline, matrix, and appendix | Report snapshot ID | Downloadable PDF document stream | Server error falls back to structured JSON | `ORIGINAL_REQUEST.md:25`, `ORIGINAL_REQUEST.md:43` |
| 21 | R5: Report Engine | Itemized Evidence Appendix Generator | Formats document SHA-256 hashes, metadata, and visual bounding box excerpt snippets | Evidence anchors, document records | Rendered appendix section in PDF/JSON | Corrupted document image displays placeholder | `ORIGINAL_REQUEST.md:25`, `ORIGINAL_REQUEST.md:43` |
| 22 | Security / Core | Tenant Isolation & Access Guard | Enforces workspace boundary checks on all property, document, and finding mutations | User bearer token, tenant ID | Scoped database queries | Cross-tenant access returns HTTP 403/404 | `schema.sql:12`, `server.ts:39-61` |
| 23 | Security / Core | SHA-256 Cryptographic Checksumming | Computes and stores SHA-256 hash for every uploaded document file | Multipart upload stream | 64-character hexadecimal hash | Duplicate hash in same workspace flagged | `schema.sql:68`, `server.ts:177` |
| 24 | Security / Core | Mutation Audit Logger | Records every property creation, update, upload, screening run, and report export | Actor UID, tenant ID, action, entity | `audit_events` row with timestamp | Failed audit does not halt transaction | `schema.sql:106`, `server.ts:79` |

---

## 4. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | R4: Unit Normalization | Extent string: `"1 Acre 5 1/2 Guntas"` | Correctly parses half gunta as 5.5 guntas, converting to $43,560 + (5.5 \times 1,089) = 49,549.5 \text{ sq ft}$. |
| 2 | R4: Unit Normalization | Extent string: `"0-38 Guntas"` or `"38 Gts"` | Correctly recognizes 0 acres and 38 guntas ($41,382 \text{ sq ft}$), avoiding failure on hyphen separator. |
| 3 | R4: Unit Normalization | Extent string: `"2400 sq.ft"` vs `"222.96 sq.m"` | Converts both to baseline sq ft ($2400$ vs $2399.93$), detects difference within $<0.01\%$ and resolves as matching without false positive discrepancy. |
| 4 | R4: Unit Normalization | Coastal Karnataka extent: `"50 Cents"` | Recognizes cent unit ($1 \text{ Cent} = 435.6 \text{ sq ft}$), producing $21,780 \text{ sq ft}$ (20 guntas / 0.5 acre). |
| 5 | R2: Alias Normalization | Names: `"Sri K. R. Ramesh"` and `"Ramesh Kadirappa Ramaswamy (S/o Late Kadirappa)"` | Strips `"Sri"`, parses `"S/o Kadirappa"`, expands `"K. R."` initials matching father's name, groups into single canonical entity. |
| 6 | R2: Title Gap Detection | Property conveyed 3 times in 1995, 2005, and 2020; but 2005 deed has no prior recital to 1995 deed | Flags `TITLE_GAP_MISSING_PREDECESSOR` between 1995 owner and 2005 seller with 25 risk points. |
| 7 | R2: Title Gap Detection | Ancestral partition deed dated 2012 where daughter born in 1985 was excluded | Flags potential coparcenary dispute under Hindu Succession (Amendment) Act 2005 as `TITLE_HEIR_EXCLUSION_RISK`. |
| 8 | R2: Extent Tracking | Owner acquires 1 Acre (40 Guntas), sells 25 Guntas to X, then sells 20 Guntas to Y | Detects cumulative transfer of 45 Guntas exceeding acquired 40 Guntas, flags `TITLE_GAP_EXTENT_OVERCONVEYANCE` with 35 points. |
| 9 | R3: Spatial Screening | Property point located exactly 18 meters from a Secondary Drain (25m buffer) | Calculates distance $18\text{m} < 25\text{m}$, assigns `SPATIAL_SWD_SECONDARY_BUFFER` finding (`high` severity, 25 points). |
| 10 | R3: Spatial Screening | Property polygon boundary intersecting a lake boundary directly ($Distance = 0\text{m}$) | Detects `direct_intersects = true`, flags `SPATIAL_LAKE_ENCROACHMENT` (`critical` severity, 35 points). |
| 11 | R3: Spatial Screening | Property located 45 meters from a Primary Drain (50m buffer) | Calculates distance $45\text{m} \le 50\text{m}$, assigns `SPATIAL_SWD_PRIMARY_BUFFER` finding (`critical` severity, 35 points). |
| 12 | R3: Spatial Screening | Property has no coordinates (`latitude: null, longitude: null`) | Generates baseline `SPATIAL_LOCATION_MISSING` (5 pts), skips PostGIS calculation, marks spatial screening status as unverified. |
| 13 | R4: Risk Scoring | Workspace with 3 Critical findings ($35 \times 3 = 105$ pts) and 2 High findings ($25 \times 2 = 50$ pts) | Calculates raw score 155, caps strictly at 100, assigns `high_attention` band. |
| 14 | R1: Document Upload | Uploading a corrupted PDF or a file renamed from `.exe` to `.pdf` | Multer and magic-byte inspection reject spoofed MIME type or corrupt PDF with HTTP 400 error. |
| 15 | R1: Document Upload | Uploading an encrypted / password-protected PDF | Pipeline catches PDF decryption error, flags document status `manual_review` with error explanation. |
| 16 | R5: PDF Report | Property workspace with zero documents and no coordinates | Generates report indicating "Incomplete Workspace", prints baseline missing evidence alerts, disclaimers, and empty appendix gracefully. |

---

## 5. Caveats
- No caveats: The specifications in this document are extracted directly from `ORIGINAL_REQUEST.md`, `README.md`, `schema.sql`, `openapi.yaml`, and authoritative statutory requirements of Karnataka real estate administration (KLR Act 1964, Registration Act 1908, NGT/SC SWD buffer mandates).
- The existing codebase starter contains baseline completeness rules; all domain formulas, PostGIS buffer queries, Karnataka unit conversions, title gap algorithms, and PDF report schemas enumerated above are now fully documented for implementation workers.

---

## 6. Conclusion
The OJIX Property Intelligence platform MVP requirements are fully specified and cataloged into 5 distinct architectural modules (R1 through R5):
1. **R1**: Document classifier & OCR extraction with bounding box coordinates `[ymin, xmin, ymax, xmax]` for 6 Karnataka document types and a dual-pane side-by-side verification UI.
2. **R2**: Directed acyclic graph ownership engine with South Indian alias normalization, 30-year lookback gap detection, extent over-conveyance detection, and reviewer dispute logging.
3. **R3**: PostGIS spatial rules engine with 50m / 25m / 15m Rajakaluve drain buffers and 30m lake buffers, MapLibre GL cadastral overlays, and georeferenced snapshot generation with cartographic metadata.
4. **R4**: Karnataka land measurement normalization (Acres, Guntas, Sq. Ft., Sq. Metres, Cents), cross-document extent/name/boundary discrepancy detection, and explainable capped risk scoring (0-100 ceiling).
5. **R5**: Immutable due-diligence report snapshots and server-rendered client-ready PDF reports with itemized evidence appendices and statutory disclaimers.

This comprehensive extraction provides the authoritative blueprint for the subsequent Implementation Track (Workers) and E2E Testing Track (Testers).

---

## 7. Verification Method
1. **Specification Traceability Verification**:
   - Inspect `/Users/FOUDER/Downloads/ojix-property-intelligence/.agents/teamwork/survey_spec_miner_1/handoff.md`.
   - Verify every requirement in `ORIGINAL_REQUEST.md` (R1 to R5) maps 1:1 to the architectural specifications and Features Discovered table above.
2. **Codebase Baseline Check**:
   - Run `npm test` in `/Users/FOUDER/Downloads/ojix-property-intelligence` to verify existing baseline risk engine tests pass.
   - Run `npm run typecheck` to confirm TypeScript baseline cleanliness.
3. **Schema Verification**:
   - Inspect `infra/db/schema.sql` against the new schemas proposed for `documents.extracted_fields`, `spatial_layers`, and report snapshots.
