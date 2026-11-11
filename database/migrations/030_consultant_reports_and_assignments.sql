ALTER TABLE properties
  ADD COLUMN assigned_consultant_uid VARCHAR(191) NOT NULL DEFAULT '' AFTER assigned_operations_uid;

CREATE TABLE IF NOT EXISTS consultant_report_versions (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  property_id CHAR(36) NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  report_type VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'draft',
  snapshot JSON NOT NULL,
  snapshot_sha256 CHAR(64) NOT NULL,
  data_checked_at DATETIME(6) NOT NULL,
  created_by_uid VARCHAR(191) NOT NULL,
  submitted_at DATETIME(6) NULL,
  reviewed_by_uid VARCHAR(191) NULL,
  review_decision VARCHAR(20) NULL,
  review_rationale TEXT NULL,
  reviewed_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY consultant_report_property_version_key (tenant_id, property_id, version_number),
  KEY consultant_report_status_idx (tenant_id, approval_status, created_at),
  CONSTRAINT consultant_report_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT consultant_report_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultant_report_shares (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  report_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(6) NULL,
  revoked_at DATETIME(6) NULL,
  created_by_uid VARCHAR(191) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY consultant_report_share_token_key (token_hash),
  KEY consultant_report_share_idx (tenant_id, report_id, created_at),
  CONSTRAINT consultant_report_share_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT consultant_report_share_report_fk FOREIGN KEY (report_id) REFERENCES consultant_report_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultant_issue_evidence (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  property_id CHAR(36) NOT NULL,
  finding_id CHAR(36) NOT NULL,
  document_id CHAR(36) NOT NULL,
  linked_by_uid VARCHAR(191) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY consultant_issue_evidence_key (tenant_id, finding_id, document_id),
  CONSTRAINT consultant_issue_evidence_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT consultant_issue_evidence_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT consultant_issue_evidence_finding_fk FOREIGN KEY (finding_id) REFERENCES risk_findings(id) ON DELETE CASCADE,
  CONSTRAINT consultant_issue_evidence_document_fk FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultant_finding_reviews (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  property_id CHAR(36) NOT NULL,
  finding_id CHAR(36) NOT NULL,
  review_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  rationale TEXT NOT NULL,
  reviewer_uid VARCHAR(191) NOT NULL,
  reviewed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY consultant_finding_review_key (tenant_id, finding_id),
  CONSTRAINT consultant_finding_review_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT consultant_finding_review_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT consultant_finding_review_finding_fk FOREIGN KEY (finding_id) REFERENCES risk_findings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
