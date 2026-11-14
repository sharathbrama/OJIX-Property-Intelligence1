# OJIX Phase 1 — Database Migration and RBAC Investigation

**Date:** 13 November 2026  
**Scope:** Static repository investigation of the migration rehearsal report, final staging audit, all migration files, canonical schema, RBAC, membership and affected API query code. No database was contacted, migrations or tests were executed, and no existing database or application file was modified.

## Executive finding

**Database migration recommendation: NO-GO for staging migration or database cutover.** Migration 026 contains an evidenced upsert that changes the seeded platform identity `user-super-admin` from `super_admin` to workspace `owner`. The rehearsal report attributes three API test failures to this role mutation; the affected test contracts align with the changed role. Migration 034 adds a viewer assignment column and index; the canonical schema already has the column, but lacks the named index. The reports establish that this index was observed after the rehearsal chain, but static inspection alone does not establish all runtime/query plans or any target database's current state.

## Evidence reviewed and limits

Reviewed `docs/DATABASE_MIGRATION_REHEARSAL.md`, `docs/OJIX_FINAL_STAGING_READINESS_AUDIT.md`, all 31 SQL migration files `database/migrations/004_...` through `034_...`, `database/mysql-schema.sql`, `infra/db/seed.sql`, `apps/api/src/rbac.ts`, relevant authentication/membership and property assignment/query code in `apps/api/src/server.ts`, and referenced tests. The rehearsal report describes execution against a disposable MariaDB 10.11.19 database reconstructed from `database/mysql-schema.sql.bak`; that activity is historical report evidence, not a run performed for this investigation. Its output logs were not available/independently inspected here. No live schema or migration history can be inferred for a staging database.

## 1. Migration 026 and the three reported API failures

### Exact SQL and data effect

`database/migrations/026_demo_login_account_binding.sql` has two effects:

1. Adds `otp_challenges.account_uid VARCHAR(191) NULL`, `otp_challenges.otp_salt CHAR(32) NULL`, and index `otp_challenges_account_purpose_idx (account_uid, purpose, created_at)`.
2. Upserts the membership with UID `user-super-admin` in organization `11111111-1111-4111-8111-111111111111`, setting `email`, **`role='owner'`**, and `status='active'` on duplicate key.

`infra/db/seed.sql` creates that same UID with role `super_admin`. Therefore, on the seeded/reconstructed baseline described in the rehearsal, the duplicate-key branch deterministically changes that identity to `owner`. The migration's demo-login/account-binding purpose does not justify changing the platform role. This is the direct root cause supported by SQL and seed evidence.

### Reported failing tests and root-cause confidence

| Reported test | Expected contract in test source | Effect of role mutation | Finding |
|---|---|---|---|
| `all ten memberships resolve their own role and only authorized dashboard surfaces` (`apps/api/test/admin-governance.test.ts`) | `/api/auth/me` for `user-super-admin` must return `super_admin`; platform overview must succeed; workspace overview must return 403. | The database-resolved membership becomes `owner`; the returned role assertion fails. Subsequent platform/workspace assertions can also invert: owner is not Super Admin, and owner may use workspace APIs. | **Root cause established by code/test contract.** Exact first failing assertion is predictable from code; no fresh test execution was done. |
| `Owner and Admin cannot escalate membership or enter the platform console` (same test file) | Owner/Admin denied platform overview; special platform identity `user-super-admin` denied workspace properties. | The first two role-protection assertions for Owner/Admin remain consistent. The final assertion expects `user-super-admin` to be Super Admin and blocked from workspace data, but after mutation it is an Owner and can pass workspace authorization. | **Likely/strongly supported root cause for the reported failure.** The altered role changes the expected platform/workspace boundary. No fresh execution confirms which assertion failed. |
| `Super Admin suspension, activation and revocation are individually audited` (same test file) | `user-super-admin` must authorize three platform membership updates, each recorded in audit. | With role `owner`, `permissionForRequest` maps `/api/super-admin/...` to `super_admin.*`; middleware requires membership role `super_admin`, so the operation is denied before mutation/audit. | **Likely/strongly supported root cause for the reported failure.** Role gate and test are explicit; no fresh execution confirms the recorded failing assertion. |

Thus the migration/report/test evidence accounts for the three failures without attributing them to unrelated SQL. The rehearsal report says 470/473 passed and names these three tests, but this investigation did not rerun them. Other possible environmental/test-state causes are not ruled out absent the original run output.

### RBAC impact by role

- **Super Admin:** direct regression. Platform routes explicitly require role `super_admin`; Super Admin is isolated from workspace grants. Conversion removes platform console access while granting workspace Owner baseline permissions. Bootstrap logic and tests also preserve/create a `super_admin` membership.
- **Owner:** the migration can create a second Owner identity from the platform account. This affects owner-only settings/governance checks, owner protections, owner activity/session policies, and platform/workspace separation. It can mask the missing Super Admin and create unintended workspace authority.
- **Admin:** no direct row mutation targets Admin. Existing tests explicitly deny Admin platform-console access; the SQL does not grant Admin platform access. Indirect risk is that migration-created Owner authority can bypass intended Owner/Admin distinctions.
- **Lawyer:** no direct role mutation. Lawyer assignment scoping and grants depend on role and `assigned_lawyer_uid`; migration 026 does not alter these.
- **Analyst:** no direct role mutation. Analyst assignment scoping and grants depend on `assigned_analyst_uid`; migration 026 does not alter these.
- **Viewer:** no direct role mutation in 026. Viewer membership access depends on role plus matter assignment and approved/complete property status; migration 034 supplies the associated property field in historical upgrade paths.

## 2. Migration 034 versus canonical schema

### Exact differences

`database/migrations/034_viewer_matter_assignment.sql` selects `ojix_property_mysql`, then:

- Adds `properties.assigned_viewer_uid VARCHAR(191) NOT NULL DEFAULT '' AFTER assigned_consultant_uid`.
- Adds non-unique index `property_viewer_assignment_idx (tenant_id, assigned_viewer_uid, status, updated_at)`.

The canonical `database/mysql-schema.sql` already declares `assigned_viewer_uid VARCHAR(191) NOT NULL DEFAULT ''` on `properties`, in the assignment columns block after `assigned_consultant_uid`. It does **not** declare `property_viewer_assignment_idx`. The rehearsal report says the upgraded rehearsal schema had this index and the canonical named-index comparison found it missing. The precise declared difference is therefore the index, not the column. No FK or unique constraint is introduced by migration 034; the column is an assignment UID string, with no FK to `org_memberships`.

Canonical and historical setup also differ in operational path: fresh initialization loads the current schema, whereas 034 is a one-shot `ALTER TABLE` intended for an older schema. Applying it to a database already created from the canonical schema will fail at `ADD COLUMN` before reaching index creation. Do not treat the current schema as a pre-034 baseline.

### Affected application behavior and query compatibility

The API references `assigned_viewer_uid` in property scoping, viewer-specific dashboards/documents/findings, assignment updates, and validation (`apps/api/src/server.ts`, including the query sites around lines 597, 1374, 1475, 1796–1798, 1920, 3824–3837 and 4040; line numbers can shift with local changes). Because canonical schema contains the column and historical sequence 034 adds it, those queries are structurally compatible with either intended final schema. The index does not change query semantics or constraint enforcement; it supports tenant/assignee/status/update filtering and may affect performance. No query plans or real workload performance were measured.

Static check of assignment queries shows viewer membership is validated as an active `viewer` in the same organization before assignment. Read paths require assignment and (for property/file access) approved/complete status. The index's leading columns align with common tenant + assigned viewer access, though status/update ordering/selectivity should be confirmed with representative plans if performance is a release criterion.

### Constraints and related schema

The rehearsal report records 72 FKs and zero orphan rows in its candidate-schema run, but migration 034 itself adds no FK. `properties.tenant_id` has an organization FK in canonical DDL; viewer assignment remains an application-enforced UID relation. Adding a cross-table FK would require a normalized assignment table or carefully designed composite membership relation; it is not implied by migration 034 and should not be improvised as part of this investigation.

## 3. Migration sequence and expected final schema

The repository's historical sequence, as reported in the rehearsal, is strict numeric order:

`004` → `005` → `006` → `007` → `008` → `009` → `010` → `011` → `012` → `013` → `014` → `015` → `016` → `017` → `018` → `019` → `020` → `021` → `022` → `023` → `024` → `025` → `026` → `027` → `028` → `029` → `030` → `031` → `032` → `033` → `034`.

The report says this order executed on its reconstructed candidate baseline, with `infra/db/seed.sql` inserted after 008 and before 009 in that rehearsal to satisfy its seed dependencies. This is **not** a universally safe sequence for an arbitrary staging database. Files include unguarded/one-shot DDL, some hard-coded `USE ojix_property_mysql`, and seed/data updates; the actual baseline, seed state, partial prior application, and DB engine/version must be established first.

Expected logical end state, per canonical schema plus reported rehearsal comparison:

- Canonical tables/columns from `database/mysql-schema.sql`, including `otp_challenges.account_uid`, `otp_salt`, property assignment fields including `assigned_viewer_uid`, and later governance/OCR/workbench tables.
- Migration 034's extra `properties.property_viewer_assignment_idx (tenant_id, assigned_viewer_uid, status, updated_at)` reconciled into the documented canonical final schema for fresh installs, or explicitly accepted as an upgrade-only performance index.
- No migration 026 role overwrite: `user-super-admin` must remain a platform `super_admin` identity. Workspace Owner accounts remain distinct memberships.
- Named constraints and indexes should match a reviewed schema manifest; engine-created FK support indexes should not be confused with declared application indexes.

The rehearsal report asserts matching 44 table names/515 columns, all 63 named canonical indexes plus the additional 034 index, and 72 FKs on its candidate result. Those are historical reported measurements and are not independently remeasured here.

## 4. Other migration effects and risks relevant to sequence

All files were enumerated. The rehearsal's repeatability table reports several one-shot DDL migrations (notably 015–019, 026–028, 030–032, 034) and one-shot 031; guarded `IF NOT EXISTS` does not prove schema equality and can hide drift. Data-mutating/demo migrations 009–012, 020–025 may reassert role/email values or delete targeted demo records. In particular 026 is not a harmless schema-only migration. Migration 031 is locally modified/uncommitted in this repository; preserve its current bytes and checksum, and do not rely on the historical report's execution result as proof for the current working-tree version.

Migration 033 introduces `workspace_permission_overrides`; server logic catches missing table for baseline permission behavior, while settings endpoints report migration readiness. It layers restrictions/restorations on server baselines and refuses grants outside them; Super Admin/Owner overrides are disallowed by route validation. Its presence is part of expected final schema, but route-level tests remain required.

## 5. Ledger/runner decision

A migration ledger and controlled runner are needed before repeatable staging/production upgrades, because:

- There is no authoritative applied-version/checksum record.
- Historical files mix idempotent-looking operations with non-idempotent DDL and data updates.
- MariaDB DDL can auto-commit, so a failed file may leave a partially changed schema.
- `CREATE TABLE IF NOT EXISTS` and duplicate-key upserts can silently preserve drift or mutate data on replay.
- Canonical fresh initialization and historical upgrade paths are different.

The ledger should record migration ID, file checksum, start/completion, runner identity, outcome and captured error; enforce strict ordering and a per-database advisory lock; reject modified historical files; and refuse to mark a partly executed migration complete. It should require an explicit baseline identity/fresh-install mode and provide a preflight schema fingerprint. Do not create the ledger ad hoc on an unknown target or auto-replay migrations based only on filenames. First approve the design and create it in a disposable rehearsal environment.

## 6. Proposed corrections (not applied)

1. Replace migration 026's role-changing duplicate-key behavior with a reviewed forward correction that preserves an existing membership role/status and only initializes a missing demo membership with the intended role. Because 026 may already have run, do not edit/rewrite history; prepare an idempotent, audited forward migration after determining each target's current membership state. Avoid automatically promoting arbitrary memberships.
2. Reconcile migration 034 with the canonical schema policy: include the assignment index in a future canonical schema update if it is desired for every fresh install, and make the migration strategy detect an existing column/index safely. Do not edit/reorder 034 in place for an already deployed environment.
3. Use a dedicated platform identity/membership model or otherwise make the Super Admin's relationship to an organization unambiguous. Current code authenticates permissions from the selected `org_memberships` role, while seed data places Super Admin in the demo workspace. Retain the explicit rule that platform Super Admin does not inherit workspace Owner access.
4. Define one authoritative canonical schema and documented fresh-install versus upgrade paths. Remove ambiguity around `database/mysql-schema.sql`, `infra/db/schema.sql`, `.bak`, seed timing, and historical deltas only through a separately reviewed change.
5. Version and checksum migration files before introducing an automated runner; preserve their historical contents.

## 7. Required regression tests

Run only after a disposable database and migration baseline are approved. Required assertions:

- Apply the full intended migration chain to a checksum-identified historical baseline; compare every table, column type/nullability/default, index (name, order, uniqueness), FK, and relevant check/engine behavior to an approved expected manifest.
- Apply the migration 026 correction where 026 already ran: Super Admin remains `super_admin`; existing Owner/Admin/Lawyer/Analyst/Viewer membership roles and statuses remain unchanged; missing intended demo membership behavior is explicit; rerun/partial-state handling is safe.
- All three named regression tests in `apps/api/test/admin-governance.test.ts`, plus `apps/api/test/super-admin-bootstrap.test.ts`, against the post-migration schema.
- Authentication and route matrix for Super Admin, Owner, Admin, Lawyer, Analyst, Viewer: platform endpoints, workspace endpoints, member/role changes, property/matter assignment, dashboard, document and export visibility. Include explicit negative tests for Super Admin-as-workspace, Owner/Admin-as-platform, cross-tenant and inactive memberships.
- Viewer assignment CRUD: active same-tenant viewer accepted; wrong-role, inactive, foreign-tenant and empty assignment behavior; property/document visibility gated by assignment and approved/complete status.
- Query compatibility and representative `EXPLAIN` checks for lawyer, analyst and viewer assignment filters; ensure schema with/without index has identical results and expected index selection at realistic cardinality.
- Migration runner: clean install, ordered upgrade, checksum drift rejection, interrupted/partial migration recovery, concurrent runner lock, already-applied detection and backup restore rehearsal.
- Validate startup and representative API queries against the final schema with current MariaDB/MySQL target version; do not use production credentials/data for this suite.

## 8. Safe staging baseline, sequence, backup and rollback

### Baseline selection

1. Use a **new, isolated, disposable staging database** with no production copy unless separately approved. Pin the exact MariaDB/MySQL engine/version and collation.
2. Decide whether staging is a fresh install or upgrade. For fresh install, initialize from an approved canonical schema revision plus seed fixtures; do not replay historical deltas already represented in canonical DDL. For upgrade, use a checksum-identified predecessor baseline and a verified migration ledger/history. The `.bak` candidate in the report is not proof of any actual target baseline.
3. Preserve the current working tree and migration 031 content/checksum. Inventory all local uncommitted changes before producing migration artifacts.
4. Reconcile migration 026 and 034 as forward changes, review SQL and expected data effects, then build and validate the full ordered artifact set against the chosen baseline. Do not cherry-pick or skip files based on number alone.

### Staging migration sequence

1. Take and verify a pre-change logical plus physical snapshot/backup of the disposable staging target; record schema fingerprint, row counts and migration state.
2. Restore that backup into a second isolated database and prove application-level recovery before applying changes.
3. Run migration preflight: engine/version, schema fingerprint, baseline/version, duplicate/partial objects, affected row counts for data updates, free space, FK integrity and application maintenance/connection plan.
4. Apply the approved full sequence through the reviewed ledger/runner in numeric order on the disposable rehearsal copy; inspect each DDL/data step and stop on any mismatch. Specifically inspect `user-super-admin` role before and after 026; validate 034 column/index state before/after.
5. Reconcile final schema to expected manifest, run migration-specific and role/tenant regression suite, then deploy the API only to isolated staging and perform read-only/synthetic-data smoke tests.
6. Repeat against the actual staging target only after matching its fingerprint to the approved baseline and obtaining a fresh verified backup. Keep a human-controlled stop between migrations with irreversible or data-mutating effects.

### Backup and rollback requirements

- Use consistent, encrypted, access-controlled backups; include database, document-object references/files as applicable, migration ledger and configuration/secret version references (never embed secrets in the report).
- Verify checksums, retention, restore permissions and recoverability. Record recovery point/time objectives and an operator-owned restore runbook.
- Since DDL is not reliably transactionally reversible, **rollback means restoring the verified pre-migration database snapshot**, not rerunning an inverse guess. Preserve the pre-migration snapshot until staging acceptance and retention period expire.
- For data changes such as role updates/deletes, capture affected rows and a reviewed restore mapping before execution. Prefer a forward-fix migration for an accepted schema already in use; never edit applied files or blindly rerun a partially completed file.
- If restore is impractical, stop and design a forward repair against an isolated copy before any target change. Reconcile database and document storage state together where operations span both.

## Conclusion

**NO-GO for staging database migration at present.** Migration 026 has a confirmed role-changing defect against the seeded platform identity; the three reported failures are consistent with explicit test expectations and middleware role gates, though exact run-time assertion traces remain unverified because tests were not rerun. Migration 034's column is already in canonical DDL, while its named index is absent there; the index is a schema-manifest drift item and the one-shot column addition makes the current migration unsafe to apply to a canonical fresh install. No target baseline, ledger, recovery drill, or current staging state is evidenced. Resolve the forward data correction, canonical/index policy, baseline/versioning and backup/restore process, then pass the specified disposable-database regressions before reconsidering GO.
