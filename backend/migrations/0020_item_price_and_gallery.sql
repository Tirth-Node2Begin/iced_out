-- A stock item carries its price and its photographs.
--
-- Both facts already existed, but only downstream of the decision to sell: the
-- price was typed into the catalogue form and the photo was uploaded there, so
-- an operator taking a garment into the warehouse described everything about it
-- EXCEPT what it costs and what it looks like — and then had to describe those
-- two again, from memory, on a different screen.
--
-- They belong on the item for the same reason `audience` does (0019): the item
-- is where a garment is described. What it sells for and how it photographs are
-- facts about the piece in the box, not about the listing. A product listed from
-- it inherits both, which is what lets the console offer "publish this straight
-- to the shop" at the moment the stock arrives.

ALTER TABLE stock_items
    ADD COLUMN price DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER sizes_csv;

-- Backfilled from whatever is already listed from each item, so an install that
-- has been trading does not have every item suddenly claiming to be free. A
-- product is listed from one item, so MIN only ever picks between listings that
-- agree; it is there to be deterministic if they ever do not.
UPDATE stock_items si
   SET si.price = COALESCE(
         (SELECT MIN(p.price)
            FROM products p
           WHERE p.item_ref = si.public_id AND p.deleted_at IS NULL),
         0.00
       );

-- The secondary shots.
--
-- `stock_items.image_media_id` (0014) stays exactly what it is: the PRIMARY, the
-- one frame that stands for the piece on a card, in the bag and in the register.
-- This table is everything else — the other angles, the detail crops, the shot
-- on a body — in the order the operator arranged them. Splitting it that way
-- rather than moving the primary in here means every surface already reading
-- `image` goes on working untouched, and the gallery is purely additive.
--
-- Rows are ordered by `position` and are not per-size: a piece photographs the
-- same whichever waist it is cut to, so these hang off the item and every
-- product listed from it shows the same run.
CREATE TABLE stock_item_photos (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    stock_item_id BIGINT UNSIGNED NOT NULL,
    media_id BIGINT UNSIGNED NOT NULL,
    position INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    -- One asset appears once in one item's gallery. Re-uploading the same file
    -- makes a new asset, so this only ever catches the same URL submitted twice.
    UNIQUE KEY uq_stock_item_photos_asset (stock_item_id, media_id),
    KEY ix_stock_item_photos_order (stock_item_id, position),
    CONSTRAINT fk_stock_item_photos_item FOREIGN KEY (stock_item_id) REFERENCES stock_items (id) ON DELETE CASCADE,
    CONSTRAINT fk_stock_item_photos_media FOREIGN KEY (media_id) REFERENCES media_assets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};
