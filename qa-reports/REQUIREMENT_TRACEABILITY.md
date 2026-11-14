# OJIX Property Intelligence - Requirement Traceability Matrix

Formal acceptance criteria are incomplete. The requirements below are **inferred** from README, OpenAPI, source, schema and existing tests and are not approved client requirements.

| Requirement ID | Requirement | Module | Test Case ID | Test Result | Evidence | Status |
|---|---|---|---|---|---|---|
| INF-REQ-001 | Source must type-check for API and web | Engineering quality | TC-QA-002, TC-QA-003 | Both passed | `npm run typecheck` exit 0 | PASS |
| INF-REQ-002 | API and web must produce production builds | Build | TC-QA-005, TC-QA-006 | Both passed | `npm run build` exit 0 | PASS |
| INF-REQ-003 | Property forms must reject invalid required values | Frontend validation | TC-QA-004 | 3/3 passed | Web test output | PASS |
| INF-REQ-004 | Production dependencies must meet security policy | Security | TC-QA-007 | Critical/high findings | npm audit: 1 critical, 7 high, 8 moderate | FAIL |
| INF-REQ-005 | CI must test the supported database implementation | CI/database | TC-QA-008 | Engine mismatch | PostGIS CI versus MariaDB runtime | FAIL |
| INF-REQ-006 | API health must report database readiness | Operations | TC-QA-009 | Service unavailable | No listener on 4000/4001 | BLOCKED |
| INF-REQ-007 | MariaDB schema must initialize and persist data | Database | TC-QA-010, TC-QA-017 | Environment unavailable | No DB listener; migrations not run | BLOCKED |
| INF-REQ-008 | Authentication and OTP must handle positive and negative flows securely | Authentication | TC-QA-013 | Not executed | External/runtime prerequisites absent | NOT TESTED |
| INF-REQ-009 | Roles and tenant boundaries must enforce least privilege | Authorization | TC-QA-011, TC-QA-014 | Current suite unavailable | DB/API unavailable | BLOCKED |
| INF-REQ-010 | Property, document, OCR, title, spatial and report workflows must persist correctly | Core workflow | TC-QA-015 | Not executed | No running stack | NOT TESTED |
| INF-REQ-011 | UI must support desktop, tablet, mobile and basic accessibility | Frontend UX | TC-QA-016 | Not executed | No browser E2E environment | NOT TESTED |
| INF-REQ-012 | API contracts must be documented | API documentation | TC-QA-018 | Inspection completed; gap found | 99 routes / 8 paths | FAIL |
| INF-REQ-013 | All maintained automated suites must run in the default CI gate | Automation | TC-QA-004, BUG-004 | Web suite excluded from root command | Root package script | FAIL |
| INF-REQ-014 | Release artifacts must be reproducible from the shared revision | Git/build | TC-QA-001, TC-QA-005, TC-QA-006 | Passed | Synced branch and successful build | PASS |

## Coverage

- Total inferred requirements: 14
- PASS: 4
- FAIL: 4
- BLOCKED: 3
- NOT TESTED: 3
- PASS requirement coverage: **28.6%** (4 / 14)
- Determinate requirement pass rate: **50.0%** (4 / 8 determinate PASS or FAIL requirements)

Blocked and not-tested requirements are not treated as passed.
