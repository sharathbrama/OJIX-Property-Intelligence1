# OJIX Engineering — Acceptance Criteria

## 1. Verified Core Gates
- [x] **Headless PDF Generation:** Chromium renders high-fidelity multi-page PDFs with running headers, title chain tables, discrepancy tables, and disclaimers. Fallback to PDFKit when Chromium is constrained.
- [x] **Workspace Settings:** Branding, LLPIN, practice address, statutory Karnataka GIS buffer thresholds (50m/25m/15m/30m), and OCR confidence persistence.
- [x] **Sole Owner Invariant:** Demotion, disabling, or removal of the last active Workspace Owner returns HTTP 403.
- [x] **Legal Sign-Off Separation:** Only role `lawyer` may transition status to `approved` or `complete`.
- [x] **Privileged MFA Policy:** MFA toggle controls whether OTP is mandated or direct login is permitted for workspace staff.
- [x] **Location Hierarchy:** Kaveri 2.0 geographic hierarchy (31 districts, 240 taluks, 861 hoblis, 30,404 villages) populated in MariaDB.

## 2. Active Owner Role Pending Gates
- [ ] **P1 - Ownership Transfer Flow:** Active Owner can safely transfer ownership or appoint co-owners via audited handover endpoint and UI.
- [ ] **P2 - Server-Side `ownerGuard` Separation:** Dedicated middleware separating Owner-only governance from general Admin actions.
- [ ] **P3 - Client Report Release Gate:** Explicit business release authorization and share link generation for client viewers.
- [ ] **P4 - Matter Workspace Lifecycle (MAT-01):** Top-level client matter dossier grouping individual properties.
- [ ] **P5 - Plans & Billing Quota Governance:** Tier tracking, usage counters, and OCR page quotas.
- [ ] **P6 - AI Model Gateway & Prompt Governance:** Configurable LLM provider, prompt template versions, and token limits.
- [ ] **P7 - Retention Purge & Legal Hold Engine:** Automated retention purge job with strict legal hold override.
- [ ] **P8 - Partner Executive Dashboard:** Real-time due diligence pipeline metrics, overdue tasks, and connector health.

