-- RFD PROP-04: allow one property dossier to contain multiple parcel/survey references.
CREATE TABLE IF NOT EXISTS parcel_refs (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    property_id CHAR(36) NOT NULL,
    sequence_no INT NOT NULL DEFAULT 1,
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    district VARCHAR(120) NOT NULL DEFAULT '',
    taluk VARCHAR(120) NOT NULL DEFAULT '',
    hobli VARCHAR(120) NOT NULL DEFAULT '',
    village VARCHAR(120) NOT NULL DEFAULT '',
    survey_number VARCHAR(80) NOT NULL,
    subdivision VARCHAR(80) NOT NULL DEFAULT '',
    extent_raw VARCHAR(80) NOT NULL DEFAULT '',
    extent_value DECIMAL(18,4) NULL,
    extent_unit VARCHAR(30) NOT NULL DEFAULT '',
    source_description VARCHAR(255) NOT NULL DEFAULT '',
    fact_state VARCHAR(20) NOT NULL DEFAULT 'known',
    notes TEXT NOT NULL,
    created_by_uid TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY parcel_refs_identity_key (tenant_id, property_id, village, survey_number, subdivision),
    KEY parcel_refs_property_idx (tenant_id, property_id, sequence_no),
    CONSTRAINT parcel_refs_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT parcel_refs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill the existing primary survey reference without overwriting later parcel records.
INSERT IGNORE INTO parcel_refs
    (id, tenant_id, property_id, sequence_no, is_primary, district, taluk, hobli, village,
     survey_number, subdivision, extent_raw, extent_value, extent_unit, source_description,
     fact_state, notes, created_by_uid)
SELECT UUID(), tenant_id, id, 1, 1, district, taluk, hobli, village,
       survey_number, subdivision, extent, extent_value, extent_unit,
       'Backfilled from primary property identity', identity_state, '', created_by_uid
FROM properties
WHERE survey_number <> '';

