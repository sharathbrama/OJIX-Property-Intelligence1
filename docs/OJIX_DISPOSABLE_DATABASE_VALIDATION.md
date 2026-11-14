# OJIX Phase 3 — Disposable Database Migration Validation

**Date:** 13 November 2026  
**Result:** Disposable MariaDB validation completed with the final suite passing. The runner is still **not approved for staging/production**; remaining risks are listed below.  
**Scope boundary:** All database connections and DDL/DML in this phase targeted uniquely named synthetic schemas on `ojix-mariadb-migration-test` only. No production, staging, application, XAMPP, or prior rehearsal database was used. Migration 026 was not executed.

## Isolation verified

Before connecting, the selected container was inspected and confirmed as:

- Container: `ojix-mariadb-migration-test`
- Image/version: MariaDB 10.11.19 (`mariadb:10.11`)
- Host binding: `127.0.0.1:3317` → container port 3306
- Data volume: dedicated `ojix_migration_test_data`
- Health: healthy

A read-only connection to that endpoint returned MariaDB `10.11.19-MariaDB-ubu2204`. The test credential was read in-process from the mode-0600 ignored disposable-test credential file; its value was not printed or copied into repository files. Existing OJIX database port 3308, SpendFlow MySQL, XAMPP, deployment services and the earlier `ojix_migration_rehearsal` schema were not connected to or changed.

Synthetic database names use the prefix `ojix_phase3_`. The completed run used:

- `ojix_phase3_1794559085694_canonical`
- `ojix_phase3_1794559085694_missing_column_index`
- `ojix_phase3_1794559085694_existing_column_index`
- `ojix_phase3_1794559085694_equivalent_other_name`
- `ojix_phase3_1794559085694_conflicting_index`
- `ojix_phase3_1794559085694_missing_super_admin`
- `ojix_phase3_1794559085694_blocked_026_034`
- `ojix_phase3_1794559085694_interrupted_ledger`

Two earlier harness attempts also left these synthetic schemas in the same disposable container: `ojix_phase3_1794558986631_canonical`, `ojix_phase3_1794558986631_missing_column_index`, `ojix_phase3_1794559014522_canonical`, and `ojix_phase3_1794559014522_missing_column_index`. Those runs stopped on a harness assertion that expected MariaDB to report an empty-string default as an empty value. MariaDB reported the text `''`; the final harness accepts both representations. The earlier schemas were left intact for inspection; no schemas, tables, containers or volumes were deleted or reset.

An earlier full passing validation run is also retained: `ojix_phase3_1794559032911_canonical`, `ojix_phase3_1794559032911_missing_column_index`, `ojix_phase3_1794559032911_existing_column_index`, `ojix_phase3_1794559032911_equivalent_other_name`, `ojix_phase3_1794559032911_conflicting_index`, `ojix_phase3_1794559032911_missing_super_admin`, and `ojix_phase3_1794559032911_interrupted_ledger`. These preceded the added blocked-history and real lock-contention cases, which passed in the final run.

All canonical seed records and fixture rows were synthetic. The canonical test schema was loaded from the repository's canonical DDL and `infra/db/seed.sql`; focused migration scenarios used minimal synthetic tables matching the columns migration 035 touches.

## Runner review and corrections exercised

Review identified and addressed two unsafe/compatibility cases before the final database run:

1. **MariaDB empty default representation:** For an existing `assigned_viewer_uid VARCHAR(191) NOT NULL DEFAULT ''`, MariaDB 10.11 reports `COLUMN_DEFAULT` as the two-character SQL literal text `''`. Migration 035 previously accepted only an empty metadata value and would reject a valid existing column. Its check now accepts both the empty representation and `CHAR(39,39)`. The existing-column/index cases passed against MariaDB after this correction.
2. **Canonical baseline ledger gaps:** A canonical baseline marker without all ledger rows could otherwise make already represented historical migrations look pending. The runner now records `baseline_through_id` transactionally with baseline ledger entries and rejects a canonical ledger missing any applied row at or below that ID. It also checks that `SELECT DATABASE()` matches the requested target before lock acquisition or writes.

The parser routed legacy `USE ojix_property_mysql` statements to the URL-selected test schema. `DELIMITER //` was not sent to MariaDB; the `CREATE PROCEDURE ... END//` body was sent by `mysql2` as one complete statement. Migration 035 successfully executed through the standard `mysql2` driver with `multipleStatements` disabled.

## Actual MariaDB tests executed

| Test | Result |
|---|---|
| Load canonical schema and synthetic seed; verify reserved Super Admin row | **PASSED** |
| Default CLI dry-run on canonical schema; confirm it created no ledger tables | **PASSED** |
| `--apply` without target confirmation and with a wrong target confirmation | **PASSED** — both rejected; missing confirmation is rejected before connection, wrong confirmation before migration writes |
| Explicit `canonical-v1` baseline on canonical schema | **PASSED** — created metadata/ledger with all current migration checksums recorded as applied; no migration SQL ran |
| Already-applied detection after baseline | **PASSED** — all 32 migration records reported applied |
| Checksum enforcement | **PASSED** — a synthetic checksum mismatch was rejected; the test checksum was restored afterward |
| Database advisory lock across two MySQL connections | **PASSED** — second runner was rejected while the first connection held the schema lock |
| Pending 026 and 034 on a synthetic pre-026 ledger state | **PASSED** — dry-run reported both blocked; neither migration started or executed |
| 035 with missing viewer column and index | **PASSED** — added both; retained two property rows and their other values |
| 035 with existing viewer column and exact index | **PASSED** — accepted existing definitions without duplicate index |
| 035 with equivalent index under a different name | **PASSED** — accepted it and did not add a duplicate |
| 035 with conflicting definition under the expected index name | **PASSED as a failure-path test** — migration failed explicitly and ledger remained `failed` with null completion time |
| Reserved Super Admin already active with role `super_admin` | **PASSED** — role remained unchanged |
| Reserved Super Admin in the known active Owner regression state | **PASSED** — pending 035 corrected only `user-super-admin` to `super_admin` |
| Reserved Super Admin row missing | **PASSED as a preflight rejection** — runner stopped before inserting a started ledger row or changing schema |
| Repeated runner invocation after 035 applied | **PASSED** — migration stayed applied and was not replayed |
| Direct second execution of 035 statement-by-statement through mysql2 | **PASSED** — migration completed idempotently; no duplicate equivalent index and role remained correct |
| Interrupted migration state (`started`, no completion time) | **PASSED as a recovery-block test** — runner refused automatic continuation and made no schema changes |
| Six role rows: Super Admin, Owner, Admin, Lawyer, Analyst, Viewer | **PASSED** — final roles were preserved/correct; only the reserved Super Admin changed in the Owner-regression scenario |

The conflicting-index case demonstrates an important DDL/data boundary: migration 035 updates the reserved role before checking the index. In that failure case the role repair was committed, the conflicting index was preserved, and the ledger stayed failed. Recovery must inspect state and proceed manually; the runner correctly did not retry or mark success.

The interrupted case seeded a realistic `started` ledger record to simulate a process interruption. It did not kill a live migration process at an arbitrary DDL boundary. The separate conflicting-index scenario exercised an actual MySQL error during the migration and verified failed-ledger behavior.

## Simulated/offline tests

The targeted offline suite used mocked connections/source checks and did not connect to any database:

```sh
node --import tsx --test-concurrency=1 --test \
  apps/api/test/migration-runner.test.ts \
  apps/api/test/migration-corrections.test.ts \
  apps/api/test/rbac.test.ts
```

**Result: 22 passed, 0 failed.** Coverage includes numeric ordering, duplicate IDs/gaps, checksum mismatch, missing baseline, canonical ledger gap, blocked 026/034, Super Admin preflight, explicit confirmation, failed/interrupted states, SQL delimiter parsing, and role policy separation.

TypeScript check:

```sh
npm exec -w apps/api -- tsc --noEmit -p tsconfig.json
```

**Result: passed.**

The MariaDB harness also used in-memory assertions for expected outcomes, but database operations in the preceding table were real SQL statements against MariaDB 10.11.19. No application API server or live service was started for these checks.

## Migration and data safety

- Migration 026 was never executed. Its unsafe SQL remains unchanged and the runner treated it only as blocked/applied synthetic ledger history.
- Migration 034 was never executed. It was represented only as blocked or already-applied ledger history.
- No production/staging records, credentials, or database endpoints were used.
- The 035 failure-path test confirms DDL and preceding DML are not atomic as a migration unit. A failed ledger is not proof that no data changed.
- Synthetic schemas remain in the dedicated test container for review; no database was reset or dropped.

## Backup and restore requirements before staging

No backup/restore was executed in this phase. Before any staging migration:

1. Confirm the target engine/version, schema identity, baseline checksum, migration ledger and expected affected-row counts.
2. Take a consistent encrypted database backup before DDL; include routines/triggers/events where applicable, transaction/binlog or GTID position, character set/collation, and backup timestamp. Store it outside the target failure domain with restricted access.
3. Snapshot document/object storage separately and record a manifest/checksum so database document records can be reconciled with stored objects.
4. Verify backup checksums and restore the backup to a new isolated database on the same engine/version. Never test restore over the source.
5. Compare restored table/column/index/FK metadata, row counts for affected tables, Super Admin membership, and selected synthetic or approved non-sensitive invariants. Start the application only against the restored isolated copy and run read-only smoke checks.
6. Record restore duration and recovery point/time, retain the pre-migration backup through acceptance, and define the operator-approved restore/forward-repair decision path.
7. Because MySQL/MariaDB DDL may auto-commit, treat backup restoration as the rollback path; do not assume transaction rollback or inverse SQL can undo a partially applied migration.

## Remaining risks and validation boundary

- The runner's `canonical-v1` baseline is still an explicit operator assertion. It checks the selected database and reserved Super Admin, but does **not** compare the entire live schema against a canonical schema fingerprint. A wrong or incomplete schema with those prerequisites could be baselined incorrectly. Add full table/column/index/FK manifest validation before operational approval.
- This validation establishes compatibility with MariaDB 10.11.19 only. Oracle MySQL versions and managed MySQL-compatible services were not tested.
- Migration 035 executes a stored procedure; routine permissions, SQL modes, metadata formatting and prepared DDL must be validated for each supported engine/version.
- Recovery after failed/started migrations is intentionally manual. No repair/resolve command exists.
- Migration 026 remains unsafe if someone executes it outside the runner. The runner blocks it when pending, but cannot prevent direct SQL use by other tools.
- No production-style size, lock duration, availability, replication, backup restore, or load test was performed.
- The retained synthetic schemas consume space in the local disposable volume. Do not mistake any `ojix_phase3_*` schema for a staging or production database.

**Decision: NO-GO for staging or production migration.** The disposable MariaDB checks passed for the stated cases, but full baseline fingerprinting, backup/restore rehearsal, operational recovery, and validation on the exact eventual target engine remain outstanding. No deployment or out-of-disposable operation was performed.
