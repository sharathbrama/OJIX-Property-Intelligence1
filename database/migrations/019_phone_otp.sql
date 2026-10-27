USE ojix_property_mysql;

ALTER TABLE user_accounts
  ADD COLUMN phone_e164 VARCHAR(20) NULL AFTER disabled_reason,
  ADD COLUMN phone_verified_at DATETIME(6) NULL AFTER phone_e164;
