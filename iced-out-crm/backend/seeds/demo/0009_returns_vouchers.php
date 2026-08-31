<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;

/**
 * The returns register (`18-returns/data/admin-return-fixtures.ts`), the
 * promotional coupons (§9.7) and the one seeded voucher (`10-coupons/vouchers.ts`).
 *
 * `amount` is what the customer paid for the item coming back, so it is stored.
 * What a REPLACEMENT costs is not: the exchange balance is read from the
 * catalogue live, because a replacement is priced at what it sells for today.
 */
return static function (Container $container): string {
    /** @var Database $db */
    $db = $container->get(Database::class);

    $returns = [
        ['ret-072', 'IO-2026-1027', 'Aarav Mehta', 'Bone Utility Overshirt · L', 'Size / fit', 'Exchange', 11400, 'Shadow Cargo 02 · L', 'shadow-cargo-02', 'New'],
        ['ret-071', 'IO-2026-1024', 'Ishita Rao', 'Shadow Cargo 02 · M', 'Changed mind', 'Voucher', 9800, '', null, 'New'],
        ['ret-069', 'IO-2026-1018', 'Kabir Shah', 'Afterdark Hoodie · M', 'Quality concern', 'Exchange', 8900, 'Bone Utility Overshirt · L', 'bone-utility-overshirt', 'Approved'],
        ['ret-066', 'IO-2026-1011', 'Meera Nair', 'Core Heavy Tee · S', 'Wrong item', 'Voucher', 4600, '', null, 'Approved'],
        ['ret-064', 'IO-2026-1008', 'Ananya Bose', 'Core Heavy Tee · S', 'Size / fit', 'Exchange', 4600, 'Core Heavy Tee · M', 'core-heavy-tee', 'Completed'],
        ['ret-058', 'IO-2026-0996', 'Diya Kapoor', 'Afterdark Hoodie · XL', 'Changed mind', 'Voucher', 8900, '', null, 'Rejected'],
        // The settled return the account archive already shows — it is what
        // pays for voucher IOV061 below.
        ['ret-061', 'IO-2026-1021', 'Iced_out Shopper', 'Core Heavy Tee · Ink / S', 'Size / fit', 'Voucher', 4600, '', null, 'Completed'],
    ];

    $coupons = [
        ['AFTERDARK15', '15% off Drop 001', 'percent', 15, 7500],
        ['FIRSTICE10', '10% off your first bag', 'percent', 10, 0],
        ['FREEZE500', '₹500 off', 'amount', 500, 4999],
    ];

    return $db->transaction(static function (Database $db) use ($returns, $coupons): string {
        $money = static fn (float $amount): string => number_format($amount, 2, '.', '');

        $products = [];

        foreach ($db->select('SELECT id, public_id FROM products') as $row) {
            $products[(string) $row['public_id']] = (int) $row['id'];
        }

        $shopper = $db->selectOne('SELECT id FROM users WHERE public_id = ?', ['cus-2049']);

        /** @var \Iced\Support\Clock $clock */
        $clock = new \Iced\Support\Clock();

        foreach ($returns as $index => $return) {
            [$publicId, $order, $customer, $item, $reason, $outcome, $amount, $replacement, $replacementSlug, $state] = $return;

            // Newest first in the register: ret-072 is the most recent request,
            // so it is seeded as the most recent row rather than relying on
            // insertion order behind a shared timestamp.
            $createdAt = $clock->addSeconds(-3600 * ($index + 1))->format(\Iced\Support\Clock::STORAGE_FORMAT);

            // The customer projection is derived from the state, never typed twice.
            $customerStatus = match (true) {
                $state === 'Completed' && $outcome === 'Voucher' => 'Voucher issued',
                $state === 'Completed' => 'Exchange on its way',
                default => 'Pickup scheduled',
            };

            $orderItem = $db->selectOne(
                'SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.number = ? LIMIT 1',
                [$order],
            );

            $db->statement(
                'INSERT INTO return_requests
                    (public_id, order_number, user_id, customer_name, item_label, order_item_id, reason, outcome,
                     amount, replacement_product_id, replacement_label, state, customer_status, destination,
                     reference, pickup_slot, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    state = VALUES(state), customer_status = VALUES(customer_status),
                    amount = VALUES(amount), replacement_label = VALUES(replacement_label),
                    replacement_product_id = VALUES(replacement_product_id), created_at = VALUES(created_at)',
                [
                    $publicId, $order,
                    $customer === 'Iced_out Shopper' && $shopper !== null ? (int) $shopper['id'] : null,
                    $customer, $item,
                    $orderItem === null ? null : (int) $orderItem['id'],
                    $reason, $outcome, $money((float) $amount),
                    $replacementSlug === null ? null : ($products[$replacementSlug] ?? null),
                    $replacement, $state, $customerStatus,
                    'Bengaluru 560001', strtoupper(str_replace('-', '', $publicId)), 'Tomorrow, 10:00 – 14:00',
                    $createdAt,
                ],
            );
        }

        foreach ($coupons as $coupon) {
            [$code, $label, $kind, $value, $minSubtotal] = $coupon;

            $db->statement(
                'INSERT INTO coupons (code, label, kind, value, min_subtotal, active)
                 VALUES (?, ?, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE
                    label = VALUES(label), kind = VALUES(kind), value = VALUES(value),
                    min_subtotal = VALUES(min_subtotal), active = 1',
                [$code, $label, $kind, $money((float) $value), $money((float) $minSubtotal)],
            );
        }

        // IOV061 — the credit for ret-061, unclaimed. The account's vouchers tab
        // would otherwise be empty for a return its orders page shows as settled.
        $db->statement(
            'INSERT INTO vouchers
                (code, amount, return_public_id, reason, customer_name, customer_user_id, issued_on, expires_on, claimed_on, claimed_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
             ON DUPLICATE KEY UPDATE amount = VALUES(amount), expires_on = VALUES(expires_on)',
            [
                'IOV061', $money(4600.0), 'ret-061', 'Core Heavy Tee · Ink / S', 'Iced_out Shopper',
                $shopper === null ? null : (int) $shopper['id'], '2026-07-22', '2027-07-22',
            ],
        );

        return sprintf('%d returns, %d coupons, 1 voucher', count($returns), count($coupons));
    });
};
