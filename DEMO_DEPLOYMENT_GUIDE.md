# OJIX Property Intelligence — Client Demo Deployment Guide

## 1. Executive Summary

This guide outlines the precise deployment procedure for the **OJIX Property Intelligence Client Demo** on **Vercel**.

The demo application has been engineered to be **100% self-contained**, eliminating all runtime dependencies on production MariaDB/MySQL databases, cloud SMTP relays, external SMS gateways, or paid third-party AI APIs (0 cloud tokens used).

---

## 2. Architecture & Deployment Boundaries

| Component | Production Architecture | Client Demo Architecture |
|---|---|---|
| **Platform** | Railway / Docker / Managed VPS | **Vercel Serverless Only** |
| **Database** | MariaDB / MySQL cluster | **Stateless Session-Scoped Mock Engine (`session-repository.ts` & `mock-pool.ts`)** |
| **Authentication** | Mandatory Email/SMS OTP + Password | **One-Click Instant Demo Login + In-App Role Switching** |
| **Roles** | 10 Roles via DB memberships | **All 10 Roles Supported Dynamically** |
| **OCR Engine** | Background Celery/Redis Python Worker | **Integrated Python Tesseract Runner (`run_ocr.py`) + Fallback Tokenizer** |
| **Storage** | Private GCS / Supabase bucket | **In-Memory Session Storage + Private Vercel Blob adapter** |
| **External APIs** | Bhoomi / Kaveri / Dishaank / Twilio | **Mocked / Marked "Demo Mode — Not Connected"** |

---

## 3. Deployment Pre-requisites

1. **Vercel Account:** Free or Pro account on vercel.com.
2. **Vercel CLI (optional for CLI deploy):**
   ```bash
   npm i -g vercel
   ```
3. **Repository Branch:**
   Ensure work is committed on the isolated demo branch:
   ```bash
   git checkout ojix-client-demo
   ```
   *Never deploy to production branch `main`.*

---

## 4. Step-by-Step Vercel Deployment

### Method A: Vercel Dashboard (Recommended)

1. Navigate to [vercel.com/new](https://vercel.com/new).
2. Import the Git repository (or fork repository containing branch `ojix-client-demo`).
3. Set **Root Directory** to `./` (root).
4. Configure Build & Development Settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `apps/web/dist`
   - **Install Command:** `npm install`
5. Configure Environment Variables (see Section 5 below).
6. Click **Deploy**.

### Method B: Vercel CLI

```bash
# Link project
vercel link

# Deploy preview build from ojix-client-demo
vercel --env DEMO_MODE=true

# Deploy to production alias when validated
vercel --prod
```

---

## 5. Required Environment Variables

Configure the following variables in the Vercel Project Settings:

```env
# Core Operation
NODE_ENV=production
DEMO_MODE=true
PUBLIC_DEMO_LOGIN_ENABLED=true
PUBLIC_DEMO_TENANT_ID=tenant-ojix-client-demo

# API & Security
PORT=4002
TRUST_PROXY_HOPS=1
PUBLIC_DEMO_SESSION_TTL_HOURS=8

# Storage & Upload Limits
MAX_UPLOAD_MB=25
DOCUMENT_STORAGE_PROVIDER=local

# OCR Configuration
OCR_MAX_PAGES=5
OCR_LANGUAGES=eng+kan
```

*Note: No `DATABASE_URL`, `TWILIO_*`, `SMTP_*`, or `VERTEX_AI_*` tokens are required.*

---

## 6. Verification Checklist Post-Deployment

- [ ] **One-Click Login:** Click "Enter Demo Workspace" — authenticates without OTP or password.
- [ ] **10-Role Switching:** Switch between all 10 roles via the topbar banner. Verify permissions update dynamically.
- [ ] **Super Admin Dashboard:** Access Super Admin console (`super_admin` role) and view synthetic organizations and audit logs.
- [ ] **Property Listing:** Verify default Karnataka properties (Whitefield, Jayanagar, Hebbal) render with correct extent and survey numbers.
- [ ] **Property Creation:** Click "New Property Application" and verify property creation succeeds.
- [ ] **Document Intake & OCR:** Upload a PDF document and verify text extraction and structured property schedule fields.
- [ ] **Title Chain & Discrepancies:** Verify the 3-step conveyance timeline and GIS proximity alerts render correctly.
- [ ] **Clean Logout:** Click "Exit Demo" and verify session data is cleaned up.
