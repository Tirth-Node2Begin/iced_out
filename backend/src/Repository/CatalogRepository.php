<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;

/**
 * The catalogue's SQL: products, variants, categories, collections.
 *
 * Availability is never selected from a column — it comes through
 * v_variant_availability, which derives it from on_hand and reserved.
 */
final class CatalogRepository
{
    /**
     * How far back "trending" looks, in days.
     *
     * Long enough that a quiet week does not empty the rail, short enough that
     * last season's best seller stops standing in front of this season's. See
     * `trendingProducts` for the ladder that takes over when the window is bare.
     */
    public const TRENDING_WINDOW_DAYS = 30;

    /** How many ranked rows the trending read returns when the caller says nothing. */
    public const TRENDING_LIMIT = 12;

    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /* -------------------------------------------------------------- products */

    /**
     * @param array{q?: string, status?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function products(array $filters): array
    {
        $where = ['p.deleted_at IS NULL'];
        $bindings = [];

        if (($filters['status'] ?? '') !== '') {
            $where[] = 'p.status = ?';
            $bindings[] = $filters['status'];
        }

        if (($filters['q'] ?? '') !== '') {
            $where[] = '(p.name LIKE ? OR p.public_id LIKE ? OR p.sku_code LIKE ? OR p.item_ref LIKE ?)';
            $like = '%' . $filters['q'] . '%';
            array_push($bindings, $like, $like, $like, $like);
        }

        return $this->db->select(
            'SELECT p.*, c.name AS taxonomy_name, col.name AS collection_name,
                    m.public_id AS image_public_id
               FROM products p
               LEFT JOIN categories c ON c.id = p.category_id
               LEFT JOIN collections col ON col.public_id = p.collection_slug
               LEFT JOIN media_assets m ON m.id = p.image_media_id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY p.position, p.id',
            $bindings,
        );
    }

    /** @return array<string, mixed>|null */
    public function findProduct(string $slug): ?array
    {
        return $this->db->selectOne(
            'SELECT p.*, c.name AS taxonomy_name, col.name AS collection_name,
                    m.public_id AS image_public_id
               FROM products p
               LEFT JOIN categories c ON c.id = p.category_id
               LEFT JOIN collections col ON col.public_id = p.collection_slug
               LEFT JOIN media_assets m ON m.id = p.image_media_id
              WHERE p.public_id = ? AND p.deleted_at IS NULL LIMIT 1',
            [$slug],
        );
    }

    /** @return list<string> */
    public function takenSlugs(): array
    {
        return array_map(
            static fn (array $row): string => (string) $row['public_id'],
            $this->db->select('SELECT public_id FROM products'),
        );
    }

    /** @return list<string> */
    public function takenSkuCodes(): array
    {
        return array_map(
            static fn (array $row): string => (string) $row['sku_code'],
            $this->db->select("SELECT sku_code FROM products WHERE sku_code <> ''"),
        );
    }

    /** @param array<string, mixed> $data */
    public function insertProduct(array $data): int
    {
        return $this->db->insert(
            'INSERT INTO products
                (public_id, name, category, category_id, item_ref, sku_code, listing_size, description,
                 price, collection_slug, status, tax_note, audience, color, image_position, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $data['public_id'], $data['name'], $data['category'], $data['category_id'], $data['item_ref'],
                $data['sku_code'], $data['listing_size'], $data['description'], $data['price'],
                $data['collection_slug'], $data['status'], $data['tax_note'],
                /* Inherited from the stock item this is listed from — the garment
                   is what is cut for men or women, and the listing is a decision
                   to sell it. This was hardcoded 'unisex', so every product an
                   operator created through the console appeared on both gender
                   pages regardless of what it was. */
                $data['audience'] ?? 'unisex',
                $data['color'] ?? '', 'top-left', $this->clock->nowString(),
            ],
        );
    }

    /** @param array<string, mixed> $fields */
    public function updateProduct(string $slug, array $fields): void
    {
        if ($fields === []) {
            return;
        }

        $sets = [];
        $bindings = [];

        foreach ($fields as $column => $value) {
            $sets[] = sprintf('%s = ?', $column);
            $bindings[] = $value;
        }

        $bindings[] = $this->clock->nowString();
        $bindings[] = $slug;

        $this->db->statement(
            'UPDATE products SET ' . implode(', ', $sets) . ', updated_at = ? WHERE public_id = ?',
            $bindings,
        );
    }

    public function priceHistory(int $productId, string $price, ?string $compareAt, ?int $actorId): void
    {
        $this->db->statement(
            'INSERT INTO product_price_history (product_id, price, compare_at_price, changed_by, created_at)
             VALUES (?, ?, ?, ?, ?)',
            [$productId, $price, $compareAt, $actorId, $this->clock->nowString()],
        );
    }

    /** Soft delete cascades to the variants — a variant whose product is gone is invisible, not free. */
    public function softDeleteProduct(int $productId): void
    {
        $now = $this->clock->nowString();
        $this->db->statement('UPDATE products SET deleted_at = ? WHERE id = ?', [$now, $productId]);
        $this->db->statement('UPDATE product_variants SET deleted_at = ? WHERE product_id = ? AND deleted_at IS NULL', [$now, $productId]);
    }

    /**
     * The stock item a product is listed from.
     *
     * Read by the catalogue's create so a new product inherits the item's
     * audience — see `insertProduct`.
     *
     * @return array<string, mixed>|null
     */
    public function findStockItem(string $itemRef): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM stock_items WHERE public_id = ? AND deleted_at IS NULL LIMIT 1',
            [$itemRef],
        );
    }

    /* ------------------------------------------------------------ storefront */

    /**
     * What the shop actually sells.
     *
     * `Published` is the whole filter, and it is applied HERE rather than left
     * to the caller: a Draft or Scheduled product is one an operator has not
     * released yet, and a public endpoint that could be asked for it by slug
     * would be a preview of unannounced stock to anyone who guessed the URL.
     *
     * Ordered by `position` then `id` so the console's own arrangement is the
     * one shoppers see, and a product added today lands at the end instead of
     * jumping the queue.
     *
     * @param array{audience?: string, collection?: string, new?: bool, q?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function storefrontProducts(array $filters = []): array
    {
        $where = ["p.deleted_at IS NULL", "p.status = 'Published'"];
        $bindings = [];

        /* "men" includes unisex, and so does "women" — the storefront's own rule
           (see `matchesDestination`), kept on this side so both halves cannot
           drift into disagreeing about what a gender page contains. */
        if (($filters['audience'] ?? '') !== '' && $filters['audience'] !== 'all') {
            $where[] = '(p.audience = ? OR p.audience = ?)';
            array_push($bindings, $filters['audience'], 'unisex');
        }

        if (($filters['collection'] ?? '') !== '') {
            $where[] = 'p.collection_slug = ?';
            $bindings[] = $filters['collection'];
        }

        if (($filters['new'] ?? false) === true) {
            $where[] = 'p.is_new = 1';
        }

        if (($filters['q'] ?? '') !== '') {
            $where[] = '(p.name LIKE ? OR p.category LIKE ? OR p.color LIKE ?)';
            $like = '%' . $filters['q'] . '%';
            array_push($bindings, $like, $like, $like);
        }

        return $this->db->select(
            'SELECT p.*, col.name AS collection_name, cat.name AS taxonomy_name,
                    m.public_id AS image_public_id,
                    rs.review_count, rs.rating_avg
               FROM products p
               LEFT JOIN collections col ON col.public_id = p.collection_slug
               LEFT JOIN categories cat ON cat.id = p.category_id AND cat.deleted_at IS NULL
               LEFT JOIN media_assets m ON m.id = p.image_media_id
               LEFT JOIN product_rating_summaries rs ON rs.product_id = p.id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY p.position, p.id',
            $bindings,
        );
    }

    /**
     * One published product by slug, or null — including for a product that
     * exists but has not been released. See `storefrontProducts`.
     *
     * @return array<string, mixed>|null
     */
    public function findStorefrontProduct(string $slug): ?array
    {
        return $this->db->selectOne(
            "SELECT p.*, col.name AS collection_name, cat.name AS taxonomy_name,
                    m.public_id AS image_public_id,
                    rs.review_count, rs.rating_avg
               FROM products p
               LEFT JOIN collections col ON col.public_id = p.collection_slug
               LEFT JOIN categories cat ON cat.id = p.category_id AND cat.deleted_at IS NULL
               LEFT JOIN media_assets m ON m.id = p.image_media_id
               LEFT JOIN product_rating_summaries rs ON rs.product_id = p.id
              WHERE p.public_id = ? AND p.deleted_at IS NULL AND p.status = 'Published'
              LIMIT 1",
            [$slug],
        );
    }

    /**
     * The published catalogue, ordered by what is actually selling.
     *
     * "Trending" is DERIVED, never a column an operator ticks: it is units
     * shipped out of `order_items` over a rolling window, so the home page's
     * rail follows the register instead of somebody's opinion of what should be
     * popular. Returns and cancellations are taken back out — a piece that sold
     * ten and had eight sent back is not trending.
     *
     * The ordering is a LADDER rather than a single figure, because a young
     * catalogue has windows with no sales in them at all and a rail that falls
     * back to nothing would render four empty slots on the front page:
     *
     *   1. units sold inside the window        — what "trending" actually means
     *   2. units sold ever                     — a shop whose window is quiet
     *   3. review count, then rating           — what shoppers bothered to say
     *   4. is_new, then the operator's own position
     *
     * So the rail degrades from "selling now" to "sold before" to "talked
     * about" to "newest first", and only ever renders nothing when the shop
     * itself has nothing published.
     *
     * Audience narrows the same way the rest of the storefront does — men and
     * women both include unisex; see `storefrontProducts`.
     *
     * @param array{audience?: string, limit?: int, days?: int} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function trendingProducts(array $filters = []): array
    {
        $where = ['p.deleted_at IS NULL', "p.status = 'Published'"];
        $bindings = [];

        if (($filters['audience'] ?? '') !== '' && ($filters['audience'] ?? '') !== 'all') {
            $where[] = '(p.audience = ? OR p.audience = ?)';
            array_push($bindings, $filters['audience'], 'unisex');
        }

        $days = max(1, min(365, (int) ($filters['days'] ?? self::TRENDING_WINDOW_DAYS)));
        $limit = max(1, min(48, (int) ($filters['limit'] ?? self::TRENDING_LIMIT)));
        $since = $this->clock->addSeconds(-$days * 86400)->format(Clock::STORAGE_FORMAT);

        /* The window bound is bound FIRST: its placeholder sits in the derived
           table in the FROM clause, which the parser reaches before the WHERE
           the audience filter appends to. `LIMIT` is interpolated rather than
           bound because prepare emulation is off (see Kernel\Database) and MySQL
           will not take a string parameter there — it is clamped to an int two
           lines above, so there is nothing to inject. */
        return $this->db->select(
            'SELECT p.*, col.name AS collection_name, cat.name AS taxonomy_name,
                    m.public_id AS image_public_id,
                    rs.review_count, rs.rating_avg,
                    COALESCE(sold.recent_units, 0) AS trend_recent_units,
                    COALESCE(sold.total_units, 0) AS trend_total_units
               FROM products p
               LEFT JOIN collections col ON col.public_id = p.collection_slug
               LEFT JOIN categories cat ON cat.id = p.category_id AND cat.deleted_at IS NULL
               LEFT JOIN media_assets m ON m.id = p.image_media_id
               LEFT JOIN product_rating_summaries rs ON rs.product_id = p.id
               LEFT JOIN (
                       SELECT oi.product_id,
                              SUM(CASE WHEN o.placed_at >= ?
                                       THEN GREATEST(CAST(oi.quantity AS SIGNED) - CAST(oi.returned_qty AS SIGNED), 0)
                                       ELSE 0 END) AS recent_units,
                              SUM(GREATEST(CAST(oi.quantity AS SIGNED) - CAST(oi.returned_qty AS SIGNED), 0)) AS total_units
                         FROM order_items oi
                         JOIN orders o ON o.id = oi.order_id
                        WHERE oi.product_id IS NOT NULL
                          AND o.status <> ' . "'Cancelled'" . '
                          AND o.console_state <> ' . "'Cancelled'" . '
                        GROUP BY oi.product_id
                     ) sold ON sold.product_id = p.id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY trend_recent_units DESC,
                       trend_total_units DESC,
                       COALESCE(rs.review_count, 0) DESC,
                       COALESCE(rs.rating_avg, 0) DESC,
                       p.is_new DESC,
                       p.position, p.id
              LIMIT ' . $limit,
            array_merge([$since], $bindings),
        );
    }

    /**
     * Every live variant of the given products, keyed by product id.
     *
     * One query for the whole list rather than one per product: the storefront
     * index asks for its variants because it renders per-size availability, and
     * a per-product query there is a request per card.
     *
     * @param list<int> $productIds
     *
     * @return array<int, list<array<string, mixed>>>
     */
    public function variantsForProducts(array $productIds): array
    {
        if ($productIds === []) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($productIds), '?'));

        $rows = $this->db->select(
            'SELECT v.*, p.public_id AS product_slug, COALESCE(vi.available, 0) AS available, vi.low_at
               FROM product_variants v
               JOIN products p ON p.id = v.product_id
               LEFT JOIN variant_inventory vi ON vi.variant_id = v.id
              WHERE v.product_id IN (' . $placeholders . ")
                AND v.deleted_at IS NULL AND v.status <> 'Archived'
              ORDER BY v.position, v.id",
            $productIds,
        );

        $grouped = [];

        foreach ($rows as $row) {
            $grouped[(int) $row['product_id']][] = $row;
        }

        return $grouped;
    }

    /**
     * The gallery behind each of the given products, keyed by product id.
     *
     * The photographs hang off the STOCK ITEM, not the listing — a piece
     * photographs the same however it is sold, and re-shooting it should not
     * mean re-uploading against every listing made from it. So this walks
     * `products.item_ref` back to the item and reads its shots in order.
     *
     * One query for the whole page rather than one per card, the same reason
     * `variantsForProducts` is shaped this way.
     *
     * @param list<int> $productIds
     *
     * @return array<int, list<string>> media public ids, in display order
     */
    public function photosForProducts(array $productIds): array
    {
        if ($productIds === []) {
            return [];
        }

        $rows = $this->db->select(
            'SELECT p.id AS product_id, m.public_id
               FROM products p
               JOIN stock_items s ON s.public_id = p.item_ref AND s.deleted_at IS NULL
               JOIN stock_item_photos sp ON sp.stock_item_id = s.id
               JOIN media_assets m ON m.id = sp.media_id AND m.deleted_at IS NULL
              WHERE p.id IN (' . implode(', ', array_fill(0, count($productIds), '?')) . ')
              ORDER BY sp.position, sp.id',
            $productIds,
        );

        $grouped = [];

        foreach ($rows as $row) {
            $grouped[(int) $row['product_id']][] = (string) $row['public_id'];
        }

        return $grouped;
    }

    /* -------------------------------------------------------------- variants */

    /** @return list<array<string, mixed>> */
    public function variants(?string $productSlug): array
    {
        $sql = 'SELECT v.*, p.public_id AS product_slug, COALESCE(vi.available, 0) AS available
                  FROM product_variants v
                  JOIN products p ON p.id = v.product_id
                  LEFT JOIN variant_inventory vi ON vi.variant_id = v.id
                 WHERE v.deleted_at IS NULL';

        if ($productSlug !== null && $productSlug !== '') {
            return $this->db->select($sql . ' AND p.public_id = ? ORDER BY v.position, v.id', [$productSlug]);
        }

        return $this->db->select($sql . ' ORDER BY p.position, v.position, v.id');
    }

    /** @return array<string, mixed>|null */
    public function findVariant(string $sku): ?array
    {
        return $this->db->selectOne(
            'SELECT v.*, p.public_id AS product_slug, COALESCE(vi.available, 0) AS available
               FROM product_variants v
               JOIN products p ON p.id = v.product_id
               LEFT JOIN variant_inventory vi ON vi.variant_id = v.id
              WHERE v.public_id = ? AND v.deleted_at IS NULL LIMIT 1',
            [$sku],
        );
    }

    /** @return list<string> */
    public function takenVariantSkus(): array
    {
        return array_map(
            static fn (array $row): string => (string) $row['public_id'],
            $this->db->select('SELECT public_id FROM product_variants'),
        );
    }

    public function insertVariant(string $sku, int $productId, string $size, string $colour, string $status, int $onHand, ?int $stockItemId): int
    {
        $id = $this->db->insert(
            'INSERT INTO product_variants (public_id, product_id, size, color, color_hex, material, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$sku, $productId, $size, $colour, '#000000', '', $status, $this->clock->nowString()],
        );

        $this->db->statement(
            'INSERT INTO variant_inventory (variant_id, stock_item_id, on_hand, reserved, low_at) VALUES (?, ?, ?, 0, 4)',
            [$id, $stockItemId, $onHand],
        );

        return $id;
    }

    public function updateVariantStatus(string $sku, string $status): void
    {
        $this->db->statement(
            'UPDATE product_variants SET status = ?, updated_at = ? WHERE public_id = ?',
            [$status, $this->clock->nowString(), $sku],
        );
    }

    public function archiveVariant(string $sku): void
    {
        $this->db->statement(
            "UPDATE product_variants SET status = 'Archived', deleted_at = ?, updated_at = ? WHERE public_id = ?",
            [$this->clock->nowString(), $this->clock->nowString(), $sku],
        );
    }

    /* ------------------------------------------------- categories & collections */

    /** @return list<array<string, mixed>> */
    public function categories(): array
    {
        return $this->db->select(
            'SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS product_count
               FROM categories c WHERE c.deleted_at IS NULL ORDER BY c.position, c.id',
        );
    }

    /** @return list<array<string, mixed>> */
    public function collections(): array
    {
        return $this->db->select(
            'SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.collection_slug = c.public_id AND p.deleted_at IS NULL) AS piece_count
               FROM collections c WHERE c.deleted_at IS NULL ORDER BY c.position, c.id',
        );
    }

    /** @return array<string, mixed>|null */
    public function findCategory(string $publicId): ?array
    {
        return $this->db->selectOne('SELECT * FROM categories WHERE public_id = ? AND deleted_at IS NULL', [$publicId]);
    }

    /** @return array<string, mixed>|null */
    public function findCollection(string $publicId): ?array
    {
        return $this->db->selectOne('SELECT * FROM collections WHERE public_id = ? AND deleted_at IS NULL', [$publicId]);
    }

    public function insertCategory(string $publicId, string $name): void
    {
        $this->db->statement('INSERT INTO categories (public_id, name) VALUES (?, ?)', [$publicId, $name]);
    }

    public function insertCollection(string $publicId, string $name, string $status): void
    {
        $this->db->statement('INSERT INTO collections (public_id, name, status) VALUES (?, ?, ?)', [$publicId, $name, $status]);
    }

    public function renameCategory(string $publicId, string $name): void
    {
        $this->db->statement('UPDATE categories SET name = ? WHERE public_id = ?', [$name, $publicId]);
    }

    /** @param array<string, mixed> $fields */
    public function updateCollection(string $publicId, array $fields): void
    {
        if ($fields === []) {
            return;
        }

        $sets = [];
        $bindings = [];

        foreach ($fields as $column => $value) {
            $sets[] = sprintf('%s = ?', $column);
            $bindings[] = $value;
        }

        $bindings[] = $publicId;

        $this->db->statement('UPDATE collections SET ' . implode(', ', $sets) . ' WHERE public_id = ?', $bindings);
    }

    public function softDeleteCategory(string $publicId): void
    {
        $this->db->statement('UPDATE categories SET deleted_at = ? WHERE public_id = ?', [$this->clock->nowString(), $publicId]);
    }

    public function softDeleteCollection(string $publicId): void
    {
        $this->db->statement('UPDATE collections SET deleted_at = ? WHERE public_id = ?', [$this->clock->nowString(), $publicId]);
    }

    /* ------------------------------------------------------------ listing room */

    /**
     * How much room a stock item still has to be listed against, per size.
     * A published listing claims one size and one piece (spec §9.6).
     *
     * @return list<array{size: string, room: int}>
     */
    public function listingRoom(string $itemRef): array
    {
        $item = $this->db->selectOne('SELECT * FROM stock_items WHERE public_id = ? AND deleted_at IS NULL', [$itemRef]);

        if ($item === null) {
            return [];
        }

        $sizes = array_values(array_filter(array_map('trim', explode(',', (string) $item['sizes_csv']))));
        $available = max(0, (int) $item['total_units'] - (int) $item['reserved_units']);

        $claimed = [];

        foreach ($this->db->select(
            "SELECT listing_size, COUNT(*) AS n FROM products
              WHERE item_ref = ? AND deleted_at IS NULL AND status = 'Published' GROUP BY listing_size",
            [$itemRef],
        ) as $row) {
            $claimed[(string) $row['listing_size']] = (int) $row['n'];
        }

        $room = [];

        foreach ($sizes as $size) {
            $room[] = ['size' => $size, 'room' => max(0, intdiv($available, max(1, count($sizes))) - ($claimed[$size] ?? 0))];
        }

        return $room;
    }
}
