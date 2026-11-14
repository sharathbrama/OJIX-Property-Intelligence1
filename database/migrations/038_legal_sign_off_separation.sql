-- Keep the accountable legal reviewer and sign-off metadata on the property record.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS legal_approved_by_uid VARCHAR(191) NULL DEFAULT NULL AFTER assigned_operations_uid,
  ADD COLUMN IF NOT EXISTS legal_approved_at DATETIME(6) NULL DEFAULT NULL AFTER legal_approved_by_uid,
  ADD COLUMN IF NOT EXISTS legal_opinion_summary TEXT NULL DEFAULT NULL AFTER legal_approved_at;
