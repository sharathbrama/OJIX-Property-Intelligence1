-- Complete the RFD property identity fields without changing existing records.
ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS property_identifier VARCHAR(160) NOT NULL DEFAULT '' AFTER name,
    ADD COLUMN IF NOT EXISTS property_type VARCHAR(50) NOT NULL DEFAULT 'land' AFTER property_identifier,
    ADD COLUMN IF NOT EXISTS extent_value DECIMAL(18,4) NULL AFTER extent,
    ADD COLUMN IF NOT EXISTS extent_unit VARCHAR(30) NOT NULL DEFAULT '' AFTER extent_value,
    ADD COLUMN IF NOT EXISTS boundary_north TEXT NOT NULL DEFAULT '' AFTER extent_unit,
    ADD COLUMN IF NOT EXISTS boundary_south TEXT NOT NULL DEFAULT '' AFTER boundary_north,
    ADD COLUMN IF NOT EXISTS boundary_east TEXT NOT NULL DEFAULT '' AFTER boundary_south,
    ADD COLUMN IF NOT EXISTS boundary_west TEXT NOT NULL DEFAULT '' AFTER boundary_east,
    ADD COLUMN IF NOT EXISTS coordinate_source VARCHAR(120) NOT NULL DEFAULT '' AFTER longitude,
    ADD COLUMN IF NOT EXISTS coordinate_confidence TINYINT UNSIGNED NULL AFTER coordinate_source,
    ADD COLUMN IF NOT EXISTS coordinate_captured_at DATETIME NULL AFTER coordinate_confidence,
    ADD COLUMN IF NOT EXISTS identity_state VARCHAR(20) NOT NULL DEFAULT 'known' AFTER notes;
