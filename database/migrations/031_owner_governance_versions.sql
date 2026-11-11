USE ojix_property_mysql;

CREATE TABLE owner_configuration_versions (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  config_type VARCHAR(40) NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  name VARCHAR(160) NOT NULL,
  configuration JSON NOT NULL,
  created_by_uid VARCHAR(191) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY owner_config_version_key (tenant_id, config_type, version_number),
  KEY owner_config_history_idx (tenant_id, config_type, created_at),
  CONSTRAINT owner_config_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workspace_export_events (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  actor_uid VARCHAR(191) NOT NULL,
  resource_type VARCHAR(60) NOT NULL,
  resource_id VARCHAR(191) NULL,
  export_format VARCHAR(30) NOT NULL,
  watermark_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at DATETIME(6) NULL,
  result VARCHAR(20) NOT NULL DEFAULT 'success',
  details JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY workspace_export_tenant_time_idx (tenant_id, created_at),
  CONSTRAINT workspace_export_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workspace_purge_requests (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  document_id CHAR(36) NOT NULL,
  requested_by_uid VARCHAR(191) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by_uid VARCHAR(191) NULL,
  approved_at DATETIME(6) NULL,
  completed_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY workspace_purge_tenant_status_idx (tenant_id, status, created_at),
  CONSTRAINT workspace_purge_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT workspace_purge_document_fk FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workspace_purge_requests (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  document_id CHAR(36) NOT NULL,
  requested_by_uid VARCHAR(191) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by_uid VARCHAR(191) NULL,
  approved_at DATETIME(6) NULL,
  completed_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY workspace_purge_tenant_status_idx (tenant_id, status, created_at),
  CONSTRAINT workspace_purge_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT workspace_purge_document_fk FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
