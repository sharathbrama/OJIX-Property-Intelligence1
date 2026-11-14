# OJIX Database Migration Runner — Design and Prepared Implementation

**Date:** 13 November 2026  
**Implementation state:** Prepared locally; offline mock tests and TypeScript typecheck pass. No database connection was made and no migration SQL was executed.  
**Operational status:** Not approved for staging/production use. Review and disposable MySQL/MariaDB validation remain mandatory.

## Summary

A runner is prepared at `apps/api/src/migration-runner.ts` with a CLI at `apps/api/scripts/migrate.ts`. It uses the existing `mysql2/promise` dependency and the API's `DATABASE_URL`, `DATABASE_SSL`, and optional `DATABASE_SSL_CA` settings. It defaults to dry-run, requires `--apply` plus an exact `--confirm-target=<database>` value before writes, and never automatically applies pending migration 026 or 034.

The authoritative migration state is stored in two InnoDB tables in the selected schema:

- `ojix_schema_migrations`: migration ID, filename, SHA-256 checksum, status (`started`, `applied`, `failed`), start/completion timestamps, and failure message.
- `ojix_migration_metadata`: explicit baseline marker.

Canonical baseline registration also records `baseline_through_id`; a later canonical-ledger preflight rejects any missing applied row at or below that migration ID, preventing an incomplete baseline from turning old migrations into pending work.

The runner has not initialized these tables anywhere. No existing target database was read or changed.

## Repository findings and migration 035 compatibility

- Migration files currently occupy contiguous numeric IDs 004–035. The loader sorts by numeric prefix and fails on malformed names, duplicate IDs or gaps.
- Migration files 026 and 034 are unsafe to auto-replay: 026's duplicate-key clause can demote the reserved Super Admin; 034's column addition can collide with canonical fresh-install schema. If they are pending, the runner reports them as blocked and refuses to continue. It does not silently skip them or mark them applied.
- Several historical files contain `USE ojix_property_mysql;`. The runner parses standalone `USE` statements and retargets them to the database selected in `DATABASE_URL`; it does not assume the OJIX schema's literal name.
- MySQL clients interpret `DELIMITER` as a client command; it is not SQL accepted by a standard driver. Migration 035's `DELIMITER //` markers are removed by the script splitter. Its `CREATE PROCEDURE ... END//` body is submitted as one statement, followed by its `CALL` and `DROP PROCEDURE` statements. This avoids requiring `multipleStatements` or the `mysql` CLI.
- This parser compatibility has only been exercised by an offline test that inspects/splits the migration text. Actual migration 035 execution against MySQL/MariaDB is **unverified**.

## Ledger lifecycle and failure behavior

1. Read migration files, calculate checksums and validate filename/ID ordering before connecting in the CLI. The core runner also verifies that `SELECT DATABASE()` exactly matches the requested schema.
2. Acquire a connection-scoped MySQL advisory lock named for the target schema. A concurrent runner that cannot acquire the lock stops before ledger or migration writes. The lock is released in `finally`; disconnect releases it server-side.
3. Inspect ledger/baseline state and list each migration as `unknown`, `applied`, `pending`, `blocked` or `failed`. An applied filename/checksum mismatch throws an error. An applied row without a completion time or any `started`/`failed` row is treated as incomplete and blocks automatic continuation.
4. Run the reserved membership preflight. It expects exactly one active `super_admin` membership for the reserved UID/organization. If and only if migration 035 is pending, the known active `owner` state produced by 026 is reported as repairable by 035. Missing, duplicate, disabled or other-role membership blocks apply.
5. For each ordinary pending migration, insert a `started` row before SQL. Execute statements serially. Only after every statement succeeds does the runner set `status='applied'` and `completed_at`. On failure it records `failed`, leaves completion null, captures a bounded error string and stops. If failure recording itself fails, the remaining `started` row still blocks automatic continuation.
6. DDL can auto-commit. A failed entry is never retried or marked successful by the runner. An operator must inspect actual schema/data state and recover or forward-fix on a reviewed copy before an explicit resolution procedure is designed. There is no `--force`, retry, or skip switch.

The advisory lock is held on one checked-out MySQL connection for the entire plan and execution. The runner does not enable multi-statement execution.

## Fresh-install baseline

The only CLI baseline currently accepted is explicit `canonical-v1`:

```sh
npm run db:migrate -w apps/api -- --baseline=canonical-v1 --apply --confirm-target=<exact_database_name>
```

The canonical schema and seed data must already have been applied by a separately reviewed process. The runner does not load `database/mysql-schema.sql`, seeds, or verify every canonical table/column/index/FK. It does verify the selected schema includes the reserved active Super Admin membership. It then transactionally records the baseline marker and records every current migration file and checksum as `applied` without executing migration SQL. The transaction is over ledger rows only; metadata table creation is DDL and may persist if baseline registration fails. A partial metadata/ledger initialization is a stop condition for manual recovery.

The baseline option is not accepted if a ledger already exists. Supplying a baseline is an explicit operator assertion and is not proof that the full schema matches `canonical-v1`; a future schema fingerprint/manifest check is recommended before operational use.

## Preflight and dry-run interface

Dry-run is the default:

```sh
npm run db:migrate -w apps/api
```

The command requires a `DATABASE_URL`; it reports selected schema, baseline, migration statuses, checksums, and warnings. It does not create ledger tables or execute migration statements. `--baseline=canonical-v1` in dry-run shows how a fresh baseline would be registered but still performs no writes. The connection is read-only by runner logic, but the database credentials themselves are not forced read-only.

Apply requires both explicit switches:

```sh
npm run db:migrate -w apps/api -- --apply --confirm-target=<exact_database_name>
```

For a fresh canonical installation, include `--baseline=canonical-v1`. The confirmation value must match the schema name parsed from `DATABASE_URL`; it is a guard against selecting the wrong target, not authorization to use production. Never point this runner at production for this phase.

## Offline tests and results

Added mock/source tests in `apps/api/test/migration-runner.test.ts` and retained the Phase 1 static migration checks in `apps/api/test/migration-corrections.test.ts`. Together with `apps/api/test/rbac.test.ts`, the latest targeted offline run reported **22 passed, 0 failed**. TypeScript typecheck passed.

Covered cases:

- Numeric migration ordering, duplicate IDs and sequence gaps.
- Applied checksum mismatch.
- Concurrent advisory-lock contention with a mocked connection.
- Failed SQL, persisted failed state, and refusal to auto-recover an incomplete DDL migration.
- Explicit fresh-install baseline registration without executing migration statements.
- Already-applied detection and blocked 026/034 behavior.
- Exact confirmation requirement.
- Migration 035 delimiter parsing, procedure statement preservation, and `USE` retargeting.
- Mock tests cover the active Super Admin preflight and the narrow case where an active Owner row is repairable only while 035 is pending; an Owner after 035 is applied is rejected. Static RBAC tests cover Super Admin/Owner/Admin/Lawyer/Analyst/Viewer permission separation. The actual database query and row cardinality scenarios still need disposable-database validation before release.

Commands executed:

```sh
npm exec -w apps/api -- tsc --noEmit -p tsconfig.json
node --import tsx --test-concurrency=1 --test apps/api/test/migration-runner.test.ts apps/api/test/migration-corrections.test.ts apps/api/test/rbac.test.ts
```

Both completed successfully. The first attempt using the `tsx --test` CLI failed because the sandbox denied creation of its IPC socket (`EPERM`); invoking Node's test runner with `--import tsx` avoided that socket. No test used a database. No migration was run.

## Changed files in this phase

- `apps/api/src/migration-runner.ts` — migration discovery, checksum/order validation, ledger, lock, preflight, dry-run/apply orchestration, SQL script splitter and target-schema routing.
- `apps/api/scripts/migrate.ts` — CLI, `DATABASE_URL`/TLS loading, dry-run default and exact-target confirmation.
- `apps/api/test/migration-runner.test.ts` — offline mock tests for runner behavior.
- `apps/api/package.json` — added `db:migrate` script. No new dependency or lockfile update was needed.
- `docs/OJIX_DATABASE_MIGRATION_FIX_PLAN.md` — updated the runner/ledger status to link to this Phase 2 work.
- `docs/OJIX_MIGRATION_RUNNER_DESIGN.md` — this document.

Pre-existing uncommitted changes were preserved, including the earlier migration 035, canonical schema index addition, and unrelated API/storage/deployment edits.

`apps/api/test/migration-corrections.test.ts` was used by the test run but was not modified in this phase.

## Limitations and risks

1. **No SQL-engine validation.** The procedure parser and SQL have not been run through MySQL or MariaDB. In particular, stored-routine syntax, metadata type values/default representation, dynamic `ALTER TABLE`, `SIGNAL`, and `information_schema.STATISTICS` behavior must be checked on the exact target version using a disposable DB.
2. **No full schema fingerprint.** Explicit canonical baseline can register an incomplete or drifted schema if it contains `org_memberships` and the expected Super Admin row. Add a manifest comparison before production approval.
3. **No existing ledgers.** Unknown environments still require manual migration-history reconstruction. The runner does not guess whether 026/034 were applied.
4. **No automatic recovery/override.** A failed/started row intentionally blocks. A separately reviewed recovery command/procedure may be needed after inspecting partial DDL; none is implemented.
5. **Migration 026 stays unsafe if manually replayed outside the runner.** The runner blocks it when pending, but cannot prevent an operator or another tool from executing the SQL directly.
6. **DDL is not atomic.** The ledger marks failure, but actual schema changes may be partially committed. Backups and restore rehearsal remain required.
7. **Baseline transaction assumptions.** Ledger tables use InnoDB; transactional registration relies on the target honoring InnoDB transactions. Table creation itself commits separately.
8. **Confirmation is not access control.** The exact database-name flag reduces operator error but does not distinguish staging from production. Use protected credentials and deployment policy to restrict targets.
9. **Advisory lock semantics.** GET_LOCK is server/session scoped and may vary across compatible database services. Verify service behavior, connection pinning and lock lifetime on the selected MySQL-compatible provider.
10. **Parser support is intentionally scoped.** The script splitter handles quote/comment-aware delimiters and DELIMITER directives used in the repository. It is not a complete MySQL client implementation; new syntax needs tests before migrations use it.
11. **Seed semantics.** The runner requires the reserved Super Admin membership before both baseline registration and migration apply. A fresh canonical schema with seeds not yet loaded is correctly blocked.
12. **Existing worktree edits.** Migration 031 is already modified before this phase. A baseline records current migration checksums; do not treat local modified SQL as approved deployment artifacts without review and source-control stabilization.

## Required next step before any database execution

Review the code and output, then validate against disposable databases only:

1. Create isolated MySQL and MariaDB targets at the exact intended engine versions; do not use production data or credentials.
2. Verify canonical fresh schema and seed, run dry-run, baseline registration, and prove no migration SQL is replayed.
3. Create a versioned historical pre-026/pre-034 fixture and verify the runner blocks rather than automatically applying either file.
4. On a separately approved fixture whose ledger says 026/034 are applied, simulate the known Owner regression and validate preflight allows only pending 035; execute 035 manually in the disposable DB and verify the role/index results and repeat behavior.
5. Test each `DELIMITER` script through the runner against both engines, including interruption after each DDL boundary and manual recovery procedure.
6. Test lock behavior from two independent connections/processes, failure ledger behavior, checksum edits, partial baseline initialization, backup restore and API regression suite.
7. Obtain schema owner review and production operations approval before considering staging.

**Decision: NO-GO for database execution today.** The runner is prepared and its offline unit checks pass, but SQL semantics, exact MySQL compatibility, full canonical baseline verification, migration history, and recovery behavior remain unverified.
