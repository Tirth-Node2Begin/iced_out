<?php

declare(strict_types=1);

namespace Iced\Service\Inventory;

use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Support\Clock;

/**
 * The ONE stock writer (spec §1.6, §9.6). Nothing else in the codebase may
 * touch `variant_inventory` or `stock_items.reserved_units`, and every write
 * here appends an `inventory_movements` row — so the ledger is always the
 * complete story of how a count got where it is.
 *
 * `available` is never written: it is a generated column, `on_hand - reserved`.
 */
final class StockService
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /**
     * Holds stock for an order line. Rows are locked in ascending id order so
     * two concurrent checkouts can never deadlock against each other.
     *
     * @throws ConflictException when the last unit is already spoken for
     */
    public function reserve(int $variantId, int $qty, int $orderId, int $orderItemId, ?int $actorId, int $ttlSeconds): void
    {
        $row = $this->db->selectOne(
            'SELECT id, on_hand, reserved, stock_item_id FROM variant_inventory WHERE variant_id = ? FOR UPDATE',
            [$variantId],
        );

        if ($row === null || (int) $row['on_hand'] - (int) $row['reserved'] < $qty) {
            throw new ConflictException('ICE-INV-409', 'That size just sold out.');
        }

        $this->db->statement(
            'UPDATE variant_inventory SET reserved = reserved + ?, version = version + 1 WHERE id = ?',
            [$qty, (int) $row['id']],
        );

        $this->db->statement(
            'INSERT INTO inventory_reservations (order_id, order_item_id, variant_id, qty, status, expires_at)
             VALUES (?, ?, ?, ?, \'HELD\', ?)',
            [$orderId, $orderItemId, $variantId, $qty, $this->clock->addSeconds($ttlSeconds)->format(Clock::STORAGE_FORMAT)],
        );

        $this->movement(
            $row['stock_item_id'] === null ? null : (int) $row['stock_item_id'],
            $variantId,
            'SALE_RESERVE',
            -$qty,
            (int) $row['on_hand'],
            (int) $row['reserved'] + $qty,
            'order',
            (string) $orderId,
            $actorId,
        );
    }

    /** Dispatch turns a hold into a sale: reserved and on_hand both come down. */
    public function confirmReservationsForOrder(int $orderId, ?int $actorId): void
    {
        foreach ($this->heldReservations($orderId) as $reservation) {
            $variantId = (int) $reservation['variant_id'];
            $qty = (int) $reservation['qty'];
            $inventory = $this->lockVariant($variantId);

            if ($inventory === null) {
                continue;
            }

            $this->db->statement(
                'UPDATE variant_inventory SET on_hand = GREATEST(0, on_hand - ?), reserved = GREATEST(0, reserved - ?), version = version + 1 WHERE id = ?',
                [$qty, $qty, (int) $inventory['id']],
            );

            $this->db->statement(
                "UPDATE inventory_reservations SET status = 'CONFIRMED', updated_at = ? WHERE id = ?",
                [$this->clock->nowString(), (int) $reservation['id']],
            );

            $this->movement(
                $inventory['stock_item_id'] === null ? null : (int) $inventory['stock_item_id'],
                $variantId,
                'SALE_CONFIRM',
                -$qty,
                max(0, (int) $inventory['on_hand'] - $qty),
                max(0, (int) $inventory['reserved'] - $qty),
                'order',
                (string) $orderId,
                $actorId,
            );
        }
    }

    /** Cancellation gives the hold back — on_hand never moved, so only reserved does. */
    public function releaseReservationsForOrder(int $orderId, ?int $actorId): void
    {
        foreach ($this->heldReservations($orderId) as $reservation) {
            $variantId = (int) $reservation['variant_id'];
            $qty = (int) $reservation['qty'];
            $inventory = $this->lockVariant($variantId);

            if ($inventory === null) {
                continue;
            }

            $this->db->statement(
                'UPDATE variant_inventory SET reserved = GREATEST(0, reserved - ?), version = version + 1 WHERE id = ?',
                [$qty, (int) $inventory['id']],
            );

            $this->db->statement(
                "UPDATE inventory_reservations SET status = 'RELEASED', updated_at = ? WHERE id = ?",
                [$this->clock->nowString(), (int) $reservation['id']],
            );

            $this->movement(
                $inventory['stock_item_id'] === null ? null : (int) $inventory['stock_item_id'],
                $variantId,
                'RESERVE_EXPIRE',
                $qty,
                (int) $inventory['on_hand'],
                max(0, (int) $inventory['reserved'] - $qty),
                'order',
                (string) $orderId,
                $actorId,
            );
        }
    }

    /** Goods physically back on the shelf: a return received, or an RTO parcel. */
    public function receiveBack(int $variantId, int $qty, string $type, string $referenceType, string $referenceId, ?int $actorId): void
    {
        $inventory = $this->lockVariant($variantId);

        if ($inventory === null) {
            return;
        }

        $this->db->statement(
            'UPDATE variant_inventory SET on_hand = on_hand + ?, version = version + 1 WHERE id = ?',
            [$qty, (int) $inventory['id']],
        );

        $this->movement(
            $inventory['stock_item_id'] === null ? null : (int) $inventory['stock_item_id'],
            $variantId,
            $type,
            $qty,
            (int) $inventory['on_hand'] + $qty,
            (int) $inventory['reserved'],
            $referenceType,
            $referenceId,
            $actorId,
        );
    }

    /**
     * A console adjustment to a stock item's counts. Both numbers are absolute,
     * as the register's form states them; the ledger records the delta.
     */
    public function setStockItemUnits(int $stockItemId, int $totalUnits, int $reservedUnits, ?int $actorId): void
    {
        $item = $this->db->selectOne('SELECT * FROM stock_items WHERE id = ? FOR UPDATE', [$stockItemId]);

        if ($item === null) {
            return;
        }

        $reservedUnits = max(0, min($reservedUnits, $totalUnits));
        $totalDelta = $totalUnits - (int) $item['total_units'];

        $this->db->statement(
            'UPDATE stock_items SET total_units = ?, reserved_units = ?, version = version + 1, updated_at = ? WHERE id = ?',
            [$totalUnits, $reservedUnits, $this->clock->nowString(), $stockItemId],
        );

        if ($totalDelta !== 0) {
            $this->movement(
                $stockItemId,
                null,
                $totalDelta > 0 ? 'ADJUST_UP' : 'ADJUST_DOWN',
                $totalDelta,
                $totalUnits,
                $reservedUnits,
                'console',
                (string) $stockItemId,
                $actorId,
            );
        }
    }

    /** @return list<array<string, mixed>> */
    private function heldReservations(int $orderId): array
    {
        return $this->db->select(
            "SELECT * FROM inventory_reservations WHERE order_id = ? AND status = 'HELD' ORDER BY variant_id",
            [$orderId],
        );
    }

    /** @return array<string, mixed>|null */
    private function lockVariant(int $variantId): ?array
    {
        return $this->db->selectOne(
            'SELECT id, on_hand, reserved, stock_item_id FROM variant_inventory WHERE variant_id = ? FOR UPDATE',
            [$variantId],
        );
    }

    private function movement(
        ?int $stockItemId,
        ?int $variantId,
        string $type,
        int $qty,
        int $onHandAfter,
        int $reservedAfter,
        string $referenceType,
        string $referenceId,
        ?int $actorId,
    ): void {
        $this->db->statement(
            'INSERT INTO inventory_movements
                (stock_item_id, variant_id, type, qty, on_hand_after, reserved_after, reference_type, reference_id, actor_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$stockItemId, $variantId, $type, $qty, $onHandAfter, $reservedAfter, $referenceType, $referenceId, $actorId, $this->clock->nowString()],
        );
    }
}
