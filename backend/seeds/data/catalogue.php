<?php

declare(strict_types=1);

/**
 * The catalogue, as one table.
 *
 * Read by BOTH `0004_inventory.php` (which takes each row in as warehouse stock)
 * and `0005_catalog.php` (which lists it as a product). One list, because
 * `products.item_ref` points at `stock_items.public_id` and two lists would drift
 * the moment somebody edited one — a product listed from an item that does not
 * exist is a row no screen can render.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 *
 * The storefront's grids showed forty tiles. Four of them were real products in
 * the database; the other thirty-six lived in `components/gender/data.ts` as
 * hardcoded objects, and every one of them LINKED to one of the four real slugs
 * (`slug(i % 4)`). So "Nightshift Overcoat" advertised at ₹18,600 opened the Bone
 * Utility Overshirt's page at ₹11,400. "Core Heavy Tee" was priced ₹4,200 on its
 * tile and ₹4,600 in the database. None of the thirty-six could be edited,
 * repriced, photographed or taken down, because there was nothing to edit.
 *
 * Every piece the shop shows is now a row here: it has a stock item behind it, a
 * price, a description, a category an operator maintains, and a photo slot. The
 * console can add, edit and delete any of them, and the storefront reads what the
 * console wrote.
 *
 * ── FIELDS ──────────────────────────────────────────────────────────────────
 *
 *   item        the ITM-* code. Also what the product is listed from.
 *   name        the garment. Also the stock item's name — one thing, one name.
 *   kind        inventory's own category: Top, Bottom or Accessory.
 *   type        inventory's sub-type, from the `types_by_category` vocabulary.
 *   sizes       what the warehouse stocks it in. Drives the variants.
 *   units       pieces on the shelf.
 *   warehouse   which node holds them.
 *   taxonomy    the CONSOLE category — what the storefront's filter pills read.
 *   descriptor  the line under the name on a card ("520 GSM brushed fleece").
 *   collection  drop-001 | after-hours | core-uniform
 *   price       whole rupees.
 *   compareAt   the struck-through price, or null.
 *   audience    men | women | unisex. Unisex shows on both gender pages.
 *   listing     the size the listing itself claims (spec §9.6).
 *   colour      + `hex` and `code` — the colour the SKU is minted from.
 *   badge       the chip in the tile's corner, or null.
 *   frame       which quadrant of the sprite sheet stands in until a photo is
 *               uploaded. See `products.image_position`.
 *   shot        which region of which source photograph this piece's IMAGE is
 *               cropped from, by `seeds/0006_catalogue_images.php`. The regions
 *               are the ones the storefront's tiles were already cropping in CSS
 *               — the difference is that the crop is now cut once, stored as a
 *               real file, and served from the database like any upload.
 *   status      Published | Scheduled | Draft.
 *   soldOut     sizes with nothing left, so the PDP can say so honestly.
 *   story/fabric/care  the three panels on the product page.
 *
 * @return list<array<string, mixed>>
 */

$T = ['S', 'M', 'L', 'XL'];
$TT = ['S', 'M', 'L', 'XL', 'XXL'];
$B = ['30', '32', '34', '36'];
$BB = ['30', '32', '34', '36', '38'];
$ONE = ['OS'];

return [
    /* ───────────────────────────── Drop 001 · the three anchors ───────────── */
    [
        'item' => 'ITM-001', 'name' => 'Afterdark Hoodie', 'kind' => 'Top', 'type' => 'Hoodie',
        'sizes' => $T, 'units' => 48, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Knitwear', 'descriptor' => 'Heavyweight fleece', 'collection' => 'drop-001',
        'price' => 8900, 'compareAt' => 10200, 'audience' => 'unisex', 'listing' => 'M',
        'colour' => 'Washed black', 'hex' => '#1b1b1b', 'code' => 'WSB',
        'badge' => 'Bestseller', 'frame' => 'top-left', 'status' => 'Published', 'soldOut' => ['XS'], 'shot' => 'hoodie',
        'description' => 'A dense, garment-washed hoodie cut with a dropped shoulder and deliberate weight.',
        'story' => 'Designed as the anchor of Drop 001 — quiet from a distance, exact up close.',
        'fabric' => '520 GSM brushed cotton fleece',
        'care' => 'Cold wash inside out. Dry flat. Do not bleach.',
    ],
    [
        'item' => 'ITM-002', 'name' => 'Bone Utility Overshirt', 'kind' => 'Top', 'type' => 'Overshirt',
        'sizes' => $T, 'units' => 26, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Outerwear', 'descriptor' => 'Structured canvas', 'collection' => 'drop-001',
        'price' => 11400, 'compareAt' => null, 'audience' => 'unisex', 'listing' => 'S',
        'colour' => 'Bone', 'hex' => '#d8d0c2', 'code' => 'BON',
        'badge' => 'New', 'frame' => 'top-right', 'status' => 'Published', 'soldOut' => ['XL'], 'shot' => 'overshirt',
        'description' => 'A four-pocket overshirt with a clean collar, boxy body, and hardware built to age.',
        'story' => 'Utility stripped back to its essential lines in the one light tone of the release.',
        'fabric' => '410 GSM cotton canvas',
        'care' => 'Cold wash separately. Line dry in shade.',
    ],
    [
        'item' => 'ITM-003', 'name' => 'Shadow Cargo 02', 'kind' => 'Bottom', 'type' => 'Cargo',
        'sizes' => $B, 'units' => 34, 'warehouse' => 'DEL-01',
        'taxonomy' => 'Trousers', 'descriptor' => 'Relaxed utility', 'collection' => 'drop-001',
        'price' => 9800, 'compareAt' => null, 'audience' => 'unisex', 'listing' => '32',
        'colour' => 'Charcoal', 'hex' => '#343434', 'code' => 'CHR',
        'badge' => 'New', 'frame' => 'bottom-left', 'status' => 'Published', 'soldOut' => [], 'shot' => 'cargo',
        'description' => 'A wide-leg cargo balanced by articulated knees and low-profile storage.',
        'story' => 'Volume without drag, designed for long nights and constant movement.',
        'fabric' => '360 GSM washed cotton twill',
        'care' => 'Machine wash cold. Wash with similar colours.',
    ],
    [
        'item' => 'ITM-004', 'name' => 'Core Heavy Tee', 'kind' => 'Top', 'type' => 'T-shirt',
        'sizes' => $TT, 'units' => 120, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Tops', 'descriptor' => '280 GSM cotton', 'collection' => 'core-uniform',
        'price' => 4600, 'compareAt' => null, 'audience' => 'unisex', 'listing' => 'M',
        'colour' => 'Ink', 'hex' => '#151515', 'code' => 'INK',
        'badge' => 'Core', 'frame' => 'bottom-right', 'status' => 'Published', 'soldOut' => [], 'shot' => 'tee',
        'description' => 'A compact jersey tee with a clean neck, dropped shoulder, and permanent structure.',
        'story' => 'The simplest piece in the uniform, rebuilt until the proportions felt inevitable.',
        'fabric' => '280 GSM compact cotton jersey',
        'care' => 'Cold wash. Reshape while damp. Dry flat.',
    ],
    [
        'item' => 'ITM-005', 'name' => 'Midnight Denim', 'kind' => 'Bottom', 'type' => 'Jeans',
        'sizes' => $B, 'units' => 22, 'warehouse' => 'MUM-01',
        'taxonomy' => 'Trousers', 'descriptor' => 'Rigid indigo denim', 'collection' => 'after-hours',
        'price' => 7800, 'compareAt' => null, 'audience' => 'men', 'listing' => '34',
        'colour' => 'Indigo', 'hex' => '#232c45', 'code' => 'IND',
        /* Scheduled on purpose: it is a real listed item that has not been
           released, which is what keeps the Published filter honest. */
        'badge' => null, 'frame' => 'bottom-left', 'status' => 'Scheduled', 'soldOut' => [], 'shot' => 'cargoWide',
        'description' => 'A straight-leg rigid denim that breaks in rather than wears out.',
        'story' => 'The pair the rest of the uniform was cut around.',
        'fabric' => '14 oz rigid indigo denim',
        'care' => 'Wash rarely, cold, inside out.',
    ],

    /* ───────────────────────────── Outerwear ──────────────────────────────── */
    [
        'item' => 'ITM-006', 'name' => 'Nightshift Overcoat', 'kind' => 'Top', 'type' => 'Jacket',
        'sizes' => $T, 'units' => 14, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Outerwear', 'descriptor' => 'Archive wool', 'collection' => 'after-hours',
        'price' => 18600, 'compareAt' => null, 'audience' => 'men', 'listing' => 'L',
        'colour' => 'Slate', 'hex' => '#2b2f36', 'code' => 'SLT',
        'badge' => 'Archive', 'frame' => 'top-right', 'status' => 'Published', 'soldOut' => ['S'], 'shot' => 'campMan',
        'description' => 'A full-length overcoat with a concealed placket and a shoulder cut to carry weight.',
        'story' => 'Brought back from the first archive run, in the one colour it was ever made in.',
        'fabric' => '740 GSM pressed wool melton',
        'care' => 'Dry clean only. Brush along the nap.',
    ],
    [
        'item' => 'ITM-007', 'name' => 'Bone Long Coat', 'kind' => 'Top', 'type' => 'Jacket',
        'sizes' => $T, 'units' => 11, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Outerwear', 'descriptor' => 'Archive canvas', 'collection' => 'after-hours',
        'price' => 19800, 'compareAt' => null, 'audience' => 'women', 'listing' => 'M',
        'colour' => 'Bone', 'hex' => '#d8d0c2', 'code' => 'BLC',
        'badge' => 'Archive', 'frame' => 'top-right', 'status' => 'Published', 'soldOut' => [], 'shot' => 'campWoman',
        'description' => 'A column coat that falls straight from the shoulder with no break at the waist.',
        'story' => 'The women\'s counterpart to the Nightshift, cut longer and left unlined.',
        'fabric' => '520 GSM cotton canvas',
        'care' => 'Dry clean only.',
    ],
    [
        'item' => 'ITM-008', 'name' => 'Bone Field Jacket', 'kind' => 'Top', 'type' => 'Jacket',
        'sizes' => $T, 'units' => 8, 'warehouse' => 'DEL-01',
        'taxonomy' => 'Outerwear', 'descriptor' => 'Waxed canvas', 'collection' => 'drop-001',
        'price' => 13900, 'compareAt' => null, 'audience' => 'men', 'listing' => 'L',
        'colour' => 'Bone', 'hex' => '#cfc6b6', 'code' => 'BFJ',
        'badge' => 'Canvas', 'frame' => 'top-right', 'status' => 'Published', 'soldOut' => ['S', 'XL'], 'shot' => 'stillJacket',
        'description' => 'A four-pocket field jacket with a bellowed back and a collar that stands on its own.',
        'story' => 'Built to be worn wet and dried on a hook.',
        'fabric' => '450 GSM waxed cotton canvas',
        'care' => 'Sponge clean. Re-wax annually. Never machine wash.',
    ],
    [
        'item' => 'ITM-009', 'name' => 'Ivory Work Jacket', 'kind' => 'Top', 'type' => 'Jacket',
        'sizes' => $T, 'units' => 12, 'warehouse' => 'DEL-01',
        'taxonomy' => 'Outerwear', 'descriptor' => 'Chore canvas', 'collection' => 'drop-001',
        'price' => 13900, 'compareAt' => null, 'audience' => 'women', 'listing' => 'M',
        'colour' => 'Ivory', 'hex' => '#e4ddd0', 'code' => 'IWJ',
        'badge' => 'Canvas', 'frame' => 'top-right', 'status' => 'Published', 'soldOut' => [], 'shot' => 'overshirtWide',
        'description' => 'A cropped chore jacket with three patch pockets and a squared hem.',
        'story' => 'The work jacket, re-proportioned rather than resized.',
        'fabric' => '430 GSM cotton canvas',
        'care' => 'Cold wash separately. Line dry in shade.',
    ],
    [
        'item' => 'ITM-010', 'name' => 'Underpass Shell', 'kind' => 'Top', 'type' => 'Jacket',
        'sizes' => $T, 'units' => 19, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Outerwear', 'descriptor' => 'Technical shell', 'collection' => 'after-hours',
        'price' => 16200, 'compareAt' => null, 'audience' => 'unisex', 'listing' => 'M',
        'colour' => 'Graphite', 'hex' => '#33383d', 'code' => 'UPS',
        'badge' => 'Technical', 'frame' => 'top-right', 'status' => 'Published', 'soldOut' => [], 'shot' => 'campPair',
        'description' => 'A sealed-seam shell with a storm hood and pit vents, cut long over a hoodie.',
        'story' => 'For the walk home, in the weather that made the walk memorable.',
        'fabric' => '3-layer recycled polyester with a PFC-free membrane',
        'care' => 'Machine wash cold on a technical cycle. No softener.',
    ],
    [
        'item' => 'ITM-011', 'name' => 'Collar Study Overshirt', 'kind' => 'Top', 'type' => 'Overshirt',
        'sizes' => $T, 'units' => 16, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Outerwear', 'descriptor' => 'Detail canvas', 'collection' => 'drop-001',
        'price' => 11800, 'compareAt' => null, 'audience' => 'men', 'listing' => 'M',
        'colour' => 'Bone', 'hex' => '#d3cabb', 'code' => 'CSO',
        'badge' => 'Detail', 'frame' => 'top-right', 'status' => 'Published', 'soldOut' => [], 'shot' => 'stillCollar',
        'description' => 'The overshirt with the collar taken apart and rebuilt twice as heavy.',
        'story' => 'One detail, followed all the way through the pattern.',
        'fabric' => '410 GSM cotton canvas, twice-fused collar',
        'care' => 'Cold wash separately. Press the collar from the underside.',
    ],
    [
        'item' => 'ITM-012', 'name' => 'Collar Study Shirt', 'kind' => 'Top', 'type' => 'Shirt',
        'sizes' => $T, 'units' => 15, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Outerwear', 'descriptor' => 'Detail poplin', 'collection' => 'drop-001',
        'price' => 11800, 'compareAt' => null, 'audience' => 'women', 'listing' => 'M',
        'colour' => 'Chalk', 'hex' => '#e8e3d8', 'code' => 'CSS',
        'badge' => 'Detail', 'frame' => 'top-right', 'status' => 'Published', 'soldOut' => ['S'], 'shot' => 'heroWoman',
        'description' => 'A stand-collar shirt cut with a dropped yoke and a curved hem.',
        'story' => 'The same collar study, in a cloth that shows every stitch of it.',
        'fabric' => '160 GSM compact cotton poplin',
        'care' => 'Cold wash. Iron damp.',
    ],
    [
        'item' => 'ITM-013', 'name' => 'Freight Overshirt', 'kind' => 'Top', 'type' => 'Overshirt',
        'sizes' => $TT, 'units' => 24, 'warehouse' => 'MUM-01',
        'taxonomy' => 'Outerwear', 'descriptor' => 'Bone canvas', 'collection' => 'core-uniform',
        'price' => 12400, 'compareAt' => null, 'audience' => 'unisex', 'listing' => 'L',
        'colour' => 'Bone', 'hex' => '#d8d0c2', 'code' => 'FRO',
        'badge' => 'Bone', 'frame' => 'top-right', 'status' => 'Published', 'soldOut' => [], 'shot' => 'stillFlat',
        'description' => 'The overshirt at its largest — two sizes of volume with the same shoulder.',
        'story' => 'Cut to go over everything else in the release at once.',
        'fabric' => '410 GSM cotton canvas',
        'care' => 'Cold wash separately. Line dry in shade.',
    ],

    /* ───────────────────────────── Knitwear ───────────────────────────────── */
    [
        'item' => 'ITM-014', 'name' => 'Concrete Zip Hood', 'kind' => 'Top', 'type' => 'Hoodie',
        'sizes' => $T, 'units' => 31, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Knitwear', 'descriptor' => 'Heavyweight fleece', 'collection' => 'drop-001',
        'price' => 10400, 'compareAt' => null, 'audience' => 'men', 'listing' => 'L',
        'colour' => 'Concrete', 'hex' => '#8b8880', 'code' => 'CZH',
        'badge' => 'Heavyweight', 'frame' => 'top-left', 'status' => 'Published', 'soldOut' => [], 'shot' => 'heroMan',
        'description' => 'A full-zip hood with a two-way zip and a hem that sits below the waist.',
        'story' => 'The hoodie, opened up, without losing the weight that made it one.',
        'fabric' => '520 GSM brushed cotton fleece',
        'care' => 'Cold wash inside out. Dry flat.',
    ],
    [
        'item' => 'ITM-015', 'name' => 'Structured Zip Hood', 'kind' => 'Top', 'type' => 'Hoodie',
        'sizes' => $T, 'units' => 28, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Knitwear', 'descriptor' => 'Heavyweight fleece', 'collection' => 'drop-001',
        'price' => 10400, 'compareAt' => null, 'audience' => 'women', 'listing' => 'M',
        'colour' => 'Ash', 'hex' => '#9a958c', 'code' => 'SZH',
        'badge' => 'Heavyweight', 'frame' => 'top-left', 'status' => 'Published', 'soldOut' => [], 'shot' => 'heroPair',
        'description' => 'A zip hood with a shaped side seam and a shortened body.',
        'story' => 'The same fleece, re-cut so the volume sits where it was meant to.',
        'fabric' => '520 GSM brushed cotton fleece',
        'care' => 'Cold wash inside out. Dry flat.',
    ],
    [
        'item' => 'ITM-016', 'name' => 'Gravel Wash Hoodie', 'kind' => 'Top', 'type' => 'Hoodie',
        'sizes' => $T, 'units' => 37, 'warehouse' => 'DEL-01',
        'taxonomy' => 'Knitwear', 'descriptor' => '520 GSM fleece', 'collection' => 'core-uniform',
        'price' => 8600, 'compareAt' => null, 'audience' => 'men', 'listing' => 'M',
        'colour' => 'Gravel', 'hex' => '#6f6b64', 'code' => 'GWH',
        'badge' => '520 GSM', 'frame' => 'top-left', 'status' => 'Published', 'soldOut' => [], 'shot' => 'stillHoodie',
        'description' => 'The hoodie put through a stone wash until the fleece gave up its shine.',
        'story' => 'Worn in before it reaches you, on purpose.',
        'fabric' => '520 GSM stone-washed cotton fleece',
        'care' => 'Cold wash inside out. Expect it to soften further.',
    ],
    [
        'item' => 'ITM-017', 'name' => 'Washed Crop Hoodie', 'kind' => 'Top', 'type' => 'Hoodie',
        'sizes' => $T, 'units' => 33, 'warehouse' => 'DEL-01',
        'taxonomy' => 'Knitwear', 'descriptor' => '520 GSM fleece', 'collection' => 'core-uniform',
        'price' => 8600, 'compareAt' => null, 'audience' => 'women', 'listing' => 'M',
        'colour' => 'Gravel', 'hex' => '#6f6b64', 'code' => 'WCH',
        'badge' => '520 GSM', 'frame' => 'top-left', 'status' => 'Published', 'soldOut' => [], 'shot' => 'hoodieWide',
        'description' => 'The washed hoodie cut to the rib, with the sleeve length kept full.',
        'story' => 'Cropped without being made smaller anywhere else.',
        'fabric' => '520 GSM stone-washed cotton fleece',
        'care' => 'Cold wash inside out. Dry flat.',
    ],
    [
        'item' => 'ITM-018', 'name' => 'Monolith Hood', 'kind' => 'Top', 'type' => 'Hoodie',
        'sizes' => $TT, 'units' => 21, 'warehouse' => 'MUM-01',
        'taxonomy' => 'Knitwear', 'descriptor' => 'Oversized fleece', 'collection' => 'after-hours',
        'price' => 9600, 'compareAt' => null, 'audience' => 'unisex', 'listing' => 'XL',
        'colour' => 'Void', 'hex' => '#101013', 'code' => 'MNH',
        'badge' => 'Oversized', 'frame' => 'top-left', 'status' => 'Published', 'soldOut' => ['XXL'], 'shot' => 'teeWide',
        'description' => 'One panel front and back, no side seam, cut two sizes past your own.',
        'story' => 'The largest thing in the release, and the simplest.',
        'fabric' => '600 GSM loopback cotton',
        'care' => 'Cold wash alone. Dry flat — it will hold water.',
    ],

    /* ───────────────────────────── Trousers ───────────────────────────────── */
    [
        'item' => 'ITM-019', 'name' => 'Volume Cargo 02', 'kind' => 'Bottom', 'type' => 'Cargo',
        'sizes' => $B, 'units' => 29, 'warehouse' => 'DEL-01',
        'taxonomy' => 'Trousers', 'descriptor' => 'Wide leg utility', 'collection' => 'drop-001',
        'price' => 9800, 'compareAt' => null, 'audience' => 'women', 'listing' => '30',
        'colour' => 'Charcoal', 'hex' => '#343434', 'code' => 'VC2',
        'badge' => 'Wide leg', 'frame' => 'bottom-left', 'status' => 'Published', 'soldOut' => [], 'shot' => 'cargo',
        'description' => 'The cargo with the leg opened up and the rise brought back to the waist.',
        'story' => 'Volume from the hip down, nothing borrowed from the menswear block.',
        'fabric' => '360 GSM washed cotton twill',
        'care' => 'Machine wash cold. Hang to dry.',
    ],
    [
        'item' => 'ITM-020', 'name' => 'Ballast Cargo Pant', 'kind' => 'Bottom', 'type' => 'Cargo',
        'sizes' => $BB, 'units' => 26, 'warehouse' => 'DEL-01',
        'taxonomy' => 'Trousers', 'descriptor' => 'Wide leg twill', 'collection' => 'after-hours',
        'price' => 9200, 'compareAt' => null, 'audience' => 'men', 'listing' => '34',
        'colour' => 'Iron', 'hex' => '#4a4d52', 'code' => 'BCP',
        'badge' => 'Wide leg', 'frame' => 'bottom-left', 'status' => 'Published', 'soldOut' => ['38'], 'shot' => 'stillCargo',
        'description' => 'A weighted cargo with a straight fall and pockets set low enough to load.',
        'story' => 'Named for what it does when the pockets are full.',
        'fabric' => '400 GSM cotton twill',
        'care' => 'Machine wash cold. Wash with similar colours.',
    ],
    [
        'item' => 'ITM-021', 'name' => 'Low Profile Cargo', 'kind' => 'Bottom', 'type' => 'Cargo',
        'sizes' => $B, 'units' => 30, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Trousers', 'descriptor' => 'Relaxed twill', 'collection' => 'core-uniform',
        'price' => 8800, 'compareAt' => 9900, 'audience' => 'men', 'listing' => '32',
        'colour' => 'Charcoal', 'hex' => '#3a3a3a', 'code' => 'LPC',
        'badge' => 'Relaxed', 'frame' => 'bottom-left', 'status' => 'Published', 'soldOut' => [], 'shot' => 'cargoWide',
        'description' => 'The cargo with its pockets flattened into the leg — utility you cannot see.',
        'story' => 'For the days the cargo should not announce itself.',
        'fabric' => '340 GSM washed cotton twill',
        'care' => 'Machine wash cold. Hang to dry.',
    ],
    [
        'item' => 'ITM-022', 'name' => 'Drape Cargo Pant', 'kind' => 'Bottom', 'type' => 'Cargo',
        'sizes' => $B, 'units' => 27, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Trousers', 'descriptor' => 'Relaxed twill', 'collection' => 'core-uniform',
        'price' => 8800, 'compareAt' => 9900, 'audience' => 'women', 'listing' => '30',
        'colour' => 'Charcoal', 'hex' => '#3a3a3a', 'code' => 'DCP',
        'badge' => 'Relaxed', 'frame' => 'bottom-left', 'status' => 'Published', 'soldOut' => [], 'shot' => 'wideWoman',
        'description' => 'A softer twill cargo that falls rather than holds its shape.',
        'story' => 'The same pattern in a cloth that moves with you instead of around you.',
        'fabric' => '300 GSM washed cotton twill',
        'care' => 'Machine wash cold. Hang to dry.',
    ],
    [
        'item' => 'ITM-023', 'name' => 'Deadstock Wide Trouser', 'kind' => 'Bottom', 'type' => 'Casual',
        'sizes' => $B, 'units' => 17, 'warehouse' => 'MUM-01',
        'taxonomy' => 'Trousers', 'descriptor' => 'Deadstock twill', 'collection' => 'after-hours',
        'price' => 9400, 'compareAt' => null, 'audience' => 'women', 'listing' => '32',
        'colour' => 'Bone', 'hex' => '#cdc4b4', 'code' => 'DWT',
        'badge' => 'Twill', 'frame' => 'bottom-left', 'status' => 'Published', 'soldOut' => ['36'], 'shot' => 'wideMan',
        'description' => 'A full-leg trouser cut from a mill run that will not be woven again.',
        'story' => 'One roll of cloth, and this is all of it.',
        'fabric' => 'Deadstock 380 GSM cotton twill',
        'care' => 'Cold wash. Hang to dry. No tumble.',
    ],

    /* ───────────────────────────── Tops ──────────────────────────────────── */
    [
        'item' => 'ITM-024', 'name' => 'Static Boxy Tee', 'kind' => 'Top', 'type' => 'T-shirt',
        'sizes' => $TT, 'units' => 84, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Tops', 'descriptor' => 'Boxy jersey', 'collection' => 'core-uniform',
        'price' => 4400, 'compareAt' => null, 'audience' => 'men', 'listing' => 'L',
        'colour' => 'Static', 'hex' => '#4f4f52', 'code' => 'SBT',
        'badge' => 'Boxy', 'frame' => 'bottom-right', 'status' => 'Published', 'soldOut' => [], 'shot' => 'tee',
        'description' => 'A square-cut tee with the shoulder seam pushed out past the joint.',
        'story' => 'The tee as a rectangle, with nothing tapered anywhere.',
        'fabric' => '260 GSM cotton jersey',
        'care' => 'Cold wash. Reshape while damp.',
    ],
    [
        'item' => 'ITM-025', 'name' => 'Sculpt Boxy Tee', 'kind' => 'Top', 'type' => 'T-shirt',
        'sizes' => $TT, 'units' => 78, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Tops', 'descriptor' => 'Boxy jersey', 'collection' => 'core-uniform',
        'price' => 4400, 'compareAt' => null, 'audience' => 'women', 'listing' => 'M',
        'colour' => 'Static', 'hex' => '#4f4f52', 'code' => 'SCT',
        'badge' => 'Boxy', 'frame' => 'bottom-right', 'status' => 'Published', 'soldOut' => [], 'shot' => 'teeWide',
        'description' => 'A boxy tee with a raised neck and a hem that finishes at the hip bone.',
        'story' => 'Square through the body, exact at the two edges that show.',
        'fabric' => '260 GSM cotton jersey',
        'care' => 'Cold wash. Reshape while damp.',
    ],
    [
        'item' => 'ITM-026', 'name' => 'Uniform Long Sleeve', 'kind' => 'Top', 'type' => 'T-shirt',
        'sizes' => $TT, 'units' => 62, 'warehouse' => 'DEL-01',
        'taxonomy' => 'Tops', 'descriptor' => 'Core jersey', 'collection' => 'core-uniform',
        'price' => 5200, 'compareAt' => null, 'audience' => 'unisex', 'listing' => 'M',
        'colour' => 'Ink', 'hex' => '#151515', 'code' => 'ULS',
        'badge' => 'Core', 'frame' => 'bottom-right', 'status' => 'Published', 'soldOut' => [], 'shot' => 'stillFlat',
        'description' => 'The heavy tee with the sleeve run to the wrist and a cuff that holds.',
        'story' => 'The layer the whole uniform is built on top of.',
        'fabric' => '280 GSM compact cotton jersey',
        'care' => 'Cold wash. Dry flat.',
    ],

    /* ───────────────────────────── Accessories ───────────────────────────── */
    [
        'item' => 'ITM-027', 'name' => 'Vault Carry Pouch', 'kind' => 'Accessory', 'type' => 'Bag',
        'sizes' => $ONE, 'units' => 45, 'warehouse' => 'MUM-01',
        'taxonomy' => 'Accessories', 'descriptor' => 'Hardware canvas', 'collection' => 'drop-001',
        'price' => 3800, 'compareAt' => null, 'audience' => 'men', 'listing' => 'OS',
        'colour' => 'Void', 'hex' => '#141416', 'code' => 'VCP',
        'badge' => 'Hardware', 'frame' => 'bottom-right', 'status' => 'Published', 'soldOut' => [], 'shot' => 'stillPouch',
        'description' => 'A flat pouch with a machined zip pull and a webbing loop that takes a belt.',
        'story' => 'Sized for a phone, a key and nothing you would have to explain.',
        'fabric' => '600D canvas with anodised hardware',
        'care' => 'Wipe clean. Do not submerge.',
    ],
    [
        'item' => 'ITM-028', 'name' => 'Vault Clutch', 'kind' => 'Accessory', 'type' => 'Bag',
        'sizes' => $ONE, 'units' => 41, 'warehouse' => 'MUM-01',
        'taxonomy' => 'Accessories', 'descriptor' => 'Hardware canvas', 'collection' => 'drop-001',
        'price' => 3800, 'compareAt' => null, 'audience' => 'women', 'listing' => 'OS',
        'colour' => 'Void', 'hex' => '#141416', 'code' => 'VCL',
        'badge' => 'Hardware', 'frame' => 'bottom-right', 'status' => 'Published', 'soldOut' => [], 'shot' => 'stillPouch',
        'description' => 'The pouch on a longer axis, with the loop replaced by a wrist strap.',
        'story' => 'The same object, carried a different way.',
        'fabric' => '600D canvas with anodised hardware',
        'care' => 'Wipe clean. Do not submerge.',
    ],
    [
        'item' => 'ITM-029', 'name' => 'Chain Link Set', 'kind' => 'Accessory', 'type' => 'Jewellery',
        'sizes' => $ONE, 'units' => 58, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Accessories', 'descriptor' => 'Steel hardware', 'collection' => 'after-hours',
        'price' => 2600, 'compareAt' => null, 'audience' => 'men', 'listing' => 'OS',
        'colour' => 'Steel', 'hex' => '#9ea3a8', 'code' => 'CLS',
        'badge' => 'Metal', 'frame' => 'bottom-right', 'status' => 'Published', 'soldOut' => [], 'shot' => 'stillHardware',
        'description' => 'Three linked lengths in brushed steel, worn together or apart.',
        'story' => 'The hardware off the garments, made wearable on its own.',
        'fabric' => 'Brushed 316L stainless steel',
        'care' => 'Polish with a dry cloth. Remove before water.',
    ],
    [
        'item' => 'ITM-030', 'name' => 'Link Chain Belt', 'kind' => 'Accessory', 'type' => 'Jewellery',
        'sizes' => $ONE, 'units' => 52, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Accessories', 'descriptor' => 'Steel hardware', 'collection' => 'after-hours',
        'price' => 2600, 'compareAt' => null, 'audience' => 'women', 'listing' => 'OS',
        'colour' => 'Steel', 'hex' => '#9ea3a8', 'code' => 'LCB',
        'badge' => 'Metal', 'frame' => 'bottom-right', 'status' => 'Published', 'soldOut' => [], 'shot' => 'stillHardware',
        'description' => 'The chain set run to belt length, closing on a machined hook.',
        'story' => 'Long enough to sit on the hip, heavy enough to stay there.',
        'fabric' => 'Brushed 316L stainless steel',
        'care' => 'Polish with a dry cloth. Remove before water.',
    ],
    [
        'item' => 'ITM-031', 'name' => 'Signal Boot', 'kind' => 'Accessory', 'type' => 'Footwear',
        'sizes' => ['7', '8', '9', '10', '11'], 'units' => 23, 'warehouse' => 'DEL-01',
        'taxonomy' => 'Accessories', 'descriptor' => 'Leather footwear', 'collection' => 'after-hours',
        'price' => 15400, 'compareAt' => null, 'audience' => 'unisex', 'listing' => '9',
        'colour' => 'Void', 'hex' => '#17171a', 'code' => 'SGB',
        'badge' => 'Footwear', 'frame' => 'bottom-left', 'status' => 'Published', 'soldOut' => ['11'], 'shot' => 'campBoots',
        'description' => 'A six-eyelet boot on a lugged wedge, built on a wide last.',
        'story' => 'The one thing in the release designed to outlast the release.',
        'fabric' => 'Full-grain leather on a rubber wedge, Blake stitched',
        'care' => 'Condition twice a year. Dry away from heat.',
    ],
    [
        'item' => 'ITM-032', 'name' => 'Drop 001 Flat Lay', 'kind' => 'Accessory', 'type' => 'Bundle',
        'sizes' => $ONE, 'units' => 9, 'warehouse' => 'BLR-01',
        'taxonomy' => 'Accessories', 'descriptor' => 'Set of three', 'collection' => 'drop-001',
        'price' => 21500, 'compareAt' => 24800, 'audience' => 'unisex', 'listing' => 'OS',
        'colour' => 'Mixed', 'hex' => '#2a2a2d', 'code' => 'D1F',
        'badge' => 'Set of 3', 'frame' => 'bottom-right', 'status' => 'Published', 'soldOut' => [], 'shot' => 'stillFlat',
        'description' => 'The hoodie, the overshirt and the cargo, boxed together at a set price.',
        'story' => 'The three anchors of Drop 001, in the arrangement they were shot in.',
        'fabric' => 'See each piece',
        'care' => 'See each piece',
    ],
];
