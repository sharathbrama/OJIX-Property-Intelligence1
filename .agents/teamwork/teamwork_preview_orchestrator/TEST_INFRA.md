# E2E Test Infra: OJIX Property Intelligence MVP

## Test Philosophy
- Opaque-box, requirement-driven derived strictly from `ORIGINAL_REQUEST.md` and statutory Karnataka real estate regulations.
- Independent of internal implementation details; exercises public API endpoints, core engine contracts, and outputs.
- Methodology: Category-Partition, Boundary Value Analysis (BVA), Pairwise Combinatorial Testing, and Real-World Application Scenarios.

## Feature Inventory Coverage Map
| # | Feature | Requirement | Tier 1 (>=5) | Tier 2 (>=5) | Tier 3 (Pairwise) | Tier 4 (Scenario) |
|---|---------|-------------|:------------:|:------------:|:-----------------:|:-----------------:|
| 1 | Karnataka Document Classifier | R1 | 6 | 5 | ✓ | ✓ |
| 2 | Metadata Extractor | R1 | 6 | 5 | ✓ | ✓ |
| 3 | Evidence Bounding Box / Anchor Generator | R1 | 5 | 5 | ✓ | ✓ |
| 4 | Side-by-Side Review UI / Document Streaming | R1 | 5 | 5 | ✓ | ✓ |
| 5 | Ownership Graph DAG Builder | R2 | 5 | 5 | ✓ | ✓ |
| 6 | South Indian / Karnataka Alias Normalizer | R2 | 6 | 6 | ✓ | ✓ |
| 7 | Unbroken Chain Gap Detector (30-yr lookback) | R2 | 5 | 5 | ✓ | ✓ |
| 8 | Chronological Inversion Detector | R2 | 5 | 5 | ✓ | ✓ |
| 9 | Extent Over-Conveyance Detector | R2 | 5 | 5 | ✓ | ✓ |
| 10 | Reviewer Dispute & Verification Engine | R2 | 5 | 5 | ✓ | ✓ |
| 11 | Rajakaluve SWD 3-Tier Buffer Screening | R3 | 6 | 6 | ✓ | ✓ |
| 12 | Lake / Waterbody 30m Buffer Screening | R3 | 5 | 5 | ✓ | ✓ |
| 13 | MapLibre Cadastral Parcel Visualizer | R3 | 5 | 5 | ✓ | ✓ |
| 14 | Georeferenced Snapshot Exporter | R3 | 5 | 5 | ✓ | ✓ |
| 15 | Karnataka Land Unit Normalizer | R4 | 6 | 6 | ✓ | ✓ |
| 16 | Cross-Document Extent Comparator | R4 | 5 | 5 | ✓ | ✓ |
| 17 | Four-Side Schedule Boundary Comparator | R4 | 5 | 5 | ✓ | ✓ |
| 18 | Capped Explainable Risk Scorer (0-100 ceiling) | R4 | 5 | 5 | ✓ | ✓ |
| 19 | Immutable Due-Diligence Snapshotter | R5 | 5 | 5 | ✓ | ✓ |
| 20 | Client-Ready PDF Report Generator | R5 | 5 | 5 | ✓ | ✓ |
| 21 | Itemized Evidence Appendix Generator | R5 | 5 | 5 | ✓ | ✓ |
| 22 | Tenant Isolation & Access Guard | Security | 5 | 5 | ✓ | ✓ |
| 23 | SHA-256 Cryptographic Checksumming | Security | 5 | 5 | ✓ | ✓ |
| 24 | Mutation Audit Logger | Security | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Runner: Node.js native test runner via `tsx --test test/*.test.ts` within `apps/api`.
- Test Directory: `apps/api/test/`
  - `test/document-extraction.test.ts` (R1)
  - `test/title-chain.test.ts` (R2)
  - `test/gis-buffer.test.ts` (R3)
  - `test/discrepancies-and-risk.test.ts` (R4)
  - `test/reports.test.ts` (R5)
  - `test/e2e-real-world-scenarios.test.ts` (Tier 4)
- Invocation: `npm test` from project root runs all tests.
- Pass/Fail Semantics: 100% pass rate, exit code 0.

## Real-World Application Scenarios (Tier 4)
1. **Scenario 1 — Clear Title Freehold Layout**:
   - Property in Arakere village, Sy No 34/2.
   - Complete 30-year chain (1994 Sale Deed -> 2008 Gift Deed -> 2018 Sale Deed) with exact matching extents (1 Acre 20 Guntas = 65,340 sq ft).
   - Zero drain/lake encroachments (>200m away).
   - Clean RTC, e-Khata, and EC.
   - Expected: Risk Score < 25 (`preliminary`), 0 critical findings.

2. **Scenario 2 — Rajakaluve Primary Drain Encroachment**:
   - Property in Bellandur, Sy No 102.
   - Property boundary within 18m of a Primary Rajakaluve (50m statutory buffer).
   - Expected: Critical risk finding `SPATIAL_SWD_PRIMARY_BUFFER` (35 pts), Buffer clearance status `buffer_zone`.

3. **Scenario 3 — Broken Title Chain & Extent Over-Conveyance**:
   - Property in Whitefield, Sy No 88/1.
   - Seller in 2015 deed has no registered predecessor acquisition in 30 years.
   - Extent conveys 2 Acres 10 Guntas, but predecessor only held 1 Acre 30 Guntas.
   - Expected: `TITLE_GAP_MISSING_PREDECESSOR` (25 pts), `TITLE_GAP_EXTENT_OVERCONVEYANCE` (35 pts). Score >= 60.

4. **Scenario 4 — Cross-Document Extent & Owner Discrepancy**:
   - Sale Deed shows 38 Guntas ($41,382$ sq ft) to "Ramesh K R", but RTC records 32 Guntas ($34,848$ sq ft) under "Suresh Gowda".
   - Expected: `DISCREPANCY_EXTENT_MISMATCH` (high, 25 pts) and `DISCREPANCY_OWNERSHIP_NAME_MISMATCH` (critical, 35 pts). Capped score >= 60 (`review_required`).

5. **Scenario 5 — Lake Buffer Violation & Unreleased Bank Mortgage**:
   - Property situated 22m from Varthur Lake (30m buffer).
   - Encumbrance Certificate shows unreleased mortgage from 2016 for INR 50 Lakhs.
   - Expected: `SPATIAL_LAKE_BUFFER` (critical, 35 pts), `TITLE_UNRELEASED_ENCUMBRANCE` (critical, 35 pts). Capped score = 70 (`high_attention`).
   - Immutable PDF snapshot generated with red banner, executive summary, distance tables, and itemized evidence appendix.
