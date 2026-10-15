# Implementation Roadmap — Remaining P0 Work

**Baseline date:** 14 October 2026  
**Calendar commitment:** none. Required decision owners, staffing and external access are not confirmed; dates would be invented. Next checkpoint: Product/Tech lead confirms owners, environment and priority decisions, then Engineering Manager re-estimates and publishes dated milestones within two working days of that confirmation.

## Executed vs remaining

| Work package | Current state | Exit evidence | Dependency / next checkpoint |
|---|---|---|---|
| P0-A Remove fabricated behavior | In Progress / Ready for Verification: code fixes applied to title, GIS, report, source lookup and map. Focused unit tests pass; E2E unavailable. | Review diff; staging empty-data and demo-row tests; verify no remaining UI fake response in active workflows. | API/Web leads; repeat source scan and runtime once MariaDB/API available. |
| P0-B Stable API/property flow | In Progress: property, document, review and title persistence code exists. | Create/read/update and persistence after API restart; malformed input and tenant isolation test output. | QA environment + DB/API service. |
| P0-C Authentication and access | In Progress: Firebase/session/RBAC code exists; production config not verified. | Role matrix, revocation, invalid-token, cross-tenant route tests on staging. | Firebase/identity, named pilot identities, security owner. |
| P0-D Evidence/document lifecycle | Blocked: local uploads/checksum/manual review exist; cloud private store, malware scan, immutable versions and full provenance are missing. | Storage/IAM/quarantine/deletion/access audit and restore acceptance. | Cloud project/IAM, retention/legal decision, storage adapter owner. |
| P0-E GIS source-backed screening | Blocked: suppresses unverified seed rows and synthetic conclusions; positive source-backed acceptance absent. | Licensed source/terms/CRS/vintage/checksum, known-case evidence and rule approval. | Data steward/legal source approval. |
| P0-F Reports | In Progress/Blocked: HTML is escaped and truthful for missing data; JSON exposes linked document evidence; PDF fake removed; real PDF/signature not implemented. | Immutable report snapshot with provenance links/timestamps; genuine renderer; qualified approver. | Evidence model, renderer and Legal/Product approval. |
| P0-G Cloud, reliability and recovery | Blocked: repository Compose/deployment docs only. | Approved target, secrets/IAM, observability, backups, measured restore, load and security evidence. | Product/Tech/cloud decisions, budget/access, NFR and RPO/RTO. |
| P0-H Controlled pilot acceptance | Not Started. | Full authorized end-to-end case, role/security and legal sign-off, P0s closed. | P0-A through G, client consent and pilot operator. |

## Order of execution

1. Complete verification of changes in P0-A; fix any remaining active-route false outputs.
2. Bring up isolated MariaDB/API environment and run persistence, auth, file, title and cross-tenant checks. Preserve any existing records; use fresh disposable DB only for tests.
3. Confirm target cloud/database and identity; build secure file storage/access and recovery before real documents.
4. Decide manual-evidence pilot vs OCR. Keep automated OCR out until provider, terms, corpus and acceptance target are agreed.
5. Secure licensed GIS sources and implement geometry/rule validation; otherwise keep map risk unavailable.
6. Finish report provenance, renderer and qualified approval; then complete load/security/restore and controlled E2E acceptance.

## Effort/timeline policy

No new person-day or calendar estimate is entered here. Prior plan ranges are explicitly provisional and cannot become delivery dates. Re-estimate each package only after role-level owners, contributors, parallel capacity, access, acceptance cohort and decisions are confirmed. Set a near-term checkpoint (two working days after those inputs are confirmed) to issue the committed milestone schedule; report blocked dependencies with owner and next action.

