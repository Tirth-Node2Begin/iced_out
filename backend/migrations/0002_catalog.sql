-- Spec §6.2 Catalog. products.public_id IS the slug the UI addresses
-- (/product/afterdark-hoodie); product_variants.public_id IS the SKU.

CREATE TABLE categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    name VARCHAR(80) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_categories_public_id (public_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE collections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(80) NOT NULL,
    name VARCHAR(120) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'Draft',
    position INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_collections_public_id (public_id),
    CONSTRAINT ck_collections_status CHECK (status IN ('Live','Scheduled','Draft'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE products (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(80) NOT NULL,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(80) NOT NULL DEFAULT '',
    item_ref VARCHAR(40) NULL,
    description TEXT NULL,
    story TEXT NULL,
    fabric VARCHAR(255) NOT NULL DEFAULT '',
    care VARCHAR(255) NOT NULL DEFAULT '',
    price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    compare_at_price DECIMAL(12,2) NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    color VARCHAR(60) NOT NULL DEFAULT '',
    badge VARCHAR(40) NULL,
    image_position VARCHAR(16) NOT NULL DEFAULT 'top-left',
    audience VARCHAR(16) NOT NULL DEFAULT 'unisex',
    collection_slug VARCHAR(80) NOT NULL DEFAULT '',
    is_new TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'Draft',
    tax_note VARCHAR(120) NULL,
    position INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_products_slug (public_id),
    KEY ix_products_status (status, deleted_at),
    KEY ix_products_audience (audience),
    KEY ix_products_collection (collection_slug),
    KEY ix_products_item_ref (item_ref),
    CONSTRAINT ck_products_image_position CHECK (image_position IN ('top-left','top-right','bottom-left','bottom-right')),
    CONSTRAINT ck_products_audience CHECK (audience IN ('men','women','unisex')),
    CONSTRAINT ck_products_status CHECK (status IN ('Published','Scheduled','Draft'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE product_variants (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    size VARCHAR(8) NOT NULL,
    color VARCHAR(60) NOT NULL DEFAULT '',
    color_hex CHAR(7) NOT NULL DEFAULT '#000000',
    material VARCHAR(120) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'Active',
    max_per_order TINYINT UNSIGNED NOT NULL DEFAULT 3,
    position INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    deleted_at DATETIME(6) NULL,
    -- NULLs are distinct in a UNIQUE index, so soft-deleted rows would slip past
    -- (product_id, size, deleted_at). This generated key is NULL once the row is
    -- deleted and therefore only ever constrains live variants.
    live_key VARCHAR(64) GENERATED ALWAYS AS (IF(deleted_at IS NULL, CONCAT(product_id, '|', size), NULL)) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_variants_sku (public_id),
    UNIQUE KEY uq_variants_live_size (live_key),
    CONSTRAINT ck_variants_status CHECK (status IN ('Active','Low','Out','Archived')),
    CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE collection_products (
    collection_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    position INT NOT NULL DEFAULT 0,
    PRIMARY KEY (collection_id, product_id),
    KEY ix_collection_products_product (product_id),
    CONSTRAINT fk_collection_products_collection FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE,
    CONSTRAINT fk_collection_products_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Ledger.
CREATE TABLE product_price_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id BIGINT UNSIGNED NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    compare_at_price DECIMAL(12,2) NULL,
    changed_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_price_history_product (product_id, created_at),
    CONSTRAINT fk_price_history_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
    CONSTRAINT fk_price_history_actor FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE product_rating_summaries (
    product_id BIGINT UNSIGNED NOT NULL,
    review_count INT UNSIGNED NOT NULL DEFAULT 0,
    rating_avg DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    refreshed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (product_id),
    CONSTRAINT fk_rating_summaries_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Ledger.
CREATE TABLE search_queries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    q VARCHAR(190) NOT NULL,
    results INT UNSIGNED NOT NULL DEFAULT 0,
    session_kind VARCHAR(16) NOT NULL DEFAULT 'guest',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_search_queries_q (q, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};
