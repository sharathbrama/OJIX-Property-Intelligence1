CREATE TABLE IF NOT EXISTS account_password_overrides (
    user_uid VARCHAR(191) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    changed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    changed_by_uid VARCHAR(191) NOT NULL,
    PRIMARY KEY (user_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
