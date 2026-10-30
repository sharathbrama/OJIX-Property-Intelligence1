ALTER TABLE otp_challenges
  ADD COLUMN account_uid VARCHAR(191) NULL AFTER email,
  ADD COLUMN otp_salt CHAR(32) NULL AFTER otp_hash,
  ADD KEY otp_challenges_account_purpose_idx (account_uid, purpose, created_at);

INSERT INTO org_memberships (id, organization_id, user_uid, email, role, status)
VALUES (UUID(), '11111111-1111-4111-8111-111111111111', 'user-super-admin', 'mrsharath3126@gmail.com', 'owner', 'active')
ON DUPLICATE KEY UPDATE email=VALUES(email), role='owner', status='active';
