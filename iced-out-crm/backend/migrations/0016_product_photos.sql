-- Products get a photo, the same way stock items already do.
--
-- `products` carried `image_position` and nothing else: a quadrant of one sprite
-- sheet shipped with the frontend, chosen from four fixed values. That is a
-- decoration, not a product photo — a shop cannot list a garment nobody can
-- photograph, and an operator adding a piece through the console had no way to
-- show it.
--
-- The image is a `media_assets` row like every other upload, not a path column on
-- the product: the asset carries its own mime, size, dimensions and checksum, it
-- is served through one guarded endpoint, and clearing the photo is a nulled
-- foreign key rather than an orphaned file nobody remembers writing. This is
-- exactly what 0014 did for `stock_items`, and `media_assets.owner_type` has
-- allowed 'product' since it was created.
--
-- `image_position` STAYS. It is the fallback: a product with no photo uploaded yet
-- still renders as its sprite quadrant rather than as a hole in the grid, which
-- matters because the whole seeded catalogue starts that way.

ALTER TABLE products
    ADD COLUMN image_media_id BIGINT UNSIGNED NULL AFTER image_position;

ALTER TABLE products
    ADD CONSTRAINT fk_products_image FOREIGN KEY (image_media_id) REFERENCES media_assets (id) ON DELETE SET NULL;
