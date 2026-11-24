-- Migration 039: Complete FDD Role-Wise Workflows (MySQL-Native)
-- Covers: Operations Intake Checklist, Lead Advocate Legal Sign-Off, and Client / Viewer Explicit Sharing

CREATE TABLE IF NOT EXISTS property_intake_checklist (
  id CHAR(36) NOT NULL PRIMARY KEY,
  property_id CHAR(36) NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  item_name VARCHAR(160) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  document_id CHAR(36) NULL,
  verified_by_uid VARCHAR(191) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY intake_prop_code_idx (property_id, item_code),
  KEY intake_prop_status_idx (property_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS legal_report_approvals (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  property_id CHAR(36) NOT NULL,
  advocate_uid VARCHAR(191) NOT NULL,
  advocate_name VARCHAR(160) NOT NULL,
  bar_council_number VARCHAR(100) NOT NULL,
  opinion_verdict VARCHAR(40) NOT NULL,
  notes TEXT NULL,
  statutory_disclaimer_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
  snapshot_hash CHAR(64) NOT NULL,
  approved_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY report_approvals_tenant_prop_idx (tenant_id, property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS property_client_shares (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  property_id CHAR(36) NOT NULL,
  viewer_uid VARCHAR(191) NOT NULL,
  shared_by_uid VARCHAR(191) NOT NULL,
  shared_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  revoked_at DATETIME(6) NULL,
  KEY client_shares_lookup_idx (tenant_id, viewer_uid, property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
