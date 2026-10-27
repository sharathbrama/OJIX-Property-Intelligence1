# OJIX Property Intelligence - Database Test Report

**Revision:** `bc0508b`  
**Execution date:** 27 October 2026

## Architecture and inventory

- Current runtime engine: MariaDB 10.11.
- Node adapter: `mysql2`.
- Canonical schema: `database/mysql-schema.sql`.
- Canonical schema table declarations: **26**.
- Incremental migrations: **22 files**, numbered `004` through `025`.
- Compose host port: `3307` by default, mapped to container port `3306`.
- Data volumes: MariaDB data and local uploads.

## Executed checks

| Check | Expected | Actual | Status |
|---|---|---|---|
| Port 3306 listener | Available when local DB runs | No listener | BLOCKED |
| Port 3307 listener | Available when Compose DB runs | No listener | BLOCKED |
| Application health/database connectivity | Connected result | API unavailable | BLOCKED |
| Schema static inspection | Valid MariaDB DDL present | 26 table declarations found | PASS - inspection only |
| Migration inventory | Ordered migration set | 22 files, `004-025` | PASS - inventory only |
| Clean schema initialization | Successful | Not executed | NOT TESTED |
| Sequential upgrade | No data loss/constraint break | Not executed | NOT TESTED |
| Persistence/restart | Data retained | Not executed | NOT TESTED |

## Confirmed integration defect

The GitHub Actions workflow provisions PostGIS 16, supplies a PostgreSQL connection string and runs `psql` against `infra/db/schema.sql` and `infra/db/seed.sql`. The current API and Compose environment use MariaDB/MySQL. This makes CI database evidence unreliable for the present architecture and is recorded as BUG-002.

## Data-integrity risks requiring retest

- Migrations `019-025` alter phone OTP, demo-property cleanup, aliases, password overrides and owner/demo login data.
- Migration idempotency and rollback/recovery procedures are not demonstrated.
- Clean schema and sequential migration paths may drift.
- Tenant foreign keys, uniqueness rules and cascades were not exercised at runtime.
- Seed scripts must never run against production or client databases.

## Required retest procedure

1. Create an isolated MariaDB QA instance with no client data.
2. Initialize the canonical schema and seed; record schema checksums and table counts.
3. Create a separate database from the prior release snapshot.
4. Apply each migration once in order and capture failures.
5. Verify account, membership, property, document, audit and workflow row integrity.
6. Run API tests and explicit cross-tenant negative queries.
7. Restart services and verify persistence.
8. Restore from a tested backup and compare checksums/counts.

## Assessment

Database implementation is statically present but runtime connectivity, migration safety and persistence are **BLOCKED / NOT TESTED**. It is not release-certified.
