CREATE DATABASE IF NOT EXISTS ojix_property_mysql
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ojix_property_mysql;

CREATE TABLE IF NOT EXISTS organizations (
    id CHAR(36) NOT NULL,
    name TEXT NOT NULL,
    slug VARCHAR(255) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY organizations_slug_key (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS org_memberships (
    id CHAR(36) NOT NULL,
    organization_id CHAR(36) NOT NULL,
    user_uid TEXT NOT NULL,
    email TEXT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'analyst',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY org_memberships_organization_user_key (organization_id, user_uid(191)),
    KEY org_memberships_user_idx (user_uid(191)),
    CONSTRAINT org_memberships_organization_fk
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspace_permission_overrides (
    tenant_id CHAR(36) NOT NULL,
    role VARCHAR(24) NOT NULL,
    resource VARCHAR(80) NOT NULL,
    action VARCHAR(24) NOT NULL,
    allowed BOOLEAN NOT NULL,
    updated_by_uid VARCHAR(191) NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (tenant_id, role, resource, action),
    KEY workspace_permission_overrides_role_idx (tenant_id, role, updated_at),
    CONSTRAINT workspace_permission_overrides_tenant_fk FOREIGN KEY (tenant_id)
        REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_accounts (
    id CHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    onboarding_organization_name VARCHAR(160) NULL,
    middle_name VARCHAR(80) NULL,
    gender VARCHAR(32) NOT NULL DEFAULT 'prefer_not_to_say',
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login_at DATETIME(6) NULL,
    otp_required BOOLEAN NOT NULL DEFAULT TRUE,
    disabled_at DATETIME(6) NULL,
    disabled_by_uid VARCHAR(191) NULL,
    disabled_reason TEXT NULL,
    phone_e164 VARCHAR(20) NULL,
    phone_verified_at DATETIME(6) NULL,
    security_question VARCHAR(40) NULL,
    security_answer_hash VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY user_accounts_email_key (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS otp_challenges (
    id CHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    account_uid VARCHAR(191) NULL,
    purpose VARCHAR(30) NOT NULL DEFAULT 'registration',
    otp_hash CHAR(64) NOT NULL,
    otp_salt CHAR(32) NULL,
    expires_at DATETIME(6) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    consumed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY otp_challenges_email_idx (email, purpose, created_at),
    KEY otp_challenges_account_purpose_idx (account_uid, purpose, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account_password_overrides (
    user_uid VARCHAR(191) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    changed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    changed_by_uid VARCHAR(191) NOT NULL,
    PRIMARY KEY (user_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS karnataka_districts (
    id CHAR(36) NOT NULL,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(40) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY karnataka_districts_name_key (name),
    UNIQUE KEY karnataka_districts_code_key (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS karnataka_taluks (
    id CHAR(36) NOT NULL,
    district_id CHAR(36) NOT NULL,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(40) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY karnataka_taluks_parent_name_idx (district_id, name),
    UNIQUE KEY karnataka_taluks_parent_code_key (district_id, code),
    KEY karnataka_taluks_district_idx (district_id),
    CONSTRAINT karnataka_taluks_district_fk FOREIGN KEY (district_id) REFERENCES karnataka_districts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS karnataka_hoblis (
    id CHAR(36) NOT NULL,
    taluk_id CHAR(36) NOT NULL,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(40) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY karnataka_hoblis_parent_name_idx (taluk_id, name),
    UNIQUE KEY karnataka_hoblis_parent_code_key (taluk_id, code),
    KEY karnataka_hoblis_taluk_idx (taluk_id),
    CONSTRAINT karnataka_hoblis_taluk_fk FOREIGN KEY (taluk_id) REFERENCES karnataka_taluks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS karnataka_villages (
    id CHAR(36) NOT NULL,
    hobli_id CHAR(36) NOT NULL,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(40) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY karnataka_villages_parent_name_idx (hobli_id, name),
    UNIQUE KEY karnataka_villages_parent_code_key (hobli_id, code),
    KEY karnataka_villages_hobli_idx (hobli_id),
    CONSTRAINT karnataka_villages_hobli_fk FOREIGN KEY (hobli_id) REFERENCES karnataka_hoblis(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS karnataka_location_imports (
    id CHAR(36) NOT NULL,
    source_name VARCHAR(255) NOT NULL,
    source_date DATE NULL,
    imported_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    completeness VARCHAR(20) NOT NULL,
    notes TEXT NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS properties (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    application_number VARCHAR(40) NOT NULL,
    name TEXT NOT NULL,
    review_purpose VARCHAR(100) NOT NULL DEFAULT '',
    review_purpose_custom VARCHAR(255) NOT NULL DEFAULT '',
    primary_document_type VARCHAR(80) NOT NULL DEFAULT '',
    primary_document_type_custom VARCHAR(255) NOT NULL DEFAULT '',
    property_identifier VARCHAR(160) NOT NULL DEFAULT '',
    property_identifier_type VARCHAR(80) NOT NULL DEFAULT '',
    property_type VARCHAR(50) NOT NULL DEFAULT 'land',
    village TEXT NOT NULL DEFAULT '',
    hobli TEXT NOT NULL DEFAULT '',
    taluk TEXT NOT NULL DEFAULT '',
    district TEXT NOT NULL DEFAULT 'Bengaluru Urban',
    district_id CHAR(36) NULL,
    taluk_id CHAR(36) NULL,
    hobli_id CHAR(36) NULL,
    village_id CHAR(36) NULL,
    survey_number TEXT NOT NULL DEFAULT '',
    subdivision TEXT NOT NULL DEFAULT '',
    extent TEXT NOT NULL DEFAULT '',
    extent_value DECIMAL(18,4) NULL,
    extent_unit VARCHAR(30) NOT NULL DEFAULT '',
    boundary_north TEXT NOT NULL DEFAULT '',
    boundary_south TEXT NOT NULL DEFAULT '',
    boundary_east TEXT NOT NULL DEFAULT '',
    boundary_west TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    latitude DOUBLE NULL,
    longitude DOUBLE NULL,
    coordinate_source VARCHAR(120) NOT NULL DEFAULT '',
    coordinate_confidence TINYINT UNSIGNED NULL,
    coordinate_captured_at DATETIME NULL,

    /*
      MariaDB spatial replacement for PostgreSQL
      geometry(Point,4326).

      MariaDB 10.4 does not provide the same PostGIS
      type modifier, so SRID 4326 is maintained when
      inserting geometry values.
    */
    location POINT NULL,

    notes TEXT NOT NULL DEFAULT '',
    identity_state VARCHAR(20) NOT NULL DEFAULT 'known',
    status VARCHAR(30) NOT NULL DEFAULT 'in_review',
    workflow_priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    due_date DATE NULL,
    assigned_lawyer_uid VARCHAR(191) NOT NULL DEFAULT '',
    assigned_analyst_uid VARCHAR(191) NOT NULL DEFAULT '',
    assigned_operations_uid VARCHAR(191) NOT NULL DEFAULT '',
    assigned_consultant_uid VARCHAR(191) NOT NULL DEFAULT '',
    assigned_viewer_uid VARCHAR(191) NOT NULL DEFAULT '',
    archived_at DATETIME(6) NULL,
    archived_by_uid VARCHAR(191) NULL,
    archive_reason TEXT NULL,
    created_by_uid TEXT NOT NULL,
    updated_by_uid TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY properties_application_number_key (application_number),
    KEY properties_survey_idx (tenant_id, survey_number(191)),
    KEY properties_tenant_updated_idx (tenant_id, updated_at),
    KEY property_viewer_assignment_idx (tenant_id, assigned_viewer_uid, status, updated_at),

    CONSTRAINT properties_tenant_fk
        FOREIGN KEY (tenant_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,
    CONSTRAINT properties_district_fk FOREIGN KEY (district_id) REFERENCES karnataka_districts(id) ON DELETE SET NULL,
    CONSTRAINT properties_taluk_fk FOREIGN KEY (taluk_id) REFERENCES karnataka_taluks(id) ON DELETE SET NULL,
    CONSTRAINT properties_hobli_fk FOREIGN KEY (hobli_id) REFERENCES karnataka_hoblis(id) ON DELETE SET NULL,
    CONSTRAINT properties_village_fk FOREIGN KEY (village_id) REFERENCES karnataka_villages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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


CREATE TABLE IF NOT EXISTS parcel_refs (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    property_id CHAR(36) NOT NULL,
    sequence_no INT NOT NULL DEFAULT 1,
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    district VARCHAR(120) NOT NULL DEFAULT '',
    taluk VARCHAR(120) NOT NULL DEFAULT '',
    hobli VARCHAR(120) NOT NULL DEFAULT '',
    village VARCHAR(120) NOT NULL DEFAULT '',
    survey_number VARCHAR(80) NOT NULL,
    subdivision VARCHAR(80) NOT NULL DEFAULT '',
    extent_raw VARCHAR(80) NOT NULL DEFAULT '',
    extent_value DECIMAL(18,4) NULL,
    extent_unit VARCHAR(30) NOT NULL DEFAULT '',
    source_description VARCHAR(255) NOT NULL DEFAULT '',
    fact_state VARCHAR(20) NOT NULL DEFAULT 'known',
    notes TEXT NOT NULL,
    created_by_uid TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY parcel_refs_identity_key (tenant_id, property_id, village, survey_number, subdivision),
    KEY parcel_refs_property_idx (tenant_id, property_id, sequence_no),
    CONSTRAINT parcel_refs_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT parcel_refs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS documents (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    property_id CHAR(36) NOT NULL,
    doc_type VARCHAR(50) NULL,
    doc_type_custom VARCHAR(255) NOT NULL DEFAULT '',
    classification_confidence DECIMAL(5,4) NULL,
    classification_source VARCHAR(30) NOT NULL DEFAULT 'automatic',
    manual_review_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    governance_status VARCHAR(20) NOT NULL DEFAULT 'active',
    governance_reason TEXT NULL,
    governance_by_uid VARCHAR(191) NULL,
    governance_at DATETIME(6) NULL,
    original_filename TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    processing_status VARCHAR(30) NOT NULL DEFAULT 'queued',
    review_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    approved_by_uid VARCHAR(191) NULL,
    approved_at DATETIME(6) NULL,
    extracted_text LONGTEXT NULL,
    extracted_fields JSON NOT NULL,
    uploaded_by_uid TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY documents_doc_type_idx (tenant_id, doc_type),
    KEY documents_property_idx (tenant_id, property_id, created_at),

    CONSTRAINT documents_property_fk
        FOREIGN KEY (property_id)
        REFERENCES properties(id)
        ON DELETE CASCADE,

    CONSTRAINT documents_tenant_fk
        FOREIGN KEY (tenant_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_processing_jobs (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    property_id CHAR(36) NOT NULL,
    document_id CHAR(36) NOT NULL,
    requested_by_uid VARCHAR(191) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'queued',
    progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
    processing_stage VARCHAR(40) NOT NULL DEFAULT 'queued',
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

CREATE TABLE IF NOT EXISTS document_extraction_runs (
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

CREATE TABLE IF NOT EXISTS document_field_history (
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

CREATE TABLE IF NOT EXISTS document_review_history (
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

CREATE TABLE IF NOT EXISTS document_ai_config (
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

CREATE TABLE IF NOT EXISTS ocr_field_mappings (
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

CREATE TABLE IF NOT EXISTS ocr_document_type_mappings (
    tenant_id CHAR(36) NOT NULL,
    source_category VARCHAR(160) NOT NULL,
    canonical_doc_type VARCHAR(80) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by_uid VARCHAR(191) NOT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (tenant_id, source_category),
    CONSTRAINT ocr_doc_type_mapping_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rtc_lookups (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    property_id CHAR(36) NULL,
    search_criteria JSON NOT NULL,
    status VARCHAR(30) NOT NULL,
    source_name VARCHAR(160) NOT NULL,
    source_url TEXT NULL,
    retrieved_data JSON NULL,
    source_payload JSON NULL,
    verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified',
    confirmed_match BOOLEAN NULL,
    confirmed_by_uid VARCHAR(191) NULL,
    confirmed_at DATETIME(6) NULL,
    error_code VARCHAR(80) NULL,
    error_message TEXT NULL,
    requested_by_uid VARCHAR(191) NOT NULL,
    retrieved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY rtc_lookups_tenant_time_idx (tenant_id, created_at),
    KEY rtc_lookups_property_idx (tenant_id, property_id, created_at),
    CONSTRAINT rtc_lookups_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT rtc_lookups_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS risk_findings (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    property_id CHAR(36) NOT NULL,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    points INT NOT NULL DEFAULT 0,
    explanation TEXT NOT NULL,
    evidence_status VARCHAR(20) NOT NULL,
    next_action TEXT NOT NULL,
    created_by_uid TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY findings_property_idx (tenant_id, property_id, created_at),

    CONSTRAINT risk_findings_property_fk
        FOREIGN KEY (property_id)
        REFERENCES properties(id)
        ON DELETE CASCADE,

    CONSTRAINT risk_findings_tenant_fk
        FOREIGN KEY (tenant_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS spatial_layers (
    id CHAR(36) NOT NULL,
    layer_type TEXT NOT NULL,
    label TEXT NOT NULL,
    source_name TEXT NULL,
    source_url TEXT NULL,
    source_date DATE NULL,
    data_status VARCHAR(20) NOT NULL DEFAULT 'demo',

    /*
      MariaDB spatial replacement for
      geometry(Geometry,4326).
    */
    geom GEOMETRY NOT NULL,

    active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSON NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY spatial_layers_active_type_idx (active, layer_type(191)),
    SPATIAL KEY spatial_layers_geom_spatial_idx (geom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS audit_events (
    id CHAR(36) NOT NULL,
    actor_uid TEXT NOT NULL,
    tenant_id CHAR(36) NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NULL,
    details JSON NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY audit_events_tenant_time_idx (tenant_id, created_at),

    CONSTRAINT audit_events_tenant_fk
        FOREIGN KEY (tenant_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS title_events (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    property_id CHAR(36) NOT NULL,
    document_id CHAR(36) NULL,
    sequence_order INT NOT NULL DEFAULT 1,
    event_date DATE NOT NULL,
    registration_date DATE NULL,
    deed_type TEXT NOT NULL,
    from_parties JSON NOT NULL,
    to_parties JSON NOT NULL,
    extent_sq_ft DECIMAL(20,4) NOT NULL DEFAULT 0,
    extent_raw TEXT NOT NULL DEFAULT '',
    consideration DECIMAL(20,4) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'unverified',
    dispute_rationale TEXT NULL,
    reviewed_by TEXT NULL,
    encumbrance_status VARCHAR(30) NOT NULL DEFAULT 'none',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY title_events_property_idx (tenant_id, property_id, event_date),

    CONSTRAINT title_events_document_fk
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE SET NULL,

    CONSTRAINT title_events_property_fk
        FOREIGN KEY (property_id)
        REFERENCES properties(id)
        ON DELETE CASCADE,

    CONSTRAINT title_events_tenant_fk
        FOREIGN KEY (tenant_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS title_reviews (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    property_id CHAR(36) NOT NULL,
    event_id CHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL,
    rationale TEXT NULL,
    reviewer_uid TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY title_reviews_event_idx (tenant_id, event_id, created_at),

    CONSTRAINT title_reviews_event_fk
        FOREIGN KEY (event_id)
        REFERENCES title_events(id)
        ON DELETE CASCADE,

    CONSTRAINT title_reviews_property_fk
        FOREIGN KEY (property_id)
        REFERENCES properties(id)
        ON DELETE CASCADE,

    CONSTRAINT title_reviews_tenant_fk
        FOREIGN KEY (tenant_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS source_registry_verifications (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    property_id CHAR(36) NOT NULL,
    registry_name VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL,
    query_params JSON NOT NULL,
    matched_record JSON NOT NULL,
    discrepancies JSON NOT NULL,
    latency_ms INT NOT NULL DEFAULT 0,
    response_hash TEXT NOT NULL,
    verified_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY src_reg_prop_idx (tenant_id, property_id, registry_name),
    KEY src_reg_verified_at_idx (tenant_id, verified_at),

    CONSTRAINT source_registry_property_fk
        FOREIGN KEY (property_id)
        REFERENCES properties(id)
        ON DELETE CASCADE,

    CONSTRAINT source_registry_tenant_fk
        FOREIGN KEY (tenant_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS legal_bookmarks (
    id CHAR(36) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    property_id CHAR(36) NULL,
    act_id TEXT NOT NULL,
    section_number TEXT NOT NULL,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_by_uid TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    KEY legal_bookmarks_tenant_idx (tenant_id, property_id),

    CONSTRAINT legal_bookmarks_property_fk
        FOREIGN KEY (property_id)
        REFERENCES properties(id)
        ON DELETE CASCADE,

    CONSTRAINT legal_bookmarks_tenant_fk
        FOREIGN KEY (tenant_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS workspace_settings (
    tenant_id CHAR(36) NOT NULL,
    org_name TEXT NOT NULL DEFAULT 'Karnataka Legal Partners LLP',
    primary_contact TEXT NOT NULL DEFAULT 'Deepak Professional (deepak@ojix.local)',
    default_district TEXT NOT NULL DEFAULT 'Bengaluru Urban',
    auto_screen_bhoomi BOOLEAN NOT NULL DEFAULT TRUE,
    auto_screen_kaveri BOOLEAN NOT NULL DEFAULT TRUE,
    auto_screen_spatial BOOLEAN NOT NULL DEFAULT TRUE,
    swd_primary_buffer_m DECIMAL(20,4) NOT NULL DEFAULT 50,
    swd_secondary_buffer_m DECIMAL(20,4) NOT NULL DEFAULT 25,
    swd_tertiary_buffer_m DECIMAL(20,4) NOT NULL DEFAULT 15,
    lake_buffer_m DECIMAL(20,4) NOT NULL DEFAULT 30,
    survey_margin_tolerance_pct DECIMAL(10,4) NOT NULL DEFAULT 1.0,
    ocr_confidence_threshold DECIMAL(10,4) NOT NULL DEFAULT 0.60,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (tenant_id),

    CONSTRAINT workspace_settings_tenant_fk
        FOREIGN KEY (tenant_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspace_invitations (id CHAR(36) NOT NULL,tenant_id CHAR(36) NOT NULL,email VARCHAR(255) NOT NULL,invited_name VARCHAR(160) NOT NULL,assigned_role VARCHAR(20) NOT NULL,invitation_token_hash CHAR(64) NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'pending',delivery_status VARCHAR(20) NOT NULL DEFAULT 'not_configured',invited_by_uid VARCHAR(191) NOT NULL,expires_at DATETIME(6) NOT NULL,accepted_at DATETIME(6) NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),PRIMARY KEY(id),KEY workspace_invitations_tenant_status_idx(tenant_id,status,created_at),KEY workspace_invitations_email_idx(tenant_id,email),CONSTRAINT workspace_invitations_tenant_fk FOREIGN KEY(tenant_id) REFERENCES organizations(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workbench_tasks (
  id CHAR(36) NOT NULL, tenant_id CHAR(36) NOT NULL, property_id CHAR(36) NOT NULL,
  task_code VARCHAR(32) NOT NULL, title VARCHAR(255) NOT NULL, description TEXT NOT NULL,
  category VARCHAR(80) NOT NULL, priority VARCHAR(16) NOT NULL DEFAULT 'medium',
  status VARCHAR(24) NOT NULL DEFAULT 'pending', due_date DATE NULL,
  assigned_by_uid VARCHAR(191) NOT NULL, assigned_to_uid VARCHAR(191) NOT NULL,
  reviewer_uid VARCHAR(191) NULL, linked_document_id CHAR(36) NULL,
  linked_finding_id CHAR(36) NULL, checklist JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id), UNIQUE KEY workbench_task_code_tenant_key (tenant_id, task_code),
  KEY workbench_task_assignee_status_idx (tenant_id, assigned_to_uid, status, due_date),
  KEY workbench_task_property_idx (tenant_id, property_id, created_at),
  CONSTRAINT workbench_task_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT workbench_task_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS workbench_task_activity (
  id CHAR(36) NOT NULL, tenant_id CHAR(36) NOT NULL, task_id CHAR(36) NOT NULL,
  actor_uid VARCHAR(191) NOT NULL, action VARCHAR(48) NOT NULL, details JSON NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (id),
  KEY workbench_task_activity_idx (tenant_id, task_id, created_at),
  CONSTRAINT workbench_task_activity_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT workbench_task_activity_task_fk FOREIGN KEY (task_id) REFERENCES workbench_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS workbench_task_comments (
  id CHAR(36) NOT NULL, tenant_id CHAR(36) NOT NULL, task_id CHAR(36) NOT NULL,
  author_uid VARCHAR(191) NOT NULL, body TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (id),
  KEY workbench_task_comments_idx (tenant_id, task_id, created_at),
  CONSTRAINT workbench_task_comments_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT workbench_task_comments_task_fk FOREIGN KEY (task_id) REFERENCES workbench_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consultant_report_versions (
  id CHAR(36) NOT NULL, tenant_id CHAR(36) NOT NULL, property_id CHAR(36) NOT NULL,
  version_number INT UNSIGNED NOT NULL, report_type VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL, approval_status VARCHAR(20) NOT NULL DEFAULT 'draft',
  snapshot JSON NOT NULL, snapshot_sha256 CHAR(64) NOT NULL,
  data_checked_at DATETIME(6) NOT NULL, created_by_uid VARCHAR(191) NOT NULL,
  submitted_at DATETIME(6) NULL, reviewed_by_uid VARCHAR(191) NULL,
  review_decision VARCHAR(20) NULL, review_rationale TEXT NULL, reviewed_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (id),
  UNIQUE KEY consultant_report_property_version_key (tenant_id, property_id, version_number),
  KEY consultant_report_status_idx (tenant_id, approval_status, created_at),
  CONSTRAINT consultant_report_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT consultant_report_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS consultant_report_shares (
  id CHAR(36) NOT NULL, tenant_id CHAR(36) NOT NULL, report_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL, expires_at DATETIME(6) NULL, revoked_at DATETIME(6) NULL,
  created_by_uid VARCHAR(191) NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id), UNIQUE KEY consultant_report_share_token_key (token_hash),
  KEY consultant_report_share_idx (tenant_id, report_id, created_at),
  CONSTRAINT consultant_report_share_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT consultant_report_share_report_fk FOREIGN KEY (report_id) REFERENCES consultant_report_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS consultant_issue_evidence (
  id CHAR(36) NOT NULL, tenant_id CHAR(36) NOT NULL, property_id CHAR(36) NOT NULL,
  finding_id CHAR(36) NOT NULL, document_id CHAR(36) NOT NULL, linked_by_uid VARCHAR(191) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (id),
  UNIQUE KEY consultant_issue_evidence_key (tenant_id, finding_id, document_id),
  CONSTRAINT consultant_issue_evidence_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT consultant_issue_evidence_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT consultant_issue_evidence_finding_fk FOREIGN KEY (finding_id) REFERENCES risk_findings(id) ON DELETE CASCADE,
  CONSTRAINT consultant_issue_evidence_document_fk FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS consultant_finding_reviews (
  id CHAR(36) NOT NULL, tenant_id CHAR(36) NOT NULL, property_id CHAR(36) NOT NULL,
  finding_id CHAR(36) NOT NULL, review_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  rationale TEXT NOT NULL, reviewer_uid VARCHAR(191) NOT NULL,
  reviewed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (id),
  UNIQUE KEY consultant_finding_review_key (tenant_id, finding_id),
  CONSTRAINT consultant_finding_review_tenant_fk FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT consultant_finding_review_property_fk FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT consultant_finding_review_finding_fk FOREIGN KEY (finding_id) REFERENCES risk_findings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS authentication_sessions (id CHAR(36) NOT NULL,tenant_id CHAR(36) NOT NULL,user_uid VARCHAR(191) NOT NULL,token_hash CHAR(64) NOT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),last_activity_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),expires_at DATETIME(6) NOT NULL,revoked_at DATETIME(6) NULL,revoked_by_uid VARCHAR(191) NULL,revoke_reason TEXT NULL,ip_address VARCHAR(64) NULL,user_agent VARCHAR(500) NULL,PRIMARY KEY(id),UNIQUE KEY authentication_sessions_token_hash_key(token_hash),KEY authentication_sessions_tenant_user_idx(tenant_id,user_uid,expires_at),CONSTRAINT authentication_sessions_tenant_fk FOREIGN KEY(tenant_id) REFERENCES organizations(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspace_retention_policies (tenant_id CHAR(36) NOT NULL,retention_days INT NOT NULL DEFAULT 2555,archive_after_days INT NOT NULL DEFAULT 365,legal_hold BOOLEAN NOT NULL DEFAULT FALSE,automatic_cleanup_enabled BOOLEAN NOT NULL DEFAULT FALSE,updated_by_uid VARCHAR(191) NOT NULL,updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),PRIMARY KEY(tenant_id),CONSTRAINT workspace_retention_tenant_fk FOREIGN KEY(tenant_id) REFERENCES organizations(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS owner_configuration_versions (id CHAR(36) NOT NULL,tenant_id CHAR(36) NOT NULL,config_type VARCHAR(40) NOT NULL,version_number INT UNSIGNED NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'draft',name VARCHAR(160) NOT NULL,configuration JSON NOT NULL,created_by_uid VARCHAR(191) NOT NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),PRIMARY KEY(id),UNIQUE KEY owner_config_version_key(tenant_id,config_type,version_number),KEY owner_config_history_idx(tenant_id,config_type,created_at),CONSTRAINT owner_config_tenant_fk FOREIGN KEY(tenant_id) REFERENCES organizations(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS workspace_export_events (id CHAR(36) NOT NULL,tenant_id CHAR(36) NOT NULL,actor_uid VARCHAR(191) NOT NULL,resource_type VARCHAR(60) NOT NULL,resource_id VARCHAR(191) NULL,export_format VARCHAR(30) NOT NULL,watermark_enabled BOOLEAN NOT NULL DEFAULT FALSE,expires_at DATETIME(6) NULL,result VARCHAR(20) NOT NULL DEFAULT 'success',details JSON NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),PRIMARY KEY(id),KEY workspace_export_tenant_time_idx(tenant_id,created_at),CONSTRAINT workspace_export_tenant_fk FOREIGN KEY(tenant_id) REFERENCES organizations(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS workspace_purge_requests (id CHAR(36) NOT NULL,tenant_id CHAR(36) NOT NULL,document_id CHAR(36) NOT NULL,requested_by_uid VARCHAR(191) NOT NULL,reason TEXT NOT NULL,status VARCHAR(20) NOT NULL DEFAULT 'pending',approved_by_uid VARCHAR(191) NULL,approved_at DATETIME(6) NULL,completed_at DATETIME(6) NULL,created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),PRIMARY KEY(id),KEY workspace_purge_tenant_status_idx(tenant_id,status,created_at),CONSTRAINT workspace_purge_tenant_fk FOREIGN KEY(tenant_id) REFERENCES organizations(id) ON DELETE CASCADE,CONSTRAINT workspace_purge_document_fk FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
