-- Migration 031: Legal Sign-off Separation (FRD §3 / §13 / LAW-01)
-- Stores the designated Lead Advocate who approved the legal opinion,
-- the timestamp of sign-off, and the advocate's legal opinion summary.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS legal_approved_by_uid VARCHAR(191) NULL DEFAULT NULL AFTER assigned_operations_uid,
  ADD COLUMN IF NOT EXISTS legal_approved_at DATETIME(6) NULL DEFAULT NULL AFTER legal_approved_by_uid,
  ADD COLUMN IF NOT EXISTS legal_opinion_summary TEXT NULL DEFAULT NULL AFTER legal_approved_at;

