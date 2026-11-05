ALTER TABLE documents
  ADD COLUMN review_status VARCHAR(30) NOT NULL DEFAULT 'pending' AFTER processing_status,
  ADD COLUMN approved_by_uid VARCHAR(191) NULL AFTER review_status,
  ADD COLUMN approved_at DATETIME(6) NULL AFTER approved_by_uid;

CREATE TABLE document_processing_jobs (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    property_id CHAR(36) NOT NULL,
    document_id CHAR(36) NOT NULL,
    requested_by_uid VARCHAR(191) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'queued',
    progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
    attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 3,
    provider VARCHAR(40) NOT NULL DEFAULT 'google_document_ai',
    pages_processed INT UNSIGNED NOT NULL DEFAULT 0,
    estimated_cost_usd DECIMAL(12,6) NULL,
    error_code VARCHAR(80) NULL,
    error_message TEXT NULL,
    worker_id VARCHAR(191) NULL,
    started_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY document_jobs_queue_idx (status, created_at),
    KEY document_jobs_tenant_idx (tenant_id, status, created_at),
    KEY document_jobs_document_idx (tenant_id, document_id, created_at),
    CONSTRAINT document_jobs_document_fk FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT document_jobs_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT document_jobs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE document_extraction_runs (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    property_id CHAR(36) NOT NULL,
    document_id CHAR(36) NOT NULL,
    job_id CHAR(36) NOT NULL,
    provider VARCHAR(40) NOT NULL,
    provider_version VARCHAR(120) NULL,
    schema_version VARCHAR(40) NOT NULL DEFAULT 'ojix-property-v1',
    page_count INT UNSIGNED NOT NULL DEFAULT 0,
    raw_ocr_text LONGTEXT NOT NULL,
    raw_ocr_tokens JSON NOT NULL,
    raw_provider_response LONGTEXT NULL,
    extracted_fields JSON NOT NULL,
    created_by_uid VARCHAR(191) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY document_extraction_job_key (job_id),
    KEY document_extraction_history_idx (tenant_id, document_id, created_at),
    CONSTRAINT document_extraction_job_fk FOREIGN KEY (job_id) REFERENCES document_processing_jobs(id) ON DELETE CASCADE,
    CONSTRAINT document_extraction_document_fk FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT document_extraction_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT document_extraction_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE document_field_history (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    property_id CHAR(36) NOT NULL,
    document_id CHAR(36) NOT NULL,
    extraction_run_id CHAR(36) NULL,
    field_path VARCHAR(255) NOT NULL,
    previous_value JSON NULL,
    new_value JSON NULL,
    action VARCHAR(32) NOT NULL DEFAULT 'corrected',
    rationale TEXT NOT NULL,
    actor_uid VARCHAR(191) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY document_field_history_idx (tenant_id, document_id, created_at),
    CONSTRAINT document_field_history_document_fk FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT document_field_history_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT document_field_history_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE document_review_history (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    property_id CHAR(36) NOT NULL,
    document_id CHAR(36) NOT NULL,
    from_status VARCHAR(24) NOT NULL,
    to_status VARCHAR(24) NOT NULL,
    decision VARCHAR(24) NOT NULL,
    rationale TEXT NOT NULL,
    actor_uid VARCHAR(191) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY document_review_history_idx (tenant_id, document_id, created_at),
    CONSTRAINT document_review_history_document_fk FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT document_review_history_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT document_review_history_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE document_ai_config (
    tenant_id CHAR(36) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    location VARCHAR(80) NOT NULL,
    processor_id VARCHAR(255) NOT NULL,
    processor_version VARCHAR(255) NULL,
    language_hints JSON NULL,
    updated_by_uid VARCHAR(191) NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (tenant_id),
    CONSTRAINT document_ai_config_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ocr_field_mappings (
    tenant_id CHAR(36) NOT NULL,
    source_field VARCHAR(255) NOT NULL,
    canonical_field VARCHAR(255) NOT NULL,
    normalization_rule VARCHAR(80) NOT NULL DEFAULT 'trim',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by_uid VARCHAR(191) NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (tenant_id, source_field),
    CONSTRAINT ocr_field_mapping_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ocr_document_type_mappings (
    tenant_id CHAR(36) NOT NULL,
    source_category VARCHAR(160) NOT NULL,
    canonical_doc_type VARCHAR(80) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by_uid VARCHAR(191) NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (tenant_id, source_category),
    CONSTRAINT ocr_doc_type_mapping_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
