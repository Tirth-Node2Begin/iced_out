-- Spec §6.4 Cart, coupons, vouchers. Guests never get a server cart (hard rule,
-- spec §8.8) — the browser keeps the guest bag and login merges it.

CREATE TABLE carts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    coupon_code VARCHAR(40) NULL,
    version INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    -- One ACTIVE cart per customer, enforced by the DB rather than by a read-then-write.
    active_key VARCHAR(32) GENERATED ALWAYS AS (IF(status = 'ACTIVE', CONCAT('u', user_id), NULL)) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_carts_active (active_key),
    KEY ix_carts_user (user_id, status),
    CONSTRAINT ck_carts_status CHECK (status IN ('ACTIVE','CONVERTED','ABANDONED')),
    CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE cart_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    cart_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    variant_size VARCHAR(8) NOT NULL,
    quantity TINYINT UNSIGNED NOT NULL DEFAULT 1,
    price_at_add DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_cart_items_line (cart_id, product_id, variant_size),
    KEY ix_cart_items_product (product_id),
    CONSTRAINT ck_cart_items_quantity CHECK (quantity BETWEEN 1 AND 10),
    CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts (id) ON DELETE CASCADE,
    CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Mirrors the frontend CheckoutDraft shape one-to-one.
CREATE TABLE checkout_drafts (
    user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL DEFAULT '',
    email VARCHAR(190) NOT NULL DEFAULT '',
    mobile VARCHAR(20) NOT NULL DEFAULT '',
    address VARCHAR(255) NOT NULL DEFAULT '',
    city VARCHAR(80) NOT NULL DEFAULT '',
    state VARCHAR(80) NOT NULL DEFAULT '',
    postal_code VARCHAR(10) NOT NULL DEFAULT '',
    delivery_method VARCHAR(16) NOT NULL DEFAULT 'standard',
    payment_method VARCHAR(16) NOT NULL DEFAULT 'cod',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id),
    CONSTRAINT ck_checkout_drafts_delivery CHECK (delivery_method IN ('standard','express')),
    CONSTRAINT ck_checkout_drafts_payment CHECK (payment_method IN ('cod','card','razorpay')),
    CONSTRAINT fk_checkout_drafts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE coupons (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(40) NOT NULL,
    label VARCHAR(120) NOT NULL DEFAULT '',
    kind VARCHAR(8) NOT NULL DEFAULT 'percent',
    value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    min_subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    active TINYINT(1) NOT NULL DEFAULT 1,
    starts_at DATETIME(6) NULL,
    ends_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_coupons_code (code),
    CONSTRAINT ck_coupons_kind CHECK (kind IN ('percent','amount'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

CREATE TABLE vouchers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(40) NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    return_public_id VARCHAR(40) NOT NULL DEFAULT '',
    reason VARCHAR(160) NOT NULL DEFAULT '',
    customer_name VARCHAR(120) NOT NULL DEFAULT '',
    customer_user_id BIGINT UNSIGNED NULL,
    issued_on DATE NOT NULL,
    expires_on DATE NOT NULL,
    claimed_on DATE NULL,
    claimed_order VARCHAR(40) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    -- Settling a return issues its voucher idempotently: hand-issued vouchers
    -- carry an empty return id (many allowed), return-issued ones exactly one.
    return_key VARCHAR(40) GENERATED ALWAYS AS (NULLIF(return_public_id, '')) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vouchers_code (code),
    UNIQUE KEY uq_vouchers_return (return_key),
    KEY ix_vouchers_customer (customer_user_id, claimed_on),
    CONSTRAINT ck_vouchers_window CHECK (expires_on > issued_on),
    CONSTRAINT fk_vouchers_customer FOREIGN KEY (customer_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};

-- Ledger. order_id FK is attached in 0005. UQ(order_id) enforces "one coupon OR
-- voucher per order" (spec §9.7) at the database level.
CREATE TABLE coupon_redemptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    coupon_id BIGINT UNSIGNED NULL,
    voucher_id BIGINT UNSIGNED NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_coupon_redemptions_order (order_id),
    KEY ix_coupon_redemptions_coupon (coupon_id),
    KEY ix_coupon_redemptions_voucher (voucher_id),
    CONSTRAINT ck_coupon_redemptions_source CHECK (coupon_id IS NOT NULL OR voucher_id IS NOT NULL),
    CONSTRAINT fk_coupon_redemptions_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE SET NULL,
    CONSTRAINT fk_coupon_redemptions_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};
