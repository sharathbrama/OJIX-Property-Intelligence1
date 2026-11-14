# OJIX Engineering — Architecture & Trust Boundaries

## 1. System Overview
OJIX Property Intelligence is an evidence-first legal due diligence and land transaction intelligence platform for Karnataka and Bengaluru. It combines physical and digital land records (Sale Deeds, RTC/Pahani, Mutation Records, Encumbrance Certificates), reconstructs 40-year chain-of-title histories, flags statutory spatial violations (Rajakaluve/SWD buffers, lake peripheries), and outputs reviewable legal due-diligence dossiers verified by qualified advocates.

## 2. Technical Stack
- **Frontend (`apps/web`):** React 18, TypeScript, Vite, Tailwind CSS, MapLibre GL JS.
- **Backend API (`apps/api`):** Node.js 20+, Express 4.21, TypeScript, Zod schema validation, native Node watch runner.
- **Database (`infra/db`):** MariaDB 10.11 on `127.0.0.1:3308`, pooled with `mysql2/promise`.
- **Report Generation:** Headless Chromium via Puppeteer rendering high-fidelity HTML/CSS with PDFKit fallback.
- **OCR Engine:** Bilingual Tesseract (`kan+eng`) with `pdftoppm` layout extraction and bounding-box evidence anchoring.
- **Authentication:** Dual-mode (Local scrypt password hash + SMTP email OTP challenges; Firebase ID token verification for cloud deployment).

## 3. Trust Boundaries & Data Classification
- **Classification:** Confidential (client land title documents, transaction values, identity proofs, surveyor annotations).
- **Tenant Scoping:** All database tables and queries enforce `tenant_id` isolation.
- **Separation of Powers:** Business administration (Workspace Owner) is strictly separated from legal title sign-off (Lead Advocate / Reviewer).
- **Sole Owner Invariant:** Invariant enforces that a tenant can never have zero active Workspace Owners; sole owners cannot be demoted or deleted.

