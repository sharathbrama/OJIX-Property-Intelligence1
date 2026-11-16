-- Apply only to a dedicated, synthetic demo database initialized from
-- database/mysql-schema.sql and infra/db/seed.sql. Never use on a client DB.
-- The public API demo-login endpoint accepts only this tenant and the seeded
-- Viewer identity. Its demo-only token adds approved read access; no writes/admin.

UPDATE organizations
SET name='OJIX Public Demo Sandbox', slug='ojix-public-demo'
WHERE id='11111111-1111-4111-8111-111111111111';

-- A platform-wide identity is not part of the public demo workspace.
DELETE FROM org_memberships
WHERE organization_id='11111111-1111-4111-8111-111111111111'
  AND user_uid<>'user-viewer';

UPDATE org_memberships
SET email=CASE user_uid
  WHEN 'user-owner' THEN 'demo.owner@ojix-public-demo.invalid'
  WHEN 'user-admin' THEN 'demo.admin@ojix-public-demo.invalid'
  WHEN 'user-lawyer' THEN 'demo.lawyer@ojix-public-demo.invalid'
  WHEN 'user-analyst' THEN 'demo.analyst@ojix-public-demo.invalid'
  WHEN 'user-operations' THEN 'demo.operations@ojix-public-demo.invalid'
  WHEN 'user-consultant' THEN 'demo.consultant@ojix-public-demo.invalid'
  WHEN 'user-support' THEN 'demo.support@ojix-public-demo.invalid'
  WHEN 'user-data-steward' THEN 'demo.data-steward@ojix-public-demo.invalid'
  WHEN 'user-viewer' THEN 'demo.viewer@ojix-public-demo.invalid'
  ELSE email
END
WHERE organization_id='11111111-1111-4111-8111-111111111111'
  AND user_uid IN ('user-owner','user-admin','user-lawyer','user-analyst','user-operations','user-consultant','user-support','user-data-steward','user-viewer');
