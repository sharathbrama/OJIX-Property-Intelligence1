USE ojix_property_mysql;

-- Forward-only repair for deployments that have already applied 026 and/or 034.
-- Do not edit or replay 026/034 to perform this correction.

-- 026's duplicate-key clause changed the reserved platform membership to Owner.
-- Repair only the reserved UID in its platform organization. No other membership
-- role, email, status, or row is changed. The operation is safe to repeat.
UPDATE org_memberships
SET role = 'super_admin'
WHERE organization_id = '11111111-1111-4111-8111-111111111111'
  AND user_uid = 'user-super-admin'
  AND role <> 'super_admin';

-- Canonical fresh-install DDL already includes assigned_viewer_uid. Older
-- upgrade baselines may not, so add it only when absent.
DROP PROCEDURE IF EXISTS ensure_viewer_assignment_schema;
DELIMITER //
CREATE PROCEDURE ensure_viewer_assignment_schema()
BEGIN
  DECLARE viewer_column_count INT DEFAULT 0;
  DECLARE viewer_column_type VARCHAR(255) DEFAULT NULL;
  DECLARE viewer_column_nullable VARCHAR(3) DEFAULT NULL;
  DECLARE viewer_column_default TEXT DEFAULT NULL;
  DECLARE named_index_count INT DEFAULT 0;
  DECLARE named_matching_index_count INT DEFAULT 0;
  DECLARE matching_index_count INT DEFAULT 0;

  SELECT COUNT(*) INTO viewer_column_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'properties'
    AND COLUMN_NAME = 'assigned_viewer_uid';

  IF viewer_column_count = 0 THEN
    SET @ojix_viewer_column_ddl = CONCAT(
      'ALTER TABLE properties ADD COLUMN assigned_viewer_uid VARCHAR(191) NOT NULL DEFAULT ',
      CHAR(39), CHAR(39), ' AFTER assigned_consultant_uid'
    );
    PREPARE ojix_viewer_column_stmt FROM @ojix_viewer_column_ddl;
    EXECUTE ojix_viewer_column_stmt;
    DEALLOCATE PREPARE ojix_viewer_column_stmt;
  ELSE
    SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      INTO viewer_column_type, viewer_column_nullable, viewer_column_default
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'properties'
      AND COLUMN_NAME = 'assigned_viewer_uid';

    IF LOWER(viewer_column_type) <> 'varchar(191)'
       OR viewer_column_nullable <> 'NO'
       OR (COALESCE(viewer_column_default, '<NULL>') <> ''
           AND COALESCE(viewer_column_default, '<NULL>') <> CHAR(39, 39)) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'assigned_viewer_uid exists with an unexpected definition';
    END IF;
  END IF;

  -- Refuse to silently accept a same-name index with a different definition.
  SELECT COUNT(*) INTO named_index_count
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'properties'
    AND INDEX_NAME = 'property_viewer_assignment_idx';

  SELECT COUNT(*) INTO matching_index_count
  FROM (
    SELECT INDEX_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'properties'
    GROUP BY INDEX_NAME
    HAVING COUNT(*) = 4
       AND GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') =
           'tenant_id,assigned_viewer_uid,status,updated_at'
       AND MIN(NON_UNIQUE) = 1
       AND SUM(SUB_PART IS NOT NULL) = 0
  ) AS expected_viewer_indexes;

  SELECT COUNT(*) INTO named_matching_index_count
  FROM (
    SELECT INDEX_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'properties'
      AND INDEX_NAME = 'property_viewer_assignment_idx'
    GROUP BY INDEX_NAME
    HAVING COUNT(*) = 4
       AND GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') =
           'tenant_id,assigned_viewer_uid,status,updated_at'
       AND MIN(NON_UNIQUE) = 1
       AND SUM(SUB_PART IS NOT NULL) = 0
  ) AS named_viewer_index;

  IF named_index_count > 0 AND named_matching_index_count = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'property_viewer_assignment_idx exists with an unexpected definition';
  END IF;

  IF matching_index_count = 0 THEN
    SET @ojix_viewer_index_ddl =
      'CREATE INDEX property_viewer_assignment_idx ON properties (tenant_id, assigned_viewer_uid, status, updated_at)';
    PREPARE ojix_viewer_index_stmt FROM @ojix_viewer_index_ddl;
    EXECUTE ojix_viewer_index_stmt;
    DEALLOCATE PREPARE ojix_viewer_index_stmt;
  END IF;
END//
DELIMITER ;

CALL ensure_viewer_assignment_schema();
DROP PROCEDURE ensure_viewer_assignment_schema;
