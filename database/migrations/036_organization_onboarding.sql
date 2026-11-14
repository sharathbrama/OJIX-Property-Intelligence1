USE ojix_property_mysql;

-- Persist the requested organization name until the email OTP is verified.
-- The canonical schema may already include this column on a fresh install.
DROP PROCEDURE IF EXISTS ensure_organization_onboarding_schema;
DELIMITER //
CREATE PROCEDURE ensure_organization_onboarding_schema()
BEGIN
  DECLARE onboarding_name_count INT DEFAULT 0;
  SELECT COUNT(*) INTO onboarding_name_count
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_accounts'
    AND COLUMN_NAME = 'onboarding_organization_name';

  IF onboarding_name_count = 0 THEN
    ALTER TABLE user_accounts
      ADD COLUMN onboarding_organization_name VARCHAR(160) NULL AFTER full_name;
  END IF;
END//
DELIMITER ;

CALL ensure_organization_onboarding_schema();
DROP PROCEDURE ensure_organization_onboarding_schema;
