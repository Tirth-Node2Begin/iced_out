-- Spec §6.9 Analytics & dashboard. These three feed the console's charts, bell
-- drawer and activity river; the window maths (current vs previous period)
-- stays client-side in periodFor().

CREATE TABLE trading_days (
    day DATE NOT NULL,
    revenue DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    orders INT UNSIGNED NOT NULL DEFAULT 0,
    sessions INT UNSIGNED NOT NULL DEFAULT 0,
    returns INT UNSIGNED NOT NULL DEFAULT 0,
    refreshed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- The bell drawer (read limit 40, sorted rose → amber → ink → mint).
CREATE TABLE ops_signals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    kind VARCHAR(16) NOT NULL,
    tone VARCHAR(8) NOT NULL DEFAULT 'ink',
    title VARCHAR(160) NOT NULL,
    detail VARCHAR(255) NOT NULL DEFAULT '',
    href VARCHAR(190) NOT NULL DEFAULT '',
    entity_type VARCHAR(40) NOT NULL DEFAULT '',
    entity_id VARCHAR(64) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    cleared_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY ix_ops_signals_open (cleared_at, created_at),
    CONSTRAINT ck_ops_signals_kind CHECK (kind IN ('order','payment','shipment','inventory','return','support','review')),
    CONSTRAINT ck_ops_signals_tone CHECK (tone IN ('mint','amber','rose','ink'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Ledger. Replaces the frontend's activity simulator (polled every 15 s).
CREATE TABLE activity_feed (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    source VARCHAR(24) NOT NULL,
    action VARCHAR(40) NOT NULL,
    title VARCHAR(160) NOT NULL,
    detail VARCHAR(255) NOT NULL DEFAULT '',
    actor VARCHAR(80) NOT NULL DEFAULT '',
    state VARCHAR(40) NOT NULL DEFAULT '',
    tone VARCHAR(8) NOT NULL DEFAULT 'info',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_activity_feed_created (id, created_at),
    CONSTRAINT ck_activity_feed_source CHECK (source IN ('Orders','Payments','Shipping','Inventory','Returns','Support')),
    CONSTRAINT ck_activity_feed_tone CHECK (tone IN ('good','warn','bad','info'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};
