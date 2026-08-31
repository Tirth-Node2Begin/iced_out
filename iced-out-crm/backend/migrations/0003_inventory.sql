-- Spec §6.3 Inventory. Availability is ALWAYS derived (total − reserved),
-- never stored; only StockService writes here and every write appends a
-- movement row (spec §9.6).

CREATE TABLE warehouses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(16) NOT NULL,
    name VARCHAR(120) NOT NULL,
    available_label VARCHAR(40) NOT NULL DEFAULT '',
    capacity_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
    cutoff VARCHAR(40) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'Online',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_warehouses_public_id (public_id),
    CONSTRAINT ck_warehouses_status CHECK (status IN ('Online','Draft','Disabled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE stock_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    item_name VARCHAR(160) NOT NULL,
    category VARCHAR(16) NOT NULL DEFAULT 'Top',
    item_type VARCHAR(80) NOT NULL DEFAULT '',
    sizes_csv VARCHAR(120) NOT NULL DEFAULT '',
    warehouse_id BIGINT UNSIGNED NOT NULL,
    total_units INT UNSIGNED NOT NULL DEFAULT 0,
    reserved_units INT UNSIGNED NOT NULL DEFAULT 0,
    version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_stock_items_public_id (public_id),
    KEY ix_stock_items_warehouse (warehouse_id),
    CONSTRAINT ck_stock_items_category CHECK (category IN ('Top','Bottom')),
    CONSTRAINT ck_stock_items_reserved CHECK (reserved_units <= total_units),
    CONSTRAINT fk_stock_items_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- products.item_ref names a stock item by its ITM-* public id. The constraint is
-- added here because stock_items only exists from this migration onward.
ALTER TABLE products
    ADD CONSTRAINT fk_products_item_ref FOREIGN KEY (item_ref) REFERENCES stock_items (public_id)
        ON UPDATE CASCADE ON DELETE SET NULL;

-- Per-size truth behind the PDP badges (IN_STOCK / LOW_STOCK / SOLD_OUT).
CREATE TABLE variant_inventory (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    variant_id BIGINT UNSIGNED NOT NULL,
    stock_item_id BIGINT UNSIGNED NULL,
    on_hand INT NOT NULL DEFAULT 0,
    reserved INT NOT NULL DEFAULT 0,
    available INT AS (on_hand - reserved) STORED,
    low_at TINYINT UNSIGNED NOT NULL DEFAULT 4,
    version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_variant_inventory_variant (variant_id),
    KEY ix_variant_inventory_stock_item (stock_item_id),
    KEY ix_variant_inventory_available (available),
    CONSTRAINT ck_variant_inventory_reserved CHECK (reserved >= 0 AND reserved <= on_hand),
    CONSTRAINT fk_variant_inventory_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE CASCADE,
    CONSTRAINT fk_variant_inventory_stock_item FOREIGN KEY (stock_item_id) REFERENCES stock_items (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Ledger. Every stock write in the system lands here.
CREATE TABLE inventory_movements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    stock_item_id BIGINT UNSIGNED NULL,
    variant_id BIGINT UNSIGNED NULL,
    type VARCHAR(24) NOT NULL,
    qty INT NOT NULL,
    on_hand_after INT NULL,
    reserved_after INT NULL,
    reference_type VARCHAR(32) NOT NULL DEFAULT '',
    reference_id VARCHAR(64) NOT NULL DEFAULT '',
    idempotency_key VARCHAR(191) NULL,
    actor_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_movements_idem (idempotency_key),
    KEY ix_inventory_movements_item (stock_item_id, created_at),
    KEY ix_inventory_movements_variant (variant_id, created_at),
    KEY ix_inventory_movements_reference (reference_type, reference_id),
    CONSTRAINT ck_inventory_movements_type CHECK (type IN (
        'PURCHASE_IN','SALE_RESERVE','SALE_CONFIRM','RESERVE_EXPIRE','RETURN_IN','RTO_IN',
        'TRANSFER_OUT','TRANSFER_IN','ADJUST_UP','ADJUST_DOWN','DAMAGE'
    )),
    CONSTRAINT fk_inventory_movements_item FOREIGN KEY (stock_item_id) REFERENCES stock_items (id) ON DELETE SET NULL,
    CONSTRAINT fk_inventory_movements_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE SET NULL,
    CONSTRAINT fk_inventory_movements_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- order_id / order_item_id foreign keys are attached in 0005 once orders exist.
CREATE TABLE inventory_reservations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NULL,
    order_item_id BIGINT UNSIGNED NULL,
    variant_id BIGINT UNSIGNED NOT NULL,
    qty INT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'HELD',
    expires_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_reservations_order_item (order_item_id),
    KEY ix_inventory_reservations_status (status, expires_at),
    KEY ix_inventory_reservations_variant (variant_id),
    KEY ix_inventory_reservations_order (order_id),
    CONSTRAINT ck_inventory_reservations_status CHECK (status IN ('HELD','CONFIRMED','RELEASED','EXPIRED')),
    CONSTRAINT fk_inventory_reservations_variant FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE inventory_transfers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(16) NOT NULL,
    from_warehouse_id BIGINT UNSIGNED NOT NULL,
    to_warehouse_id BIGINT UNSIGNED NOT NULL,
    units INT UNSIGNED NOT NULL DEFAULT 0,
    dispatched_label VARCHAR(40) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'Ready',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_transfers_public_id (public_id),
    KEY ix_inventory_transfers_status (status),
    CONSTRAINT ck_inventory_transfers_status CHECK (status IN ('Ready','In transit','Received','Cancelled')),
    CONSTRAINT ck_inventory_transfers_route CHECK (from_warehouse_id <> to_warehouse_id),
    CONSTRAINT fk_inventory_transfers_from FOREIGN KEY (from_warehouse_id) REFERENCES warehouses (id),
    CONSTRAINT fk_inventory_transfers_to FOREIGN KEY (to_warehouse_id) REFERENCES warehouses (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE inventory_transfer_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    transfer_id BIGINT UNSIGNED NOT NULL,
    stock_item_id BIGINT UNSIGNED NOT NULL,
    qty INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY ix_transfer_items_transfer (transfer_id),
    CONSTRAINT fk_transfer_items_transfer FOREIGN KEY (transfer_id) REFERENCES inventory_transfers (id) ON DELETE CASCADE,
    CONSTRAINT fk_transfer_items_stock_item FOREIGN KEY (stock_item_id) REFERENCES stock_items (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};
