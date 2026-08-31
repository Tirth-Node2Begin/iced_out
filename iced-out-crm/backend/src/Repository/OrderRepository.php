<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;
use Iced\Support\Paginator;

final class OrderRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /**
     * The console order register. Payment state is joined from the newest
     * payment row rather than duplicated onto the order, so the two registers
     * can never disagree about whether the money landed.
     *
     * @param array{status?: string, payment?: string, q?: string} $filters
     *
     * @return array{rows: list<array<string, mixed>>, total: int}
     */
    public function search(array $filters, Paginator $page): array
    {
        $where = ['1 = 1'];
        $bindings = [];

        if (($filters['status'] ?? '') !== '') {
            $where[] = 'o.console_state = ?';
            $bindings[] = $filters['status'];
        }

        if (($filters['payment'] ?? '') !== '') {
            $where[] = 'COALESCE(p.status, \'Due\') = ?';
            $bindings[] = $filters['payment'];
        }

        if (($filters['q'] ?? '') !== '') {
            $where[] = '(o.number LIKE ? OR o.contact_name LIKE ? OR o.addr_city LIKE ?)';
            $like = '%' . $filters['q'] . '%';
            $bindings[] = $like;
            $bindings[] = $like;
            $bindings[] = $like;
        }

        $clause = implode(' AND ', $where);

        $sql = 'FROM orders o
                LEFT JOIN payments p ON p.id = (
                    SELECT id FROM payments WHERE order_id = o.id ORDER BY created_at DESC, id DESC LIMIT 1
                )
                WHERE ' . $clause;

        $count = $this->db->selectOne('SELECT COUNT(*) AS n ' . $sql, $bindings);

        $rows = $this->db->select(
            'SELECT o.*, p.status AS payment_status, p.method AS payment_method, p.public_id AS payment_public_id,
                    (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS piece_count
             ' . $sql . ' ORDER BY o.placed_at DESC, o.id DESC LIMIT ? OFFSET ?',
            [...$bindings, $page->perPage, $page->offset()],
        );

        return ['rows' => $rows, 'total' => $count === null ? 0 : (int) $count['n']];
    }

    /** @return array<string, mixed>|null */
    public function findByNumber(string $number): ?array
    {
        return $this->db->selectOne(
            'SELECT o.*, p.status AS payment_status, p.method AS payment_method, p.public_id AS payment_public_id,
                    (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS piece_count
               FROM orders o
               LEFT JOIN payments p ON p.id = (
                   SELECT id FROM payments WHERE order_id = o.id ORDER BY created_at DESC, id DESC LIMIT 1
               )
              WHERE o.number = ? LIMIT 1',
            [$number],
        );
    }

    /** @return array<string, mixed>|null */
    public function findByPublicIdOrNumber(string $key): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM orders WHERE public_id = ? OR number = ? LIMIT 1',
            [$key, $key],
        );
    }

    /** @return list<array<string, mixed>> */
    public function lines(int $orderId): array
    {
        return $this->db->select(
            'SELECT oi.*, p.public_id AS product_slug
               FROM order_items oi
               LEFT JOIN products p ON p.id = oi.product_id
              WHERE oi.order_id = ?
              ORDER BY oi.id',
            [$orderId],
        );
    }

    /** @return list<array<string, mixed>> */
    public function timeline(int $orderId): array
    {
        return $this->db->select(
            'SELECT seq, from_status, to_status, actor_type, note, created_at
               FROM order_status_history WHERE order_id = ? ORDER BY seq',
            [$orderId],
        );
    }

    /** @return list<array<string, mixed>> */
    public function forCustomer(int $userId): array
    {
        return $this->db->select(
            'SELECT o.*, (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS piece_count
               FROM orders o WHERE o.user_id = ? ORDER BY o.placed_at DESC, o.id DESC',
            [$userId],
        );
    }

    /** Optimistic locking: a stale version loses rather than silently overwriting. */
    public function updateState(int $orderId, string $consoleState, string $status, ?string $cancelledBy, int $version): int
    {
        return $this->db->statement(
            'UPDATE orders
                SET console_state = ?, status = ?, cancelled_by = ?, version = version + 1,
                    cancellation_eligible = ?, updated_at = ?
              WHERE id = ? AND version = ?',
            [
                $consoleState,
                $status,
                $cancelledBy,
                $consoleState === 'Placed' ? 1 : 0,
                $this->clock->nowString(),
                $orderId,
                $version,
            ],
        );
    }

    public function appendHistory(int $orderId, string $from, string $to, string $actorType, ?int $actorId, string $note): void
    {
        $row = $this->db->selectOne('SELECT COALESCE(MAX(seq), 0) AS seq FROM order_status_history WHERE order_id = ?', [$orderId]);

        $this->db->statement(
            'INSERT INTO order_status_history (order_id, seq, from_status, to_status, actor_type, actor_id, note, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$orderId, ($row === null ? 0 : (int) $row['seq']) + 1, $from, $to, $actorType, $actorId, $note, $this->clock->nowString()],
        );
    }

    /** A live shipment is anything not Failed or Cancelled — the dispatch guard. */
    public function hasLiveShipment(int $orderId): bool
    {
        $row = $this->db->selectOne(
            "SELECT COUNT(*) AS n FROM shipments WHERE order_id = ? AND status NOT IN ('Failed','Cancelled')",
            [$orderId],
        );

        return $row !== null && (int) $row['n'] > 0;
    }

    /** @return list<array<string, mixed>> */
    public function openShipments(int $orderId): array
    {
        return $this->db->select(
            "SELECT id, public_id, status FROM shipments WHERE order_id = ? AND status NOT IN ('Delivered','Cancelled')",
            [$orderId],
        );
    }

    /** @return array<string, mixed>|null */
    public function latestPayment(int $orderId): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
            [$orderId],
        );
    }
}
