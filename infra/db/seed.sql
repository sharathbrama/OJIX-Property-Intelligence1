INSERT INTO organizations (id, name, slug)
VALUES ('11111111-1111-4111-8111-111111111111', 'OJIX Local Demo Workspace', 'ojix-local-demo')
ON CONFLICT (slug) DO NOTHING;
INSERT INTO org_memberships (organization_id, user_uid, email, role)
VALUES 
  ('11111111-1111-4111-8111-111111111111', 'local-developer', 'developer@localhost', 'owner'),
  ('11111111-1111-4111-8111-111111111111', 'user-owner', 'owner@ojix.local', 'owner'),
  ('11111111-1111-4111-8111-111111111111', 'user-admin', 'admin@ojix.local', 'admin'),
  ('11111111-1111-4111-8111-111111111111', 'user-lawyer', 'lawyer@ojix.local', 'lawyer'),
  ('11111111-1111-4111-8111-111111111111', 'user-analyst', 'analyst@ojix.local', 'analyst'),
  ('11111111-1111-4111-8111-111111111111', 'user-viewer', 'viewer@ojix.local', 'viewer')
ON CONFLICT (organization_id, user_uid) DO NOTHING;

-- Synthetic example only. This is not an official parcel, survey, Rajakaluve, lake or planning dataset.
INSERT INTO properties (id, tenant_id, name, village, hobli, taluk, district, survey_number, subdivision, extent, address, latitude, longitude, notes, created_by_uid, updated_by_uid)
VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Sample Arakere Due Diligence', 'Arakere (sample label)', 'Demo Hobli', 'Bengaluru South (demo)', 'Bengaluru Urban', 'DEMO-34', 'A', 'Not verified', 'Illustrative map point only; not a verified parcel', 12.8870, 77.5960, 'Seeded sample workspace. All details are synthetic and must not be used for a transaction.', 'local-developer', 'local-developer')
ON CONFLICT (id) DO NOTHING;
INSERT INTO spatial_layers (id, layer_type, label, source_name, data_status, geom, metadata)
VALUES ('33333333-3333-4333-8333-333333333333', 'demo_reference', 'Synthetic reference polygon', 'OJIX synthetic demo seed', 'demo', ST_GeomFromText('POLYGON((77.594 12.886,77.598 12.886,77.598 12.889,77.594 12.889,77.594 12.886))',4326), '{"warning":"Not a real property boundary or government feature."}'::jsonb)
ON CONFLICT (id) DO NOTHING;

