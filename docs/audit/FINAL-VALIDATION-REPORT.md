# Final Validation Report — Current Repository Work

**Updated:** 15 October 2026, 11:30 IST. Historical baseline entries below are retained; latest revalidation is recorded first.  
**Release status:** RED — not ready for external client data or public production.  
**Scope:** repository implementation and available local checks; no live customer, external cloud, official dataset or production environment accessed.

## Revalidation — 15 October 2026, 11:30 IST

| Command / check | Result | Evidence / limits |
|---|---|---|
| `GET http://127.0.0.1:4000/health` | PASS — `status: ok`, `database: connected`, `databaseEngine: MariaDB` | Ran against the local development API and MariaDB. Authentication reported `local-development-only`; this is not production identity evidence. |
| `npm test` from repository root | PASS — 427 passed, 0 failed, 0 skipped | The API process was started in development mode first. Includes API role/tenant and document-security cases plus unit/rule tests. No complete browser-driven workflow was run. |
| `npm run typecheck` | PASS | API and web TypeScript checks exited 0. |
| `npm run build` | PASS | API compilation and web Vite production build exited 0. Vite warns the JS bundle is larger than 500 kB (1.64 MB before gzip). |
| Read-only browser map check at `http://localhost:5173/maps` | PASS — map point response displayed `UNKNOWN` for both source categories and said clearance could not be determined | Local unverified/demo data did not produce a positive result. Removed hardcoded hotspot controls, fabricated rings/parcel polygon, and map-to-property geometry write. Responsive narrow layout visually checked. This is one focused UI check, not a complete E2E journey. |

No browser-to-database property workflow, production authentication, client-data test, licensed GIS positive case, cloud storage, real PDF renderer, or backup/restore verification is claimed.

## Additional map safeguards

- Point-screening queries now use only active spatial layers with `data_status='verified'`, source name, source URL and source date, and supported spatial layer types. Findings carry available source provenance.
- Spatial screening now returns `unknown` / `missing_coordinates` for invalid coordinates instead of a misleading clear result.
- The global map no longer exposes hardcoded Bengaluru “hotspots,” draws generated buffer circles or parcel geometry, attaches point-derived geometry to a property, or says that an empty result satisfies statutory thresholds. It explains when results are unknown and that they are not official clearance.
- The map layout stacks at narrow widths; a browser check confirmed the map is visible in a mobile-sized viewport.

## Changes implemented in this work

- Removed fabricated historical title events from the empty title-chain path (`apps/api/src/server.ts:1953-1995`).
- Spatial screening no longer assumes missing property coordinates or fabricates GIS layers; an empty/unavailable dataset yields unknown. Invalid stored coordinates return 422. Spatial API screening only selects rows with verified status and source name, URL and date (`apps/api/src/server.ts:2151-2225`). Point screening rejects absent coordinates and database query errors instead of returning dummy results (`apps/api/src/server.ts:2228-2265`).
- Dashboard spatial source health now queries only provenance-complete verified layers (`apps/api/src/server.ts:1005-1093`). Analysis route only examines same-qualified imported layers (`apps/api/src/server.ts:1455-1472`).
- Spatial engine no longer generates a parcel polygon or PNG and ignores input layers without a real distance or coordinates (`apps/api/src/spatial-rules-engine.ts:216-354`).
- Removed browser GIS fallback fake findings, assumed parcel geometry, and false snapshot download. Missing coordinates and API errors are explicit; Canvas fallback draws only neutral grid/message (`apps/web/src/components/MapViewer.tsx:111-175,535-570`).
- Source-registry search has no prefilled example identifiers or quick presets; it no longer writes an invented 30-gunta extent. API rejects incomplete search identifiers (`apps/web/src/components/SourceRegistryView.tsx:72-80,202-235,240-265`; `apps/api/src/server.ts:2715-2748`).
- Report HTML escapes dynamic values, removes misleading “no gaps” claims where no events/documents exist, and marks spatial unknowns. Mock PDF bytes were removed; PDF route returns `501 PDF_RENDERER_NOT_CONFIGURED` (`apps/api/src/report-generator.ts:14-16,142-245`; `apps/api/src/server.ts:2494-2502`). JSON evidence report adds document IDs, extracted fields, created timestamps and authorized property-document file links (`apps/api/src/server.ts:2349-2360`).
- Production CORS now checks configured allowlist; dummy account endpoint hidden in production; synthetic `user-token-*`, local developer identity and dummy OTP accounts are only recognized outside production (`apps/api/src/server.ts:170-190,330-420,675-680,744-790`). Authorized document streaming now uses `Cache-Control: private, no-store` (`apps/api/src/server.ts:1637-1660`).
- HTML report accepts the database's `survey_number` shape and escapes untrusted stored text; regression test covers both conditions (`apps/api/src/report-generator.ts:142-170`; `apps/api/test/reports.test.ts`, “Renders persisted snake_case property fields and escapes untrusted values”). A north-arrow claim now requires an actual rendered snapshot.

## Executed verification results

| Command | Result | Evidence / limits |
|---|---|---|
| `npm run typecheck` in `apps/api` | PASS | Final TypeScript check exited 0. |
| `npm run typecheck` in `apps/web` | PASS | Final web build also runs `tsc --noEmit` against final frontend source. |
| `npm run build` in `apps/api` | PASS | Final TypeScript build exited 0. |
| `npm run build` in `apps/web` | PASS | Final Vite production bundle completed; reports chunk >500 kB warning (not build failure). |
| `node --import tsx --test --test-name-pattern='F11 Tier 2|F13 Tier 1|F14 Tier 1|F20 Tier 1|F20 Tier 2|Tier 3 Pairwise: Missing cadastral|ADVERSARIAL-5.2' test/gis-buffer.test.ts test/reports.test.ts test/spatial-adversarial.test.ts` in `apps/api` | PASS — 25 passed, 0 failed | Includes unknown spatial status, no inferred parcel, no raster/PDF, title/report HTML, custom geometry and report status assertions. It does not run HTTP/database integration. |
| `node --import tsx --test --test-name-pattern='F20 Tier 1|F20 Tier 2|Spatial Screening Map Snapshot' test/reports.test.ts test/e2e-real-world-scenarios.test.ts` in `apps/api` | PASS — 13 passed, 0 failed | Includes database snake_case mapping, HTML injection escaping and synthetic E2E scenario calculations. The scenario suite does not exercise HTTP or MariaDB. |
| `npx tsx --test test/real-portal-integrations.test.ts` in `apps/api` | PASS — 11 passed, 0 failed | Six portal reachability probes responded; this tests reachability only, not authenticated data integration. Direct query endpoint test passed after its request included the now-required hobli field. Registry connectors still report not connected; no official record is claimed. |
| `npm test` from repository root | PASS — 427 passed, 0 failed, 0 skipped | Full API test suite completed at 14 October 2026, 20:07 IST against local API and MariaDB. Includes API/database role and tenant checks, document/path validation, GIS/report rules, and unit scenarios. This is not a complete browser-based workflow, production security review, backup restore, or client-data acceptance. |
| `git status --short` / diff review | PASS as inspection only | Pre-existing user UI redesign/image/docs modifications remain uncommitted and were preserved. No destructive DB/schema/data operation was performed. |

The current API suite includes database-backed API role/tenant and document-security tests, but that does not demonstrate a full runtime E2E journey. Browser login, property create-and-reload, actual upload/download persistence, live report-link resolution, outage UI behavior, production identity and restore remain unverified.

## Unresolved blockers

1. Keep an isolated test database/API available. Full automated API suite now passes; next verify the complete browser workflow, document upload/retrieval, reload persistence, report evidence links and failure states. Tests currently use a local database and include fixture writes, so do not point them at client or production data.
2. Confirm production identity provider/project, tenant roles, users and deployment access; pass route-by-route cross-tenant/negative tests.
3. Select cloud/database target. Existing MariaDB conflicts with FRD’s PostgreSQL/PostGIS direction; no migration decision or cloud resource verified.
4. Implement private durable storage, malware scanning/quarantine, encryption/IAM, retention/deletion, download/export auditing and measured restore.
5. Provide GIS license/terms, publisher, vintage, CRS, representative known cases and legal/data-steward approval. Until then map risk stays unavailable.
6. Decide manual-first vs OCR pilot; OCR provider, terms, representative corpus and accuracy threshold remain unapproved.
7. Implement valid deterministic PDF renderer and evidence snapshot links/anchors; name qualified report approver and approve template/signature semantics.
8. Define load profile, monitoring, support owner, RPO/RTO and staffing/parallel capacity. Only then produce calendar milestones.

## Overall disposition

The changes remove several concrete sources of false property conclusions and make frontend/backend builds plus focused pure tests pass. This is not a completed P0 plan: document/cloud security, production identity acceptance, licensed spatial evidence, actual full workflow verification, real PDF output, recovery and release approval remain open. Continue from `PROGRESS-TRACKER.md` and `IMPLEMENTATION-ROADMAP.md` after dependencies are supplied.

