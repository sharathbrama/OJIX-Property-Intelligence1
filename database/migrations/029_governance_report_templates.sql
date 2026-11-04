USE ojix_property_mysql;

ALTER TABLE workspace_settings
  ADD COLUMN firm_email VARCHAR(191) NOT NULL DEFAULT 'info@ojix.in' AFTER primary_contact,
  ADD COLUMN default_report_template VARCHAR(64) NOT NULL DEFAULT 'detailed_due_diligence' AFTER default_district,
  ADD COLUMN legal_disclaimer TEXT NULL AFTER firm_logo_url;

