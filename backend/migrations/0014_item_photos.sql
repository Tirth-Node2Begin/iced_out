-- Stock items get a photo.
--
-- The image is a `media_assets` row like every other upload, not a path column
-- on the item: the asset carries its own mime, size, dimensions and checksum,
-- it is served through one guarded endpoint, and clearing the photo is a
-- nulled foreign key rather than an orphaned file nobody remembers writing.

ALTER TABLE media_assets DROP CONSTRAINT ck_media_owner_type;

ALTER TABLE media_assets
    ADD CONSTRAINT ck_media_owner_type
        CHECK (owner_type IN ('product', 'review', 'profile', 'cms', 'shipment', 'stock_item', 'variant'));

ALTER TABLE stock_items
    ADD COLUMN image_media_id BIGINT UNSIGNED NULL AFTER sizes_csv;

ALTER TABLE stock_items
    ADD CONSTRAINT fk_stock_items_image FOREIGN KEY (image_media_id) REFERENCES media_assets (id) ON DELETE SET NULL;
