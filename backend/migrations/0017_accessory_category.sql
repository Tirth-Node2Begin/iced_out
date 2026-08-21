-- Inventory learns about accessories.
--
-- `store_settings.inventory` offered two categories, `Top` and `Bottom`, each with
-- its own size vocabulary — letters for one, waist inches for the other. That is
-- the right shape, and it was missing a third: a pouch, a chain, a belt or a boot
-- is neither, so none of the shop's accessories could be taken into stock at all.
--
-- The consequence reached the storefront. Accessories could not be inventory, so
-- they could not be products, so the grids showed them as hardcoded tiles that
-- linked to a garment's page instead — and no operator could reprice or retire one.
--
-- `OS` is one size. The numbers are UK shoe sizes, for footwear.
--
-- A migration rather than a seed change because the seed only fills in keys that
-- are MISSING — by design, so it never overwrites something an operator has tuned.
-- `inventory` already exists on any install, holding the two categories.
--
-- Written so an operator who has added their own category or type keeps it:
-- `JSON_MERGE_PATCH` sets these three paths and leaves the rest of the object
-- alone.

UPDATE store_settings
   SET value_json = JSON_MERGE_PATCH(
         value_json,
         JSON_OBJECT(
           'categories',        JSON_ARRAY('Top', 'Bottom', 'Accessory'),
           'sizes_by_category', JSON_OBJECT(
             'Accessory', JSON_ARRAY('OS', '7', '8', '9', '10', '11', '12')
           ),
           'types_by_category', JSON_OBJECT(
             'Accessory', JSON_ARRAY('Bag', 'Jewellery', 'Footwear', 'Headwear', 'Bundle')
           )
         )
       ),
       version = version + 1
 WHERE `key` = 'inventory';
