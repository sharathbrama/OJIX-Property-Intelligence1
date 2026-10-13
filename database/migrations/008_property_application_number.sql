-- Adds a stable, human-readable reference for every property review application.
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS application_number VARCHAR(40) NULL AFTER tenant_id;

-- Preserve existing workspaces by assigning a deterministic reference from their
-- original creation date and UUID. New records receive the number in the API.
UPDATE properties
SET application_number = CONCAT(
    'OJIX-PR-',
    DATE_FORMAT(created_at, '%Y%m%d'),
    '-',
    UPPER(SUBSTRING(REPLACE(id, '-', ''), 1, 8))
)
WHERE application_number IS NULL OR application_number = '';

ALTER TABLE properties
    MODIFY COLUMN application_number VARCHAR(40) NOT NULL,
    ADD UNIQUE INDEX IF NOT EXISTS properties_application_number_key (application_number);
