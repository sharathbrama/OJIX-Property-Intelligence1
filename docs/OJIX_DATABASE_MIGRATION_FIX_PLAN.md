# OJIX Database Migration Corrections — Phase 1 Fix Plan

**Prepared:** 13 November 2026  
**State:** Corrections prepared for review; no migration or database operation was executed. No tests were run.  
**Database recommendation:** **NO-GO** until the migration artifacts are reviewed, staging baseline/history is identified, and disposable-database validation succeeds.

## Findings and known application state

- `database/migrations/026_demo_login_account_binding.sql` performs the unsafe role update in `ON DUPLICATE KEY UPDATE email=VALUES(email), role='owner', status='active'`. `infra/db/seed.sql` seeds UID `user-super-admin` as `super_admin`; its duplicate-key clause is `id=id`, so the seed itself does not change roles.
- `database/migrations/034_viewer_matter_assignment.sql` adds `properties.assigned_viewer_uid` and `property_viewer_assignment_idx (tenant_id, assigned_viewer_uid, status, updated_at)`. The current canonical schema already had the column but was missing the index.
- `docs/DATABASE_MIGRATION_REHEARSAL.md` says both 026 and 034 ran against its isolated reconstructed MariaDB rehearsal baseline. That is evidence of application in that reported disposable test environment only. It does not establish whether either migration was applied in staging or any other environment. No migration ledger is evidenced in the repository.
- Migration files 004–034 are present, with no later IDs found at preparation time. New ID **035** is therefore next. The 031 file has pre-existing uncommitted changes and was not edited.

## Corrections prepared

### Migration 026 role regression

Historical migration 026 was preserved because the rehearsal report records it as applied in at least one known environment and other environments are unknown. Rewriting it would cause checksum/history ambiguity and would not repair databases where it already ran.

New `database/migrations/035_correct_platform_role_and_viewer_index.sql` repairs only the reserved `user-super-admin` membership in organization `11111111-1111-4111-8111-111111111111`, setting its role to `super_admin`. It leaves email, status and every other membership unchanged. The update is safe to repeat and does not promote or modify unrelated user UIDs. The synthetic seed's own duplicate-key path leaves the existing role intact.

**Replay limitation:** the old 026 SQL remains unsafe if manually replayed after 035; 035 cannot make historical SQL safe to replay without rewriting history or installing a broad role-protection trigger. Therefore, 026 must be recorded as applied and never replayed. Before any environment applies 035, migration tracking/order enforcement is required. If there is a real operational requirement to rerun 026, stop and separately approve a controlled change to that historical script plus checksum reconciliation; do not silently rerun it.

### Migration 034 index/schema drift

The canonical schema now declares the exact index already used by 034:

```sql
KEY property_viewer_assignment_idx (tenant_id, assigned_viewer_uid, status, updated_at)
```

New 035 is a repeatable forward repair for both fresh canonical schemas and older upgrade schemas. It adds `assigned_viewer_uid` only if absent, checks `information_schema.STATISTICS` for an equivalent full-column, non-unique index before adding the named index, and signals an error if that name exists with a different definition. It does not update or delete property records and adds no constraint/FK. A same-shaped index under another name is accepted to avoid a duplicate index.

The original 034 was preserved. It remains a one-shot migration and will fail if blindly applied to a canonical schema that already contains the column. Fresh installs use canonical DDL and then proceed according to the installation baseline policy; they must not replay 034. Upgrades from a pre-034 baseline apply 034 only if the ledger/schema fingerprint confirms it has not already run, then apply 035 to verify/repair the final index and reserved role.

## Proposed migration sequence

There is no safe universal sequence for an unclassified target. First classify it:

1. **Fresh install:** apply the reviewed canonical schema (now including the viewer index), then seeds. Do not replay historical migrations represented by that schema. Use a ledger baseline marker so later upgrades begin at the correct version.
2. **Upgrade where 026 and 034 are both confirmed applied:** snapshot and verify first, then apply 035 once through the approved runner. Since 034 has already added the column/index, 035 validates the state and repairs the reserved role. It will no-op for an already equivalent index.
3. **Upgrade before 026/034:** apply the complete applicable migration chain in numeric order 004–035 against a proven predecessor baseline. Never skip/replay based on filenames alone. Because 026 is unsafe, this path is **blocked** until its history is reconciled. Do not allow rerunning 026 after 035.
4. **Partial/unknown migration state:** do not apply 034 or 035 yet. Restore a copy to an isolated database, inspect schema and data state, compare migration checksums/history, then prepare a target-specific recovery/forward plan. The current repository has no ledger proving this state.

Migration 035 uses a stored procedure with an initial `DROP PROCEDURE IF EXISTS` and a final drop so an interrupted attempt can be retried after verifying any DDL that committed. MariaDB/MySQL DDL is not assumed transactional; a failure still requires schema inspection before retry.

## Tests prepared

Added an offline Node test file that checks:

- The role correction scopes to the reserved platform UID and organization and does not alter unrelated fields or rows.
- The seeded Super Admin role is explicit and seed duplicate handling does not change it.
- Owner, Admin, Lawyer, Analyst, Viewer and Super Admin permission baselines remain separated.
- Canonical column/index definitions match migration 034 and correction 035.
- The correction contains metadata checks for the column/index and does not drop/truncate/delete records.
- Migration IDs are unique and 035 follows 034 as the current final ID.

These are static/source-contract checks only. Existing API integration tests include Super Admin membership/console and role-resolution cases, but they require a configured database/API and were not run. A disposable MariaDB validation remains required to prove DDL syntax, repeatability, existing-index scenarios, role preservation across representative rows, and application-query behavior.

## Migration runner / ledger requirement

A runner/tracking mechanism is required before this sequence is applied to a staging database. Phase 2 has prepared an implementation and design in `apps/api/src/migration-runner.ts`, `apps/api/scripts/migrate.ts`, and `docs/OJIX_MIGRATION_RUNNER_DESIGN.md`; it has not been used against a database. No authoritative migration ledger has been initialized in any target. Minimum controls:

- Explicit baseline/fresh-install marker and strict numeric ordering.
- Applied migration ID plus SHA-256 checksum; reject modified/replayed files and checksum drift.
- Advisory lock, start/completion/outcome records and captured failure details.
- Preflight schema fingerprint; halt on partial or unexpected state; never auto-mark a partly applied DDL migration complete.
- Role/data impact preflight for mutations such as 026 and dry-run affected-row summaries where possible.

The Phase 1 fix plan did not implement a runner. The Phase 2 implementation requires offline review and disposable-database validation before it is approved for use. Do not apply migrations merely because the runner code exists; manual filename sequencing alone remains insufficient.

## Required validation before GO

1. Review 035 SQL against the exact staging engine/version in a disposable database; test absent column/index, column already present, exact index already present, equivalent same-shaped index under another name, and conflicting same-name index.
2. Insert synthetic memberships for Super Admin, Owner, Admin, Lawyer, Analyst and Viewer; apply 035 and prove only the reserved Super Admin role changes, with all unrelated roles, statuses, emails and IDs unchanged. Reapply 035 and prove no further data/schema change.
3. Compare canonical fresh schema and upgraded schema for table/column/index/unique/FK metadata; assert viewer index has the exact column order and is non-unique, with no duplicate equivalent index.
4. Run existing `admin-governance` Super Admin role-resolution, Super Admin isolation, Owner/Admin denial and Super Admin lifecycle tests against an isolated final-schema DB, plus Super Admin bootstrap tests and viewer assignment tests.
5. Run API query regression tests for viewer matter/property/document access and representative `EXPLAIN` plans. Confirm role-scoped queries retain correct results with the new index.
6. Rehearse the migration runner's ordering, checksum, lock, interruption, partial-DDL recovery and restore behavior.
7. Confirm a verified pre-migration backup and complete restore rehearsal before touching the staging target.

Suggested validation commands **(not executed)**:

```sh
npm exec -w apps/api -- tsx --test test/migration-corrections.test.ts test/rbac.test.ts
npm test -w apps/api -- --test-name-pattern='Super Admin|Owner and Admin|Viewer workspace|viewer assignment'
```

The second command is illustrative; confirm the repository's Node test-name filtering syntax and run it only with `TEST_DATABASE_URL` and API settings pinned to a disposable database. The full API suite is the preferred post-migration validation. Separately run the reviewed migration only against an isolated disposable database; never use production credentials or data for this phase.

## Changed files

- `database/migrations/035_correct_platform_role_and_viewer_index.sql` — new forward-only role/index correction.
- `database/mysql-schema.sql` — added the missing viewer assignment index to canonical fresh-install DDL.
- `apps/api/test/migration-corrections.test.ts` — new offline regression/schema/order checks.
- `docs/OJIX_DATABASE_MIGRATION_FIX_PLAN.md` — this plan.

Historical migrations 026 and 034 and all unrelated pre-existing modifications were preserved.

## Remaining risks and decision

- Staging/other environment application state for 026 and 034 is unknown; only the disposable rehearsal application is documented.
- 026 remains unsafe to replay. An enforced migration ledger is necessary; without it, operators could regress the role after 035.
- The new migration has not been parsed or executed on any SQL engine in this task; test suite and code are unrun.
- Target baseline, engine version, backup/restore readiness, schema drift, and current membership data are unverified.
- Adding a composite index may consume storage and change optimizer plans; use representative staging-scale data for plan review.

**Recommendation: NO-GO for staging migration today.** The corrections are prepared for review, but stage only after baseline and migration history are identified, the runner/order gate is in place, backups are restorable, and all offline plus disposable-database regression checks pass. No migration was executed and no runtime validation is claimed.
