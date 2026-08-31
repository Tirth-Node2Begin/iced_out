-- Raw materials — the half of inventory that comes BEFORE a garment exists.
--
-- `stock_items` counts finished pieces. Nothing in the schema said where they
-- came from: an operator could add 40 hoodies and no row anywhere recorded the
-- 96 metres of fleece that became them. These seven tables are that upstream
-- half, and they close into the existing one at exactly one point —
-- `production_runs`, which consumes materials and adds finished units in a
-- single transaction.
--
--   suppliers → material_purchases → (receipt) → materials
--                                                    ↓  product_materials (BOM)
--                                            production_runs
--                                                    ↓
--                                             stock_items  (already there)
--
-- Three rules carried over from 0003, because inventory that half-follows them
-- is worse than inventory that follows none:
--
--   · AVAILABILITY IS DERIVED. `available` is a generated column, never written.
--   · EVERY WRITE APPENDS A MOVEMENT. `material_movements` is the whole story of
--     how a quantity got where it is, the same way `inventory_movements` is.
--   · ONE SERVICE WRITES. MaterialService owns every quantity change here, so
--     the ledger cannot be bypassed.
--
-- Quantities are DECIMAL(12,3) rather than INT: fabric is bought and cut in
-- metres and a hoodie takes 2.4 of them. Rounding that to whole units would put
-- the error into every production run and compound it.

CREATE TABLE suppliers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(16) NOT NULL,
    name VARCHAR(160) NOT NULL,
    name_normalized VARCHAR(160) NOT NULL,
    contact_name VARCHAR(120) NOT NULL DEFAULT '',
    email VARCHAR(190) NOT NULL DEFAULT '',
    phone VARCHAR(20) NOT NULL DEFAULT '',
    city VARCHAR(80) NOT NULL DEFAULT '',
    country VARCHAR(80) NOT NULL DEFAULT 'India',
    -- What to promise a customer. A material that takes six weeks to arrive is
    -- a different planning problem from one that takes three days, and this is
    -- the only place that difference is written down.
    lead_time_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_suppliers_public_id (public_id),
    KEY ix_suppliers_name (name_normalized),
    KEY ix_suppliers_status (status, deleted_at),
    CONSTRAINT ck_suppliers_status CHECK (status IN ('ACTIVE','ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE materials (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(16) NOT NULL,
    -- The operator's own reference, printed on the roll or the box.
    code VARCHAR(40) NOT NULL DEFAULT '',
    name VARCHAR(160) NOT NULL,
    kind VARCHAR(16) NOT NULL DEFAULT 'FABRIC',
    unit VARCHAR(8) NOT NULL DEFAULT 'M',
    on_hand DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    -- Committed to a production run that has started but not finished.
    reserved DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    available DECIMAL(12,3) AS (on_hand - reserved) STORED,
    -- Below this, the material is at risk and the register says so. Zero means
    -- "do not warn" rather than "warn always", which is what an unset numeric
    -- threshold has to mean if it is not to shout about every consumable.
    reorder_point DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    supplier_id BIGINT UNSIGNED NULL,
    warehouse_id BIGINT UNSIGNED NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_materials_public_id (public_id),
    KEY ix_materials_supplier (supplier_id, deleted_at),
    KEY ix_materials_warehouse (warehouse_id, deleted_at),
    KEY ix_materials_kind (kind, deleted_at),
    -- The at-risk sweep reads this pair; the generated column is what makes it
    -- an index lookup rather than a scan with arithmetic in the WHERE.
    KEY ix_materials_available (available, reorder_point),
    CONSTRAINT ck_materials_kind CHECK (kind IN ('FABRIC','TRIM','HARDWARE','LABEL','PACKAGING','OTHER')),
    CONSTRAINT ck_materials_unit CHECK (unit IN ('M','CM','PC','KG','G','L','ROLL','SET')),
    CONSTRAINT ck_materials_status CHECK (status IN ('ACTIVE','ARCHIVED')),
    CONSTRAINT ck_materials_reserved CHECK (reserved >= 0 AND reserved <= on_hand),
    CONSTRAINT ck_materials_on_hand CHECK (on_hand >= 0),
    CONSTRAINT fk_materials_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL,
    CONSTRAINT fk_materials_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- The ledger. Every material write in the system lands here, exactly as
-- `inventory_movements` does for finished goods.
CREATE TABLE material_movements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    material_id BIGINT UNSIGNED NULL,
    type VARCHAR(24) NOT NULL,
    -- Signed: what this movement did to `on_hand`. A consumption is negative.
    qty DECIMAL(12,3) NOT NULL,
    on_hand_after DECIMAL(12,3) NULL,
    reserved_after DECIMAL(12,3) NULL,
    -- What caused it: 'purchase' + po-0003, 'production' + run-0007, 'manual'.
    reference_type VARCHAR(32) NOT NULL DEFAULT '',
    reference_id VARCHAR(64) NOT NULL DEFAULT '',
    note VARCHAR(190) NOT NULL DEFAULT '',
    actor_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_material_movements_material (material_id, created_at),
    KEY ix_material_movements_reference (reference_type, reference_id),
    CONSTRAINT ck_material_movements_type CHECK (type IN (
        'RECEIPT','CONSUME','RESERVE','RELEASE','ADJUST_UP','ADJUST_DOWN','WASTAGE','RETURN_OUT'
    )),
    CONSTRAINT fk_material_movements_material FOREIGN KEY (material_id) REFERENCES materials (id) ON DELETE SET NULL,
    CONSTRAINT fk_material_movements_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE material_purchases (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(16) NOT NULL,
    supplier_id BIGINT UNSIGNED NOT NULL,
    -- DRAFT is being written; ORDERED has been sent; PARTIAL has had some of it
    -- arrive; RECEIVED is closed. Only ORDERED and PARTIAL can receive stock,
    -- which is what stops a draft quietly adding metres nobody has bought.
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    ordered_on DATE NULL,
    expected_on DATE NULL,
    received_on DATE NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    notes TEXT NULL,
    owner_user_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_material_purchases_public_id (public_id),
    KEY ix_material_purchases_supplier (supplier_id, deleted_at),
    KEY ix_material_purchases_status (status, deleted_at),
    CONSTRAINT ck_material_purchases_status CHECK (status IN ('DRAFT','ORDERED','PARTIAL','RECEIVED','CANCELLED')),
    CONSTRAINT fk_material_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
    CONSTRAINT fk_material_purchases_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE material_purchase_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    purchase_id BIGINT UNSIGNED NOT NULL,
    material_id BIGINT UNSIGNED NOT NULL,
    qty_ordered DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    -- Climbs as deliveries arrive. A short delivery leaves this below
    -- `qty_ordered` and the purchase sits at PARTIAL, which is the honest state
    -- — the alternative is closing a PO that is still owed 40 metres.
    qty_received DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (id),
    UNIQUE KEY uq_purchase_items_line (purchase_id, material_id),
    KEY ix_purchase_items_material (material_id),
    CONSTRAINT ck_purchase_items_qty CHECK (qty_ordered >= 0 AND qty_received >= 0),
    CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES material_purchases (id) ON DELETE CASCADE,
    CONSTRAINT fk_purchase_items_material FOREIGN KEY (material_id) REFERENCES materials (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- The bill of materials: what one unit of a stock item is made of.
--
-- This is the row that turns two separate ledgers into a flow. Without it a
-- production run would have to be told its own consumption by hand every time,
-- and the number would be a guess that drifted.
CREATE TABLE product_materials (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    stock_item_id BIGINT UNSIGNED NOT NULL,
    material_id BIGINT UNSIGNED NOT NULL,
    -- Four decimal places: a hoodie takes 2.4 m of fleece but 0.0125 kg of
    -- thread, and rounding the second to three places loses a third of it.
    qty_per_unit DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    -- Cutting loss, as a percentage on top. Held apart from `qty_per_unit`
    -- because they answer different questions: one is what the garment
    -- contains, the other is what the table wastes.
    wastage_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    note VARCHAR(190) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_product_materials_line (stock_item_id, material_id),
    KEY ix_product_materials_material (material_id),
    CONSTRAINT ck_product_materials_qty CHECK (qty_per_unit >= 0),
    CONSTRAINT ck_product_materials_wastage CHECK (wastage_pct >= 0 AND wastage_pct <= 100),
    CONSTRAINT fk_product_materials_item FOREIGN KEY (stock_item_id) REFERENCES stock_items (id) ON DELETE CASCADE,
    CONSTRAINT fk_product_materials_material FOREIGN KEY (material_id) REFERENCES materials (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Where the two halves meet.
--
-- PLANNED reserves nothing. STARTED reserves the materials the BOM says it
-- needs, so a second run cannot promise the same fleece. DONE consumes the
-- reservation and adds the finished units to `stock_items`. CANCELLED releases.
--
-- `qty_produced` is separate from `qty_planned` because they differ in real
-- life: a run of 40 that yields 38 has two rejects, and recording 40 would put
-- units into the warehouse that nobody can pick.
CREATE TABLE production_runs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(16) NOT NULL,
    stock_item_id BIGINT UNSIGNED NOT NULL,
    warehouse_id BIGINT UNSIGNED NULL,
    qty_planned INT UNSIGNED NOT NULL DEFAULT 0,
    qty_produced INT UNSIGNED NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'PLANNED',
    started_at DATETIME(6) NULL,
    completed_at DATETIME(6) NULL,
    notes TEXT NULL,
    owner_user_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_production_runs_public_id (public_id),
    KEY ix_production_runs_item (stock_item_id, deleted_at),
    KEY ix_production_runs_status (status, deleted_at),
    CONSTRAINT ck_production_runs_status CHECK (status IN ('PLANNED','STARTED','DONE','CANCELLED')),
    CONSTRAINT fk_production_runs_item FOREIGN KEY (stock_item_id) REFERENCES stock_items (id),
    CONSTRAINT fk_production_runs_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE SET NULL,
    CONSTRAINT fk_production_runs_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- What a run actually reserved and consumed, frozen line by line.
--
-- A SNAPSHOT, not a view of the BOM: the recipe can change next month, and a
-- run that happened in August has to keep saying what it used in August. This
-- is the same reason `order_items` freezes its prices.
CREATE TABLE production_run_materials (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    run_id BIGINT UNSIGNED NOT NULL,
    material_id BIGINT UNSIGNED NOT NULL,
    qty_per_unit DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    wastage_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    -- What was held at STARTED, and what was actually taken at DONE. They
    -- differ whenever the run produced fewer units than it planned.
    qty_reserved DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    qty_consumed DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    PRIMARY KEY (id),
    UNIQUE KEY uq_run_materials_line (run_id, material_id),
    KEY ix_run_materials_material (material_id),
    CONSTRAINT fk_run_materials_run FOREIGN KEY (run_id) REFERENCES production_runs (id) ON DELETE CASCADE,
    CONSTRAINT fk_run_materials_material FOREIGN KEY (material_id) REFERENCES materials (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};
