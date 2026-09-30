# TEST_READY: OJIX Property Intelligence E2E Test Suite

## Executive Summary
A comprehensive requirement-driven, opaque-box E2E test suite has been implemented in `apps/api/test/` covering all 24 functional and security features across Milestones 1 through 5, spanning all 4 testing tiers:
- **Tier 1**: Feature Coverage in isolation (>= 5 unit/integration test cases per feature)
- **Tier 2**: Boundary & Corner Cases (>= 5 test cases per feature covering empty inputs, extreme coordinates, fractions, zero values, unit boundaries, missing data)
- **Tier 3**: Cross-Feature Combinations (Pairwise combinatorial testing across modules)
- **Tier 4**: Real-World Application Scenarios (the 5 end-to-end scenarios specified in `TEST_INFRA.md`)

All tests execute with 100% pass rate (`npm test`), zero failures, zero skipped tests, strict TypeScript typechecking (`npm run typecheck`), and successful monorepo production build (`npm run build`).

---

## Test Execution Commands
- **Run Full Test Suite**:
  ```bash
  npm test
  ```
  *(or directly within `apps/api`)*:
  ```bash
  cd apps/api && npm test
  ```
- **Typecheck Verification**:
  ```bash
  npm run typecheck
  ```
- **Production Build Verification**:
  ```bash
  npm run build
  ```

---

## Test Files Inventory (`apps/api/test/`)

| # | Test File | Primary Scope | Test Count |
|---|-----------|---------------|:----------:|
| 1 | `apps/api/test/document-extraction.test.ts` | R1: Document Classification, Metadata Extraction, Bounding Boxes, Overrides, Tenant Isolation, SHA-256 Checksums, Audit Logging | 74 |
| 2 | `apps/api/test/title-chain.test.ts` | R2: Ownership DAG, South Indian Alias Normalization, 30-Year Lookback Gaps, Chronological Inversions, Extent Over-Conveyance, Reviewer Disputes | 65 |
| 3 | `apps/api/test/gis-buffer.test.ts` | R3: Rajakaluve 50m/25m/15m SWD Buffers, 30m Lake Buffers, Cadastral Parcel GeoJSON, Georeferenced Cartographic Metadata | 45 |
| 4 | `apps/api/test/discrepancies-and-risk.test.ts` | R4: Karnataka Land Unit Conversions, Extent Comparator, Boundary Schedule Comparator, Capped Risk Scorer (0-100 ceiling) | 47 |
| 5 | `apps/api/test/reports.test.ts` | R5: Immutable Due-Diligence Snapshotter, 7-Section PDF Report Generator, Itemized Evidence Appendix | 33 |
| 6 | `apps/api/test/e2e-real-world-scenarios.test.ts` | Tier 4: Scenarios 1–5 (Arakere Clear Title, Bellandur Primary SWD, Whitefield Over-Conveyance, Extent/Owner Mismatch, Varthur Lake & Mortgage) + Invariants | 12 |
| 7 | `apps/api/test/risk-engine.test.ts` | Baseline risk engine checks | 3 |
| 8 | `apps/api/test/contract-oracle.ts` | Domain contract reference oracle & typed interfaces matching `PROJECT.md § Interface Contracts` | N/A (Helper) |
| **Total** | | | **279 Tests** |

---

## 24-Feature Coverage & Tier Breakdown

| # | Feature | Req | Tier 1 (Isolated) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Scenario) | Total Tests |
|---|---------|:---:|:-----------------:|:-----------------:|:-----------------:|:-----------------:|:-----------:|
| 1 | Karnataka Document Classifier | R1 | 6 | 5 | 1 | 1 | 13 |
| 2 | Metadata Extractor | R1 | 6 | 5 | 1 | 1 | 13 |
| 3 | Evidence Bounding Box / Anchor Generator | R1 | 5 | 5 | 1 | 1 | 12 |
| 4 | Side-by-Side Review UI / Document Overrides | R1 | 5 | 5 | 1 | 0 | 11 |
| 5 | Ownership Graph DAG Builder | R2 | 5 | 5 | 1 | 1 | 12 |
| 6 | South Indian / Karnataka Alias Normalizer | R2 | 6 | 6 | 1 | 1 | 14 |
| 7 | Unbroken Chain Gap Detector (30-yr lookback) | R2 | 5 | 5 | 1 | 1 | 12 |
| 8 | Chronological Inversion Detector | R2 | 5 | 5 | 0 | 0 | 10 |
| 9 | Extent Over-Conveyance Detector | R2 | 5 | 5 | 1 | 1 | 12 |
| 10 | Reviewer Dispute & Verification Engine | R2 | 5 | 5 | 1 | 0 | 11 |
| 11 | Rajakaluve SWD 3-Tier Buffer Screening | R3 | 6 | 6 | 1 | 1 | 14 |
| 12 | Lake / Waterbody 30m Buffer Screening | R3 | 5 | 5 | 1 | 1 | 12 |
| 13 | MapLibre Cadastral Parcel Visualizer | R3 | 5 | 5 | 1 | 0 | 11 |
| 14 | Georeferenced Snapshot Exporter | R3 | 5 | 5 | 1 | 1 | 12 |
| 15 | Karnataka Land Unit Normalizer | R4 | 6 | 6 | 1 | 1 | 14 |
| 16 | Cross-Document Extent Comparator | R4 | 5 | 5 | 1 | 1 | 12 |
| 17 | Four-Side Schedule Boundary Comparator | R4 | 5 | 5 | 1 | 0 | 11 |
| 18 | Capped Explainable Risk Scorer (0-100 ceiling) | R4 | 5 | 6 | 2 | 2 | 15 |
| 19 | Immutable Due-Diligence Snapshotter | R5 | 5 | 5 | 1 | 1 | 12 |
| 20 | Client-Ready PDF Report Generator | R5 | 5 | 5 | 1 | 1 | 12 |
| 21 | Itemized Evidence Appendix Generator | R5 | 5 | 5 | 1 | 1 | 12 |
| 22 | Tenant Isolation & Access Guard | Security | 5 | 5 | 1 | 0 | 11 |
| 23 | SHA-256 Cryptographic Checksumming | Security | 5 | 5 | 1 | 1 | 12 |
| 24 | Mutation Audit Logger | Security | 5 | 5 | 1 | 0 | 11 |

---

## Tier 4 Real-World Application Scenarios Summary

1. **Scenario 1 — Clear Title Freehold Layout (Arakere Village, Sy No 34/2)**:
   - Complete 30-year conveyance history (1994 Sale Deed -> 2008 Gift Deed -> 2018 Sale Deed) with matching 1 Acre 20 Guntas (65,340 sq ft).
   - Zero drain/lake encroachments (>200m away).
   - Clean RTC, e-Khata, and Nil EC.
   - Result: Risk Score = 0 (`preliminary`), 0 critical findings. Passed.

2. **Scenario 2 — Rajakaluve Primary Drain Encroachment (Bellandur, Sy No 102)**:
   - Property boundary situated 18m from a Primary Rajakaluve (50m statutory buffer).
   - Result: Critical risk finding `SPATIAL_SWD_PRIMARY_BUFFER` (35 pts), Buffer clearance status `buffer_zone`. Passed.

3. **Scenario 3 — Broken Title Chain & Extent Over-Conveyance (Whitefield, Sy No 88/1)**:
   - Seller in 2015 deed lacks preceding registered acquisition in 30 years.
   - Extent conveys 2 Acres 10 Guntas (98,010 sq ft) exceeding acquired 1 Acre 30 Guntas (76,230 sq ft).
   - Result: `TITLE_GAP_MISSING_PREDECESSOR` (25 pts), `TITLE_GAP_EXTENT_OVERCONVEYANCE` (35 pts). Score = 60 (`review_required`). Passed.

4. **Scenario 4 — Cross-Document Extent & Owner Discrepancy (Varthur)**:
   - Sale Deed records 38 Guntas (41,382 sq ft) to "Ramesh K R", while RTC records 32 Guntas (34,848 sq ft) under "Suresh Gowda".
   - Result: `DISCREPANCY_EXTENT_MISMATCH` (35 pts) and `DISCREPANCY_OWNERSHIP_NAME_MISMATCH` (35 pts). Capped score = 70 (`high_attention`). Passed.

5. **Scenario 5 — Lake Buffer Violation & Unreleased Bank Mortgage (Varthur Lake)**:
   - Situated 22m from Varthur Lake (30m buffer).
   - Encumbrance Certificate shows unreleased bank mortgage for INR 50 Lakhs.
   - Result: `SPATIAL_LAKE_BUFFER` (35 pts), `TITLE_UNRELEASED_ENCUMBRANCE` (35 pts). Capped score = 70 (`high_attention`).
   - Immutable PDF snapshot generated with all 7 structural sections, North arrow, and itemized evidence appendix. Passed.

---

## Escalations & Implementation Feedback for Implementing Agents
1. **Extent Regex in `apps/api/src/document-extractor.ts`**:
   - The regex `(?:extent|measuring|area)\s*(?:of|is)?\s*[:.\-]?\s*([0-9\s\/\.,\-\w]+?(?:acres?|guntas?...)\b)` uses non-greedy matching `+?`. For compound strings like `"Extent: 1 Acre 20 Guntas"`, it stops at the first unit `"1 Acre"`. Consider adjusting to greedy or compound-aware matching so both acres and guntas are captured together.
2. **Boundary Regex in `apps/api/src/document-extractor.ts`**:
   - The regex `(?:North\s*by|North\s*[:.\-])` does not strip a colon if written as `"North by: [boundary]"`. Suggest updating the regex to `(?:North\s*by\s*[:.\-]?|North\s*[:.\-])` so trailing colons are not captured into the boundary value.
