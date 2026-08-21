-- Spec §6.7 Returns, reviews, support.

CREATE TABLE return_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    order_number VARCHAR(40) NOT NULL DEFAULT '',
    user_id BIGINT UNSIGNED NULL,
    customer_name VARCHAR(120) NOT NULL DEFAULT '',
    item_label VARCHAR(160) NOT NULL DEFAULT '',
    order_item_id BIGINT UNSIGNED NULL,
    reason VARCHAR(40) NOT NULL,
    outcome VARCHAR(16) NOT NULL DEFAULT 'Voucher',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    replacement_product_id BIGINT UNSIGNED NULL,
    replacement_label VARCHAR(160) NOT NULL DEFAULT '',
    state VARCHAR(24) NOT NULL DEFAULT 'New',
    customer_status VARCHAR(32) NOT NULL DEFAULT 'Pickup scheduled',
    destination VARCHAR(120) NOT NULL DEFAULT '',
    reference VARCHAR(60) NOT NULL DEFAULT '',
    pickup_slot VARCHAR(80) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_return_requests_public_id (public_id),
    KEY ix_return_requests_state (state),
    KEY ix_return_requests_user (user_id, created_at),
    KEY ix_return_requests_order (order_number),
    CONSTRAINT ck_return_requests_reason CHECK (reason IN ('Size / fit','Changed mind','Quality concern','Wrong item','Damaged in transit')),
    CONSTRAINT ck_return_requests_outcome CHECK (outcome IN ('Voucher','Exchange')),
    CONSTRAINT ck_return_requests_state CHECK (state IN ('New','Awaiting payment','Approved','Completed','Rejected')),
    CONSTRAINT ck_return_requests_customer_status CHECK (customer_status IN ('Pickup scheduled','Voucher issued','Exchange on its way')),
    CONSTRAINT fk_return_requests_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_return_requests_order_item FOREIGN KEY (order_item_id) REFERENCES order_items (id) ON DELETE SET NULL,
    CONSTRAINT fk_return_requests_replacement FOREIGN KEY (replacement_product_id) REFERENCES products (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Ledger.
CREATE TABLE return_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    return_id BIGINT UNSIGNED NOT NULL,
    from_state VARCHAR(24) NOT NULL DEFAULT '',
    to_state VARCHAR(24) NOT NULL,
    actor_id BIGINT UNSIGNED NULL,
    note VARCHAR(255) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_return_status_history_return (return_id, created_at),
    CONSTRAINT fk_return_status_history_return FOREIGN KEY (return_id) REFERENCES return_requests (id) ON DELETE CASCADE,
    CONSTRAINT fk_return_status_history_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE reviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    product_name VARCHAR(160) NOT NULL DEFAULT '',
    product_id BIGINT UNSIGNED NULL,
    rating TINYINT UNSIGNED NOT NULL,
    customer_name VARCHAR(120) NOT NULL DEFAULT '',
    user_id BIGINT UNSIGNED NULL,
    headline VARCHAR(160) NOT NULL DEFAULT '',
    body TEXT NULL,
    fit VARCHAR(40) NULL,
    submitted_label VARCHAR(40) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'Pending',
    origin VARCHAR(16) NOT NULL DEFAULT 'Customer',
    order_number VARCHAR(40) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    -- One review per ordered product, but only when both sides are known.
    order_product_key VARCHAR(120) GENERATED ALWAYS AS (
        IF(order_number IS NOT NULL AND product_id IS NOT NULL, CONCAT(order_number, '#', product_id), NULL)
    ) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_reviews_public_id (public_id),
    UNIQUE KEY uq_reviews_order_product (order_product_key),
    KEY ix_reviews_status (status, created_at),
    KEY ix_reviews_product (product_id, status),
    CONSTRAINT ck_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT ck_reviews_status CHECK (status IN ('Pending','Approved','Rejected')),
    CONSTRAINT ck_reviews_origin CHECK (origin IN ('Customer','Console')),
    CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL,
    CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Ledger.
CREATE TABLE review_moderation_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    review_id BIGINT UNSIGNED NOT NULL,
    from_status VARCHAR(16) NOT NULL DEFAULT '',
    to_status VARCHAR(16) NOT NULL,
    actor_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_review_moderation_review (review_id, created_at),
    CONSTRAINT fk_review_moderation_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE,
    CONSTRAINT fk_review_moderation_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE support_queries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    customer_name VARCHAR(120) NOT NULL DEFAULT '',
    email VARCHAR(190) NOT NULL DEFAULT '',
    user_id BIGINT UNSIGNED NULL,
    topic VARCHAR(40) NOT NULL,
    order_number VARCHAR(40) NOT NULL DEFAULT 'No order',
    message TEXT NOT NULL,
    sent_label VARCHAR(60) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'Open',
    reply TEXT NOT NULL,
    resolved_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_support_queries_public_id (public_id),
    KEY ix_support_queries_status (status, created_at),
    KEY ix_support_queries_user (user_id),
    CONSTRAINT ck_support_queries_topic CHECK (topic IN ('Delivery','Return or exchange','Payment or refund','Product and fit','Something else')),
    CONSTRAINT ck_support_queries_status CHECK (status IN ('Open','Resolved')),
    CONSTRAINT fk_support_queries_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_support_queries_resolver FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Ledger.
CREATE TABLE support_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    query_id BIGINT UNSIGNED NOT NULL,
    from_status VARCHAR(16) NOT NULL DEFAULT '',
    to_status VARCHAR(16) NOT NULL,
    actor_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_support_status_history_query (query_id, created_at),
    CONSTRAINT fk_support_status_history_query FOREIGN KEY (query_id) REFERENCES support_queries (id) ON DELETE CASCADE,
    CONSTRAINT fk_support_status_history_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE faqs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    question VARCHAR(255) NOT NULL,
    answer TEXT NOT NULL,
    position INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_faqs_active (is_active, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};
