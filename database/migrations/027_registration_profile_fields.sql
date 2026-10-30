USE ojix_property_mysql;

ALTER TABLE user_accounts
  ADD COLUMN middle_name VARCHAR(80) NULL AFTER full_name,
  ADD COLUMN gender VARCHAR(32) NOT NULL DEFAULT 'prefer_not_to_say' AFTER middle_name,
  ADD COLUMN security_question VARCHAR(40) NULL AFTER phone_verified_at,
  ADD COLUMN security_answer_hash VARCHAR(255) NULL AFTER security_question;
