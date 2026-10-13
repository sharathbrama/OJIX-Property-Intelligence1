USE ojix_property_mysql;

ALTER TABLE org_memberships
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER role,
  ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) AFTER created_at;

ALTER TABLE user_accounts
  ADD COLUMN last_login_at DATETIME(6) NULL AFTER status,
  ADD COLUMN otp_required BOOLEAN NOT NULL DEFAULT TRUE AFTER last_login_at,
  ADD COLUMN disabled_at DATETIME(6) NULL AFTER otp_required,
  ADD COLUMN disabled_by_uid VARCHAR(191) NULL AFTER disabled_at,
  ADD COLUMN disabled_reason TEXT NULL AFTER disabled_by_uid;

ALTER TABLE properties
  ADD COLUMN archived_at DATETIME(6) NULL AFTER assigned_operations_uid,
  ADD COLUMN archived_by_uid VARCHAR(191) NULL AFTER archived_at,
  ADD COLUMN archive_reason TEXT NULL AFTER archived_by_uid;

ALTER TABLE documents
  ADD COLUMN governance_status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER manual_review_status,
  ADD COLUMN governance_reason TEXT NULL AFTER governance_status,
  ADD COLUMN governance_by_uid VARCHAR(191) NULL AFTER governance_reason,
  ADD COLUMN governance_at DATETIME(6) NULL AFTER governance_by_uid;

CREATE TABLE workspace_invitations (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  invited_name VARCHAR(160) NOT NULL,
  assigned_role VARCHAR(20) NOT NULL,
  invitation_token_hash CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  delivery_status VARCHAR(20) NOT NULL DEFAULT 'not_configured',
  invited_by_uid VARCHAR(191) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  accepted_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY workspace_invitations_tenant_status_idx (tenant_id,status,created_at),
  KEY workspace_invitations_email_idx (tenant_id,email),
  CONSTRAINT workspace_invitations_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE authentication_sessions (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  user_uid VARCHAR(191) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_activity_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  expires_at DATETIME(6) NOT NULL,
  revoked_at DATETIME(6) NULL,
  revoked_by_uid VARCHAR(191) NULL,
  revoke_reason TEXT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY authentication_sessions_token_hash_key (token_hash),
  KEY authentication_sessions_tenant_user_idx (tenant_id,user_uid,expires_at),
  CONSTRAINT authentication_sessions_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workspace_retention_policies (
  tenant_id CHAR(36) NOT NULL,
  retention_days INT NOT NULL DEFAULT 2555,
  archive_after_days INT NOT NULL DEFAULT 365,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  automatic_cleanup_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by_uid VARCHAR(191) NOT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (tenant_id),
  CONSTRAINT workspace_retention_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
