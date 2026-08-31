<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;

/**
 * The dashboard's reads (spec §8.18). Every count here is computed from the
 * registers themselves — the console's landing screen must never be able to
 * disagree with the screen it links to.
 */
final class DashboardRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /** @return array<string, mixed> */
    public function queues(): array
    {
        $row = $this->db->selectOne('SELECT * FROM v_dashboard_queues');

        $oldest = $this->db->selectOne(
            "SELECT number, contact_name, placed_at FROM orders
              WHERE console_state = 'Placed' ORDER BY placed_at ASC LIMIT 1",
        );

        $failedPayments = $this->db->select(
            "SELECT p.public_id, p.note FROM payments p WHERE p.status = 'Failed' ORDER BY p.created_at DESC LIMIT 3",
        );

        $failedShipments = $this->db->selectOne(
            "SELECT COUNT(*) AS n FROM shipments WHERE status = 'Failed'",
        );

        $approvedReturns = $this->db->selectOne(
            "SELECT COUNT(*) AS n FROM return_requests WHERE state = 'Approved'",
        );

        $ticketsWithOrder = $this->db->selectOne(
            "SELECT COUNT(*) AS n FROM support_queries WHERE status = 'Open' AND order_number <> 'No order'",
        );

        // `low` and `out` are both reserved words — the aliases are spelled out.
        $atRisk = $this->db->selectOne(
            "SELECT
                SUM(CASE WHEN stock = 'LOW_STOCK' THEN 1 ELSE 0 END) AS low_count,
                SUM(CASE WHEN stock = 'SOLD_OUT' THEN 1 ELSE 0 END) AS out_count
               FROM v_variant_availability",
        );

        return [
            'counts' => $row ?? [],
            'oldest_placed' => $oldest,
            'failed_payment_notes' => array_map(static fn (array $p): string => (string) $p['note'], $failedPayments),
            'failed_shipments' => $failedShipments === null ? 0 : (int) $failedShipments['n'],
            'approved_returns' => $approvedReturns === null ? 0 : (int) $approvedReturns['n'],
            'tickets_with_order' => $ticketsWithOrder === null ? 0 : (int) $ticketsWithOrder['n'],
            'stock_low' => $atRisk === null ? 0 : (int) $atRisk['low_count'],
            'stock_out' => $atRisk === null ? 0 : (int) $atRisk['out_count'],
        ];
    }

    /** @return list<array<string, mixed>> */
    public function trading(int $days): array
    {
        return $this->db->select(
            'SELECT day, revenue, orders, sessions, returns FROM trading_days
              WHERE day <= ? ORDER BY day DESC LIMIT ?',
            [$this->clock->display($this->clock->now())->format('Y-m-d'), $days],
        );
    }

    /** @return list<array<string, mixed>> */
    public function activity(int $after, int $limit): array
    {
        if ($after > 0) {
            return $this->db->select(
                'SELECT * FROM activity_feed WHERE id > ? ORDER BY id DESC LIMIT ?',
                [$after, $limit],
            );
        }

        return $this->db->select('SELECT * FROM activity_feed ORDER BY id DESC LIMIT ?', [$limit]);
    }

    /** @return list<array<string, mixed>> */
    public function signals(int $limit): array
    {
        // rose → amber → ink → mint, then newest first (spec §8.18 #92).
        return $this->db->select(
            "SELECT * FROM ops_signals
              WHERE cleared_at IS NULL
              ORDER BY FIELD(tone, 'rose', 'amber', 'ink', 'mint'), created_at DESC
              LIMIT ?",
            [$limit],
        );
    }

    /** @return array<string, mixed> */
    public function summaryToday(): array
    {
        $row = $this->db->selectOne(
            'SELECT revenue, orders, sessions, returns FROM trading_days WHERE day = ?',
            [$this->clock->display($this->clock->now())->format('Y-m-d')],
        );

        return $row ?? ['revenue' => 0, 'orders' => 0, 'sessions' => 0, 'returns' => 0];
    }
}
