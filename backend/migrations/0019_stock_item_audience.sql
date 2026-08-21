-- A stock item says who it is cut for.
--
-- `products.audience` has always existed — it is what decides whether a piece
-- appears on /new-drop, on /women, or on both — but the stock item behind it did
-- not carry the fact. So an operator taking a garment into the warehouse could
-- not say it was a women's coat; the answer only appeared later, when somebody
-- listed it, and the listing form never asked either. Every product created
-- through the console came out `unisex` by default.
--
-- The column belongs on the item because that is where the garment is first
-- described: its category, its type, its sizes and now who wears it are all facts
-- about the thing in the box, not about the decision to sell it.
--
-- `unisex` is the default rather than a required answer. An item taken in during
-- a busy afternoon should not be blocked on a question with a sensible neutral
-- answer, and unisex shows on both pages — the widest, safest reading.

ALTER TABLE stock_items
    ADD COLUMN audience VARCHAR(16) NOT NULL DEFAULT 'unisex' AFTER category;

ALTER TABLE stock_items
    ADD CONSTRAINT ck_stock_items_audience CHECK (audience IN ('men', 'women', 'unisex'));

-- Backfilled from what is already listed from each item, so an install that has
-- been trading does not have thirty-two items suddenly claiming to be unisex.
-- Where an item carries more than one product they agree in practice (a product
-- is listed from one item), and MIN picks deterministically if they ever do not.
UPDATE stock_items si
   SET si.audience = COALESCE(
         (SELECT MIN(p.audience)
            FROM products p
           WHERE p.item_ref = si.public_id AND p.deleted_at IS NULL),
         'unisex'
       );
