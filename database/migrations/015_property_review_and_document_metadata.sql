ALTER TABLE properties
  ADD COLUMN review_purpose VARCHAR(100) NOT NULL DEFAULT '' AFTER name,
  ADD COLUMN review_purpose_custom VARCHAR(255) NOT NULL DEFAULT '' AFTER review_purpose,
  ADD COLUMN primary_document_type VARCHAR(80) NOT NULL DEFAULT '' AFTER review_purpose_custom,
  ADD COLUMN primary_document_type_custom VARCHAR(255) NOT NULL DEFAULT '' AFTER primary_document_type;

ALTER TABLE documents
  ADD COLUMN doc_type_custom VARCHAR(255) NOT NULL DEFAULT '' AFTER doc_type,
  ADD COLUMN classification_confidence DECIMAL(5,4) NULL AFTER doc_type_custom,
  ADD COLUMN classification_source VARCHAR(30) NOT NULL DEFAULT 'automatic' AFTER classification_confidence,
  ADD COLUMN manual_review_status VARCHAR(30) NOT NULL DEFAULT 'pending' AFTER classification_source;
