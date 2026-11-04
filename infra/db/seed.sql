INSERT INTO organizations (id, name, slug)
VALUES ('11111111-1111-4111-8111-111111111111', 'OJIX Local Demo Workspace', 'ojix-local-demo')
ON DUPLICATE KEY UPDATE id=VALUES(id);
INSERT INTO org_memberships (id, organization_id, user_uid, email, role)
VALUES 
  (UUID(), '11111111-1111-4111-8111-111111111111', 'local-developer', 'developer@localhost', 'owner'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-super-admin', 'keerthana1234p@gmail.com', 'owner'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-owner', 'keerthana1234p@gmail.com', 'owner'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-admin', 'keerthana1234p@gmail.com', 'admin'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-lawyer', 'keerthana1234p@gmail.com', 'lawyer'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-analyst', 'keerthana1234p@gmail.com', 'analyst'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-operations', 'keerthana1234p@gmail.com', 'operations'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-consultant', 'keerthana1234p@gmail.com', 'consultant'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-support', 'keerthana1234p@gmail.com', 'support'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-data-steward', 'keerthana1234p@gmail.com', 'data_steward'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-viewer', 'keerthana1234p@gmail.com', 'viewer')
ON DUPLICATE KEY UPDATE id=id;

-- Synthetic example only. This is not an official parcel, survey, Rajakaluve, lake or planning dataset.
INSERT INTO properties (id, tenant_id, application_number, name, village, hobli, taluk, district, survey_number, subdivision, extent, address, latitude, longitude, notes, created_by_uid, updated_by_uid)
VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'OJIX-DEMO-0001', 'Sample Arakere Due Diligence', 'Arakere (sample label)', 'Demo Hobli', 'Bengaluru South (demo)', 'Bengaluru Urban', 'DEMO-34', 'A', 'Not verified', 'Illustrative map point only; not a verified parcel', 12.8870, 77.5960, 'Seeded sample workspace. All details are synthetic and must not be used for a transaction.', 'local-developer', 'local-developer')
ON DUPLICATE KEY UPDATE id=VALUES(id);

INSERT INTO spatial_layers (id, layer_type, label, source_name, data_status, geom, metadata)
VALUES ('33333333-3333-4333-8333-333333333333', 'demo_reference', 'Synthetic reference polygon', 'OJIX synthetic demo seed', 'demo', ST_GeomFromText('POLYGON((77.594 12.886,77.598 12.886,77.598 12.889,77.594 12.889,77.594 12.886))',4326), '{"warning":"Not a real property boundary or government feature."}')
ON DUPLICATE KEY UPDATE id=VALUES(id);
