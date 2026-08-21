<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;
use Iced\Service\Catalog\SkuMinter;

/**
 * The catalogue: the taxonomy, the collections, every product and its variants.
 *
 * The products come from `seeds/data/catalogue.php` — the same list
 * `0004_inventory.php` takes into the warehouses, so every product here is listed
 * from a stock item that exists.
 *
 * ── WHAT CHANGED ────────────────────────────────────────────────────────────
 *
 * This used to seed FIVE products. The storefront's grids showed forty tiles, and
 * the other thirty-six were hardcoded objects in `components/gender/data.ts` that
 * every one of them linked back to one of these five slugs — so a tile advertising
 * "Nightshift Overcoat · ₹18,600" opened the Bone Utility Overshirt at ₹11,400,
 * and none of the thirty-six could be edited, repriced or taken down because there
 * was nothing to edit. Every piece the shop shows is a row here now.
 *
 * The taxonomy is the five categories the storefront's filter pills actually read
 * — Outerwear, Knitwear, Trousers, Tops, Accessories — rather than a different
 * four the pills had no way to match.
 *
 * Variant SKUs are the console form of spec §6.2 — ADH-WSB-M — because that is the
 * one SKU both surfaces speak.
 */
return static function (Container $container): string {
    /** @var Database $db */
    $db = $container->get(Database::class);

    /** @var list<array<string, mixed>> $catalogue */
    $catalogue = require __DIR__ . '/data/catalogue.php';

    $collections = [
        ['slug' => 'drop-001', 'name' => 'Drop 001', 'status' => 'Live'],
        ['slug' => 'after-hours', 'name' => 'After Hours', 'status' => 'Live'],
        ['slug' => 'core-uniform', 'name' => 'Core Uniform', 'status' => 'Live'],
    ];

    /**
     * The console's taxonomy — and the storefront's filter pills, which are the
     * same list read from the other end.
     *
     * These were `Outerwear, Essentials, Bottoms, Accessories` while the pills
     * offered `Outerwear, Knitwear, Trousers, Tops, Accessories`, so three of the
     * five pills could never match a product and two categories were invisible.
     */
    $categories = [
        ['slug' => 'outerwear', 'name' => 'Outerwear'],
        ['slug' => 'knitwear', 'name' => 'Knitwear'],
        ['slug' => 'trousers', 'name' => 'Trousers'],
        ['slug' => 'tops', 'name' => 'Tops'],
        ['slug' => 'accessories', 'name' => 'Accessories'],
    ];

    return $db->transaction(static function (Database $db) use ($collections, $categories, $catalogue): string {
        $money = static fn (?int $rupees): ?string => $rupees === null
            ? null
            : number_format((float) $rupees, 2, '.', '');

        foreach ($collections as $position => $collection) {
            $db->statement(
                'INSERT INTO collections (public_id, name, status, position) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status), position = VALUES(position)',
                [$collection['slug'], $collection['name'], $collection['status'], $position],
            );
        }

        foreach ($categories as $position => $category) {
            $db->statement(
                'INSERT INTO categories (public_id, name, position) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name), position = VALUES(position)',
                [$category['slug'], $category['name'], $position],
            );
        }

        $categoryIds = [];

        foreach ($db->select('SELECT id, public_id FROM categories') as $row) {
            $categoryIds[(string) $row['public_id']] = (int) $row['id'];
        }

        $collectionIds = [];

        foreach ($db->select('SELECT id, public_id FROM collections') as $row) {
            $collectionIds[(string) $row['public_id']] = (int) $row['id'];
        }

        $stockIds = [];

        foreach ($db->select('SELECT id, public_id FROM stock_items') as $row) {
            $stockIds[(string) $row['public_id']] = (int) $row['id'];
        }

        $variantCount = 0;

        foreach ($catalogue as $position => $piece) {
            /* The slug is the name, and it is stable: it is the URL a shopper may
               keep and the id every screen addresses the product by. */
            $slug = SkuMinter::slugify((string) $piece['name']);
            $taxonomy = SkuMinter::slugify((string) $piece['taxonomy']);

            $db->statement(
                'INSERT INTO products
                    (public_id, name, category, category_id, item_ref, sku_code, listing_size, description, story,
                     fabric, care, price, compare_at_price, color, badge, image_position, audience,
                     collection_slug, is_new, status, position)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    name = VALUES(name), category = VALUES(category), category_id = VALUES(category_id),
                    item_ref = VALUES(item_ref), sku_code = VALUES(sku_code), listing_size = VALUES(listing_size),
                    description = VALUES(description), story = VALUES(story), fabric = VALUES(fabric),
                    care = VALUES(care), price = VALUES(price), compare_at_price = VALUES(compare_at_price),
                    color = VALUES(color), badge = VALUES(badge), image_position = VALUES(image_position),
                    audience = VALUES(audience), collection_slug = VALUES(collection_slug),
                    is_new = VALUES(is_new), status = VALUES(status), position = VALUES(position)',
                [
                    $slug,
                    $piece['name'],
                    $piece['descriptor'],
                    $categoryIds[$taxonomy] ?? null,
                    $piece['item'],
                    $piece['code'],
                    $piece['listing'],
                    $piece['description'],
                    $piece['story'],
                    $piece['fabric'],
                    $piece['care'],
                    $money((int) $piece['price']),
                    $money($piece['compareAt'] === null ? null : (int) $piece['compareAt']),
                    $piece['colour'],
                    $piece['badge'],
                    $piece['frame'],
                    $piece['audience'],
                    $piece['collection'],
                    /* "New" is the badge saying so — one fact, not two that can
                       disagree. */
                    $piece['badge'] === 'New' ? 1 : 0,
                    $piece['status'],
                    $position,
                ],
            );

            $row = $db->selectOne('SELECT id FROM products WHERE public_id = ?', [$slug]);

            if ($row === null) {
                continue;
            }

            $productId = (int) $row['id'];

            if (isset($collectionIds[$piece['collection']])) {
                $db->statement(
                    'INSERT IGNORE INTO collection_products (collection_id, product_id, position) VALUES (?, ?, ?)',
                    [$collectionIds[$piece['collection']], $productId, $position],
                );
            }

            $stockItemId = $stockIds[$piece['item']] ?? null;

            /**
             * Stock is spread across the sizes rather than repeated per size.
             *
             * The item holds `units` pieces in total; each size gets its share, and
             * a size listed as sold out gets none. Giving every size the item's
             * full count would have the console reporting several times the stock
             * the warehouse actually has.
             */
            $sizes = $piece['sizes'];
            $soldOut = $piece['soldOut'];
            $selling = max(1, count($sizes) - count($soldOut));
            $share = intdiv((int) $piece['units'], $selling);

            foreach ($sizes as $sizeIndex => $size) {
                $out = in_array($size, $soldOut, true);
                $onHand = $out ? 0 : max(1, $share);
                $status = $out ? 'Out' : ($onHand <= 4 ? 'Low' : 'Active');

                /* `ADH-WSB-M`, not `ADH-Washed black-M`: the colour is reduced to its
                   three-letter code the same way the product's own code is, which
                   is what makes the SKU readable on a picking slip. */
                $sku = SkuMinter::variantSku(
                    (string) $piece['code'],
                    SkuMinter::skuCode((string) $piece['colour']),
                    $size,
                );

                $db->statement(
                    'INSERT INTO product_variants
                        (public_id, product_id, size, color, color_hex, material, status, max_per_order, position)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 3, ?)
                     ON DUPLICATE KEY UPDATE
                        color = VALUES(color), color_hex = VALUES(color_hex),
                        material = VALUES(material), status = VALUES(status)',
                    [
                        $sku,
                        $productId,
                        $size,
                        $piece['colour'],
                        $piece['hex'],
                        $piece['fabric'],
                        $status,
                        $sizeIndex,
                    ],
                );

                $variant = $db->selectOne('SELECT id FROM product_variants WHERE public_id = ?', [$sku]);

                if ($variant === null) {
                    continue;
                }

                $db->statement(
                    'INSERT INTO variant_inventory (variant_id, stock_item_id, on_hand, reserved, low_at)
                     VALUES (?, ?, ?, 0, 4)
                     ON DUPLICATE KEY UPDATE on_hand = VALUES(on_hand), reserved = 0, stock_item_id = VALUES(stock_item_id)',
                    [(int) $variant['id'], $stockItemId, $onHand],
                );

                ++$variantCount;
            }

            $db->statement(
                'INSERT INTO product_rating_summaries (product_id, review_count, rating_avg)
                 VALUES (?, 0, 0.00) ON DUPLICATE KEY UPDATE product_id = product_id',
                [$productId],
            );
        }

        return sprintf(
            '%d products, %d variants, %d collections, %d categories',
            count($catalogue),
            $variantCount,
            count($collections),
            count($categories),
        );
    });
};
