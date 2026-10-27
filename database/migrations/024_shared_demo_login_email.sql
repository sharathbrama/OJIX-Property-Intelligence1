-- All local demo roles share one Gmail login. The selected portal role resolves
-- the correct membership during authentication.
UPDATE org_memberships
SET email = 'mrsharath3126@gmail.com'
WHERE organization_id = '11111111-1111-4111-8111-111111111111'
  AND user_uid IN (
    'user-owner', 'user-admin', 'user-lawyer', 'user-analyst',
    'user-operations', 'user-consultant', 'user-support',
    'user-data-steward', 'user-viewer'
  );
