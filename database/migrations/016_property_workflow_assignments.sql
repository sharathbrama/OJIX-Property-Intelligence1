ALTER TABLE properties
  ADD COLUMN workflow_priority VARCHAR(20) NOT NULL DEFAULT 'normal' AFTER status,
  ADD COLUMN due_date DATE NULL AFTER workflow_priority,
  ADD COLUMN assigned_lawyer_uid VARCHAR(191) NOT NULL DEFAULT '' AFTER due_date,
  ADD COLUMN assigned_analyst_uid VARCHAR(191) NOT NULL DEFAULT '' AFTER assigned_lawyer_uid,
  ADD COLUMN assigned_operations_uid VARCHAR(191) NOT NULL DEFAULT '' AFTER assigned_analyst_uid;

CREATE TABLE IF NOT EXISTS property_workflow_history (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  property_id CHAR(36) NOT NULL,
  previous_status VARCHAR(30) NOT NULL,
  new_status VARCHAR(30) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  changes_json JSON NOT NULL,
  changed_by_uid VARCHAR(191) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY property_workflow_history_property_idx (tenant_id, property_id, created_at),
  CONSTRAINT property_workflow_history_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT property_workflow_history_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
