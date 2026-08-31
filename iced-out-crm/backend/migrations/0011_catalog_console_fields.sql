-- The console catalogue register carries three things the storefront shape does
-- not, and they are genuinely different facts rather than the same one renamed:
--
--   sku_code      the three-letter stock code every variant SKU is built from
--                 (ADH → ADH-WSB-M). Minted once and then held, so a rename
--                 never re-labels the thing already in the box.
--   listing_size  the ONE size a published listing claims from its stock item
--                 (spec §9.6 listing room).
--   category_id   the console's taxonomy (Outerwear, Essentials, Bottoms).
--                 `products.category` stays the storefront's descriptor line
--                 ("Heavyweight fleece") — the two are not interchangeable.

ALTER TABLE products
    ADD COLUMN sku_code VARCHAR(8) NOT NULL DEFAULT '' AFTER item_ref,
    ADD COLUMN listing_size VARCHAR(8) NOT NULL DEFAULT '' AFTER sku_code,
    ADD COLUMN category_id BIGINT UNSIGNED NULL AFTER category;

ALTER TABLE products
    ADD KEY ix_products_sku_code (sku_code),
    ADD CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL;
