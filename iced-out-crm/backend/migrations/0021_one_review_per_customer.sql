-- One review per customer per product, enforced by the database.
--
-- `uq_reviews_order_product` (0007) already said "one review per ORDERED
-- product" — keyed on `(order_number, product_id)`, and null for any review that
-- did not come in against an order. Almost nothing satisfies it: a shopper
-- writing from a product page has no order number to hand, so the key was null
-- and the constraint stood aside. The same person could review the same piece
-- as often as they liked, and every one of them would sit in the moderation
-- queue as a separate record.
--
-- The rule the shop actually wants is about the PERSON, not the order: one
-- customer, one product, one opinion. So this is keyed on `(user_id,
-- product_id)`, which is the pair that identifies "this shopper on this piece"
-- however they reached the form.
--
-- Null for a review missing either half, because NULLs are distinct in a UNIQUE
-- index and that is exactly the behaviour wanted here:
--
--   · a console-written review has no `user_id` — an operator transcribing
--     feedback from three different people about one product must not be
--     blocked by the second one;
--   · a review whose product has been deleted has no `product_id`, and holding
--     a slot against a piece that no longer exists helps nobody.
--
-- The state is deliberately NOT part of the key. A rejected review still counts:
-- letting somebody rewrite until moderation likes the answer is the loophole
-- this is here to close, and the storefront tells them their review is being
-- looked at rather than pretending it was never received.

ALTER TABLE reviews
    ADD COLUMN customer_product_key VARCHAR(120)
        GENERATED ALWAYS AS (
            IF(user_id IS NOT NULL AND product_id IS NOT NULL, CONCAT(user_id, '#', product_id), NULL)
        ) STORED;

ALTER TABLE reviews
    ADD UNIQUE KEY uq_reviews_customer_product (customer_product_key);
