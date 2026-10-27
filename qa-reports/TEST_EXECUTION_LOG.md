# OJIX Property Intelligence - Test Execution Log

**Date:** 27 October 2026 (Asia/Kolkata)  
**Workspace:** Local macOS development checkout  
**Branch / revision:** `main` / `bc0508b`  
**Data policy:** No production or client data accessed

## Environment observations

- Node dependencies were already installed.
- Docker command was present, but the Docker daemon was not running.
- No listeners were found on database ports 3306/3307.
- No listeners were found on API ports 4000/4001.
- External Firebase, Resend, Twilio, government portal and licensed GIS test credentials were not used.

## Commands and outcomes

| Command / check | Outcome | Classification |
|---|---|---|
| `git status --short --branch` | `main` synchronized with `origin/main` before report generation | PASS |
| `git log --reverse --date=short ...` | Project history reviewed from 1 October through current revision | PASS |
| `npm run typecheck` | API and web checks exited 0 | PASS |
| `npm run test -w apps/web` | 3 passed, 0 failed | PASS |
| `npm run build` | API and web builds exited 0 | PASS WITH WARNING |
| Vite bundle output | Main JS 1,680.35 KB; gzip 442.38 KB; chunk warning emitted | OBSERVATION |
| `npm test` current-release attempt | Suite launched; DB/API-dependent cases failed with `ECONNREFUSED` | BLOCKED |
| `curl ... /health` on 4000/4001 | Could not connect | BLOCKED |
| `lsof` on 3306/3307/4000/4001 | No listeners | BLOCKED |
| `docker compose ps --format json` | Docker daemon unavailable | BLOCKED |
| `npm audit --omit=dev --json` | Exit 1; 1 critical, 7 high, 8 moderate vulnerabilities | FAIL |
| Express route count | 99 registrations | INSPECTION |
| OpenAPI path count | 8 paths | INSPECTION / GAP |
| Schema table count | 26 `CREATE TABLE` declarations | INSPECTION |
| Migration inventory | 22 migration files (`004-025`) | INSPECTION |
| API test inventory | 19 files; 402 top-level declarations | INSPECTION |
| Web test inventory | 1 file; 3 executed tests | PASS / INSPECTION |
| `npm run test:e2e` | 12 passed, 0 failed in 65.0 seconds; desktop Chrome and Pixel 7 mobile profile | PASS |

## Security audit detail

The npm audit reported:

- Critical: 1
- High: 7
- Moderate: 8
- Total: 16

Direct packages appearing in affected dependency paths include `maplibre-gl`, `firebase`, `firebase-admin`, `vite` and `zod`. Package upgrades were not applied because remediation requires compatibility testing and the user requested QA evidence, not application refactoring.

## Limitations

- No live API/database assertions can be counted as passed.
- Playwright covers the public authentication experience only; authenticated workflows require the unavailable API and database.
- No coverage instrumentation produced statement, branch, route or requirement automation percentages.
- Historical test counts in prior documentation were not substituted for current execution.
- No destructive database, volume or reset command was run.
