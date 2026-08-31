-- Clears what the previous catalogue seed left behind.
--
-- The seed used to describe five products against a four-category taxonomy
-- (`Outerwear, Essentials, Bottoms, Accessories`) and gave every product the same
-- letter size run. Both have changed: the taxonomy is now the five categories the
-- storefront's filter pills actually read, and each product's sizes come from the
-- stock item it is listed from.
--
-- Seeds are idempotent UPSERTS, so they add and correct but never retire. That
-- leaves two kinds of row on an install that predates the change, and only a
-- migration can clear them:
--
--   1. Two categories nothing is filed under — `Essentials` and `Bottoms`. They
--      show in the console's category register reading zero products, and in the
--      product form's dropdown as choices that mean nothing.
--
--   2. Eight variants in sizes their stock item does not stock. `shadow-cargo-02`
--      is a Bottom sized 30–36 and carried S/M/L/XL from when every product got
--      letters; four products carried an XS nothing holds. None of them can be
--      bought — availability comes from `variant_inventory`, and there is no stock
--      behind a size the warehouse does not keep — so they are rows that can only
--      mislead.
--
-- Both are SOFT deletes. A variant may be named on an old order line and a
-- category on an old audit entry; `deleted_at` keeps the row readable for those
-- while taking it out of every register and dropdown.
--
-- Guarded rather than blanket. Only a category with no live products is retired,
-- so an operator who has filed something under `Essentials` keeps it.

UPDATE categories c
   SET c.deleted_at = UTC_TIMESTAMP(6)
 WHERE c.public_id IN ('essentials', 'bottoms')
   AND c.deleted_at IS NULL
   AND NOT EXISTS (
         SELECT 1 FROM products p
          WHERE p.category_id = c.id AND p.deleted_at IS NULL
       );

-- A variant whose size is not in its stock item's `sizes_csv`. The CSV is stored
-- as "S, M, L" — the spaces come out before FIND_IN_SET is asked.
UPDATE product_variants v
  JOIN products p ON p.id = v.product_id
  JOIN stock_items si ON si.public_id = p.item_ref
   SET v.status = 'Archived',
       v.deleted_at = UTC_TIMESTAMP(6),
       v.updated_at = UTC_TIMESTAMP(6)
 WHERE v.deleted_at IS NULL
   AND si.sizes_csv <> ''
   AND NOT FIND_IN_SET(v.size, REPLACE(si.sizes_csv, ', ', ','));
