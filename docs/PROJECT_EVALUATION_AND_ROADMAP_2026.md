# OJIX Property Intelligence — Comprehensive Project Evaluation & Roadmap

**Document Reference:** FRD v1.0 (29 September 2026) vs. Repository Baseline (`main`)  
**Prepared For:** Engineering, Product, and QA Teams  
**Release Status:** **CONDITIONAL GO for Internal Synthetic Testing | NO-GO for Production / Client Data**

---

## 1. Executive Summary & Project Purpose

### 1.1 The Problem Statement
Property and land due diligence in India—especially in **Bengaluru and Karnataka**—is fragmented, slow, high-risk, and opaque:
- **Severe Spatial Risks:** Thousands of properties infringe on storm-water drains (**Rajakaluve**), lake/tank buffer zones (NGT buffer mandates: 30m/50m/75m), or master-plan road widening alignments. Encroachments lead to demolition drives, registration bans, and severe litigation.
- **Fragmented Public Records:** Legal proof is scattered across disparate government portals: **Bhoomi** (RTC / Pahani, Mutation Extract), **Kaveri 2.0** (Registered deeds, Encumbrance Certificates), **BBMP / e-Aasthi** (Khata, property tax), and **BDA** (Zoning & Master Plan approvals).
- **Multilingual & Multi-Unit Discrepancies:** Deeds mix archaic Kannada legal terminology with modern English records. Land extents vary wildly across units (acres, guntas, anas, cents, square feet, square meters), leading to hidden over-conveyance and chain gaps.
- **The "AI Hype" Pitfall:** Generic conversational AI or black-box risk scores are unacceptable for property transactions. Lawyers and lenders require an **unbroken chain of custody and verifiable proof**.

### 1.2 The Core Product Thesis
> **"Build one trusted evidence layer, then package it into focused legal/property workflows."**
> 
> The system is an **evidence and workflow platform**, never an automated legal opinion or government certification. High-impact conclusions must always be reviewable and signable by a qualified legal professional.

---

## 2. End-to-End Workflow & Architecture

### 2.1 The Evidence Lifecycle Flow
The FRD defines a deterministic pipeline where raw data is converted into verified findings without automated guesswork:

```
[1. Matter & Property Intake]
        │  (Survey No, Taluk, Hobli, Village, Extent, Coordinates)
        ▼
[2. Ingestion & Verification]
        │  (PDF/Image Upload ➔ SHA-256 Checksum ➔ Virus Quarantine)
        ▼
[3. Extraction & Bilingual OCR]
        │  (Tesseract kan+eng ➔ Property Schedule, Parties, Boundaries ➔ BBox Anchors)
        ▼
[4. Deterministic Intelligence Engines]
        ├─► A. Title Chain Engine (DAG graph, timeline, broken links & gap detection)
        ├─► B. GIS Rules Engine (Buffer calculations: Rajakaluve drains & lake proximity)
        ├─► C. Discrepancy Engine (Cross-document comparison: Deed vs RTC vs EC)
        └─► D. Risk Scoring Engine (Explainable findings: Critical, High, Moderate, Info)
        ▼
[5. Professional Review & Disposition]
        │  (Lawyer reviews: Accept, Dispute, Override, or Assign Task)
        ▼
[6. Immutable Report Snapshot]
        └─► (Versioned JSON & Signed PDF export with complete evidence appendix)
```

### 2.2 Core User Journeys (J1–J6)
1. **J1 — Matter & Property Intake:** Create a matter, assign advocates/analysts, enter land identifiers (District, Taluk, Hobli, Village, Survey No, Subdivision), and geocode coordinates.
2. **J2 — Document Intake:** Upload Sale Deeds, RTCs, ECs, and Khata certificates. Generate SHA-256 hashes and extract bilingual Kannada/English text.
3. **J3 — Title Chain Reconstruction:** Chronologically order deed instruments into a Directed Acyclic Graph (DAG) to detect missing predecessors, chronological inversions, or extent over-conveyance.
4. **J4 — GIS & Map Screening:** Validate cadastral boundaries against official spatial layers (Rajakaluve, water bodies, BDA master plans) and measure buffer distances.
5. **J5 — Discrepancy Detection:** Run automated cross-document comparisons (e.g., Sale Deed says 1 Acre 20 Guntas, but RTC says 1 Acre 10 Guntas).
6. **J6 — Report Sign-Off & Export:** Produce an executive summary report with an immutable evidence appendix citing exact page numbers and document hashes.

---

## 3. Current Implementation Status

### 3.1 Overall Completion
- **Functional Prototype Progress:** **~55% – 60%** (Core domain logic, UI views, and database schemas are built).
- **Production Readiness:** **~20%** (Runs locally with synthetic data; cloud infrastructure, secure storage, and real PDF generation are not ready).

### 3.2 Completed Work Breakdown

| Module | Features Implemented | Code Location | Status |
| :--- | :--- | :--- | :--- |
| **Authentication & Tenancy** | Multi-tenant organization scoping (`tenant_id`), local email/password login, demo accounts, role assignment (`owner`, `admin`, `lawyer`, `analyst`, `viewer`, `super_admin`), and audit logging. | `apps/api/src/server.ts`, `database/mysql-schema.sql` | ✅ Implemented |
| **Property Register** | Property CRUD, full Karnataka administrative hierarchy (31 Districts, Taluks, Hoblis, Villages), survey numbers, subdivisions, extents, and lat/long coordinates. | `apps/api/src/server.ts` | ✅ Implemented |
| **Document Ingestion** | Multipart upload via `multer`, MIME/size restrictions (25 MB max), local storage, and cryptographic SHA-256 checksum generation. | `apps/api/src/server.ts` | ✅ Implemented |
| **Local OCR** | Bilingual Kannada and English OCR via local Tesseract (`kan+eng`) and `pdftoppm` for PDF page rendering. | `apps/api/src/local-ocr.ts` | ✅ Implemented |
| **Title Chain Engine** | Directed Acyclic Graph (DAG) construction, sequence sorting, party normalization, and automated gap detection (missing predecessor, date conflicts, over-conveyance). | `apps/api/src/title-engine.ts` | ✅ Implemented |
| **Discrepancy Engine** | Extent normalizer (acres, guntas, sq. ft), cross-document comparison across Sale Deeds vs. RTC vs. EC, and boundary conflict detection. | `apps/api/src/discrepancy-engine.ts` | ✅ Implemented |
| **Spatial Engine** | Cadastral GeoJSON validation, distance calculations to storm-water drains (Rajakaluve) and lakes, and spatial buffering rules. | `apps/api/src/spatial-rules-engine.ts` | ✅ Implemented |
| **Risk Scoring** | Explainable baseline findings generator, point-based penalty scoring, and severity mapping (`critical`, `high`, `medium`, `low`). | `apps/api/src/risk-engine.ts` | ✅ Implemented |
| **Frontend Workspace** | React 18 + TypeScript + Vite SPA, responsive layout, property dossier, document viewer, title timeline, MapLibre map view, and admin console. | `apps/web/src/` | ✅ Implemented |
| **API Contract** | OpenAPI / Swagger specification interactive documentation at `/api-docs`. | `apps/api/src/swagger/openapi.ts` | ✅ Implemented |

---

## 4. Pending Work List (Remaining Implementation)

### 4.1 Release-Blocking Gaps (P0)

1. **Real PDF Report Generation:**
   - *Current Status:* `/api/reports/:id/pdf` returns `501 PDF_RENDERER_NOT_CONFIGURED` because previous fake PDF bytes were disabled.
   - *Required Action:* Wire up headless Chromium via Playwright or Puppeteer to generate genuine, immutable PDF reports from the HTML report template.
2. **Private Cloud Document Storage & Antivirus:**
   - *Current Status:* Uploads are stored on the local container disk (`./uploads`). If the container restarts or scales horizontally, files are lost.
   - *Required Action:* Implement Google Cloud Storage (GCS) or AWS S3 signed URLs with server-side encryption and ClamAV malware scanning.
3. **Official / Licensed GIS Datasets:**
   - *Current Status:* Database contains a single synthetic demo layer (`Arakere SWD`).
   - *Required Action:* Ingest official spatial layers from BBMP (Storm Water Drains / Rajakaluve) and Karnataka SSLR revenue maps with verified CRS (EPSG:4326) and publication metadata.
4. **Asynchronous Job Queues:**
   - *Current Status:* Heavy OCR and document analysis run synchronously on the HTTP thread, which can cause connection timeouts on multi-page files.
   - *Required Action:* Integrate Cloud Tasks, Pub/Sub, or BullMQ with worker containers for background OCR, retry policies, and dead-letter queues.
5. **Production Identity & MFA:**
   - *Current Status:* Uses local password hashes and simulated OTP codes (`DEMO_OTP_EMAIL`).
   - *Required Action:* Integrate Firebase Identity Platform / Auth with mandatory Multi-Factor Authentication (MFA) for lawyers and admins, plus live Resend (Email) and Twilio (SMS) delivery.

### 4.2 Phase 2 & Enterprise Enhancements (P1)
- **Deep Legal Research & Vector Search:** Implement vector embeddings (`pgvector` / vertex embeddings) over the Karnataka Land Revenue Act, Land Reforms Act, and PTCL case law.
- **Government Registry Webhooks & Watchers:** Scheduled pollers to detect new entries in Kaveri 2.0 or mutation statuses in Bhoomi.
- **Tenant Billing & Metering:** Stripe / Razorpay payment gateway integration with per-dossier pricing and page-count meters.

---

## 5. Defects, Mistakes & Architectural Divergences

### ⚠️ 1. Architectural Divergence: Database & Backend Framework
- **FRD Specification:** Mandates **Google Cloud SQL PostgreSQL + PostGIS + pgvector** and **NestJS**.
  - *Why:* Native PostGIS spatial queries (`ST_DWithin`, `ST_Intersects`) and `pgvector` allow relational, geospatial, and semantic vector search in a single database engine.
- **Current Codebase:** Built with **MariaDB 10.11** + **Express.js**.
  - *Impact:* MariaDB has basic spatial support, but lacks `pgvector` for semantic legal research. Furthermore, Express resulted in a single massive file (`apps/api/src/server.ts` is 3,685 lines) rather than clean, testable NestJS modules.

### 🐛 2. The Historical "Fabricated Fallback" Trap
- **What Occurred:** Early code versions invented synthetic facts when real data was missing (e.g., generating 3 fake deeds when a title chain was empty, inventing 18m buffer distances, and returning dummy PDF bytes).
- **Current State:** As recorded in `P0-GAP-REGISTER.md`, these misleading fallbacks have been removed and replaced with defensive guards (`501 Not Implemented`, `unknown` states). However, the real external integrations to fulfill those endpoints have yet to be connected.

### ⚠️ 3. Frontend Bundle Size Bloat
- Vite production build triggers a chunk size warning: the main JavaScript file is **1.68 MB** before gzip.
- **Issue:** No code-splitting or route lazy-loading (`React.lazy()`) is implemented for large libraries like MapLibre and Lucide icons.

### ⚠️ 4. Brittle Integration Testing Suite
- Running `npm test` fails with `ECONNREFUSED` unless MariaDB is running on port `3306` with pre-seeded data. The test suite lacks mocked in-memory database fixtures for isolated CI/CD runs.

---

## 6. Actionable Implementation Roadmap

### Phase 1: Foundations (Week 1)
- Fix integration test suite with mocked in-memory DB fixtures.
- Add route-based lazy loading (`React.lazy()`) in Vite to shrink bundle size from 1.68MB to < 300KB.

### Phase 2: Core P0 Services (Weeks 2–4)
- Wire Playwright/Puppeteer headless PDF generator for legal reports.
- Implement Google Cloud Storage / S3 signed URLs with virus scanning.
- Import verified BBMP Rajakaluve and lake spatial layers with official CRS.
- Introduce background async worker queues (BullMQ / Cloud Tasks).

### Phase 3: Hardening & Launch (Weeks 5–6)
- Connect live Firebase Auth & MFA.
- Run complete end-to-end audit with synthetic property corpus.
- Sign off on legal templates and release for controlled internal pilot.
