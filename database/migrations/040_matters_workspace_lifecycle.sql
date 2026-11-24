-- ============================================================
-- Migration 040: Matters Workspace & Multi-Property Lifecycle
-- FRD §5 / §7 — Matter-centric grouping of property applications
-- ============================================================
-- A "Matter" is a top-level client engagement file. Each matter
-- can contain one or more property applications. This migration
-- creates the matters table and links it to properties, so that
-- the full J1 workflow (create matter → intake properties →
-- extract → screen → report → sign-off) is properly scoped.
-- ============================================================

CREATE TABLE IF NOT EXISTS matters (
  id               VARCHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  tenant_id        VARCHAR(36)  NOT NULL,
  matter_number    VARCHAR(60)  NOT NULL,
  title            VARCHAR(255) NOT NULL,
  client_name      VARCHAR(255) NOT NULL,
  client_email     VARCHAR(255) DEFAULT NULL,
  client_phone     VARCHAR(50)  DEFAULT NULL,
  review_purpose   VARCHAR(60)  NOT NULL DEFAULT 'purchase_due_diligence',
  status           ENUM('open','in_review','ready_for_signoff','closed','archived')
                   NOT NULL DEFAULT 'open',
  priority         ENUM('normal','high','urgent','critical')
                   NOT NULL DEFAULT 'normal',
  created_by_uid   VARCHAR(36)  NOT NULL,
  assigned_lawyer_uid    VARCHAR(36) DEFAULT NULL,
  assigned_analyst_uid   VARCHAR(36) DEFAULT NULL,
  assigned_operations_uid VARCHAR(36) DEFAULT NULL,
  assigned_consultant_uid VARCHAR(36) DEFAULT NULL,
  due_date         DATE         DEFAULT NULL,
  notes            TEXT         DEFAULT NULL,
  archived_at      DATETIME(3)  DEFAULT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                   ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_matter_number_tenant UNIQUE (tenant_id, matter_number),
  INDEX idx_matters_tenant_status (tenant_id, status),
  INDEX idx_matters_tenant_priority (tenant_id, priority),
  INDEX idx_matters_lawyer (assigned_lawyer_uid),
  INDEX idx_matters_analyst (assigned_analyst_uid),
  INDEX idx_matters_created_by (created_by_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- Link properties to matters (FK from properties → matters)
-- A property belongs to at most one matter at a time.
-- ─────────────────────────────────────────────────────────────

-- Add matter_id FK column to properties if not present
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS matter_id VARCHAR(36) DEFAULT NULL AFTER tenant_id,
  ADD INDEX IF NOT EXISTS idx_properties_matter (matter_id);

-- ─────────────────────────────────────────────────────────────
-- Matter Audit Log — tracks status transitions, assignments,
-- sign-offs, and any override actions on a matter record.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matter_audit_events (
  id          VARCHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  tenant_id   VARCHAR(36)  NOT NULL,
  matter_id   VARCHAR(36)  NOT NULL,
  actor_uid   VARCHAR(36)  NOT NULL,
  action      VARCHAR(100) NOT NULL,
  details     JSON         DEFAULT NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_matter_audit_matter (tenant_id, matter_id),
  INDEX idx_matter_audit_actor (actor_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- Computed view: matter_summary
-- Aggregates property counts, document counts, and risk totals
-- per matter for the matter listing page.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW matter_summary AS
SELECT
  m.id,
  m.tenant_id,
  m.matter_number,
  m.title,
  m.client_name,
  m.status,
  m.priority,
  m.assigned_lawyer_uid,
  m.assigned_analyst_uid,
  m.due_date,
  m.created_at,
  m.updated_at,
  COUNT(DISTINCT p.id)              AS property_count,
  COUNT(DISTINCT d.id)              AS document_count,
  SUM(COALESCE(rf.total_points, 0)) AS total_risk_points
FROM matters m
LEFT JOIN properties p
       ON p.matter_id = m.id AND p.tenant_id = m.tenant_id AND p.archived_at IS NULL
LEFT JOIN documents d
       ON d.property_id = p.id AND d.tenant_id = m.tenant_id AND d.governance_status = 'active'
LEFT JOIN (
  SELECT property_id, tenant_id, SUM(points) AS total_points
  FROM   risk_findings
  WHERE  evidence_status NOT IN ('dismissed', 'resolved')
  GROUP  BY property_id, tenant_id
) rf ON rf.property_id = p.id AND rf.tenant_id = m.tenant_id
WHERE m.archived_at IS NULL
GROUP BY
  m.id, m.tenant_id, m.matter_number, m.title, m.client_name,
  m.status, m.priority, m.assigned_lawyer_uid, m.assigned_analyst_uid,
  m.due_date, m.created_at, m.updated_at;
