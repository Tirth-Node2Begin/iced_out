-- The garments that fly through the home page hero.
--
-- The hero used to be three PNGs compiled into the frontend bundle
-- (`HERO_PRODUCTS` in `fashion-hero.tsx`), which meant the first thing anybody
-- sees of this shop was the one thing an operator could not change. Deciding
-- which pieces lead the site is merchandising, and merchandising is data.
--
-- A slide is a GARMENT SHOWN ON A GHOST MANNEQUIN — no model, no backdrop, just
-- the cloth floating. That look is why two media ids hang off one row rather
-- than one:
--
--   source_media_id  what the operator uploaded, exactly as they shot it
--   cutout_media_id  the same frame with its background removed
--
-- The source is kept because the cutout is derived and derived things must be
-- re-derivable: remove.bg can be down, an API key can lapse, a later cutout can
-- come out better than an earlier one. Throwing the original away would make
-- every one of those a re-upload.
--
-- `cutout_state` is a state machine the application branches on — the console
-- shows a retry for Failed, the storefront skips anything not Ready — so it
-- keeps its CHECK, per the rule 0013 set out.

CREATE TABLE home_hero_slides (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    -- Which piece this garment is. Nullable so a slide can be pure art
    -- direction — a look with nothing to buy behind it yet — and SET NULL on
    -- delete so retiring a product empties the link instead of tearing the
    -- slide off the home page without warning.
    product_id BIGINT UNSIGNED NULL,
    alt VARCHAR(190) NOT NULL DEFAULT '',
    source_media_id BIGINT UNSIGNED NULL,
    cutout_media_id BIGINT UNSIGNED NULL,
    cutout_state VARCHAR(16) NOT NULL DEFAULT 'Pending',
    -- Why the last attempt failed, in the operator's language. Shown on the
    -- card beside the retry, because "it did not work" is not an instruction.
    cutout_detail VARCHAR(255) NOT NULL DEFAULT '',
    cutout_at DATETIME(6) NULL,
    position INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_home_hero_slides_public (public_id),
    KEY ix_home_hero_slides_running (is_active, position, id),
    KEY ix_home_hero_slides_product (product_id),
    CONSTRAINT ck_home_hero_slides_cutout_state
        CHECK (cutout_state IN ('Pending', 'Ready', 'Failed', 'Skipped')),
    CONSTRAINT fk_home_hero_slides_product
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL,
    CONSTRAINT fk_home_hero_slides_source
        FOREIGN KEY (source_media_id) REFERENCES media_assets (id) ON DELETE SET NULL,
    CONSTRAINT fk_home_hero_slides_cutout
        FOREIGN KEY (cutout_media_id) REFERENCES media_assets (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE={{collation}};
