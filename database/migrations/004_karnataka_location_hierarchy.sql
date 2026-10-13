USE ojix_property_mysql;

CREATE TABLE IF NOT EXISTS karnataka_districts (
  id CHAR(36) NOT NULL, name VARCHAR(120) NOT NULL, code VARCHAR(40) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id), UNIQUE KEY karnataka_districts_name_key (name), UNIQUE KEY karnataka_districts_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS karnataka_taluks (
  id CHAR(36) NOT NULL, district_id CHAR(36) NOT NULL, name VARCHAR(120) NOT NULL, code VARCHAR(40) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id), KEY karnataka_taluks_parent_name_idx (district_id,name),
  UNIQUE KEY karnataka_taluks_parent_code_key (district_id,code), KEY karnataka_taluks_district_idx (district_id),
  CONSTRAINT karnataka_taluks_district_fk FOREIGN KEY (district_id) REFERENCES karnataka_districts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS karnataka_hoblis (
  id CHAR(36) NOT NULL, taluk_id CHAR(36) NOT NULL, name VARCHAR(120) NOT NULL, code VARCHAR(40) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id), KEY karnataka_hoblis_parent_name_idx (taluk_id,name),
  UNIQUE KEY karnataka_hoblis_parent_code_key (taluk_id,code), KEY karnataka_hoblis_taluk_idx (taluk_id),
  CONSTRAINT karnataka_hoblis_taluk_fk FOREIGN KEY (taluk_id) REFERENCES karnataka_taluks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS karnataka_villages (
  id CHAR(36) NOT NULL, hobli_id CHAR(36) NOT NULL, name VARCHAR(120) NOT NULL, code VARCHAR(40) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id), KEY karnataka_villages_parent_name_idx (hobli_id,name),
  UNIQUE KEY karnataka_villages_parent_code_key (hobli_id,code), KEY karnataka_villages_hobli_idx (hobli_id),
  CONSTRAINT karnataka_villages_hobli_fk FOREIGN KEY (hobli_id) REFERENCES karnataka_hoblis(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS karnataka_location_imports (
  id CHAR(36) NOT NULL, source_name VARCHAR(255) NOT NULL, source_date DATE NULL,
  imported_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), completeness VARCHAR(20) NOT NULL,
  notes TEXT NOT NULL, PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS district_id CHAR(36) NULL AFTER district,
  ADD COLUMN IF NOT EXISTS taluk_id CHAR(36) NULL AFTER district_id,
  ADD COLUMN IF NOT EXISTS hobli_id CHAR(36) NULL AFTER taluk_id,
  ADD COLUMN IF NOT EXISTS village_id CHAR(36) NULL AFTER hobli_id;

DELIMITER //
CREATE PROCEDURE add_location_fk_if_missing(IN constraint_name_value VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='properties'
      AND CONSTRAINT_NAME=constraint_name_value AND CONSTRAINT_TYPE='FOREIGN KEY'
  ) THEN
    SET @location_fk_ddl=ddl;
    PREPARE location_fk_stmt FROM @location_fk_ddl;
    EXECUTE location_fk_stmt;
    DEALLOCATE PREPARE location_fk_stmt;
  END IF;
END//
DELIMITER ;

CALL add_location_fk_if_missing('properties_district_fk','ALTER TABLE properties ADD CONSTRAINT properties_district_fk FOREIGN KEY (district_id) REFERENCES karnataka_districts(id) ON DELETE SET NULL');
CALL add_location_fk_if_missing('properties_taluk_fk','ALTER TABLE properties ADD CONSTRAINT properties_taluk_fk FOREIGN KEY (taluk_id) REFERENCES karnataka_taluks(id) ON DELETE SET NULL');
CALL add_location_fk_if_missing('properties_hobli_fk','ALTER TABLE properties ADD CONSTRAINT properties_hobli_fk FOREIGN KEY (hobli_id) REFERENCES karnataka_hoblis(id) ON DELETE SET NULL');
CALL add_location_fk_if_missing('properties_village_fk','ALTER TABLE properties ADD CONSTRAINT properties_village_fk FOREIGN KEY (village_id) REFERENCES karnataka_villages(id) ON DELETE SET NULL');
DROP PROCEDURE add_location_fk_if_missing;
