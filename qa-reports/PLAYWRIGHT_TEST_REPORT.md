# OJIX Property Intelligence - Playwright Test Report

**Execution date:** 27 October 2026 (Asia/Kolkata)  
**Branch / revision:** `main` / `27183ff`  
**Framework:** Playwright Test 1.64.1  
**Result:** **PASS - 12 passed, 0 failed**

## Scope

The suite starts the Vite frontend and tests the public authentication experience in installed Google Chrome. It deliberately runs while the API and MariaDB are unavailable so that the user-facing outage state is also verified.

| Browser project | Logical scenarios | Passed | Failed |
|---|---:|---:|---:|
| Desktop Chrome | 6 | 6 | 0 |
| Mobile Chrome (Pixel 7 profile) | 6 | 6 | 0 |
| **Total executions** | **12** | **12** | **0** |

Elapsed Playwright run duration was approximately 65.0 seconds.

## Executed scenarios

| Scenario | Desktop | Mobile |
|---|---|---|
| Login landing heading and actions render | PASS | PASS |
| Secure login form exposes required controls | PASS | PASS |
| API/database outage is shown without hiding login | PASS | PASS |
| Password visibility can be toggled | PASS | PASS |
| Registration route shows required account fields | PASS | PASS |
| Configured viewport has no horizontal page overflow | PASS | PASS |

## Automation implementation

- Configuration: `playwright.config.ts`
- Test specification: `tests/e2e/public-auth.spec.ts`
- Command: `npm run test:e2e`
- Local HTML evidence: `playwright-report/index.html` (generated and intentionally ignored by Git)
- Machine-readable evidence: `qa-reports/playwright-results.json`

The configuration retains traces and screenshots on failure. Video recording is disabled so the suite can use the locally installed Chrome channel without downloading Playwright's FFmpeg bundle.

## Limitations

- This is a public-authentication smoke and responsive-layout suite, not complete application E2E certification.
- Login submission, OTP verification, authenticated navigation, role permissions, tenant isolation, property workflows, uploads, OCR, title chain, spatial data, report generation and administration remain untested in Playwright because the API and MariaDB were unavailable.
- The run used Google Chrome on local macOS. Firefox, WebKit, Windows, Android hardware and iOS hardware were not tested.
- The overflow assertion is not a substitute for a complete WCAG accessibility review.

## Conclusion

The tested public login and registration interface behaves correctly in the two configured Chrome profiles, including its degraded-service message. This passing result does not change the overall **NOT READY FOR RELEASE** decision because critical security, CI/database, API, database and authenticated-workflow gates remain unresolved or blocked.
