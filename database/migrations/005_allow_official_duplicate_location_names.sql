USE ojix_property_mysql;

-- Kaveri 2.0 contains a small number of distinct administrative records that
-- share the same display name under one parent. Codes, not labels, identify
-- those records. Keep the parent+code constraints and allow duplicate labels.
ALTER TABLE karnataka_taluks DROP INDEX IF EXISTS karnataka_taluks_parent_name_key;
ALTER TABLE karnataka_hoblis DROP INDEX IF EXISTS karnataka_hoblis_parent_name_key;
ALTER TABLE karnataka_villages DROP INDEX IF EXISTS karnataka_villages_parent_name_key;
ALTER TABLE karnataka_taluks ADD INDEX IF NOT EXISTS karnataka_taluks_parent_name_idx (district_id, name);
ALTER TABLE karnataka_hoblis ADD INDEX IF NOT EXISTS karnataka_hoblis_parent_name_idx (taluk_id, name);
ALTER TABLE karnataka_villages ADD INDEX IF NOT EXISTS karnataka_villages_parent_name_idx (hobli_id, name);
