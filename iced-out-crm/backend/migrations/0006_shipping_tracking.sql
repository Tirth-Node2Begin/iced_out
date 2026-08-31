-- Spec §6.6 Shipping & tracking.
--
-- Fulfilment (shipments, dispatch, pickups, labels, tokens) is internal.
-- Courier scan events are NOT: shipment_events is a CACHE of what the external
-- tracking API returns (spec §9.8), so /track keeps rendering when that
-- provider is down — and the backend never invents an event.

CREATE TABLE shipments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    order_number VARCHAR(40) NOT NULL DEFAULT '',
    provider VARCHAR(40) NOT NULL DEFAULT '',
    awb VARCHAR(60) NOT NULL DEFAULT '',
    destination VARCHAR(120) NOT NULL DEFAULT '',
    dispatched_label VARCHAR(40) NOT NULL DEFAULT '',
    promise_label VARCHAR(40) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'Dispatched',
    fail_reason VARCHAR(120) NULL,
    handling VARCHAR(24) NULL,
    tracking_token VARCHAR(40) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_shipments_public_id (public_id),
    UNIQUE KEY uq_shipments_token (tracking_token),
    KEY ix_shipments_order (order_id),
    KEY ix_shipments_status (status),
    CONSTRAINT ck_shipments_status CHECK (status IN ('Dispatched','In transit','Delivered','Failed','Cancelled')),
    CONSTRAINT ck_shipments_handling CHECK (handling IS NULL OR handling IN ('Needs action','Sending back','Back in store')),
    CONSTRAINT fk_shipments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE shipment_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shipment_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(80) NOT NULL,
    detail VARCHAR(255) NOT NULL DEFAULT '',
    time_label VARCHAR(40) NOT NULL DEFAULT '',
    is_complete TINYINT(1) NOT NULL DEFAULT 0,
    position INT NOT NULL DEFAULT 0,
    source VARCHAR(16) NOT NULL DEFAULT 'internal',
    external_ref VARCHAR(120) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_shipment_events_shipment (shipment_id, position),
    CONSTRAINT ck_shipment_events_source CHECK (source IN ('internal','external')),
    CONSTRAINT fk_shipment_events_shipment FOREIGN KEY (shipment_id) REFERENCES shipments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE courier_pickups (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(24) NOT NULL,
    provider VARCHAR(40) NOT NULL DEFAULT '',
    parcels INT UNSIGNED NOT NULL DEFAULT 0,
    pickup_label VARCHAR(60) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'Open',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_courier_pickups_public_id (public_id),
    CONSTRAINT ck_courier_pickups_status CHECK (status IN ('Open','Handed over'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE shipment_labels (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shipment_id BIGINT UNSIGNED NOT NULL,
    media_id BIGINT UNSIGNED NULL,
    printed_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_shipment_labels_shipment (shipment_id),
    CONSTRAINT fk_shipment_labels_shipment FOREIGN KEY (shipment_id) REFERENCES shipments (id) ON DELETE CASCADE,
    CONSTRAINT fk_shipment_labels_media FOREIGN KEY (media_id) REFERENCES media_assets (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Non-delivery cases. Max 3 reattempts before RTO (spec §9.4).
CREATE TABLE ndr_cases (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    shipment_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(120) NOT NULL DEFAULT '',
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'Open',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_ndr_cases_shipment (shipment_id),
    CONSTRAINT ck_ndr_cases_attempts CHECK (attempts <= 3),
    CONSTRAINT ck_ndr_cases_status CHECK (status IN ('Open','Reattempting','RTO','Closed')),
    CONSTRAINT fk_ndr_cases_shipment FOREIGN KEY (shipment_id) REFERENCES shipments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};
