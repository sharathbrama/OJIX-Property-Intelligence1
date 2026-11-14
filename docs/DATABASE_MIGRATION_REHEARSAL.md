# OJIX database migration rehearsal

**Date:** 12 November 2026  
**Target:** disposable MariaDB 10.11.19 on `127.0.0.1:3317`, database `ojix_migration_rehearsal`  
**Decision:** SQL sequence passed on the available reconstructed baseline. **Not production-ready** because the baseline is not tied to deployed schema history, migration 026 changes Super Admin to Owner, API tests fail on that role state, and canonical schema/index drift remains.

## Safety and execution scope

The test server is container `ojix-mariadb-migration-test`, image `mariadb:10.11`, volume `ojix_migration_test_data`, loopback-only host mapping `127.0.0.1:3317 -> 3306/tcp`. Credentials are stored in ignored `.env.migration-test` with mode 0600; no password appears in this report. The existing OJIX database on port 3308, its volume, XAMPP data, and SpendFlow MySQL were not used or contacted. No existing container was stopped/restarted, and no source migration was edited. All migration SQL was sent only to `ojix_migration_rehearsal`; hard-coded `USE ojix_property_mysql` statements were redirected in memory to that test DB.

## Historical baseline identification

`database/mysql-schema.sql.bak` is tracked in the initial repository commit and provides the only older schema snapshot. It has the core `organizations`, `org_memberships`, `properties`, `documents`, `risk_findings`, and supporting tables. By contrast, the earliest committed `database/mysql-schema.sql` already contains many later changes and collides with historical `ALTER TABLE` migrations. It is not a valid baseline for replaying 004–034.

The `.bak` snapshot is the best available candidate, but it is not tagged with a schema version or checksum and there is no ledger proving it matches a real deployed database. Thus the rehearsal proves the chain against this candidate baseline, not against a particular production installation.

For safety, the rehearsal used a temporary copy only. The copy removed `CREATE DATABASE`, `USE`, all `DROP TABLE`, and foreign-key-check toggles; `CREATE TABLE` became `CREATE TABLE IF NOT EXISTS` to preserve two tables from an earlier failed baseline-load attempt. The nullable `properties.location` spatial index was omitted because MariaDB 10.11 rejected it with error 1252; current canonical schema also omits that index. All changes were confined to `/private/tmp/ojix-migration-baseline.sql`.

`infra/db/seed.sql` was loaded after migration 008 because it inserts `application_number`, and before migration 009 so the subsequent role/data migrations operate on seeded memberships. One test-only legacy property was later inserted to check 007/008 backfills and is identified separately below.

## Execution plan and result

1. Verified `@@port=3306` inside the container, MariaDB 10.11.19, and the connected schema name `ojix_migration_rehearsal` over host `127.0.0.1:3317`.
2. Confirmed the disposable schema was absent, created it, and recorded that its initial state had no user schemas/tables.
3. Loaded the filtered historical baseline and `infra/db/seed.sql` at the sequence point described above.
4. Applied all 31 migrations in numeric order with fail-fast execution. Each file completed with exit status 0. Migration 031 ran once.
5. Compared the resulting information schema to `database/mysql-schema.sql`, checked referential integrity, verified seed rows, and ran the backend suite against the same isolated database.

The first baseline load attempt failed before DDL because a temporary text filter left continuation lines from its multi-line `CREATE DATABASE` statement. The next attempt stopped at MariaDB error 1252 on the nullable `properties.location` spatial index after only `organizations` and `org_memberships` had been created. The corrected, filtered baseline then completed. Neither failure was a migration failure. Detailed timestamps/output are in `/private/tmp/ojix-migration-execution.log`.

### Per-file migration execution and repeatability assessment

“Passed” means that migration executed in the stated order on the test DB. Repeatability classification is static plus the explicit 007/008 replay check; it does not mean every migration was run twice.

| Order | File | Result | Repeatability / notable effect |
|---:|---|---|---|
| 1 | `004_karnataka_location_hierarchy.sql` | Passed | Guarded table/column/FK creation; temporary procedure is dropped on success. |
| 2 | `005_allow_official_duplicate_location_names.sql` | Passed | Guarded index drop/add; repeatable. |
| 3 | `006_complete_property_identity.sql` | Passed | `ADD COLUMN IF NOT EXISTS`; repeatable. |
| 4 | `007_property_parcel_references.sql` | Passed | Table `IF NOT EXISTS`; backfill uses `INSERT IGNORE`. Supplemental check created two parcel references and retained exactly two on replay. |
| 5 | `008_property_application_number.sql` | Passed | Guarded add/index plus deterministic backfill and `MODIFY`; supplemental check filled blank value and retained it on replay. |
| 6 | `009_operations_role.sql` | Passed | Upsert, but rerun deliberately reasserts role/email. |
| 7 | `010_property_consultant_role.sql` | Passed | Upsert, but rerun deliberately reasserts role/email. |
| 8 | `011_ojix_support_role.sql` | Passed | Upsert, but rerun deliberately reasserts role/email. |
| 9 | `012_data_steward_role.sql` | Passed | Upsert, but rerun deliberately reasserts role/email. |
| 10 | `013_user_registration_otp.sql` | Passed | Both tables use `IF NOT EXISTS`; rerun can conceal schema drift. |
| 11 | `014_property_identifier_type.sql` | Passed | Guarded column add; repeatable. |
| 12 | `015_property_review_and_document_metadata.sql` | Passed | Unguarded `ALTER TABLE ADD COLUMN`; non-idempotent. |
| 13 | `016_property_workflow_assignments.sql` | Passed | Unguarded property column additions; non-idempotent despite history table `IF NOT EXISTS`. |
| 14 | `017_admin_governance.sql` | Passed | Multiple unguarded column additions and unguarded table creates; strongly one-shot. |
| 15 | `018_rtc_lookups.sql` | Passed | Unguarded table create; one-shot. |
| 16 | `019_phone_otp.sql` | Passed | Unguarded column additions; one-shot. |
| 17 | `020_remove_dummy_property.sql` | Passed | Repeatable targeted deletes using fixed demo IDs and application number. No matching target row existed; seeded property remained. |
| 18 | `021_role_gmail_aliases.sql` | Passed | Repeatable update, but reasserts specific demo email values. |
| 19 | `022_account_password_overrides.sql` | Passed | Table `IF NOT EXISTS`; rerun can conceal schema drift. |
| 20 | `023_owner_primary_email.sql` | Passed | Repeatable update, but reasserts owner email. |
| 21 | `024_shared_demo_login_email.sql` | Passed | Repeatable update, but reasserts shared demo email. |
| 22 | `025_role_specific_demo_passwords.sql` | Passed | Repeatable targeted delete of selected demo override rows. Test table had no matching rows. |
| 23 | `026_demo_login_account_binding.sql` | Passed | Unguarded OTP columns/index; non-idempotent. Upsert sets an existing `user-super-admin` membership role to `owner`—observed regression. |
| 24 | `027_registration_profile_fields.sql` | Passed | Unguarded account-column additions; one-shot. |
| 25 | `028_role_wise_document_ai.sql` | Passed | Unguarded document column additions and table creates; one-shot. |
| 26 | `029_lawyer_workbench_tasks.sql` | Passed | Tables use `IF NOT EXISTS`; repeatable with schema-drift caveat. |
| 27 | `030_consultant_reports_and_assignments.sql` | Passed | Unguarded property column addition; non-idempotent, even though new tables use `IF NOT EXISTS`. |
| 28 | `031_owner_governance_versions.sql` | Passed once | Unguarded creates; one-shot. Not rerun. Phase 2 independently proved rerun fails with error 1050. |
| 29 | `032_ocr_processing_stages.sql` | Passed | Unguarded column addition plus status backfill; one-shot. |
| 30 | `033_workspace_rbac_permission_overrides.sql` | Passed | Table uses `IF NOT EXISTS`; repeatable with schema-drift caveat. |
| 31 | `034_viewer_matter_assignment.sql` | Passed | Unguarded column/index creation; one-shot. Adds an index missing from canonical fresh-install schema. |

## Schema, indexes, constraints, and integrity

- Canonical `database/mysql-schema.sql` declares 44 tables; rehearsal result has the same 44 names.
- Canonical parser and MariaDB `information_schema.COLUMNS` comparison found exactly 515 columns on both sides, with no missing or extra columns.
- Type/nullability comparisons matched semantically. The only representation differences were MariaDB's boolean alias (`BOOLEAN` becomes `TINYINT`) and `TINYINT` display width. Eight decimal default strings had equivalent scale formatting (for example `50` vs `50.0000`).
- All 63 explicitly named canonical indexes were present with their declared key columns/order (prefix-length notation excluded from column-name comparison). Migration 034 creates `properties.property_viewer_assignment_idx (tenant_id, assigned_viewer_uid, status, updated_at)`, which is absent from canonical `database/mysql-schema.sql`; this is an install-path drift item to reconcile.
- The catalog has 142 distinct indexes total, including 62 unique indexes (44 primary keys plus 18 other unique indexes). MariaDB additionally creates supporting FK indexes where needed; these account for extra catalog names and are not duplicate declarations.
- All 72 foreign keys were present with expected names/mappings. Delete actions: 62 `CASCADE`, 6 `SET NULL`, 4 `RESTRICT`; update actions are `RESTRICT`. Orphan check across every FK returned **0 violations**.
- Required fields/defaults inspected through column metadata. No unexpected nullable mismatch was found. JSON is represented by MariaDB as `LONGTEXT` with MariaDB JSON semantics/check handling; boolean and decimal formatting differences noted above are engine representations.
- The historical baseline's nullable `properties.location` spatial index was deliberately omitted from the temporary baseline and is absent from the current canonical schema. The non-null `spatial_layers.geom` spatial index is present.

## Seed and data effects

After migration and API-suite cleanup checks:

- Organization: 1 (`ojix-local-demo`).
- Memberships: 11. Ten role-specific demo/platform memberships plus `local-developer` remain.
- `user_accounts`: 0 rows. The repository seed does not insert account rows; it seeds organization memberships. This should be distinguished from registered account data.
- Canonical seeded property `22222222-2222-4222-8222-222222222222` remains as `OJIX-DEMO-0001`; its parcel reference is present after the supplemental 007 backfill.
- Synthetic spatial layer: 1.
- Additional migration-only fixture property `66666666-6666-4666-8666-666666666666` has deterministic generated reference `OJIX-PR-20261112-66666666` and one parcel reference. It is explicitly labelled synthetic; no real property data was used.
- `020` found no fixed dummy property `44444444-4444-4444-8444-444444444444` and made no deletion. `025` found no matching password-override rows and removed none.
- `021` and `024` collapsed seeded role emails to the shared Gmail address; `023` kept the Owner address at that value. `026` converted `user-super-admin` from `super_admin` to `owner` and kept its membership active. This conflicts with the seed and server-side Super Admin identity and is a high-severity migration/data issue.

## Backend test result

The first API suite attempt had no API listening on port 4000 and failed with connection refusals. It is not counted. The subsequent run started a temporary local API process with `DATABASE_URL` and `TEST_DATABASE_URL` explicitly pinned to the isolated rehearsal database. The process was stopped afterward and port 4000 was confirmed closed.

`npm test -w apps/api`: **470 passed, 3 failed of 473**. Failing tests:

1. `all ten memberships resolve their own role and only authorized dashboard surfaces`
2. `Owner and Admin cannot escalate membership or enter the platform console`
3. `Super Admin suspension, activation and revocation are individually audited`

The failing role expectations are consistent with migration 026's `ON DUPLICATE KEY UPDATE role='owner'` mutation. Do not claim this suite passed. Prior Phase 2's separate 473/473 result remains historical evidence only.

## Ledger recommendation

Do not implement a runner/ledger in this phase. A future approved design should store migration filename/version, SHA-256 checksum, started/completed timestamps, runner identity, status, and captured error metadata. Acquire a database advisory lock; enforce strict order; reject checksum drift; write success only after full file completion; and never auto-mark a partially committed DDL migration as complete. Require explicit baseline identity (schema version/checksum and bootstrap mode) so a canonical fresh install cannot be confused with a historical upgrade. MariaDB DDL auto-commits, so failures need schema-state inspection and reviewed repair/restore, not blind rerun.

## Production blockers and recommendation

1. **Baseline provenance:** the tracked `.bak` is a candidate, not a proven representation of any deployed database. Identify each actual target's schema/history before choosing migrations.
2. **RBAC regression:** migration 026 demotes the Super Admin seed membership to workspace Owner; three API tests fail. Resolve intended identity semantics and write/review a corrective forward migration before deployment.
3. **Fresh/upgrade drift:** migration 034's viewer assignment index is missing from canonical fresh-install DDL.
4. **No ledger/runner:** filenames and manually applied subsets cannot prove applied history; partial DDL failure is ambiguous.
5. **Data migration coverage:** 007 and 008 backfills were exercised with the explicit synthetic fixture, but the full historic customer-data distribution is unknown. 020/025 had no matching data to delete in this rehearsal.
6. **Operational recovery:** no production backup, restore drill, maintenance window, or rollback/forward-repair plan was validated.

The successful isolated SQL run establishes technical compatibility with one reconstructed MariaDB 10.11 baseline. It does **not** authorize or establish safety for a production migration. No production change, deployment, push, source migration edit, or migration-ledger implementation occurred.
