USE ojix_property_mysql;

ALTER TABLE properties
  ADD COLUMN assigned_viewer_uid VARCHAR(191) NOT NULL DEFAULT '' AFTER assigned_consultant_uid;

CREATE INDEX property_viewer_assignment_idx
  ON properties (tenant_id, assigned_viewer_uid, status, updated_at);
