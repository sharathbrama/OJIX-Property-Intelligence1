INSERT INTO organizations (id, name, slug)
VALUES ('11111111-1111-4111-8111-111111111111', 'OJIX Local Demo Workspace', 'ojix-local-demo')
ON DUPLICATE KEY UPDATE id=VALUES(id);
INSERT INTO org_memberships (id, organization_id, user_uid, email, role)
VALUES 
  (UUID(), '11111111-1111-4111-8111-111111111111', 'local-developer', 'developer@localhost', 'owner'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-owner', 'owner@ojix.local', 'owner'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-admin', 'admin@ojix.local', 'admin'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-lawyer', 'lawyer@ojix.local', 'lawyer'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-analyst', 'analyst@ojix.local', 'analyst'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-operations', 'operations@ojix.local', 'operations'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-consultant', 'consultant@ojix.local', 'consultant'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-support', 'support@ojix.local', 'support'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-data-steward', 'steward@ojix.local', 'data_steward'),
  (UUID(), '11111111-1111-4111-8111-111111111111', 'user-viewer', 'viewer@ojix.local', 'viewer')
ON DUPLICATE KEY UPDATE id=id;

-- Synthetic example only. This is not an official parcel, survey, Rajakaluve, lake or planning dataset.
INSERT INTO properties (id, tenant_id, application_number, name, village, hobli, taluk, district, survey_number, subdivision, extent, address, latitude, longitude, notes, created_by_uid, updated_by_uid)
VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'OJIX-DEMO-0001', 'Sample Arakere Due Diligence', 'Arakere (sample label)', 'Demo Hobli', 'Bengaluru South (demo)', 'Bengaluru Urban', 'DEMO-34', 'A', 'Not verified', 'Illustrative map point only; not a verified parcel', 12.8870, 77.5960, 'Seeded sample workspace. All details are synthetic and must not be used for a transaction.', 'local-developer', 'local-developer')
ON DUPLICATE KEY UPDATE id=VALUES(id);

-- Complete synthetic workspace for exercising the property-review workflow.
-- This is test data only and must never be treated as a verified land record.
INSERT INTO properties (
  id, tenant_id, application_number, name,
  review_purpose, review_purpose_custom, primary_document_type, primary_document_type_custom,
  property_identifier, property_identifier_type, property_type,
  village, hobli, taluk, district, district_id, taluk_id, hobli_id, village_id,
  survey_number, subdivision, extent, extent_value, extent_unit,
  boundary_north, boundary_south, boundary_east, boundary_west,
  address, latitude, longitude, coordinate_source, coordinate_confidence, coordinate_captured_at,
  location, notes, identity_state, status, created_by_uid, updated_by_uid
)
VALUES (
  '44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111',
  'OJIX-DEMO-0002',
  'Dummy Ganadahosuru Legal Due Diligence',
  'legal_due_diligence', '', 'rtc_pahani', '',
  '', '', 'agricultural',
  'Ganadahosuru', 'Kasaba2', 'Pandavapura', 'Mandya',
  (SELECT id FROM karnataka_districts WHERE name = 'Mandya' LIMIT 1),
  (SELECT id FROM karnataka_taluks WHERE name = 'Pandavapura' LIMIT 1),
  (SELECT id FROM karnataka_hoblis WHERE name = 'Kasaba2' LIMIT 1),
  (SELECT id FROM karnataka_villages WHERE name = 'Ganadahosuru' LIMIT 1),
  '45', '2', '20 guntas', 20.0000, 'gunta',
  '20-ft public road', 'Land of Ramesh', 'Survey No. 46', 'Irrigation canal',
  'Survey No. 45/2, Near Taluk Office, Pandavapura Main Road, Mandya',
  12.500100, 76.670200, 'Licensed surveyor GPS (dummy reference)', 85, '2026-10-12 11:45:00',
  ST_GeomFromText('POINT(76.670200 12.500100)', 4326),
  'SYNTHETIC TEST RECORD ONLY. Complete dummy workspace for development and validation; not verified and not suitable for any transaction.',
  'known', 'in_review', 'local-developer', 'local-developer'
)
ON DUPLICATE KEY UPDATE
  name=VALUES(name), review_purpose=VALUES(review_purpose), primary_document_type=VALUES(primary_document_type),
  property_type=VALUES(property_type), village=VALUES(village), hobli=VALUES(hobli), taluk=VALUES(taluk), district=VALUES(district),
  district_id=VALUES(district_id), taluk_id=VALUES(taluk_id), hobli_id=VALUES(hobli_id), village_id=VALUES(village_id),
  survey_number=VALUES(survey_number), subdivision=VALUES(subdivision), extent=VALUES(extent), extent_value=VALUES(extent_value), extent_unit=VALUES(extent_unit),
  boundary_north=VALUES(boundary_north), boundary_south=VALUES(boundary_south), boundary_east=VALUES(boundary_east), boundary_west=VALUES(boundary_west),
  address=VALUES(address), latitude=VALUES(latitude), longitude=VALUES(longitude), coordinate_source=VALUES(coordinate_source),
  coordinate_confidence=VALUES(coordinate_confidence), coordinate_captured_at=VALUES(coordinate_captured_at), location=VALUES(location),
  notes=VALUES(notes), identity_state=VALUES(identity_state), status=VALUES(status), updated_by_uid=VALUES(updated_by_uid);

INSERT INTO parcel_refs (
  id, tenant_id, property_id, sequence_no, is_primary, district, taluk, hobli, village,
  survey_number, subdivision, extent_raw, extent_value, extent_unit, source_description,
  fact_state, notes, created_by_uid
)
VALUES (
  '55555555-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',
  '44444444-4444-4444-8444-444444444444',
  1, 1, 'Mandya', 'Pandavapura', 'Kasaba2', 'Ganadahosuru',
  '45', '2', '20 guntas', 20.0000, 'gunta',
  'Synthetic seeded RTC / Pahani reference', 'known',
  'SYNTHETIC TEST PARCEL ONLY. Not sourced from an official land record.', 'local-developer'
)
ON DUPLICATE KEY UPDATE
  sequence_no=VALUES(sequence_no), is_primary=VALUES(is_primary), district=VALUES(district), taluk=VALUES(taluk),
  hobli=VALUES(hobli), village=VALUES(village), extent_raw=VALUES(extent_raw), extent_value=VALUES(extent_value),
  extent_unit=VALUES(extent_unit), source_description=VALUES(source_description), fact_state=VALUES(fact_state), notes=VALUES(notes);
INSERT INTO spatial_layers (id, layer_type, label, source_name, data_status, geom, metadata)
VALUES ('33333333-3333-4333-8333-333333333333', 'demo_reference', 'Synthetic reference polygon', 'OJIX synthetic demo seed', 'demo', ST_GeomFromText('POLYGON((77.594 12.886,77.598 12.886,77.598 12.889,77.594 12.889,77.594 12.886))',4326), '{"warning":"Not a real property boundary or government feature."}')
ON DUPLICATE KEY UPDATE id=VALUES(id);
