CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_uid text NOT NULL,
  email text,
  role text NOT NULL CHECK (role IN ('owner','admin','lawyer','analyst','viewer')) DEFAULT 'analyst',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_uid)
);
CREATE INDEX IF NOT EXISTS org_memberships_user_idx ON org_memberships(user_uid);

CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  village text NOT NULL DEFAULT '',
  hobli text NOT NULL DEFAULT '',
  taluk text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT 'Bengaluru Urban',
  survey_number text NOT NULL DEFAULT '',
  subdivision text NOT NULL DEFAULT '',
  extent text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  latitude double precision,
  longitude double precision,
  location geometry(Point,4326),
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'in_review' CHECK (status IN ('in_review','ready_for_review','archived')),
  created_by_uid text NOT NULL,
  updated_by_uid text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS properties_tenant_updated_idx ON properties(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS properties_survey_idx ON properties(tenant_id, survey_number);
CREATE INDEX IF NOT EXISTS properties_location_gix ON properties USING gist(location);
CREATE OR REPLACE FUNCTION set_property_location() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS properties_location_trigger ON properties;
CREATE TRIGGER properties_location_trigger BEFORE INSERT OR UPDATE OF latitude, longitude ON properties FOR EACH ROW EXECUTE FUNCTION set_property_location();

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  doc_type varchar(50),
  original_filename text NOT NULL,
  storage_key text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  sha256 char(64) NOT NULL,
  processing_status text NOT NULL DEFAULT 'queued' CHECK (processing_status IN ('queued','processing','completed','failed','manual_review')),
  extracted_text text,
  extracted_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by_uid text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_property_idx ON documents(tenant_id, property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS documents_doc_type_idx ON documents(tenant_id, doc_type);
CREATE TABLE IF NOT EXISTS risk_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical','unverified')),
  points integer NOT NULL DEFAULT 0 CHECK (points BETWEEN 0 AND 100),
  explanation text NOT NULL,
  evidence_status text NOT NULL CHECK (evidence_status IN ('demo','verified','missing','unverified')),
  next_action text NOT NULL,
  created_by_uid text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS findings_property_idx ON risk_findings(tenant_id, property_id, created_at DESC);
CREATE TABLE IF NOT EXISTS spatial_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_type text NOT NULL,
  label text NOT NULL,
  source_name text,
  source_url text,
  source_date date,
  data_status text NOT NULL DEFAULT 'demo' CHECK (data_status IN ('demo','unverified','verified','retired')),
  geom geometry(Geometry,4326) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spatial_layers_geom_gix ON spatial_layers USING gist(geom);
CREATE INDEX IF NOT EXISTS spatial_layers_active_type_idx ON spatial_layers(active, layer_type);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_uid text NOT NULL,
  tenant_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_tenant_time_idx ON audit_events(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS title_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  sequence_order integer NOT NULL DEFAULT 1,
  event_date date NOT NULL,
  registration_date date,
  deed_type text NOT NULL,
  from_parties jsonb NOT NULL DEFAULT '[]'::jsonb,
  to_parties jsonb NOT NULL DEFAULT '[]'::jsonb,
  extent_sq_ft numeric NOT NULL DEFAULT 0,
  extent_raw text NOT NULL DEFAULT '',
  consideration numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('verified','unverified','disputed')),
  dispute_rationale text,
  reviewed_by text,
  encumbrance_status text DEFAULT 'none' CHECK (encumbrance_status IN ('active_mortgage','discharged','none')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS title_events_property_idx ON title_events(tenant_id, property_id, event_date ASC);

CREATE TABLE IF NOT EXISTS title_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES title_events(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('verified','disputed','unverified')),
  rationale text,
  reviewer_uid text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS title_reviews_event_idx ON title_reviews(tenant_id, event_id, created_at DESC);

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


