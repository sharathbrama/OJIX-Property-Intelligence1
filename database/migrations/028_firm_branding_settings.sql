USE ojix_property_mysql;

ALTER TABLE workspace_settings
  ADD COLUMN llpin VARCHAR(64) NOT NULL DEFAULT 'ADA-1604' AFTER org_name,
  ADD COLUMN office_address TEXT NULL AFTER default_district,
  ADD COLUMN firm_logo_url TEXT NULL AFTER office_address;

