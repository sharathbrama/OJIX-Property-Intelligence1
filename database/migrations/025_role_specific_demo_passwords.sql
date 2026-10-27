-- Demo roles share one Gmail address, but authenticate with separate passwords.
-- Remove any legacy shared-password overrides so the API's role-specific local
-- development credentials take effect. Future user-changed passwords continue
-- to be stored in account_password_overrides.
DELETE FROM account_password_overrides
WHERE user_uid IN (
  'user-owner', 'user-admin', 'user-lawyer', 'user-analyst',
  'user-operations', 'user-consultant', 'user-support',
  'user-data-steward', 'user-viewer'
);
