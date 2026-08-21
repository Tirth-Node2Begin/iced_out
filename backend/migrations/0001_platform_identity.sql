-- Spec §6.1 Identity & access, plus media_assets (§6.2 #17) which is created
-- first because users.photo_media_id points at it.

CREATE TABLE media_assets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    owner_type VARCHAR(16) NOT NULL,
    owner_id BIGINT UNSIGNED NULL,
    storage_key VARCHAR(255) NOT NULL,
    mime VARCHAR(64) NOT NULL,
    bytes INT UNSIGNED NOT NULL DEFAULT 0,
    width INT UNSIGNED NULL,
    height INT UNSIGNED NULL,
    checksum CHAR(64) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_media_public_id (public_id),
    KEY ix_media_owner (owner_type, owner_id),
    CONSTRAINT ck_media_owner_type CHECK (owner_type IN ('product','review','profile','cms','shipment'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    type VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    email_normalized VARCHAR(190) NOT NULL,
    phone VARCHAR(20) NOT NULL DEFAULT '',
    password_hash VARCHAR(255) NOT NULL DEFAULT '',
    photo_media_id BIGINT UNSIGNED NULL,
    last_seen_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_public_id (public_id),
    UNIQUE KEY uq_users_email_per_type (type, email_normalized),
    KEY ix_users_status (status),
    KEY ix_users_last_seen (last_seen_at),
    CONSTRAINT ck_users_type CHECK (type IN ('CUSTOMER','STAFF')),
    CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE','BLOCKED')),
    CONSTRAINT fk_users_photo FOREIGN KEY (photo_media_id) REFERENCES media_assets (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE user_addresses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(40) NOT NULL DEFAULT '',
    name VARCHAR(120) NOT NULL,
    street VARCHAR(255) NOT NULL,
    city VARCHAR(80) NOT NULL,
    state VARCHAR(80) NOT NULL,
    pincode CHAR(6) NOT NULL,
    phone VARCHAR(20) NOT NULL DEFAULT '',
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    position INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_addresses_public_id (public_id),
    KEY ix_addresses_user (user_id, deleted_at),
    CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Opaque session tokens: only the SHA-256 is ever stored (spec §5.1).
CREATE TABLE user_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    audience VARCHAR(16) NOT NULL,
    token_hash BINARY(32) NOT NULL,
    ip VARBINARY(16) NULL,
    user_agent VARCHAR(255) NOT NULL DEFAULT '',
    last_active_at DATETIME(6) NOT NULL,
    idle_expires_at DATETIME(6) NULL,
    absolute_expires_at DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_sessions_token (token_hash),
    KEY ix_sessions_user (user_id, audience, revoked_at),
    CONSTRAINT ck_sessions_audience CHECK (audience IN ('customer','staff')),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE auth_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NULL,
    purpose VARCHAR(24) NOT NULL,
    token_hash BINARY(32) NOT NULL,
    payload_json TEXT NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    expires_at DATETIME(6) NOT NULL,
    consumed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_auth_tokens_hash (token_hash),
    KEY ix_auth_tokens_user (user_id, purpose),
    CONSTRAINT ck_auth_tokens_purpose CHECK (purpose IN ('PASSWORD_RESET','EMAIL_VERIFY','BAG_INTENT')),
    CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Ledger: append-only. The app DB user gets no UPDATE/DELETE grant here (spec §14).
CREATE TABLE login_attempts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email_normalized VARCHAR(190) NOT NULL,
    audience VARCHAR(16) NOT NULL,
    ip VARBINARY(16) NULL,
    was_success TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_login_attempts_email (email_normalized, created_at),
    KEY ix_login_attempts_ip (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE roles (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(32) NOT NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE permissions (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(64) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE role_permissions (
    role_id INT UNSIGNED NOT NULL,
    permission_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    KEY ix_role_permissions_permission (permission_id),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE user_roles (
    user_id BIGINT UNSIGNED NOT NULL,
    role_id INT UNSIGNED NOT NULL,
    granted_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id, role_id),
    KEY ix_user_roles_role (role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_granted_by FOREIGN KEY (granted_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Ledger. Feeds the staff profile activity table (5 preview rows / 12 in the dialog).
CREATE TABLE staff_activity_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    staff_user_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(120) NOT NULL,
    resource VARCHAR(120) NOT NULL DEFAULT '',
    result VARCHAR(16) NOT NULL DEFAULT 'Completed',
    where_label VARCHAR(80) NOT NULL DEFAULT '',
    request_id VARCHAR(64) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_staff_activity_user (staff_user_id, created_at),
    CONSTRAINT ck_staff_activity_result CHECK (result IN ('Completed','Denied','Recorded')),
    CONSTRAINT fk_staff_activity_user FOREIGN KEY (staff_user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};
