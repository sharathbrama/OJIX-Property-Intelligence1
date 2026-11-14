-- Firm identity and report configuration fields introduced by the Keerthana branch.
-- Numbered after the existing 036 onboarding migration to avoid duplicate IDs.
ALTER TABLE workspace_settings
  ADD COLUMN IF NOT EXISTS llpin VARCHAR(64) NOT NULL DEFAULT '' AFTER org_name,
  ADD COLUMN IF NOT EXISTS office_address TEXT NULL AFTER default_district,
  ADD COLUMN IF NOT EXISTS firm_logo_url TEXT NULL AFTER office_address,
  ADD COLUMN IF NOT EXISTS firm_email VARCHAR(191) NOT NULL DEFAULT '' AFTER primary_contact,
  ADD COLUMN IF NOT EXISTS default_report_template VARCHAR(64) NOT NULL DEFAULT 'detailed_due_diligence' AFTER default_district,
  ADD COLUMN IF NOT EXISTS legal_disclaimer TEXT NULL AFTER firm_logo_url;
