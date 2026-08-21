-- A hero garment can be a product you have already photographed.
--
-- 0023 gave the hero one way in: upload a frame. That is right for art
-- direction, and wrong for the common case — the piece leading the home page is
-- almost always a piece already in the catalogue, with a photograph already
-- uploaded against it. Making an operator find that file again and upload it a
-- second time is asking them to do work the store has already done, and it
-- creates a second copy that can drift out of step with the listing.
--
-- So a slide now declares WHERE its frame comes from:
--
--   Upload   the operator's own file, claimed by the slide (0023's behaviour)
--   Product  the product's own photo, followed rather than copied
--
-- The difference is not cosmetic. A `Product` slide does not snapshot an id at
-- create time and keep it forever: `GhostCutoutService` re-reads
-- `products.image_media_id` every time it runs, so re-shooting a piece in the
-- catalogue and pressing Cut again on its hero card is all it takes for the
-- home page to catch up. `source_media_id` still records the frame the CURRENT
-- cutout was made from, which is what lets the console say when the two have
-- diverged.
--
-- Existing rows are `Upload`, which is what they are.

ALTER TABLE home_hero_slides
    ADD COLUMN source_kind VARCHAR(16) NOT NULL DEFAULT 'Upload' AFTER product_id;

-- A state the application branches on — the console draws a different form for
-- each and the cutout resolves its source differently — so it keeps its CHECK,
-- per the rule 0013 set out for what stays in DDL and what becomes a setting.
ALTER TABLE home_hero_slides
    ADD CONSTRAINT ck_home_hero_slides_source_kind
        CHECK (source_kind IN ('Upload', 'Product'));
