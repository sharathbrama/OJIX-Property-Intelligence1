# OJIX PROPERTY INTELLIGENCE
## Functional Requirements Document + Technical Architecture (Aligned Production Baseline)
**Product:** AI-Assisted Land, Property and Legal Due-Diligence Platform  
**Scope:** Karnataka-First, Bengaluru-First Property Intelligence  
**Document Version:** 1.1 (Production & Architecture Aligned)  
**Database Mandate:** MariaDB 10.11 / MySQL 8.x with Native Spatial Geometries & JSON Engines  
**Prepared For:** OJIX Engineering & Technology LLP, Bengaluru, Karnataka, India  
**Status:** Canonical Engineering Baseline

---

### IMPORTANT OPERATING PRINCIPLE
> **The platform is an evidence and workflow verification system. It does not represent automated AI output as a certified legal opinion, ownership guarantee, or government sanction. High-impact conclusions, title chain integrity, and transaction clearance remain strictly reviewable and signable by a qualified Advocate.**

---

## 1. Executive Summary & Vision

OJIX Property Intelligence is a single, reusable intelligence platform for advocates, real estate legal teams, property consultants, developers, lending institutions, and serious land buyers designed to answer one question quickly:
> **"What do we know about this property, what verified evidence supports it, what inconsistencies exist, what spatial or statutory risks threaten the transaction, and what requires professional advocate review?"**

The platform consolidates non-litigation legal office automation, 40-year chain-of-title reconstruction, bilingual (Kannada and English) land record extraction, cross-document discrepancy detection, statutory spatial buffer screening (BBMP Rajakaluve drains and lake peripheries), and structured legal reporting.

### Core Product Tenet: Deterministic Evidence Layer
The differentiator is **not a generic AI chat box**. It is:
1. **Traceable Evidence:** Every fact links to a specific document, page number, and bounding box.
2. **Geospatial Rigor:** Deterministic distance calculations against Karnataka spatial layers.
3. **Deterministic Rules:** Automated conflict detection for survey numbers, boundaries, extents, and dates.
4. **Professional Reviewability:** Explicit role separation where legal opinions require licensed advocate sign-off.

---

## 2. Product Roles & Operating Model

The operating model maintains tenant-scoped isolation across all resources:
$$\text{Tenant (Firm)} \longrightarrow \text{Workspace} \longrightarrow \text{Property Matter} \longrightarrow \text{Documents} \longrightarrow \text{Extracted Facts} \longrightarrow \text{Discrepancies} \longrightarrow \text{Legal Sign-off} \longrightarrow \text{Client Decision Pack}$$

### 2.1 The 8 Canonical Product Roles

| Role Key | Role Title | Core Responsibilities | Access & Permission Boundaries |
| :--- | :--- | :--- | :--- |
| `owner` | **Workspace Owner** | Managing Partner / Firm Founder; oversees firm branding, billing, user policies, and firm-wide risk. | Full tenant administration; protected against accidental deletion or demotion. |
| `admin` | **Organisation Admin** | Manages users, invitations, role permissions, retention policies, and immutable audit logs. | Full tenant administration; cannot self-certify legal opinions or demote the owner. |
| `lawyer` | **Lead Advocate / Reviewer** | Qualified Advocate owning final non-litigation due-diligence review, resolving discrepancies, and signing legal opinions. | Create/edit matters, verify title events, approve reports, record Bar Council enrollment number. |
| `analyst` | **Associate / Analyst** | Performs document ingestion, corrects OCR extractions, tags evidence anchors, and prepares preliminary discrepancies. | Edit extraction fields, run analysis; cannot legally certify title or approve final client reports. |
| `operations` | **Paralegal / Operations** | Initial document intake, completeness checklist, metadata cleanup, duplicate detection, and file hygiene. | Upload files, update intake checklists, assign priorities; no legal decision access. |
| `consultant` | **Property Consultant** | Prepares client-ready transaction dossiers, compiles executive summaries, and tracks commercial issues. | View assigned matters, compile Client Decision Packs; cannot alter legal title opinions. |
| `viewer` | **Client / Read-only Reviewer** | Bank officer, land buyer, or investor viewing the final approved report and executive risk summary. | Read-only access strictly restricted to matters explicitly shared and approved by the Advocate. |
| `support` | **OJIX Support** | Technical troubleshooting with time-bound (1-hour) sessions. | System diagnostics and error logs only; strictly blocked from customer document scans and reports. |
| `data_steward` | **OJIX Data Steward** | Governs government source mappings, spatial layer vintages, and rule versioning. | Manage spatial buffer rules, connector status, and source metadata; no tenant user management. |
| `super_admin` | **Platform Super Admin** | Platform-level operations, organization provisioning, and global telemetry. | Cross-tenant infrastructure oversight; strictly audited. |

---

## 3. Database Architecture & Technical Stack

### 3.1 Database: MySQL / MariaDB Foundation
The platform is built on **MariaDB 10.11 / MySQL 8.x** utilizing native database engines:
* **Spatial Processing:** MySQL native `GEOMETRY`, `POINT`, and `POLYGON` types with `SPATIAL INDEX` (R-Tree) and spherical geodesic functions (`ST_Distance_Sphere(geom1, geom2)`).
* **JSON Structured Facts:** MySQL native `JSON` columns storing multi-field extraction anchors and party lists, with virtual generated columns for indexing.
* **Full-Text Retrieval:** Built-in MySQL `FULLTEXT` index over normalized document text and statutory legal provisions.

### 3.2 Backend Service Architecture
* **Runtime:** Node.js 22 LTS, TypeScript (`tsx`), Express.js REST API.
* **Security Middleware:** Helmet (OWASP secure headers), CORS origin validation (allowing localhost and production domains), rate limiting (`express-rate-limit`).
* **Authentication:** Dual-mode: Local `scrypt` password hashing + Gmail SMTP 6-digit OTP challenges, with Firebase Auth hooks for enterprise cloud identity.
* **PDF Engine:** Headless Chromium via Playwright / Puppeteer producing multi-page PDF opinions with headers, footers (*"Page X of Y"*), and statutory disclaimers.

### 3.3 Frontend Architecture
* **Framework:** React 18 with TypeScript, Vite bundler, and Tailwind CSS.
* **Maps Engine:** MapLibre GL JS / Leaflet providing interactive cadastral survey parcel rendering and statutory buffer overlays.
* **Dual Execution Modes:**
  1. **Enterprise Live Mode:** Connected to MariaDB/MySQL database with full multi-tenancy and live document storage.
  2. **Standalone Client Demo Mode:** Self-contained browser-persistent mode allowing full role switching and interactive testing with zero external dependencies.

---

## 4. End-to-End Due-Diligence Lifecycle (10 Phases)

```
[ Phase 1: INTAKE & TRIAGE ] ──────> [ Phase 2: HYGIENE & CHECKLIST ] ──────> [ Phase 3: BILINGUAL EXTRACTION ]
   Owner / Admin assigns team           Operations completes checklist            Tesseract OCR & layout analysis
                 │                                    │                                    │
                 ▼                                    ▼                                    ▼
[ Phase 4: EVIDENCE TAGGING ] ──────> [ Phase 5: TITLE RECONSTRUCTION ] ───> [ Phase 6: DISCREPANCY MATRIX ]
   Analyst verifies page anchors        40-year chronological DAG built           Cross-document mismatch detected
                 │                                    │                                    │
                 ▼                                    ▼                                    ▼
[ Phase 7: SPATIAL SCREENING ] ─────> [ Phase 8: ADVOCATE SIGN-OFF ] ───────> [ Phase 9: DECISION PACK ]
   Rajakaluve & Lake 30m buffers        Advocate signs Bar Council opinion        Consultant prepares client pack
                                                      │
                                                      ▼
                                       [ Phase 10: CLIENT DELIVERY ]
                                          Viewer accesses approved report
```

---

## 5. Functional Specifications per Module

### 5.1 Document Intake & Hygiene Checklist (Operations)
* Mandatory statutory non-litigation Karnataka document checklist:
  1. **Form 15 & Form 16 Encumbrance Certificate (EC):** 30–40 year search range.
  2. **Parent Title Deeds:** Absolute Sale Deed, Gift Deed, Partition Deed, Release Deed.
  3. **Current RTC / Pahani:** Verification of Column 9 (Owner), Column 10 (Extent), Column 11 (Liabilities), Column 12 (Crops/Cultivator).
  4. **Mutation Register (MR) Extract:** Verification of acquisition mode (Inheritance, Purchase, Grant).
  5. **Municipal Records:** BBMP e-Aasthi, e-Khata, Assessment Register extract.
  6. **Revenue Map & Topography:** Survey Sketch, Tippan, Village Map (Naksha).
  7. **Tax Paid Receipts:** Minimum 3 recent financial years.
* **Duplicate Detection:** Automatic SHA-256 checksum calculation flags duplicate uploads before indexing.

### 5.2 Bilingual OCR & Evidence Extraction (Analyst)
* Extraction schema parses:
  - Document registration number, date of execution, date of registration, Sub-Registrar Office (SRO).
  - Executant (Seller / Donor) and Claimant (Buyer / Donee) parties with parentage and address.
  - Property schedule: Survey number, hissa / subdivision, village, hobli, taluk, district.
  - Land extent normalized into square feet: Acres, Guntas, Cents, Sq. Yards, Sq. Meters.
  - Four-side boundaries: North, South, East, West with cross-deed mismatch flagging.
* Evidence anchoring stores: `page_number`, `bounding_box: [ymin, xmin, ymax, xmax]`, and extraction confidence score.

### 5.3 40-Year Title Chain DAG Reconstruction (Advocate)
* Represents property ownership transfer events on a directed acyclic graph (DAG).
* Automated gap detection:
  - Discontinuity between Buyer in Deed $N$ and Seller in Deed $N+1$.
  - Missing intermediate succession or partition documentation.
  - Extent variance exceeding configured tolerance margin (1.0%).
  - Date anomalies (e.g., deed executed prior to mutation of predecessor).

### 5.4 Spatial Buffer Screening Engine (Data Steward & Advocate)
* Implemented in MySQL using `ST_Distance_Sphere`:
  - **Primary Rajakaluve (Storm-Water Drain):** 50 meters statutory buffer zone.
  - **Secondary Rajakaluve:** 25 meters statutory buffer zone.
  - **Tertiary Rajakaluve:** 15 meters statutory buffer zone.
  - **Lake / Waterbody Periphery:** 30 meters statutory buffer zone under NGT guidelines.
* Every finding outputs: Exact distance in meters, clearance status (`Clear`, `Buffer Zone`, `Encroached`, `Unknown`), and rule version.

### 5.5 Lead Advocate Formal Sign-Off State Machine
* Gatekeeper to report release:
  - Captures Advocate Full Name, Bar Council Enrollment Number, Sign-off Date, and Opinion Verdict:
    - `marketable_title` — Clear and marketable title established.
    - `conditional_clearance` — Marketable subject to specified encumbrance discharge or document retrieval.
    - `rejection_defective_title` — Severe title break, government acquisition, or drain encroachment detected.
  - Freezes immutable snapshot in `legal_report_approvals`.

### 5.6 Client Sharing & Viewer Security
* Viewers access the application through explicit shares recorded in `property_client_shares`.
* Unreleased drafts, internal reviewer disputes, low-confidence OCR logs, and unverified notes are strictly stripped from viewer responses.

---

## 6. MySQL Database Schema Blueprint

```sql
-- 1. Organizations (Tenants)
CREATE TABLE IF NOT EXISTS organizations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  plan VARCHAR(40) NOT NULL DEFAULT 'standard',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Properties (Due Diligence Matters)
CREATE TABLE IF NOT EXISTS properties (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  application_number VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(191) NOT NULL,
  survey_number VARCHAR(60) NOT NULL,
  subdivision VARCHAR(60) NULL,
  village VARCHAR(100) NOT NULL,
  hobli VARCHAR(100) NULL,
  taluk VARCHAR(100) NOT NULL,
  district VARCHAR(100) NOT NULL,
  extent VARCHAR(100) NOT NULL,
  extent_sqft DECIMAL(14,2) NULL,
  boundary_north VARCHAR(255) NULL,
  boundary_south VARCHAR(255) NULL,
  boundary_east VARCHAR(255) NULL,
  boundary_west VARCHAR(255) NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'documents_pending',
  workflow_priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  due_date DATE NULL,
  assigned_lawyer_uid VARCHAR(191) NULL,
  assigned_analyst_uid VARCHAR(191) NULL,
  assigned_operations_uid VARCHAR(191) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  KEY properties_tenant_status_idx (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Document Intake Checklist
CREATE TABLE IF NOT EXISTS property_intake_checklist (
  id CHAR(36) NOT NULL PRIMARY KEY,
  property_id CHAR(36) NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  document_id CHAR(36) NULL,
  verified_by_uid VARCHAR(191) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY intake_prop_code_idx (property_id, item_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Legal Report Approvals (Advocate Sign-Off)
CREATE TABLE IF NOT EXISTS legal_report_approvals (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  property_id CHAR(36) NOT NULL,
  advocate_uid VARCHAR(191) NOT NULL,
  advocate_name VARCHAR(160) NOT NULL,
  bar_council_number VARCHAR(100) NOT NULL,
  opinion_verdict VARCHAR(40) NOT NULL,
  notes TEXT NULL,
  statutory_disclaimer_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
  snapshot_hash CHAR(64) NOT NULL,
  approved_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY report_approvals_prop_idx (tenant_id, property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Property Client Shares (Viewer Access)
CREATE TABLE IF NOT EXISTS property_client_shares (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  property_id CHAR(36) NOT NULL,
  viewer_uid VARCHAR(191) NOT NULL,
  shared_by_uid VARCHAR(191) NOT NULL,
  shared_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  revoked_at DATETIME(6) NULL,
  KEY client_shares_lookup_idx (tenant_id, viewer_uid, property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 7. Acceptance Criteria & Launch Gate

1. **Intake Gate:** Operations can upload deeds, verify SHA-256 uniqueness, and complete the 7 statutory checklist items.
2. **Extraction Gate:** Analyst can review extracted Kannada and English fields and verify page-level evidence anchors.
3. **Discrepancy Gate:** Deterministic checks flag extent differences and boundary conflicts across title deeds.
4. **Spatial Gate:** MySQL `ST_Distance_Sphere` calculates metric clearance against Rajakaluve drains and lake peripheries.
5. **Advocate Sign-Off Gate:** Legal opinion approval requires a licensed advocate with Bar Council number, freezing an immutable snapshot.
6. **Client Gate:** Viewer access is restricted to approved, explicitly shared matters without exposing raw internal documents.
7. **Demo Parity Gate:** The entire 10-phase lifecycle operates in both MySQL live mode and self-contained browser demo mode.
