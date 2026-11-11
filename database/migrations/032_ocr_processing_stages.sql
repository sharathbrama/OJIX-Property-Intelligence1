ALTER TABLE document_processing_jobs
    ADD COLUMN processing_stage VARCHAR(40) NOT NULL DEFAULT 'queued' AFTER progress;

UPDATE document_processing_jobs
SET processing_stage = CASE
    WHEN status = 'completed' THEN 'completed'
    WHEN status = 'processing' THEN 'document_ai_processing'
    WHEN status = 'retry_wait' THEN 'retry_wait'
    WHEN status = 'failed' THEN 'failed'
    ELSE 'queued'
END;
