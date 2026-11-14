# OJIX Engineering — Security & Authorization Review

## 1. Verified Controls
- **Tenant Isolation:** Enforced on SQL queries via `tenant_id` parameters.
- **Sole Owner Invariant:** Demotion or removal of the last remaining active Owner is blocked server-side (HTTP 403).
- **Separation of Powers:** Only role `lawyer` may approve/complete legal due diligence reports.
- **Session Revocation:** Durable sessions can be revoked per user; sessions expire deterministically.
- **Audit Logging:** Immutably records administrative mutations (`admin.member_role_changed`, `admin.member_status_changed`, `admin.settings_updated`, etc.).

## 2. Identified Vulnerabilities & Pending Hardening
1. **Lumped Admin Guard:** `adminGuard` permits `['owner', 'admin']` across almost all governance routes. Certain destructive or fundamental firm actions (e.g. transfer of ownership, tenant billing tier changes, firm deletion) lack an isolated `ownerGuard`.
2. **Legal Reviewer Guard Mismatch:** `legalReviewerGuard` includes `admin`, even though the canonical `ROLE_PERMISSIONS` matrix excludes `legal_review` from general administrators. Must be narrowed to `['owner', 'lawyer']`.
3. **Implicit Client Release:** Client viewers currently access matters when `properties.status = 'complete'`, rather than requiring an explicit, auditable release grant by the Managing Partner or Lead Advocate.

