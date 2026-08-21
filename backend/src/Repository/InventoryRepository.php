<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;

final class InventoryRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly StoreSettings $settings,
    ) {
    }

    /** @return list<array<string, mixed>> */
    public function items(string $q = ''): array
    {
        $sql = 'SELECT s.*, w.public_id AS warehouse_code, m.public_id AS image_public_id
                  FROM stock_items s
                  LEFT JOIN warehouses w ON w.id = s.warehouse_id
                  LEFT JOIN media_assets m ON m.id = s.image_media_id AND m.deleted_at IS NULL
                 WHERE s.deleted_at IS NULL';

        if ($q !== '') {
            return $this->db->select(
                $sql . ' AND (s.public_id LIKE ? OR s.item_name LIKE ? OR s.item_type LIKE ?) ORDER BY s.public_id',
                ['%' . $q . '%', '%' . $q . '%', '%' . $q . '%'],
            );
        }

        return $this->db->select($sql . ' ORDER BY s.public_id');
    }

    /** @return array<string, mixed>|null */
    public function findItem(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT s.*, w.public_id AS warehouse_code, m.public_id AS image_public_id
               FROM stock_items s
               LEFT JOIN warehouses w ON w.id = s.warehouse_id
               LEFT JOIN media_assets m ON m.id = s.image_media_id AND m.deleted_at IS NULL
              WHERE s.public_id = ? AND s.deleted_at IS NULL LIMIT 1',
            [$publicId],
        );
    }

    public function nextItemId(): string
    {
        $series = $this->settings->series('stock_item', 'ITM-', 1, 3);
        $row = $this->db->selectOne(
            'SELECT public_id FROM stock_items WHERE public_id LIKE ? ORDER BY public_id DESC LIMIT 1',
            [$series['prefix'] . '%'],
        );
        $highest = $row === null ? 0 : (int) preg_replace('/\D/', '', (string) $row['public_id']);

        return $series['prefix'] . str_pad((string) max($series['from'], $highest + 1), max(1, $series['width']), '0', STR_PAD_LEFT);
    }

    public function insertItem(
        string $publicId,
        string $name,
        string $category,
        string $type,
        string $sizes,
        int $warehouseId,
        int $total,
        int $reserved,
        string $audience = 'unisex',
        string $price = '0.00',
    ): int {
        return $this->db->insert(
            'INSERT INTO stock_items
                (public_id, item_name, category, audience, item_type, sizes_csv, price, warehouse_id, total_units, reserved_units, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$publicId, $name, $category, $audience, $type, $sizes, $price, $warehouseId, $total, $reserved, $this->clock->nowString()],
        );
    }

    /* -------------------------------------------------------------- gallery */

    /**
     * The secondary shots of the given items, in the order the operator set,
     * keyed by stock item id.
     *
     * One query for the whole register rather than one per row: the item list is
     * read on every visit to the stock screen, and a query per item there is a
     * request per garment. Same shape as `CatalogRepository::variantsForProducts`.
     *
     * @param list<int> $itemIds
     *
     * @return array<int, list<string>> media public ids, in position order
     */
    public function photosFor(array $itemIds): array
    {
        if ($itemIds === []) {
            return [];
        }

        $rows = $this->db->select(
            'SELECT sp.stock_item_id, m.public_id
               FROM stock_item_photos sp
               JOIN media_assets m ON m.id = sp.media_id AND m.deleted_at IS NULL
              WHERE sp.stock_item_id IN (' . implode(', ', array_fill(0, count($itemIds), '?')) . ')
              ORDER BY sp.position, sp.id',
            $itemIds,
        );

        $grouped = [];

        foreach ($rows as $row) {
            $grouped[(int) $row['stock_item_id']][] = (string) $row['public_id'];
        }

        return $grouped;
    }

    /**
     * The gallery of one item, by the public id every surface addresses it with.
     *
     * @return list<string> media public ids, in position order
     */
    public function photosOf(string $itemRef): array
    {
        $rows = $this->db->select(
            'SELECT m.public_id
               FROM stock_item_photos sp
               JOIN stock_items s ON s.id = sp.stock_item_id
               JOIN media_assets m ON m.id = sp.media_id AND m.deleted_at IS NULL
              WHERE s.public_id = ?
              ORDER BY sp.position, sp.id',
            [$itemRef],
        );

        return array_map(static fn (array $row): string => (string) $row['public_id'], $rows);
    }

    /**
     * Rewrites one item's gallery to exactly the assets given, in the order given.
     *
     * Replace rather than merge: the field submits the whole arrangement every
     * time, so what it sends IS the gallery — a merge would make removing a shot
     * impossible, and reordering would depend on rows nobody can see.
     *
     * @param list<int> $mediaIds already-uploaded assets, in display order
     */
    public function replacePhotos(int $stockItemId, array $mediaIds): void
    {
        $this->db->statement('DELETE FROM stock_item_photos WHERE stock_item_id = ?', [$stockItemId]);

        $position = 0;

        foreach ($mediaIds as $mediaId) {
            $this->db->statement(
                'INSERT INTO stock_item_photos (stock_item_id, media_id, position, created_at) VALUES (?, ?, ?, ?)',
                [$stockItemId, $mediaId, $position, $this->clock->nowString()],
            );
            ++$position;
        }
    }

    /**
     * Carries an item's own facts down onto every product listed from it.
     *
     * The item and its listing are one garment: `seeds/data/catalogue.php` writes
     * both from a single row, and the catalogue form derives a new product's name
     * from the item it is chosen from. Renaming the item afterwards did NOT follow
     * through, so an operator who corrected a stock item's name found the shop
     * still selling it under the old one — the two names were the same fact stored
     * twice, and only one of them moved.
     *
     * Audience travels the same way and for the same reason: which page a piece
     * belongs on is a fact about the garment, and the item is where a garment is
     * described.
     *
     * Only the fields that actually changed are pushed, so an unrelated edit does
     * not rewrite a product's name.
     *
     * @param array<string, mixed> $fields the item columns being written
     */
    public function syncListedProducts(string $itemRef, array $fields): void
    {
        $sets = [];
        $bindings = [];

        if (array_key_exists('item_name', $fields)) {
            $sets[] = 'name = ?';
            $bindings[] = $fields['item_name'];
        }

        if (array_key_exists('audience', $fields)) {
            $sets[] = 'audience = ?';
            $bindings[] = $fields['audience'];
        }

        if ($sets === []) {
            return;
        }

        $bindings[] = $this->clock->nowString();
        $bindings[] = $itemRef;

        $this->db->statement(
            'UPDATE products SET ' . implode(', ', $sets) . ', updated_at = ? WHERE item_ref = ? AND deleted_at IS NULL',
            $bindings,
        );
    }

    /** @param array<string, mixed> $fields */
    public function updateItem(string $publicId, array $fields): void
    {
        if ($fields === []) {
            return;
        }

        $sets = [];
        $bindings = [];

        foreach ($fields as $column => $value) {
            $sets[] = $column . ' = ?';
            $bindings[] = $value;
        }

        $bindings[] = $this->clock->nowString();
        $bindings[] = $publicId;

        $this->db->statement('UPDATE stock_items SET ' . implode(', ', $sets) . ', updated_at = ? WHERE public_id = ?', $bindings);
    }

    public function softDeleteItem(string $publicId): void
    {
        $this->db->statement('UPDATE stock_items SET deleted_at = ? WHERE public_id = ?', [$this->clock->nowString(), $publicId]);
    }

    /** A published listing pointing at this item blocks its deletion. */
    public function publishedListings(string $itemRef): int
    {
        $row = $this->db->selectOne(
            "SELECT COUNT(*) AS n FROM products WHERE item_ref = ? AND deleted_at IS NULL AND status = 'Published'",
            [$itemRef],
        );

        return $row === null ? 0 : (int) $row['n'];
    }

    /** @return list<array<string, mixed>> */
    public function movements(string $itemRef, int $limit, int $offset): array
    {
        if ($itemRef !== '') {
            return $this->db->select(
                'SELECT m.*, s.public_id AS item_code FROM inventory_movements m
                   LEFT JOIN stock_items s ON s.id = m.stock_item_id
                  WHERE s.public_id = ? ORDER BY m.id DESC LIMIT ? OFFSET ?',
                [$itemRef, $limit, $offset],
            );
        }

        return $this->db->select(
            'SELECT m.*, s.public_id AS item_code FROM inventory_movements m
               LEFT JOIN stock_items s ON s.id = m.stock_item_id
              ORDER BY m.id DESC LIMIT ? OFFSET ?',
            [$limit, $offset],
        );
    }

    /* ---------------------------------------------------------- warehouses */

    /** @return list<array<string, mixed>> */
    public function warehouses(): array
    {
        return $this->db->select(
            'SELECT w.*, (SELECT COALESCE(SUM(s.total_units - s.reserved_units), 0)
                            FROM stock_items s WHERE s.warehouse_id = w.id AND s.deleted_at IS NULL) AS available_units
               FROM warehouses w ORDER BY w.public_id',
        );
    }

    /** @return array<string, mixed>|null */
    public function findWarehouse(string $publicId): ?array
    {
        return $this->db->selectOne('SELECT * FROM warehouses WHERE public_id = ? LIMIT 1', [$publicId]);
    }

    public function insertWarehouse(string $publicId, string $name, int $capacity, string $cutoff, string $status): void
    {
        $this->db->statement(
            'INSERT INTO warehouses (public_id, name, available_label, capacity_pct, cutoff, status) VALUES (?, ?, ?, ?, ?, ?)',
            [$publicId, $name, '0', $capacity, $cutoff, $status],
        );
    }

    /** @param array<string, mixed> $fields */
    public function updateWarehouse(string $publicId, array $fields): void
    {
        if ($fields === []) {
            return;
        }

        $sets = [];
        $bindings = [];

        foreach ($fields as $column => $value) {
            $sets[] = $column . ' = ?';
            $bindings[] = $value;
        }

        $bindings[] = $publicId;

        $this->db->statement('UPDATE warehouses SET ' . implode(', ', $sets) . ' WHERE public_id = ?', $bindings);
    }

    /* ----------------------------------------------------------- transfers */

    /** @return list<array<string, mixed>> */
    public function transfers(): array
    {
        return $this->db->select(
            'SELECT t.*, f.public_id AS from_code, o.public_id AS to_code
               FROM inventory_transfers t
               JOIN warehouses f ON f.id = t.from_warehouse_id
               JOIN warehouses o ON o.id = t.to_warehouse_id
              ORDER BY t.public_id DESC',
        );
    }

    /** @return array<string, mixed>|null */
    public function findTransfer(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT t.*, f.public_id AS from_code, o.public_id AS to_code
               FROM inventory_transfers t
               JOIN warehouses f ON f.id = t.from_warehouse_id
               JOIN warehouses o ON o.id = t.to_warehouse_id
              WHERE t.public_id = ? LIMIT 1',
            [$publicId],
        );
    }

    public function nextTransferId(): string
    {
        $series = $this->settings->series('transfer', 'TRF-', 1, 3);
        $row = $this->db->selectOne('SELECT public_id FROM inventory_transfers ORDER BY public_id DESC LIMIT 1');
        $highest = $row === null ? 0 : (int) preg_replace('/\D/', '', (string) $row['public_id']);

        return $series['prefix'] . str_pad((string) max($series['from'], $highest + 1), max(1, $series['width']), '0', STR_PAD_LEFT);
    }

    public function insertTransfer(string $publicId, int $from, int $to, int $units, string $dispatched): void
    {
        $this->db->statement(
            "INSERT INTO inventory_transfers (public_id, from_warehouse_id, to_warehouse_id, units, dispatched_label, status)
             VALUES (?, ?, ?, ?, ?, 'Ready')",
            [$publicId, $from, $to, $units, $dispatched],
        );
    }

    public function setTransferStatus(string $publicId, string $status): void
    {
        $this->db->statement(
            'UPDATE inventory_transfers SET status = ?, updated_at = ? WHERE public_id = ?',
            [$status, $this->clock->nowString(), $publicId],
        );
    }

    /* ------------------------------------------------------------- at risk */

    /** @return list<array<string, mixed>> */
    public function atRisk(): array
    {
        return $this->db->select(
            "SELECT product_slug, sku, size, available, stock FROM v_variant_availability
              WHERE stock IN ('LOW_STOCK','SOLD_OUT') ORDER BY available, sku",
        );
    }
}
