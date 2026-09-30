# Original User Request

## 2026-09-30T15:06:52Z

Complete the end-to-end MVP development of the OJIX Property Intelligence platform according to the Functional Requirements Document (FRD), delivering document OCR & structured extraction with evidence anchors, an interactive title chain and gap-detection engine, PostGIS-backed Rajakaluve/waterbody spatial buffer screening, cross-document discrepancy detection, and reviewable legal due-diligence PDF reports.

Working directory: /Users/FOUDER/Downloads/ojix-property-intelligence
Integrity mode: development

## Requirements

### R1. Document Intelligence & Evidence Extraction Pipeline
Implement a document processing pipeline that classifies common Karnataka property documents (Sale Deed, Gift Deed, RTC/Pahani, Encumbrance Certificate, e-Khata, Mutation Extract), extracts key metadata (parties, survey numbers, execution dates, extent, consideration, boundaries) with page-level bounding boxes and confidence scores, and provides a side-by-side document review UI for human verification.

### R2. Title Chain & Ownership Graph Engine
Build an ownership timeline and title-chain analysis module that chronologically connects instruments, maps party entities with alias normalization, automatically identifies title gaps (missing preceding title deeds, date inconsistencies, extent changes between transfers), and allows legal reviewers to verify or dispute individual title events with recorded rationales.

### R3. GIS & Spatial Rules Engine with Buffer Screening
Implement a PostGIS-backed spatial screening rules engine that computes exact distances and intersections against Rajakaluve / storm-water drains (with 50m / 25m / 15m buffer bands) and lake/water body boundaries, supports cadastral survey parcel overlays on MapLibre GL, and exports georeferenced map snapshots with scale, north arrow, legend, and source metadata.

### R4. Cross-Document Discrepancy & Explainable Risk Scoring Engine
Construct a discrepancy comparison engine that normalizes property identifiers, person names, and Karnataka land measurement units (Acres, Guntas, Sq. Ft., Sq. Meters), flags conflicting boundary descriptions or extent representations across instruments, and calculates an explainable, capped risk score where every finding cites its underlying rule version and evidence.

### R5. Reviewable Report & Evidence Appendix Generator
Implement a reporting engine that generates client-ready due-diligence PDF reports from immutable property snapshots, incorporating the executive summary, property profile, title timeline, discrepancy matrix, GIS screening snapshots, and an itemized evidence appendix.

## Acceptance Criteria

### Automated Tests & Quality
- [ ] Comprehensive unit and integration test suite covering document field extraction, title gap detection, unit conversions, and spatial buffer rules passes with 100% success (`npm test`).
- [ ] Complete codebase passes strict TypeScript verification (`npm run typecheck`) and production build (`npm run build`) without errors.

### Document & Title Intelligence
- [ ] Document processing pipeline accepts PDF and image files, correctly classifies document types, and populates structured fields with page-level anchors.
- [ ] Title timeline visualizes ownership progression and generates high-severity findings for missing parent documents or discontinuous transactions.

### GIS & Spatial Screening
- [ ] Spatial screening endpoint returns accurate distance calculations to drain and lake layers, categorizing findings into appropriate regulatory buffer bands.
- [ ] Interactive MapLibre map renders property geometry, layer controls, and buffer zones, and allows exporting a static snapshot with provenance metadata.

### Discrepancy & Reporting
- [ ] Discrepancy engine flags simulated mismatches between Sale Deed and RTC/Khata extent and party details.
- [ ] Due-diligence report generates a downloadable, structured document containing an executive summary, findings register, and evidence appendix.

## 2026-09-30T21:23:50Z

Conduct a comprehensive multi-agent production audit, edge-case hardening, and end-to-end verification of the OJIX Property Intelligence platform across its Document OCR Extraction, Title DAG Analysis, PostGIS Spatial Screening, Cross-Document Discrepancy Matrix, Legal Research Engine, and Government Source Registry modules.

Working directory: /Users/FOUDER/Downloads/ojix-property-intelligence
Integrity mode: development

## Requirements

### R1. Title Chain & Complex Succession Stress Verification
Perform deep adversarial testing and validation of the Title Engine's 30-year DAG resolution, covering complex Indian land tenure edge cases: ancestral coparcenary splits under Hindu Succession Act, partition deeds with fractional guntas, Power of Attorney (GPA/SPA) revocation risks, court attachment orders, and chronological inversion anomalies.

### R2. Spatial & PostGIS Cadastral Clearance Verification
Validate the spatial screening engine across irregular cadastral survey boundaries, multi-polygon parcels, overlapping Rajakaluve buffer zones (50m primary, 25m secondary, 15m tertiary), and lake wetland peripheries (30m buffer). Verify that arbitrary coordinate screening and parcel-to-property assignment maintain topological integrity.

### R3. Document Intelligence & OCR Extraction Boundary Testing
Verify document classification and field extraction across degraded, rotated, or noisy document uploads (Sale Deeds, RTC/Pahani, e-Khata, Encumbrance Certificates), ensuring SHA-256 cryptographic hashing, bounding box normalization, and side-by-side human review state transitions remain robust under concurrency.

### R4. Government Source Registry & Resilience Verification
Verify the resiliency of the Source Registry Engine (Bhoomi, Kaveri 2.0, Mojini, Dishaank, e-Aasthi, K-RERA) against network timeouts, HTTP 5xx failures, and unexpected portal response formats, confirming that fallback cache layers and operational status indicators accurately inform the legal reviewer.

### R5. Cross-Document Discrepancy & Due-Diligence Report Generation
Verify that the discrepancy comparison engine accurately catches cross-instrument mismatches in party names, aliases, survey numbers, and extent units (Acres, Guntas, Sq. Ft., Sq. Meters), and verify that generated Due Diligence PDF/JSON reports are immutable and audit-compliant.

## Acceptance Criteria

### Automated Verification & Code Quality
- [ ] All automated test suites (349+ tests) pass cleanly without any regression (`npm test`).
- [ ] Full monorepo passes TypeScript compilation with zero errors (`npm run typecheck`).
- [ ] Production build compiles successfully (`npm run build`).

### Resilience & Security Guardrails
- [ ] Multi-tenant data isolation strictly enforced with tenant ID scoping across all SQL queries and API endpoints.
- [ ] Prototype pollution guards and safe field path validation prevent unauthorized mutation of extracted document metadata.
- [ ] Audit logs accurately record every document override, parcel geometry linkage, and property snapshot.

