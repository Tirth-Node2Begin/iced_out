-- Spec §6.5 Orders & payments. public_id is the pre-rendered slot the static
-- export can address (ord-local-07); `number` is the human order number
-- (IO-2026-1049). Both are UI-visible and both are unique.

CREATE TABLE orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    number VARCHAR(40) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'Processing',
    console_state VARCHAR(16) NOT NULL DEFAULT 'Placed',
    cancelled_by VARCHAR(16) NULL,
    contact_name VARCHAR(120) NOT NULL DEFAULT '',
    contact_email VARCHAR(190) NOT NULL DEFAULT '',
    contact_mobile VARCHAR(20) NOT NULL DEFAULT '',
    addr_line VARCHAR(255) NOT NULL DEFAULT '',
    addr_city VARCHAR(80) NOT NULL DEFAULT '',
    addr_state VARCHAR(80) NOT NULL DEFAULT '',
    addr_postal VARCHAR(10) NOT NULL DEFAULT '',
    delivery_label VARCHAR(80) NOT NULL DEFAULT '',
    delivery_estimate VARCHAR(40) NOT NULL DEFAULT '',
    delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    coupon_code VARCHAR(40) NULL,
    items_summary TEXT NULL,
    cancellation_eligible TINYINT(1) NOT NULL DEFAULT 1,
    placed_at DATETIME(6) NOT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_orders_public_id (public_id),
    UNIQUE KEY uq_orders_number (number),
    KEY ix_orders_user (user_id, placed_at),
    KEY ix_orders_status (status),
    KEY ix_orders_console_state (console_state, placed_at),
    CONSTRAINT ck_orders_status CHECK (status IN ('Processing','Delivered','Payment failed','Cancelled')),
    CONSTRAINT ck_orders_console_state CHECK (console_state IN ('Placed','Confirmed','Cancelled')),
    CONSTRAINT ck_orders_cancelled_by CHECK (cancelled_by IS NULL OR cancelled_by IN ('Store','Customer')),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Frozen snapshots: name, variant label and price are copied at place-order so
-- a later catalogue edit never rewrites history.
CREATE TABLE order_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    line_public_id VARCHAR(40) NOT NULL,
    product_id BIGINT UNSIGNED NULL,
    name VARCHAR(160) NOT NULL,
    variant_label VARCHAR(120) NOT NULL DEFAULT '',
    size VARCHAR(8) NOT NULL DEFAULT '',
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    line_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    return_eligible TINYINT(1) NOT NULL DEFAULT 1,
    returned_qty INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_order_items_line (order_id, line_public_id),
    KEY ix_order_items_product (product_id),
    CONSTRAINT ck_order_items_returned CHECK (returned_qty <= quantity),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Ledger. Drives both projections of spec §9.3 from one truth.
CREATE TABLE order_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    seq INT UNSIGNED NOT NULL,
    from_status VARCHAR(24) NOT NULL DEFAULT '',
    to_status VARCHAR(24) NOT NULL,
    actor_type VARCHAR(16) NOT NULL DEFAULT 'system',
    actor_id BIGINT UNSIGNED NULL,
    note VARCHAR(255) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_order_status_history_seq (order_id, seq),
    CONSTRAINT ck_order_status_history_actor CHECK (actor_type IN ('customer','staff','system')),
    CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE order_cancellation_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(120) NOT NULL,
    note VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'Received',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_order_cancellation_order (order_id, status),
    CONSTRAINT ck_order_cancellation_status CHECK (status IN ('Received','Approved','Rejected')),
    CONSTRAINT fk_order_cancellation_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- No PAN/CVV column exists anywhere by design (SAQ-A, spec §14): only gateway
-- references and display labels such as "Visa ending 1111".
CREATE TABLE payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    customer_masked VARCHAR(120) NOT NULL DEFAULT '',
    gateway VARCHAR(24) NOT NULL DEFAULT 'Razorpay',
    method VARCHAR(40) NOT NULL DEFAULT '',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(16) NOT NULL DEFAULT 'Due',
    note VARCHAR(255) NOT NULL DEFAULT '',
    reference VARCHAR(120) NOT NULL DEFAULT '',
    razorpay_order_id VARCHAR(120) NULL,
    signature_verified TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_payments_public_id (public_id),
    KEY ix_payments_order (order_id),
    KEY ix_payments_status (status, created_at),
    KEY ix_payments_reference (reference),
    KEY ix_payments_razorpay_order (razorpay_order_id),
    CONSTRAINT ck_payments_status CHECK (status IN ('Captured','Due','Failed','Refunded')),
    CONSTRAINT ck_payments_gateway CHECK (gateway IN ('Razorpay','Stripe','Cashfree','On device','Courier','Store credit')),
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Ledger. Every gateway conversation, request and response, in order.
CREATE TABLE payment_attempts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    payment_id BIGINT UNSIGNED NOT NULL,
    operation VARCHAR(16) NOT NULL,
    request_json MEDIUMTEXT NULL,
    response_json MEDIUMTEXT NULL,
    outcome VARCHAR(24) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY ix_payment_attempts_payment (payment_id, created_at),
    CONSTRAINT ck_payment_attempts_operation CHECK (operation IN ('initiate','verify','webhook','capture','refund','check')),
    CONSTRAINT fk_payment_attempts_payment FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE refunds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    payment_id BIGINT UNSIGNED NOT NULL,
    order_number VARCHAR(40) NOT NULL DEFAULT '',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    reason VARCHAR(40) NOT NULL DEFAULT 'Goodwill',
    status VARCHAR(16) NOT NULL DEFAULT 'Requested',
    gateway_refund_id VARCHAR(120) NULL,
    requested_by BIGINT UNSIGNED NULL,
    approved_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_refunds_public_id (public_id),
    KEY ix_refunds_payment (payment_id),
    KEY ix_refunds_status (status),
    CONSTRAINT ck_refunds_status CHECK (status IN ('Requested','Processing','Succeeded','Failed')),
    CONSTRAINT ck_refunds_reason CHECK (reason IN ('Return approved','Order cancelled','Payment mismatch','Goodwill')),
    CONSTRAINT fk_refunds_payment FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE CASCADE,
    CONSTRAINT fk_refunds_requested_by FOREIGN KEY (requested_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_refunds_approved_by FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE payouts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    gateway VARCHAR(24) NOT NULL DEFAULT 'Razorpay',
    period_label VARCHAR(60) NOT NULL DEFAULT '',
    gross DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    fees DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(16) NOT NULL DEFAULT 'Pending',
    paid_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_payouts_public_id (public_id),
    CONSTRAINT ck_payouts_status CHECK (status IN ('Pending','Paid'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE idempotency_keys (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    scope VARCHAR(120) NOT NULL,
    endpoint VARCHAR(160) NOT NULL,
    key_hash BINARY(32) NOT NULL,
    request_hash BINARY(32) NOT NULL,
    response_status SMALLINT UNSIGNED NOT NULL DEFAULT 200,
    response_body MEDIUMTEXT NULL,
    expires_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_idempotency_keys (scope, endpoint, key_hash),
    KEY ix_idempotency_keys_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE webhook_inbox (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider VARCHAR(40) NOT NULL,
    event_id VARCHAR(190) NOT NULL,
    signature_ok TINYINT(1) NOT NULL DEFAULT 0,
    payload MEDIUMTEXT NULL,
    processed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_webhook_inbox_event (provider, event_id),
    KEY ix_webhook_inbox_unprocessed (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Deferred constraints from 0003/0004, now that orders and order_items exist.
ALTER TABLE inventory_reservations
    ADD CONSTRAINT fk_inventory_reservations_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_inventory_reservations_order_item FOREIGN KEY (order_item_id) REFERENCES order_items (id) ON DELETE CASCADE;

ALTER TABLE coupon_redemptions
    ADD CONSTRAINT fk_coupon_redemptions_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE;
