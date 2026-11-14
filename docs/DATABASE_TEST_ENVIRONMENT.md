# Database test environment readiness

**Updated:** 12 November 2026  
**Scope:** Isolated MariaDB server preparation and Phase 3.3 migration rehearsal. Production and pre-existing application databases were not contacted.

## Prepared server

| Item | Verified result |
|---|---|
| Container | `ojix-mariadb-migration-test` — running, health status `healthy` |
| Image | `mariadb:10.11`, image ID `sha256:7db29378d4fdab73f8123bbc2b48905c90d1a4b00cf848b028f1e81e623257f2` |
| Server version | `10.11.19-MariaDB-ubu2204` |
| Host binding | `127.0.0.1:3317` → container `3306/tcp` (verified from Docker port mapping) |
| Persistent storage | Dedicated Docker volume `ojix_migration_test_data` mounted at `/var/lib/mysql` |
| Credentials | Unique random root password; stored only in Git-ignored [`.env.migration-test`](/Users/apple/Desktop/OJIX-NonLetigation-Law-inteligence/.env.migration-test), file mode `0600`. Password is not included here or in command output. |
| Connection | Successful TCP connection to `127.0.0.1:3317` using the MariaDB client; returned MariaDB 10.11.19. |
| Database state | Disposable `ojix_migration_rehearsal` was created on the isolated server after separate approval. The full 004–034 sequence and synthetic seed/replay checks ran there. No OJIX test DB was created on another server. |

## Safety verification

- Checked Docker daemon and inventory before making changes. Docker Desktop daemon reported version 29.8.0.
- Port 3317 was closed before preparation.
- Confirmed the requested container name and volume name did not already exist before creating either.
- Created only the new volume `ojix_migration_test_data` and the new MariaDB container above. The container has exactly the new named volume mounted as its data directory; no host database directory or pre-existing volume is mounted.
- The host port is bound to loopback only: `127.0.0.1:3317`, not `0.0.0.0`.
- The existing containers remained running after preparation: `ojix-web`, `ojix-api`, `ojix-tesseract-ocr-worker`, `ojix-nonletigation-law-inteligence-db-1`, `ojix-phpmyadmin`, and `spendflow-mysql`.
- The existing OJIX database volume `ojix-nonletigation-law-inteligence_ojix_db_data` and existing OJIX host port 3308 were not used. No connection was made to the existing OJIX database or the XAMPP database.
- No existing container or volume was stopped, restarted, removed, or modified. No application source, production credential/configuration, deployment, or GitHub state was changed.

## Connection details

For the **server only** (after approval for the next phase):

- Host: `127.0.0.1`
- Port: `3317`
- User: `root`
- Password: stored in `.env.migration-test`; do not display, commit, or copy it into source/configuration.
- Engine/version: MariaDB `10.11.19`

The OJIX test schema/database is deliberately not provisioned. Credentials currently grant access to the disposable server only. Before the next phase, create a dedicated least-privilege test user/database if appropriate rather than reusing app or production credentials.

## Rehearsal status and next boundary

Server preparation, database migration rehearsal, and verification are complete. The test database remains on the disposable test server for inspection. All 31 migrations passed on a reconstructed baseline candidate; migration 026 changes seeded `user-super-admin` to `owner`, three API tests failed on Super Admin/role assertions, and migration 034's index is missing from canonical fresh-install DDL. The test result is **not production approval**. See `docs/DATABASE_MIGRATION_REHEARSAL.md` for evidence and blockers. Do not use the test credential in application or production configuration.
