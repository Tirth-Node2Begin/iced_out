-- Spec §6.8 CMS, settings, platform.

CREATE TABLE cms_pages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(80) NOT NULL,
    title VARCHAR(160) NOT NULL DEFAULT '',
    type VARCHAR(16) NOT NULL DEFAULT 'POLICY',
    status VARCHAR(16) NOT NULL DEFAULT 'Draft',
    current_version_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_cms_pages_slug (slug),
    CONSTRAINT ck_cms_pages_type CHECK (type IN ('HOME','POLICY')),
    CONSTRAINT ck_cms_pages_status CHECK (status IN ('Published','Draft'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Immutable: a publish writes a new row and repoints cms_pages.current_version_id.
CREATE TABLE cms_page_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    page_id BIGINT UNSIGNED NOT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    body_json MEDIUMTEXT NULL,
    published_at DATETIME(6) NULL,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_cms_page_versions (page_id, version),
    CONSTRAINT fk_cms_page_versions_page FOREIGN KEY (page_id) REFERENCES cms_pages (id) ON DELETE CASCADE,
    CONSTRAINT fk_cms_page_versions_author FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

ALTER TABLE cms_pages
    ADD CONSTRAINT fk_cms_pages_current_version FOREIGN KEY (current_version_id) REFERENCES cms_page_versions (id) ON DELETE SET NULL;

-- Only the seven renderable block types exist; the renderer skips anything else.
CREATE TABLE cms_blocks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    page_id BIGINT UNSIGNED NOT NULL,
    public_id VARCHAR(40) NOT NULL,
    type VARCHAR(24) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    config_json MEDIUMTEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_cms_blocks_public_id (public_id),
    KEY ix_cms_blocks_page (page_id, position),
    CONSTRAINT ck_cms_blocks_type CHECK (type IN ('hero','signal-strip','product-rail','destination-grid','brand-story','manifesto','service-grid')),
    CONSTRAINT fk_cms_blocks_page FOREIGN KEY (page_id) REFERENCES cms_pages (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Policy values pricing/checkout read internally (delivery fees, COD rules,
-- thresholds, id-pool bounds). Secrets are forbidden here.
CREATE TABLE store_settings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(120) NOT NULL,
    value_json MEDIUMTEXT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    updated_by BIGINT UNSIGNED NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_store_settings_key (`key`),
    CONSTRAINT fk_store_settings_actor FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE notification_preferences (
    user_id BIGINT UNSIGNED NOT NULL,
    channel VARCHAR(16) NOT NULL,
    topic VARCHAR(16) NOT NULL,
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id, channel, topic),
    CONSTRAINT ck_notification_channel CHECK (channel IN ('email','sms','whatsapp','push')),
    CONSTRAINT ck_notification_topic CHECK (topic IN ('orders','marketing','security')),
    CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- The account inbox. Deletes are soft so a re-seed never resurrects a cleared message.
CREATE TABLE inbox_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    subject VARCHAR(160) NOT NULL,
    preview VARCHAR(255) NOT NULL DEFAULT '',
    type VARCHAR(16) NOT NULL DEFAULT 'Order',
    sent_at DATETIME(6) NOT NULL,
    read_at DATETIME(6) NULL,
    deleted_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_inbox_messages_user_public (user_id, public_id),
    KEY ix_inbox_messages_user (user_id, deleted_at, sent_at),
    CONSTRAINT ck_inbox_messages_type CHECK (type IN ('Order','Delivery','Drop','Restock','Support')),
    CONSTRAINT fk_inbox_messages_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE contact_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL,
    topic VARCHAR(40) NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    consent TINYINT(1) NOT NULL DEFAULT 0,
    converted_query_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_contact_messages_created (created_at),
    CONSTRAINT fk_contact_messages_query FOREIGN KEY (converted_query_id) REFERENCES support_queries (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Ledger. Every console mutation lands here (spec §14).
CREATE TABLE audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id BIGINT UNSIGNED NULL,
    actor_role VARCHAR(32) NOT NULL DEFAULT '',
    permission_used VARCHAR(64) NOT NULL DEFAULT '',
    action VARCHAR(160) NOT NULL DEFAULT '',
    entity_type VARCHAR(60) NOT NULL DEFAULT '',
    entity_id VARCHAR(64) NOT NULL DEFAULT '',
    before_json MEDIUMTEXT NULL,
    after_json MEDIUMTEXT NULL,
    request_id VARCHAR(64) NOT NULL DEFAULT '',
    ip VARCHAR(45) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_audit_logs_actor (actor_id, created_at),
    KEY ix_audit_logs_entity (entity_type, entity_id),
    KEY ix_audit_logs_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Transactional outbox: services write here inside the transaction; the worker
-- drains it after commit. No domain event ever escapes an uncommitted write.
CREATE TABLE domain_events_outbox (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id CHAR(36) NOT NULL,
    type VARCHAR(80) NOT NULL,
    payload_json MEDIUMTEXT NULL,
    occurred_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    processed_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_domain_events_event_id (event_id),
    KEY ix_domain_events_pending (processed_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Queue fallback for installs without Redis.
CREATE TABLE job_queue (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    queue VARCHAR(32) NOT NULL DEFAULT 'default',
    type VARCHAR(120) NOT NULL,
    payload_json MEDIUMTEXT NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    run_after DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    locked_by VARCHAR(64) NULL,
    locked_at DATETIME(6) NULL,
    done_at DATETIME(6) NULL,
    failed_at DATETIME(6) NULL,
    last_error TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_job_queue_claim (queue, done_at, failed_at, run_after),
    KEY ix_job_queue_locked (locked_by, locked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};
