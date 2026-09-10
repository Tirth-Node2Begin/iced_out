<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;

/**
 * The server-side bag (spec §6.4, §8.8) and the saved list (§8.7).
 *
 * `carts` and `cart_items` have been in the schema since migration 0004 and
 * until now nothing read them: the web bag lived in `localStorage` and the
 * phone's in a Hive box, so one account signed in twice held two bags that
 * could never see each other. This is the register both clients now read and
 * write, which is the whole of what makes them agree.
 *
 * ONE ACTIVE CART PER CUSTOMER is a database rule, not a convention —
 * `carts.active_key` is UNIQUE — so `open()` below can be a blind upsert
 * instead of a read-then-write that two devices can both win.
 */
final class CartRepository
{
    public function __construct(private readonly Database $db)
    {
    }

    /** @return array<string, mixed>|null */
    public function active(int $userId): ?array
    {
        return $this->db->selectOne(
            "SELECT * FROM carts WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1",
            [$userId],
        );
    }

    /**
     * The customer's ACTIVE cart, made if they have never had one.
     *
     * `ON DUPLICATE KEY` against the unique active_key rather than
     * SELECT-then-INSERT: the phone and the browser adding to an empty bag in
     * the same second would otherwise both find nothing and both insert, and
     * one of them would get a duplicate-key error where a bag was expected.
     */
    public function open(int $userId): int
    {
        return $this->db->insert(
            "INSERT INTO carts (user_id, status) VALUES (?, 'ACTIVE')
             ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)",
            [$userId],
        );
    }

    /**
     * Every stored line, with the catalogue row and the live stock behind it.
     *
     * The variant is joined on (product, size) because that pair NAMES a
     * variant: `uq_variants_live_size` is unique over it for live rows. That is
     * also why no colour is stored on the line — it is read from here.
     *
     * LEFT JOINed deliberately. A line whose variant has gone must come back so
     * the service can decide what to do with it; an INNER JOIN would make it
     * vanish from the read and stay in the table forever.
     *
     * @return list<array<string, mixed>>
     */
    public function lines(int $cartId): array
    {
        return $this->db->select(
            'SELECT ci.id, ci.product_id, ci.variant_size, ci.quantity, ci.price_at_add,
                    p.public_id AS product_slug, p.name AS product_name, p.price,
                    p.status AS product_status, p.deleted_at AS product_deleted_at,
                    v.id AS variant_id, v.public_id AS sku, v.color, v.status AS variant_status,
                    v.max_per_order, COALESCE(vi.available, 0) AS available
               FROM cart_items ci
               JOIN products p ON p.id = ci.product_id
               LEFT JOIN product_variants v
                      ON v.product_id = ci.product_id AND v.size = ci.variant_size AND v.deleted_at IS NULL
               LEFT JOIN variant_inventory vi ON vi.variant_id = v.id
              WHERE ci.cart_id = ?
              ORDER BY ci.id',
            [$cartId],
        );
    }

    /**
     * The variant a (slug, size) pair names, or null.
     *
     * `color` comes back so the caller can hand it to the client; nothing sends
     * a colour IN that decides anything, because a size already names one.
     *
     * @return array<string, mixed>|null
     */
    public function findVariant(string $slug, string $size): ?array
    {
        return $this->db->selectOne(
            'SELECT v.id AS variant_id, v.size, v.color, v.status AS variant_status, v.max_per_order,
                    p.id AS product_id, p.public_id AS product_slug, p.name AS product_name,
                    p.price, p.status AS product_status,
                    COALESCE(vi.available, 0) AS available
               FROM product_variants v
               JOIN products p ON p.id = v.product_id
               LEFT JOIN variant_inventory vi ON vi.variant_id = v.id
              WHERE p.public_id = ? AND v.size = ?
                AND v.deleted_at IS NULL AND p.deleted_at IS NULL
              LIMIT 1',
            [$slug, $size],
        );
    }

    /**
     * Add a line, or move the one already there to `$quantity`.
     *
     * SET rather than ADD on the duplicate: the caller has already worked the
     * final figure out against stock and the per-order cap, and a database that
     * added on top of it would put a bag over the cap the service had just
     * clamped it to.
     */
    public function putLine(int $cartId, int $productId, string $size, int $quantity, string $price): void
    {
        $this->db->statement(
            'INSERT INTO cart_items (cart_id, product_id, variant_size, quantity, price_at_add)
                  VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), price_at_add = VALUES(price_at_add)',
            [$cartId, $productId, $size, $quantity, $price],
        );
    }

    /**
     * How many of one line the bag currently holds.
     *
     * A single row rather than `lines()`, which joins five tables to build a
     * whole payload — this is asked once per line of a merge, and a hundred-line
     * guest bag would otherwise run a hundred of those to read a hundred
     * integers.
     */
    public function quantityOf(int $cartId, int $productId, string $size): int
    {
        $row = $this->db->selectOne(
            'SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_size = ?',
            [$cartId, $productId, $size],
        );

        return $row === null ? 0 : (int) $row['quantity'];
    }

    /**
     * Removes a line by SLUG, not by product id.
     *
     * So that a line can always be taken out, even when the thing behind it is
     * no longer sellable. Resolving the slug through `findVariant` first would
     * mean a product an operator has moved to Draft leaves a line the shopper
     * can see the effects of and cannot delete.
     */
    public function removeLine(int $cartId, string $slug, string $size): int
    {
        return $this->db->statement(
            'DELETE ci FROM cart_items ci
               JOIN products p ON p.id = ci.product_id
              WHERE ci.cart_id = ? AND p.public_id = ? AND ci.variant_size = ?',
            [$cartId, $slug, $size],
        );
    }

    /** @param list<int> $ids cart_items.id */
    public function removeLinesById(array $ids): void
    {
        if ($ids === []) {
            return;
        }

        $this->db->statement(
            'DELETE FROM cart_items WHERE id IN (' . implode(', ', array_fill(0, count($ids), '?')) . ')',
            $ids,
        );
    }

    public function clear(int $cartId): void
    {
        $this->db->statement('DELETE FROM cart_items WHERE cart_id = ?', [$cartId]);
    }

    public function setCoupon(int $cartId, ?string $code): void
    {
        $this->db->statement('UPDATE carts SET coupon_code = ? WHERE id = ?', [$code, $cartId]);
    }

    /**
     * Bumps `version` so a client can tell "the server changed something" from
     * "my own write came back". `updated_at` moves on its own (ON UPDATE), and
     * a bag two devices are editing wants a counter rather than a timestamp:
     * two writes inside the same microsecond share a timestamp.
     */
    public function touch(int $cartId): void
    {
        $this->db->statement('UPDATE carts SET version = version + 1 WHERE id = ?', [$cartId]);
    }

    /**
     * Retires the customer's open bag once its contents have become an order.
     *
     * Spec §8.9 #52 — "converts cart". Without this the bag the shopper has
     * just bought would still be sitting there on the other device.
     */
    public function convertActive(int $userId): void
    {
        $this->db->statement(
            "UPDATE carts SET status = 'CONVERTED' WHERE user_id = ? AND status = 'ACTIVE'",
            [$userId],
        );
    }

    /* -------------------------------------------------------------- wishlist */

    /**
     * The saved ids, in the order they were saved.
     *
     * @return list<string>
     */
    public function wishlist(int $userId): array
    {
        $rows = $this->db->select(
            'SELECT product_ref FROM wishlist_items WHERE user_id = ? ORDER BY position, id',
            [$userId],
        );

        return array_map(static fn (array $row): string => (string) $row['product_ref'], $rows);
    }

    /** Ignores an id already saved — pressing save twice is not an error. */
    public function saveWish(int $userId, string $productRef, int $position): void
    {
        $this->db->statement(
            'INSERT INTO wishlist_items (user_id, product_ref, position) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE position = position',
            [$userId, $productRef, $position],
        );
    }

    public function forgetWish(int $userId, string $productRef): void
    {
        $this->db->statement(
            'DELETE FROM wishlist_items WHERE user_id = ? AND product_ref = ?',
            [$userId, $productRef],
        );
    }

    public function nextWishPosition(int $userId): int
    {
        $row = $this->db->selectOne(
            'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM wishlist_items WHERE user_id = ?',
            [$userId],
        );

        return (int) ($row['next'] ?? 0);
    }

    /** @param list<string> $productRefs */
    public function replaceWishlist(int $userId, array $productRefs): void
    {
        $this->db->transaction(function () use ($userId, $productRefs): void {
            $this->db->statement('DELETE FROM wishlist_items WHERE user_id = ?', [$userId]);

            foreach (array_values($productRefs) as $position => $ref) {
                $this->db->statement(
                    'INSERT INTO wishlist_items (user_id, product_ref, position) VALUES (?, ?, ?)',
                    [$userId, $ref, $position],
                );
            }
        });
    }
}
