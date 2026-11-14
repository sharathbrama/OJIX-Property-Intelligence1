# Production test report

**Updated:** 12 November 2026  
**Scope:** Phase 2 single-migration/API verification and Phase 3 full migration rehearsal, all on disposable MariaDB 10.11 environments. No production database, existing OJIX database on port 3308, XAMPP database, or SpendFlow database was contacted.

## Results summary

| Check | Result | Evidence |
|---|---|---|
| Phase 2 migration 031 test | **Passed separately** | Repaired migration 031 applied once to a disposable MariaDB 10.11 database with synthetic organization/document prerequisites. A separate second attempt confirmed expected one-shot error 1050. See below and `docs/DATABASE_MIGRATION_REHEARSAL.md`. |
| Phase 2 API suite | **473/473 passed in the earlier run** | `npm test -w apps/api` against a separate canonical-schema-plus-seed disposable DB; API TypeScript build passed. This is prior evidence and was not repeated as a passing run in Phase 3. |
| Phase 3 historical sequence 004–034 | **31/31 SQL files passed** | MariaDB 10.11.19, isolated `ojix_migration_rehearsal`, baseline derived from tracked `database/mysql-schema.sql.bak` with documented compatibility edits. Migration 031 ran exactly once. |
| Catalog / referential integrity | **Passed with noted drift** | 44/44 canonical table names and 515/515 column names; 72 foreign keys, zero orphaned rows; all canonical named indexes found. Migration 034 adds one explicit index absent from canonical schema. |
| Seed data | **Partially passed; role regression found** | 1 organization, 11 memberships, 1 spatial layer, 1 canonical seeded property retained. No `user_accounts` rows are created by `infra/db/seed.sql`. Migration 026 changes `user-super-admin` from `super_admin` to `owner`. |
| API suite on migrated historical schema | **470 passed, 3 failed of 473** | Temporary local API ran with both DB URLs pinned to `127.0.0.1:3317/ojix_migration_rehearsal`. All three failing cases are Super Admin/role surface assertions and align with the migration 026 role change. Exact output: `/private/tmp/ojix-migration-api-suite.log`. |

## Phase 2 evidence retained

- Migration 031's duplicate `CREATE TABLE workspace_purge_requests` declaration was removed before this audit. On a disposable MariaDB 10.11 database, the repaired migration created `owner_configuration_versions`, `workspace_export_events`, and `workspace_purge_requests`; prerequisite rows remained intact.
- Reapplying 031 to a separate disposable DB failed with MariaDB error 1050 at `owner_configuration_versions` as expected. Migration 031 is one-shot. Do not rerun it against an existing target without inspecting actual schema/history and a verified backup.
- The earlier API run passed 473/473 and the API TypeScript build passed. That run used a separate canonical-schema-plus-seed database and must not be conflated with the Phase 3 run that had three failures.

## Phase 3 migration rehearsal

### Environment and isolation

- Container: `ojix-mariadb-migration-test`, image `mariadb:10.11`, server `10.11.19-MariaDB-ubu2204`, healthy.
- Host connection: `127.0.0.1:3317`; Docker mapping verified as `127.0.0.1:3317 -> 3306/tcp`.
- Dedicated volume: `ojix_migration_test_data` only. No host database directory or pre-existing volume mounted.
- Test database: `ojix_migration_rehearsal`; root credential came from Git-ignored `.env.migration-test` (mode 0600). No password is recorded here.
- The existing OJIX database container/volume on port 3308, XAMPP databases, and SpendFlow MySQL were not used. All listed existing application containers remained running.
- MariaDB image initialization created its normal system schemas and `test`; no OJIX database existed before the authorized test DB was created.

### Historical baseline and sequence

`database/mysql-schema.sql.bak` is tracked in the initial Git commit and represents the available older schema snapshot: its 11 core tables include `organizations`, `org_memberships`, `properties`, `documents`, `risk_findings`, and the earlier spatial/registry tables. The earliest committed `database/mysql-schema.sql` already includes many later migration results, so it is not a valid starting point for replaying all deltas. The backup is the best available candidate baseline, but the repository contains no version label/checksum proving it matches any deployed production schema.

The baseline backup contains database selection, `DROP TABLE` statements, and a spatial index on nullable `properties.location`. For the isolated rehearsal only, a temporary copy was made in `/private/tmp/ojix-migration-baseline.sql`: database-selection/drop statements were removed, creates were made `IF NOT EXISTS` to resume after an initial partial load, and the nullable property spatial index was omitted. This aligns with current canonical schema, which also has no spatial index on `properties.location`. No source schema or migration was edited. `infra/db/seed.sql` was applied after migration 008 so its `application_number` field existed, and before migrations 009–034 so role/demo updates acted on seeded memberships.

The first baseline load attempt stopped before table DDL because an incomplete temporary filter left continuation lines from `CREATE DATABASE`; the second stopped at MariaDB error 1252 on the nullable spatial index after creating only the first two tables. The corrected temporary baseline completed. These were harness/baseline compatibility errors, not migration errors. They are retained in the execution log.

All 31 migration files then executed in strict numeric order, fail-fast, with per-file start/completion records in `/private/tmp/ojix-migration-execution.log`. Statements that contain `USE ojix_property_mysql` were rewritten only in memory to `USE ojix_migration_rehearsal`; files in the repository were not changed. Migration 031 was executed once, not rerun.

Additional isolated checks inserted one clearly synthetic legacy property and ran migrations 007 and 008 again to check their backfill/idempotency behavior. Migration 007 created one parcel reference for each property and did not duplicate references on replay. Migration 008 assigned `OJIX-PR-20261112-66666666` to the fixture's blank application number and retained it on replay. The canonical seeded property remains `OJIX-DEMO-0001`. No other migration was replayed for idempotency testing.

Detailed per-file status, dependencies, one-shot/repeatable classification, schema findings, seed effects, and ledger recommendation are in `docs/DATABASE_MIGRATION_REHEARSAL.md`.

### API suite

The first API suite attempt had no API process at port 4000 and failed on connection refusal; it is not counted. The successful-to-run suite started a temporary local API process on free port 4000 with both `DATABASE_URL` and `TEST_DATABASE_URL` set to the isolated test DB. The process was stopped afterward; port 4000 was confirmed closed. The suite result was 470 passed and 3 failed of 473. The failures were:

- `all ten memberships resolve their own role and only authorized dashboard surfaces`
- `Owner and Admin cannot escalate membership or enter the platform console`
- `Super Admin suspension, activation and revocation are individually audited`

The seeded `user-super-admin` row is changed to `owner` by migration 026's `ON DUPLICATE KEY UPDATE role='owner'`. This conflicts with `infra/db/seed.sql`, the server's Super Admin identity, and the failing authorization assertions. Do not patch or rerun this migration against an existing system as a quick fix; resolve the intended role semantics and prepare a reviewed corrective migration first.

## Production migration decision

**Not ready for production database migration.** The SQL chain runs on the available reconstructed baseline, but production readiness is blocked by unproven baseline provenance, the migration 026 Super Admin role change and API test failures, canonical/migration index drift at migration 034, and the absence of a migration ledger/runner and backup/restore rehearsal. Do not interpret the successful disposable replay as proof that any existing OJIX database should receive 004–034. Establish the actual target schema/history first, reconcile the role and index drift, approve a versioned deployment plan, and rehearse on a verified copy before any production change.

## Earlier release checks still outstanding

The prior requirements remain: frontend build/typecheck, OCR worker tests, representative OCR quality testing, production API reachability/CORS, deployment smoke test, private storage/security controls, and backup restore rehearsal. The ledger design is documented as a proposal only; no runner, ledger, startup DDL, or source migration was implemented.
