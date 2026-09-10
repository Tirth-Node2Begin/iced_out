-- Payment intents — the server's own record that a gateway payment happened.
--
-- WHAT THIS CLOSES.
--
-- `PlaceOrderService` used to read the payment outcome out of the REQUEST BODY:
--
--     $outcome = (string) ($input['payment']['outcome'] ?? 'due');
--
-- and wrote a Captured/Razorpay row into `payments` on the strength of that one
-- word. The signature check existed, was correct, and used hash_equals — but its
-- result was handed back to the browser and then forgotten. Nothing tied a
-- `razorpay_payment_id` to an order, and `payments.reference` was free text the
-- client supplied. Three consequences, all reachable with curl and a valid
-- session cookie:
--
--   1. POST /checkout/orders with payment.outcome="captured" created a real,
--      confirmed, stock-reserving order for nothing.
--   2. One payment id could back any number of orders.
--   3. The Razorpay order could be created for ₹1 and the order placed for
--      ₹50,000 — nothing compared the two figures.
--
-- This table is the missing middle. A row is written when the gateway order is
-- created, promoted to VERIFIED only by a server-side signature check, and
-- CONSUMED by exactly one order under a row lock.
--
-- THE TWO INDEXES ARE THE SECURITY CONTROLS, not merely lookups:
--
--   uq_payment_intents_payment   one razorpay_payment_id backs ONE order, ever.
--                                A replayed payment id fails at the index, not
--                                at a check somebody could forget to write.
--   uq_payment_intents_order     one intent per gateway order, so the verify
--                                call is idempotent by construction.
--
-- WHY `amount_paise` IS HERE AND WHY IT IS CHECKED AT CONSUMPTION.
--
-- The amount the browser asks for when it opens the gateway is not trusted, and
-- deliberately is not re-priced at creation time either — re-pricing there would
-- need the whole bag in a request that carries only a figure, which would be a
-- contract change. Instead the figure is RECORDED, and `PlaceOrderService`
-- refuses to consume an intent whose amount is not exactly what the order's
-- gateway share came to when priced from the catalogue. A client that asks for
-- ₹1 gets an intent for ₹1 and an order that will not accept it.
--
-- `quote_hash` is not read by the application yet. It is written so that a
-- future reconciliation can answer "was this intent created against the same bag
-- that was eventually ordered", which the amount alone cannot.
--
-- NOTHING EXISTING IS ALTERED. No column is dropped, no type changed, no foreign
-- key added to `orders` — an intent may legitimately outlive an order that was
-- never placed, and a FK would make the sweep that expires them a cascade.
--
-- MySQL 8 / MariaDB: no CHECK constraint and no functional index here, which are
-- the two constructs this schema has already been bitten by across the two
-- servers. `status` is a plain VARCHAR validated in PHP.

CREATE TABLE payment_intents (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    -- The gateway's own ids. `razorpay_payment_id` is NULL until the signature
    -- has been checked, which is why the unique index tolerates nulls: MySQL
    -- allows any number of NULLs in a UNIQUE column, so every unverified intent
    -- coexists and only the verified ones compete for uniqueness.
    razorpay_order_id   VARCHAR(64)     NOT NULL,
    razorpay_payment_id VARCHAR(64)     NULL,

    -- Whose intent this is. Every read is scoped to it, so one customer can
    -- never consume another's verified payment.
    user_id             BIGINT UNSIGNED NOT NULL,

    -- What the gateway was asked for, in the gateway's own unit.
    amount_paise        BIGINT UNSIGNED NOT NULL,
    currency            CHAR(3)         NOT NULL DEFAULT 'INR',

    -- sha256 of the priced bag at creation time. Written, not yet read.
    quote_hash          CHAR(64)        NOT NULL DEFAULT '',

    -- CREATED → VERIFIED → CONSUMED, or CREATED → FAILED/EXPIRED.
    -- CONSUMED is terminal and is what makes double-spend impossible.
    status              VARCHAR(16)     NOT NULL DEFAULT 'CREATED',

    -- Set when an order takes it. Not a foreign key — see the note above.
    order_id            BIGINT UNSIGNED NULL,

    -- What the gateway itself said when asked, for the console's reconciliation
    -- screen. Never trusted for a decision; the signature is.
    gateway_status      VARCHAR(24)     NOT NULL DEFAULT '',
    gateway_method      VARCHAR(40)     NOT NULL DEFAULT '',

    verified_at         DATETIME(6)     NULL,
    consumed_at         DATETIME(6)     NULL,

    -- A verified payment nobody used goes stale. Fifteen minutes is longer than
    -- any honest gap between paying and the order landing, and short enough that
    -- a stolen session cannot bank one for later.
    expires_at          DATETIME(6)     NOT NULL,
    created_at          DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_intents_order   (razorpay_order_id),
    UNIQUE KEY uq_payment_intents_payment (razorpay_payment_id),
    KEY ix_payment_intents_claim (user_id, status, expires_at),
    KEY ix_payment_intents_sweep (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};
