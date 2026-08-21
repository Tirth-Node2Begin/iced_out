<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;
use Iced\Support\Clock;

/**
 * The dashboard's 200-day trading window, the activity river and the bell drawer.
 *
 * TRADING SERIES — the frontend generates this from an integer hash of the day
 * offset (`15-dashboard/data/trading-series.ts`) precisely so the build and the
 * browser agree. The same hash is reproduced here, Math.imul included, so
 * wiring the console to the API does not move a single bar on the chart.
 * Offset 0 is stated rather than generated, exactly as the fixture states it.
 *
 * ACTIVITY + SIGNALS — NOT copied from the frontend's simulator. Those rows
 * describe real events, so they are derived from the registers actually seeded:
 * the failed payment on IO-2026-1046 is a signal because that payment failed,
 * not because a fixture said so.
 */
return static function (Container $container): string {
    /** @var Database $db */
    $db = $container->get(Database::class);
    /** @var Clock $clock */
    $clock = $container->get(Clock::class);

    /** JavaScript's Math.imul — a 32-bit truncated multiply. */
    $imul = static function (int $a, int $b): int {
        $ah = ($a >> 16) & 0xFFFF;
        $al = $a & 0xFFFF;
        $bh = ($b >> 16) & 0xFFFF;
        $bl = $b & 0xFFFF;

        return (($al * $bl) + ((($ah * $bl + $al * $bh) << 16) & 0xFFFFFFFF)) & 0xFFFFFFFF;
    };

    /** The fixture's hash: an integer seed to a stable float in [0, 1). */
    $hash = static function (int $seed) use ($imul): float {
        $x = ($seed ^ 0x9E3779B9) & 0xFFFFFFFF;
        $x = $imul($x ^ ($x >> 16), 0x21F0AAAD) & 0xFFFFFFFF;
        $x = $imul($x ^ ($x >> 15), 0x735A2D97) & 0xFFFFFFFF;

        return (($x ^ ($x >> 15)) & 0xFFFFFFFF) / 0x100000000;
    };

    $rhythm = [1.14, 0.93, 0.88, 0.95, 1.04, 1.19, 1.27];
    $days = 200;

    return $db->transaction(static function (Database $db) use ($hash, $rhythm, $days, $clock): string {
        $today = $clock->display($clock->now());

        for ($offset = 0; $offset < $days; ++$offset) {
            if ($offset === 0) {
                // Stated, so the landing screen keeps the figures it has always had.
                $orders = 48;
                $revenue = 428420;
                $sessions = 1249;
                $returns = 5;
            } else {
                $trend = 1 - $offset * 0.0016;
                $jitter = 0.88 + $hash($offset) * 0.26;
                $orders = (int) max(6, round(42 * $rhythm[$offset % 7] * $trend * $jitter));
                $basket = 7400 + (int) round($hash($offset + 977) * 2600);
                $sessions = (int) round($orders * (24 + $hash($offset + 5501) * 8));
                $returns = (int) round($orders * (0.08 + $hash($offset + 131) * 0.07));
                $revenue = $orders * $basket;
            }

            $db->statement(
                'INSERT INTO trading_days (day, revenue, orders, sessions, returns, refreshed_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    revenue = VALUES(revenue), orders = VALUES(orders),
                    sessions = VALUES(sessions), returns = VALUES(returns), refreshed_at = VALUES(refreshed_at)',
                [
                    $today->modify(sprintf('-%d days', $offset))->format('Y-m-d'),
                    number_format((float) $revenue, 2, '.', ''),
                    $orders,
                    $sessions,
                    $returns,
                    $clock->nowString(),
                ],
            );
        }

        // ---- Activity river, derived from the registers that were just seeded.
        $db->statement('DELETE FROM activity_feed');

        $entries = [];

        foreach ($db->select(
            "SELECT number, console_state, total, placed_at FROM orders
              WHERE console_state IN ('Placed','Confirmed') ORDER BY placed_at DESC LIMIT 6",
        ) as $row) {
            $entries[] = [
                'Orders',
                (string) $row['console_state'] === 'Confirmed' ? 'order.confirmed' : 'order.placed',
                sprintf('%s %s', $row['number'], (string) $row['console_state'] === 'Confirmed' ? 'confirmed' : 'placed'),
                sprintf('₹%s', number_format((float) $row['total'], 0, '.', ',')),
                'Aarav D.',
                (string) $row['console_state'],
                'good',
                (string) $row['placed_at'],
            ];
        }

        foreach ($db->select('SELECT public_id, order_id, status, amount, created_at FROM payments ORDER BY created_at DESC LIMIT 6') as $row) {
            $failed = (string) $row['status'] === 'Failed';
            $entries[] = [
                'Payments',
                $failed ? 'payment.failed' : 'payment.captured',
                sprintf('%s %s', $row['public_id'], match ((string) $row['status']) {
                    'Failed' => 'failed',
                    'Due' => 'is due',
                    default => 'captured',
                }),
                sprintf('₹%s', number_format((float) $row['amount'], 0, '.', ',')),
                'System',
                (string) $row['status'],
                $failed ? 'bad' : ((string) $row['status'] === 'Due' ? 'warn' : 'good'),
                (string) $row['created_at'],
            ];
        }

        foreach ($db->select('SELECT public_id, order_number, status, provider, updated_at FROM shipments ORDER BY updated_at DESC LIMIT 5') as $row) {
            $failed = (string) $row['status'] === 'Failed';
            $entries[] = [
                'Shipping',
                'shipment.dispatched',
                sprintf('%s %s', $row['public_id'], strtolower((string) $row['status'])),
                sprintf('%s · %s', $row['provider'], $row['order_number']),
                'Warehouse',
                (string) $row['status'],
                $failed ? 'bad' : 'info',
                (string) $row['updated_at'],
            ];
        }

        foreach ($db->select("SELECT public_id, state, item_label, updated_at FROM return_requests WHERE state IN ('New','Approved') ORDER BY updated_at DESC LIMIT 4") as $row) {
            $entries[] = [
                'Returns',
                'return.approved',
                sprintf('%s %s', $row['public_id'], strtolower((string) $row['state'])),
                (string) $row['item_label'],
                'Aarav D.',
                (string) $row['state'],
                'warn',
                (string) $row['updated_at'],
            ];
        }

        foreach ($entries as $entry) {
            $db->statement(
                'INSERT INTO activity_feed (source, action, title, detail, actor, state, tone, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                $entry,
            );
        }

        // ---- Bell drawer: one signal per thing that genuinely needs someone.
        $db->statement('DELETE FROM ops_signals');

        $signals = 0;

        foreach ($db->select("SELECT public_id, order_id, amount FROM payments WHERE status = 'Failed'") as $row) {
            $order = $db->selectOne('SELECT number FROM orders WHERE id = ?', [(int) $row['order_id']]);
            $db->statement(
                'INSERT INTO ops_signals (kind, tone, title, detail, href, entity_type, entity_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    'payment', 'rose',
                    sprintf('Payment failed on %s', $order === null ? '' : $order['number']),
                    sprintf('₹%s could not be taken.', number_format((float) $row['amount'], 0, '.', ',')),
                    '/admin/payments/' . $row['public_id'],
                    'payment', (string) $row['public_id'],
                    $clock->nowString(),
                ],
            );
            ++$signals;
        }

        foreach ($db->select("SELECT public_id, order_number, fail_reason FROM shipments WHERE status = 'Failed'") as $row) {
            $db->statement(
                'INSERT INTO ops_signals (kind, tone, title, detail, href, entity_type, entity_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    'shipment', 'rose',
                    sprintf('Delivery failed on %s', $row['order_number']),
                    (string) ($row['fail_reason'] ?? 'The courier could not deliver it.'),
                    '/admin/shipments/' . $row['public_id'],
                    'shipment', (string) $row['public_id'],
                    $clock->nowString(),
                ],
            );
            ++$signals;
        }

        foreach ($db->select("SELECT public_id, item_label FROM return_requests WHERE state = 'New'") as $row) {
            $db->statement(
                'INSERT INTO ops_signals (kind, tone, title, detail, href, entity_type, entity_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    'return', 'amber',
                    sprintf('Return %s is waiting', $row['public_id']),
                    (string) $row['item_label'],
                    '/admin/returns/' . $row['public_id'],
                    'return', (string) $row['public_id'],
                    $clock->nowString(),
                ],
            );
            ++$signals;
        }

        foreach ($db->select("SELECT public_id, customer_name, topic FROM support_queries WHERE status = 'Open'") as $row) {
            $db->statement(
                'INSERT INTO ops_signals (kind, tone, title, detail, href, entity_type, entity_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    'support', 'amber',
                    sprintf('%s is waiting on a reply', $row['customer_name']),
                    (string) $row['topic'],
                    '/admin/support',
                    'support', (string) $row['public_id'],
                    $clock->nowString(),
                ],
            );
            ++$signals;
        }

        foreach ($db->select("SELECT sku, size, available FROM v_variant_availability WHERE stock = 'SOLD_OUT' LIMIT 6") as $row) {
            $db->statement(
                'INSERT INTO ops_signals (kind, tone, title, detail, href, entity_type, entity_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    'inventory', 'amber',
                    sprintf('%s is sold out', $row['sku']),
                    sprintf('Size %s has nothing sellable left.', $row['size']),
                    '/admin/inventory/overview',
                    'variant', (string) $row['sku'],
                    $clock->nowString(),
                ],
            );
            ++$signals;
        }

        return sprintf('%d trading days, %d activity entries, %d signals', $days, count($entries), $signals);
    });
};
