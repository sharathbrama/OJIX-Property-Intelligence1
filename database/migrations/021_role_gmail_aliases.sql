UPDATE org_memberships
SET email = CASE user_uid
  WHEN 'user-owner' THEN 'keerthana1234p+owner@gmail.com'
  WHEN 'user-admin' THEN 'keerthana1234p+admin@gmail.com'
  WHEN 'user-lawyer' THEN 'keerthana1234p+lawyer@gmail.com'
  WHEN 'user-analyst' THEN 'keerthana1234p+analyst@gmail.com'
  WHEN 'user-operations' THEN 'keerthana1234p+operations@gmail.com'
  WHEN 'user-consultant' THEN 'keerthana1234p+consultant@gmail.com'
  WHEN 'user-support' THEN 'keerthana1234p+support@gmail.com'
  WHEN 'user-data-steward' THEN 'keerthana1234p+steward@gmail.com'
  WHEN 'user-viewer' THEN 'keerthana1234p+viewer@gmail.com'
  ELSE email
END
WHERE user_uid IN (
  'user-owner', 'user-admin', 'user-lawyer', 'user-analyst',
  'user-operations', 'user-consultant', 'user-support',
  'user-data-steward', 'user-viewer'
);
