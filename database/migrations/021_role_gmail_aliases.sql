UPDATE org_memberships
SET email = CASE user_uid
  WHEN 'user-owner' THEN 'mrsharath3126+owner@gmail.com'
  WHEN 'user-admin' THEN 'mrsharath3126+admin@gmail.com'
  WHEN 'user-lawyer' THEN 'mrsharath3126+lawyer@gmail.com'
  WHEN 'user-analyst' THEN 'mrsharath3126+analyst@gmail.com'
  WHEN 'user-operations' THEN 'mrsharath3126+operations@gmail.com'
  WHEN 'user-consultant' THEN 'mrsharath3126+consultant@gmail.com'
  WHEN 'user-support' THEN 'mrsharath3126+support@gmail.com'
  WHEN 'user-data-steward' THEN 'mrsharath3126+steward@gmail.com'
  WHEN 'user-viewer' THEN 'mrsharath3126+viewer@gmail.com'
  ELSE email
END
WHERE user_uid IN (
  'user-owner', 'user-admin', 'user-lawyer', 'user-analyst',
  'user-operations', 'user-consultant', 'user-support',
  'user-data-steward', 'user-viewer'
);
