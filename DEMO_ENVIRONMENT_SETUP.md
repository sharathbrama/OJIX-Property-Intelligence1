# OJIX Property Intelligence — Demo Environment Setup Guide

## 1. Overview

This document guides engineers, testers, and stakeholders through setting up the **OJIX Property Intelligence Demo Environment** locally or in staging.

The environment requires **no cloud tokens**, **no paid AI APIs**, and **no running MariaDB/MySQL server** to deliver a complete end-to-end client demo experience.

---

## 2. System Requirements

- **Node.js:** v20.x or v22.x (Recommended: Node 22+)
- **npm:** v10+
- **Python (Optional for local Tesseract OCR):** Python 3.9+ with `tesseract` and `poppler-utils` / `pdftoppm` installed.
  - On macOS: `brew install tesseract poppler`
  - On Ubuntu/Debian: `sudo apt-get install -y tesseract-ocr poppler-utils`
  *(Note: If Tesseract/Python is omitted, the demo runner automatically uses high-fidelity structured fallback parsing without errors).*

---

## 3. Quickstart (Under 2 Minutes)

```bash
# 1. Clone & Switch to the Demo Branch
git clone <repo-url>
cd OJIX-NonLetigation-Law-inteligence
git checkout ojix-client-demo

# 2. Install Dependencies
npm install

# 3. Create Demo Environment Configuration
cp .env.example .env

# Set DEMO_MODE=true in .env
# (No DB or Cloud tokens needed)

# 4. Start Development Servers
npm run dev
```

The web application will be accessible at:
- Frontend: `http://localhost:5173`
- API Health & Endpoints: `http://localhost:4002/api/health`

---

## 4. Key Demo Configuration Flags

In your `.env`:

```env
# Activates the zero-dependency session repository and mock database pool
DEMO_MODE=true

# Enables one-click instant authentication bypassing OTP & SMS
PUBLIC_DEMO_LOGIN_ENABLED=true

# Sets session duration (hours)
PUBLIC_DEMO_SESSION_TTL_HOURS=8

# Configures document upload limit (MB)
MAX_UPLOAD_MB=25

# Uses local in-memory private storage
DOCUMENT_STORAGE_PROVIDER=local
```

---

## 5. Supported Demo Roles

All 10 RBAC roles are available without logging out:

1. **`super_admin`:** Platform Administrator — System health, synthetic organizations, security audit log, member directory.
2. **`owner`:** Workspace Owner / Managing Partner — Portfolio overview, firm settings, workload analytics, approvals.
3. **`admin`:** Organization Admin — User management, permission overrides, audit history.
4. **`lawyer`:** Senior Legal Reviewer — Title verification, discrepancy review, legal sign-off, report generation.
5. **`analyst`:** Evidence Analyst — Schedule data extraction, document cross-checking, task execution.
6. **`operations`:** Document Intake Operations — Document intake, OCR review, queue tracking.
7. **`consultant`:** Property Consultant — Client dossier inspection, report generation and sharing.
8. **`support`:** Support Specialist — Workspace diagnostics and service health indicators.
9. **`data_steward`:** Platform Data Admin — Location hierarchy (Districts, Taluks, Hoblis, Villages) and data quality governance.
10. **`viewer`:** Read-Only Client Reviewer — Access approved property summaries and released evidence.

---

## 6. Preloaded Synthetic Dataset

Every new session is seeded with realistic Karnataka property records:

1. **OJ-2026-BLR-001 (Whitefield Residential Site Sy 45/3A):**
   - Non-agricultural residential plot near ITPL junction.
   - Seeded documents: Sale deed, RTC, Encumbrance certificate.
   - Seeded findings: Rajakaluve / SWD buffer proximity alert, title conveyance link review.

2. **OJ-2026-BLR-002 (Jayanagar Agricultural Land Sy 112/5):**
   - Agricultural parcel with 1 acre 20 guntas extent.
   - Seeded findings: Extent discrepancy between RTC extract and registered sale deed.

3. **OJ-2026-BLR-003 (Hebbal Commercial Plot Sy 78/1):**
   - High-value commercial plot on Outer Ring Road.
   - Status: Approved with clean title chain and completed report.
