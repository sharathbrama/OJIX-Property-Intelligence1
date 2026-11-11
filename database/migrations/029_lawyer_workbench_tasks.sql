CREATE TABLE IF NOT EXISTS workbench_tasks (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  property_id CHAR(36) NOT NULL,
  task_code VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(80) NOT NULL,
  priority VARCHAR(16) NOT NULL DEFAULT 'medium',
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  due_date DATE NULL,
  assigned_by_uid VARCHAR(191) NOT NULL,
  assigned_to_uid VARCHAR(191) NOT NULL,
  reviewer_uid VARCHAR(191) NULL,
  linked_document_id CHAR(36) NULL,
  linked_finding_id CHAR(36) NULL,
  checklist JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY workbench_task_code_tenant_key (tenant_id, task_code),
  KEY workbench_task_assignee_status_idx (tenant_id, assigned_to_uid, status, due_date),
  KEY workbench_task_property_idx (tenant_id, property_id, created_at),
  CONSTRAINT workbench_task_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT workbench_task_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workbench_task_activity (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  task_id CHAR(36) NOT NULL,
  actor_uid VARCHAR(191) NOT NULL,
  action VARCHAR(48) NOT NULL,
  details JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY workbench_task_activity_idx (tenant_id, task_id, created_at),
  CONSTRAINT workbench_task_activity_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT workbench_task_activity_task_fk FOREIGN KEY (task_id) REFERENCES workbench_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workbench_task_comments (
  id CHAR(36) NOT NULL,
  tenant_id CHAR(36) NOT NULL,
  task_id CHAR(36) NOT NULL,
  author_uid VARCHAR(191) NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY workbench_task_comments_idx (tenant_id, task_id, created_at),
  CONSTRAINT workbench_task_comments_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT workbench_task_comments_task_fk FOREIGN KEY (task_id) REFERENCES workbench_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
