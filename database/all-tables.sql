-- OJIX complete database inspection
-- Database: ojix_property
-- Run with:
-- psql "postgres://ojix:ojix_local_only@localhost:5432/ojix_property" -f database/all-tables.sql

\pset pager off
\timing on

-- Database and PostGIS versions.
SELECT
  current_database() AS database_name,
  current_user AS database_user,
  version() AS postgresql_version,
  postgis_full_version() AS postgis_version;

-- All application tables.
\dt public.*

-- Row count and storage size for every application table.
SELECT
  t.tablename AS table_name,
  pg_size_pretty(
    pg_total_relation_size(format('%I.%I', t.schemaname, t.tablename))
  ) AS total_size,
  (
    xpath(
      '/row/count/text()',
      query_to_xml(
        format('SELECT count(*) AS count FROM %I.%I', t.schemaname, t.tablename),
        false,
        true,
        ''
      )
    )
  )[1]::text::bigint AS row_count
FROM pg_tables AS t
WHERE t.schemaname = 'public'
  AND t.tablename <> 'spatial_ref_sys'
ORDER BY t.tablename;

-- Complete definitions: columns, indexes, constraints, and foreign keys.
\d+ public.organizations
\d+ public.org_memberships
\d+ public.properties
\d+ public.documents
\d+ public.risk_findings
\d+ public.spatial_layers
\d+ public.audit_events
\d+ public.title_events
\d+ public.title_reviews
\d+ public.source_registry_verifications
\d+ public.legal_bookmarks
\d+ public.workspace_settings

-- All data from every application table.
SELECT * FROM public.organizations ORDER BY created_at;
SELECT * FROM public.org_memberships ORDER BY created_at;
SELECT * FROM public.properties ORDER BY created_at;
SELECT * FROM public.documents ORDER BY created_at;
SELECT * FROM public.risk_findings ORDER BY created_at;
SELECT * FROM public.spatial_layers ORDER BY created_at;
SELECT * FROM public.audit_events ORDER BY created_at;
SELECT * FROM public.title_events ORDER BY created_at;
SELECT * FROM public.title_reviews ORDER BY created_at;
SELECT * FROM public.source_registry_verifications ORDER BY verified_at;
SELECT * FROM public.legal_bookmarks ORDER BY created_at;
SELECT * FROM public.workspace_settings ORDER BY tenant_id;
