-- Records the authority-specific number used to identify non-agricultural property.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS property_identifier_type VARCHAR(80) NOT NULL DEFAULT '' AFTER property_identifier;
