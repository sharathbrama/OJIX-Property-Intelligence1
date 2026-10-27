-- Use the primary Gmail address for the local Owner sign-in.
UPDATE org_memberships
SET email = 'mrsharath3126@gmail.com'
WHERE user_uid = 'user-owner'
  AND organization_id = '11111111-1111-4111-8111-111111111111';
