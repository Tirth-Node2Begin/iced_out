-- The saved list, spec §8.7 — the one register the cart's neighbours were all
-- missing.
--
-- `carts` and `cart_items` have existed since 0004 and were never read by
-- anything: the bag lived in the browser's localStorage on the web and in a
-- Hive box on the phone, so two clients signed into the SAME account held two
-- different bags and neither could see the other. The API that closes that
-- (`/me/cart`, spec §8.8) needs no schema of its own — 0004 already shaped it
-- correctly. The wishlist had no table at all, so it gets one here.
--
-- WHAT IS DELIBERATELY NOT HERE: a `variant_color` column on `cart_items`.
-- It looks like it is missing, because the phone's bag line carries a colour
-- and the cart's unique key is (cart_id, product_id, variant_size). It is not:
-- `product_variants.uq_variants_live_size` is UNIQUE on (product_id, size) for
-- every live row, so a size names exactly one colour and the colour is DERIVED
-- rather than stored. A copy of it here could only ever drift from the variant
-- an operator renames.
--
-- `product_ref` is an OPAQUE STRING, not a foreign key to `products`, and that
-- is the spec's own rule (§8.7): the storefront saves real product slugs
-- (`afterdark-hoodie`) AND the gender listing-tile ids (`m01`…`w20`) that only
-- resolve client-side. A foreign key would refuse half of what the UI legally
-- saves, and validating against the catalogue here would silently drop the
-- other half. Resolution stays in `saved-items.ts`, which already discards ids
-- it cannot resolve.
CREATE TABLE wishlist_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    product_ref VARCHAR(64) NOT NULL,
    -- The order the shopper put them in. Saved lists read newest-first
    -- everywhere in the UI, and a list that reshuffles itself between two
    -- devices reads as data loss even when nothing was lost.
    position INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    -- Saving the same piece twice is a no-op, enforced here rather than by a
    -- read-then-write: the phone and the browser can both press save on the
    -- same product in the same second.
    UNIQUE KEY uq_wishlist_items_entry (user_id, product_ref),
    KEY ix_wishlist_items_user (user_id, position, id),
    CONSTRAINT fk_wishlist_items_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};
