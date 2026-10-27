-- Remove the previously seeded complete dummy workspace. The fixed IDs and
-- application number ensure no user-created property can be affected.
DELETE FROM parcel_refs
WHERE id = '55555555-5555-4555-8555-555555555555'
  AND property_id = '44444444-4444-4444-8444-444444444444';

DELETE FROM properties
WHERE id = '44444444-4444-4444-8444-444444444444'
  AND tenant_id = '11111111-1111-4111-8111-111111111111'
  AND application_number = 'OJIX-DEMO-0002';
