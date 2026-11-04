USE ojix_property_mysql;

ALTER TABLE workspace_settings
  ADD COLUMN enforce_mfa_privileged BOOLEAN NOT NULL DEFAULT TRUE AFTER legal_disclaimer;

