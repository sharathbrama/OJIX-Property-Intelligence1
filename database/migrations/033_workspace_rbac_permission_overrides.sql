USE ojix_property_mysql;

-- Role baselines are defined in the server permission registry. This table
-- stores explicit tenant-specific grants/denials layered on those baselines.
CREATE TABLE IF NOT EXISTS workspace_permission_overrides (
  tenant_id CHAR(36) NOT NULL,
  role VARCHAR(24) NOT NULL,
  resource VARCHAR(80) NOT NULL,
  action VARCHAR(24) NOT NULL,
  allowed BOOLEAN NOT NULL,
  updated_by_uid VARCHAR(191) NOT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (tenant_id, role, resource, action),
  KEY workspace_permission_overrides_role_idx (tenant_id, role, updated_at),
  CONSTRAINT workspace_permission_overrides_tenant_fk FOREIGN KEY (tenant_id)
    REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Platform administration is not a workspace role grant. Existing platform
-- Super Admin memberships are marked super_admin by the bootstrap flow.
