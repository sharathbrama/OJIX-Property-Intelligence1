-- Migration: Add Source Registry, Legal Research Bookmarks, and Settings tables

CREATE TABLE IF NOT EXISTS source_registry_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  registry_name text NOT NULL CHECK (registry_name IN ('bhoomi', 'kaveri', 'mojini', 'dishaank', 'easthi', 'rera')),
  status text NOT NULL CHECK (status IN ('verified', 'mismatch', 'pending', 'not_found', 'error')),
  query_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  matched_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  discrepancies jsonb NOT NULL DEFAULT '[]'::jsonb,
  latency_ms integer NOT NULL DEFAULT 0,
  response_hash text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS src_reg_prop_idx ON source_registry_verifications(tenant_id, property_id, registry_name);
CREATE INDEX IF NOT EXISTS src_reg_verified_at_idx ON source_registry_verifications(tenant_id, verified_at DESC);

CREATE TABLE IF NOT EXISTS legal_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  act_id text NOT NULL,
  section_number text NOT NULL,
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_by_uid text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_bookmarks_tenant_idx ON legal_bookmarks(tenant_id, property_id);

CREATE TABLE IF NOT EXISTS workspace_settings (
  tenant_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  org_name text NOT NULL DEFAULT 'Karnataka Legal Partners LLP',
  primary_contact text NOT NULL DEFAULT 'Deepak Professional (deepak@ojix.local)',
  default_district text NOT NULL DEFAULT 'Bengaluru Urban',
  auto_screen_bhoomi boolean NOT NULL DEFAULT true,
  auto_screen_kaveri boolean NOT NULL DEFAULT true,
  auto_screen_spatial boolean NOT NULL DEFAULT true,
  swd_primary_buffer_m numeric NOT NULL DEFAULT 50,
  swd_secondary_buffer_m numeric NOT NULL DEFAULT 25,
  swd_tertiary_buffer_m numeric NOT NULL DEFAULT 15,
  lake_buffer_m numeric NOT NULL DEFAULT 30,
  survey_margin_tolerance_pct numeric NOT NULL DEFAULT 1.0,
  ocr_confidence_threshold numeric NOT NULL DEFAULT 0.60,
  updated_at timestamptz NOT NULL DEFAULT now()
);
