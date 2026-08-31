<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;
use Iced\Support\Clock;

/**
 * Orders, their lines, and the payment ledger.
 *
 * Three tiers, all real rows so every foreign key holds:
 *
 *  1. The register orders of `07-orders/data/admin-order-fixtures.ts` — seeded
 *     as LINES against the real catalogue, exactly as the fixture does, so item
 *     counts and values are counted rather than typed.
 *  2. IO-2026-1027, the delivered order the account area opens (spec §12), with
 *     the return-eligible overshirt line that `ret-072` comes back from.
 *  3. History orders — every number the customer histories, returns and refunds
 *     reference. Minimal but real, so a customer listed with four orders opens
 *     onto four.
 *
 * `placed_at` is stored relative to now, not as a fixed August date: the console
 * recomputes age at read time (endpoint #94), so seeding "1 h 04 min ago" is
 * what keeps the register reading the way the fixture wrote it on any day.
 *
 * Note: the payment fixtures state their own amounts, which for some orders
 * differ from the line total (pay_ICE1048 says 11400 against an 18100 order).
 * That disagreement is in the frontend fixtures themselves and both registers
 * display their own figure, so both are seeded as written rather than silently
 * reconciled.
 */
return static function (Container $container): string {
    /** @var Database $db */
    $db = $container->get(Database::class);
    /** @var Clock $clock */
    $clock = $container->get(Clock::class);

    $now = $clock->now();

    // ACCOUNT LINKS follow the customer register's own histories
    // (`01-users/customers-data.ts`) exactly, so a customer listed with four
    // orders opens onto those four and no others. An order that no history
    // claims carries no account link — it is still a full member of the order
    // register, which displays contact_name rather than the account.
    $registerOrders = [
        ['number' => 'IO-2026-1048', 'public_id' => 'ord-1048', 'customer' => 'cus-2048', 'contact' => 'Aarav K.',
            'payment' => 'Captured', 'method' => 'UPI', 'state' => 'Placed', 'destination' => 'Bengaluru', 'age' => 8,
            'lines' => [['afterdark-hoodie', 'M', 1], ['core-heavy-tee', 'L', 2]], 'status' => 'Processing'],
        ['number' => 'IO-2026-1047', 'public_id' => 'ord-1047', 'customer' => null, 'contact' => 'Riya S.',
            'payment' => 'Due', 'method' => 'Cash on delivery', 'state' => 'Placed', 'destination' => 'Mumbai', 'age' => 16,
            'lines' => [['bone-utility-overshirt', 'S', 1]], 'status' => 'Processing'],
        // The order register calls this one Confirmed with a captured payment;
        // the payments ledger calls pay_ICE1046 Failed. Both are seeded exactly
        // as written, and they are reconciled the way a real store reconciles
        // them: the netbanking attempt failed and the customer paid again. The
        // failed attempt stays in the ledger (and stays the dashboard's payment
        // exception); the retry is what the order register reads.
        ['number' => 'IO-2026-1046', 'public_id' => 'ord-1046', 'customer' => null, 'contact' => 'Maya P.',
            'payment' => 'Captured', 'method' => 'Netbanking', 'state' => 'Confirmed', 'destination' => 'Delhi', 'age' => 42,
            'lines' => [['shadow-cargo-02', 'M', 1], ['afterdark-hoodie', 'L', 1], ['core-heavy-tee', 'M', 1]], 'status' => 'Payment failed'],
        ['number' => 'IO-2026-1045', 'public_id' => 'ord-1045', 'customer' => null, 'contact' => 'Ishan T.',
            'payment' => 'Captured', 'method' => 'Card', 'state' => 'Confirmed', 'destination' => 'Bengaluru', 'age' => 64,
            'lines' => [['afterdark-hoodie', 'L', 2]], 'status' => 'Processing'],
        ['number' => 'IO-2026-1044', 'public_id' => 'ord-1044', 'customer' => 'cus-2031', 'contact' => 'Dev W.',
            'payment' => 'Refunded', 'method' => 'Mastercard ••••7731', 'state' => 'Confirmed', 'destination' => 'Pune', 'age' => 72,
            'lines' => [['core-heavy-tee', 'S', 1]], 'status' => 'Delivered'],
        ['number' => 'IO-2026-1042', 'public_id' => 'ord-1042', 'customer' => null, 'contact' => 'Sana R.',
            'payment' => 'Refunded', 'method' => 'UPI', 'state' => 'Cancelled', 'destination' => 'Chennai', 'age' => 124,
            'lines' => [['shadow-cargo-02', 'L', 1], ['core-heavy-tee', 'XL', 1]], 'status' => 'Cancelled', 'cancelled_by' => 'Customer'],
        ['number' => 'IO-2026-1039', 'public_id' => 'ord-1039', 'customer' => 'cus-2047', 'contact' => 'Noor A.',
            'payment' => 'Captured', 'method' => 'UPI', 'state' => 'Confirmed', 'destination' => 'Kolkata', 'age' => 320,
            'lines' => [['afterdark-hoodie', 'XL', 1]], 'status' => 'Processing'],
        // The account's own delivered order — the one "Start a return" opens from.
        ['number' => 'IO-2026-1027', 'public_id' => 'ord-1027', 'customer' => 'cus-2049', 'contact' => 'Iced_out Shopper',
            'payment' => 'Captured', 'method' => 'UPI', 'state' => 'Confirmed', 'destination' => 'Bengaluru', 'age' => 18720,
            'lines' => [['bone-utility-overshirt', 'L', 1]], 'status' => 'Delivered'],
    ];

    /**
     * number => [public_id, customer, placed (Y-m-d), pieces, value, status]
     *
     * The customer-linked rows are exactly the histories in
     * `01-users/customers-data.ts`, values included, so each register row's
     * order count and lifetime value are the sum of real orders rather than a
     * second figure sitting nearby. The unlinked rows exist because the
     * payments, refunds and returns fixtures name them.
     */
    $historyOrders = [
        'IO-2026-1043' => ['ord-1043', null, '2026-08-03', 2, 24800, 'Processing'],
        'IO-2026-1034' => ['ord-1034', null, '2026-07-30', 1, 4600, 'Cancelled'],
        'IO-2026-1030' => ['ord-1030', 'cus-2019', '2026-07-28', 1, 6400, 'Delivered'],
        'IO-2026-1024' => ['ord-1024', null, '2026-07-25', 1, 9800, 'Delivered'],
        'IO-2026-1021' => ['ord-1021', 'cus-2048', '2026-07-22', 1, 8900, 'Delivered'],
        'IO-2026-1018' => ['ord-1018', null, '2026-07-20', 1, 8900, 'Delivered'],
        'IO-2026-1012' => ['ord-1012', 'cus-2031', '2026-07-19', 2, 18400, 'Delivered'],
        'IO-2026-1011' => ['ord-1011', null, '2026-07-18', 1, 4600, 'Delivered'],
        'IO-2026-1008' => ['ord-1008', null, '2026-07-16', 1, 4600, 'Delivered'],
        'IO-2026-0996' => ['ord-0996', 'cus-1984', '2026-07-12', 1, 14200, 'Delivered'],
        'IO-2026-0984' => ['ord-0984', 'cus-2048', '2026-07-09', 3, 12400, 'Delivered'],
        'IO-2026-0977' => ['ord-0977', 'cus-2031', '2026-07-07', 1, 12600, 'Delivered'],
        'IO-2026-0968' => ['ord-0968', 'cus-2047', '2026-07-05', 1, 5900, 'Delivered'],
        'IO-2026-0941' => ['ord-0941', 'cus-2031', '2026-06-26', 1, 9800, 'Delivered'],
        'IO-2026-0934' => ['ord-0934', 'cus-1984', '2026-06-24', 1, 9700, 'Delivered'],
        'IO-2026-0912' => ['ord-0912', 'cus-2048', '2026-06-18', 1, 3500, 'Delivered'],
        'IO-2026-0908' => ['ord-0908', 'cus-2031', '2026-06-16', 1, 7400, 'Delivered'],
        'IO-2026-0872' => ['ord-0872', 'cus-2031', '2026-06-02', 1, 5300, 'Delivered'],
        'IO-2026-0865' => ['ord-0865', 'cus-1984', '2026-05-31', 1, 5000, 'Cancelled'],
        'IO-2026-0831' => ['ord-0831', 'cus-2031', '2026-05-21', 1, 3000, 'Delivered'],
    ];

    // The payments register, verbatim from `09-payment/payment-data.ts`.
    $payments = [
        ['pay_ICE1048', 'IO-2026-1048', 'A•••• K••••', 'Razorpay', 'UPI ••••42', 11400, 'Captured', 'Taken at checkout', 'rzp_live_8Kq2•••4810', 8],
        ['pay_ICE1047', 'IO-2026-1047', 'R•••• S••••', 'Courier', 'Cash on delivery', 8900, 'Due', 'The courier collects it at the door', '', 22],
        ['pay_ICE1046', 'IO-2026-1046', 'M•••• P••••', 'Razorpay', 'Netbanking', 18700, 'Failed', 'Bank declined the debit', 'rzp_live_7Jd9•••4602', 49],
        // The retry that let IO-2026-1046 be confirmed. Without it the order
        // register would have to show "Failed" where its own fixture shows
        // "Captured", because the register reads the ledger rather than a copy.
        ['pay_ICE1046R', 'IO-2026-1046', 'M•••• P••••', 'Razorpay', 'Netbanking', 18700, 'Captured', 'Taken at checkout on the second attempt', 'rzp_live_7Jd9•••4713', 44],
        ['pay_ICE1045', 'IO-2026-1045', 'S•••• N••••', 'Razorpay', 'UPI ••••11', 6200, 'Captured', 'Taken at checkout', 'rzp_live_5Tb1•••4553', 80],
        ['pay_ICE1044', 'IO-2026-1044', 'K•••• V••••', 'Cashfree', 'Mastercard ••••7731', 12400, 'Refunded', 'Sent back in full after a return', 'cf_9021•••4471', 1196],
        ['pay_ICE1043', 'IO-2026-1043', 'D•••• J••••', 'Courier', 'Cash on delivery', 24800, 'Due', 'Out for delivery — collect on arrival', '', 1248],
        // The payments fixture lists six rows; the order register states a
        // payment state for every order and the refund register names payments
        // of its own. Those rows are seeded here so no order in the register
        // falls back to a default payment state it was never given, and no
        // refund points at a payment that does not exist.
        ['pay_ICE1042', 'IO-2026-1042', 'S•••• R••••', 'Razorpay', 'UPI ••••63', 14400, 'Refunded', 'Sent back after the customer called it off', 'rzp_live_4Nb2•••4128', 130],
        ['pay_ICE1039', 'IO-2026-1039', 'N•••• A••••', 'Razorpay', 'UPI ••••07', 8900, 'Captured', 'Taken at checkout', 'rzp_live_6Ke5•••4039', 326],
        ['pay_ICE1034', 'IO-2026-1034', 'R•••• S••••', 'Razorpay', 'UPI ••••90', 4600, 'Refunded', 'Order called off before dispatch', 'rzp_live_3Ma7•••4390', 20160],
        ['pay_ICE1021', 'IO-2026-1021', 'A•••• K••••', 'Razorpay', 'Card ••••4471', 8900, 'Captured', 'Taken at checkout', 'rzp_live_2Qc4•••4211', 33120],
        ['pay_ICE1027', 'IO-2026-1027', 'I•••• S••••', 'Razorpay', 'UPI ••••31', 11400, 'Captured', 'Taken at checkout', 'rzp_live_1Za8•••4270', 18720],
    ];

    $refunds = [
        ['ref_ICE072', 'pay_ICE1044', 'IO-2026-1044', 12400, 'Return approved', 'Succeeded'],
        ['ref_ICE071', 'pay_ICE1034', 'IO-2026-1034', 4600, 'Order cancelled', 'Processing'],
        ['ref_ICE070', 'pay_ICE1047', 'IO-2026-1047', 8900, 'Payment mismatch', 'Requested'],
        ['ref_ICE069', 'pay_ICE1021', 'IO-2026-1021', 3100, 'Goodwill', 'Failed'],
    ];

    $payouts = [
        ['out_ICE084', 'Razorpay', '03–04 Aug 2026', 284600, 5692, 'Pending', null],
        ['out_ICE083', 'Stripe', '02–03 Aug 2026', 94200, 2166, 'Paid', '2026-08-03 12:00:00'],
        ['out_ICE082', 'Razorpay', '01–02 Aug 2026', 196300, 3926, 'Paid', '2026-08-02 12:00:00'],
    ];

    return $db->transaction(static function (Database $db) use (
        $registerOrders,
        $historyOrders,
        $payments,
        $refunds,
        $payouts,
        $now,
    ): string {
        $money = static fn (float $amount): string => number_format($amount, 2, '.', '');

        $users = [];

        foreach ($db->select("SELECT id, public_id, name, email, phone FROM users WHERE type = 'CUSTOMER'") as $row) {
            $users[(string) $row['public_id']] = $row;
        }

        $products = [];

        foreach ($db->select('SELECT id, public_id, name, price, color FROM products') as $row) {
            $products[(string) $row['public_id']] = $row;
        }

        $orderIds = [];

        $insertOrder = static function (array $order) use ($db, $money, &$orderIds): int {
            $db->statement(
                'INSERT INTO orders
                    (public_id, number, user_id, status, console_state, cancelled_by,
                     contact_name, contact_email, contact_mobile, addr_line, addr_city, addr_state, addr_postal,
                     delivery_label, delivery_estimate, delivery_fee, subtotal, discount, total,
                     items_summary, cancellation_eligible, placed_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    status = VALUES(status), console_state = VALUES(console_state),
                    cancelled_by = VALUES(cancelled_by), total = VALUES(total),
                    subtotal = VALUES(subtotal), items_summary = VALUES(items_summary),
                    placed_at = VALUES(placed_at)',
                [
                    $order['public_id'], $order['number'], $order['user_id'], $order['status'], $order['console_state'],
                    $order['cancelled_by'], $order['contact_name'], $order['contact_email'], $order['contact_mobile'],
                    $order['addr_line'], $order['addr_city'], $order['addr_state'], $order['addr_postal'],
                    $order['delivery_label'], $order['delivery_estimate'],
                    $money((float) $order['delivery_fee']), $money((float) $order['subtotal']),
                    $money(0.0), $money((float) $order['total']),
                    $order['items_summary'], $order['cancellation_eligible'], $order['placed_at'], $order['placed_at'],
                ],
            );

            $row = $db->selectOne('SELECT id FROM orders WHERE number = ?', [$order['number']]);
            $id = $row === null ? 0 : (int) $row['id'];
            $orderIds[$order['number']] = $id;

            return $id;
        };

        $lineCount = 0;

        foreach ($registerOrders as $order) {
            $user = $users[$order['customer']] ?? null;
            $placedAt = $now->modify(sprintf('-%d minutes', $order['age']))->format('Y-m-d H:i:s.u');

            $subtotal = 0;
            $names = [];

            foreach ($order['lines'] as $line) {
                $product = $products[$line[0]] ?? null;

                if ($product === null) {
                    continue;
                }

                $subtotal += (int) (float) $product['price'] * $line[2];
                $names[] = (string) $product['name'];
            }

            $orderId = $insertOrder([
                'public_id' => $order['public_id'],
                'number' => $order['number'],
                'user_id' => $user === null ? null : (int) $user['id'],
                'status' => $order['status'],
                'console_state' => $order['state'],
                'cancelled_by' => $order['cancelled_by'] ?? null,
                'contact_name' => $order['contact'],
                'contact_email' => $user === null ? '' : (string) $user['email'],
                'contact_mobile' => $user === null ? '' : (string) $user['phone'],
                'addr_line' => '12 Residency Road',
                'addr_city' => $order['destination'],
                'addr_state' => 'Karnataka',
                'addr_postal' => '560001',
                'delivery_label' => 'Iced_out Logistics · Surface',
                'delivery_estimate' => '',
                'delivery_fee' => 0,
                'subtotal' => $subtotal,
                'total' => $subtotal,
                'items_summary' => implode(' · ', $names),
                'cancellation_eligible' => $order['state'] === 'Placed' ? 1 : 0,
                'placed_at' => $placedAt,
            ]);

            if ($orderId === 0) {
                continue;
            }

            $db->statement('DELETE FROM order_items WHERE order_id = ?', [$orderId]);

            foreach ($order['lines'] as $index => $line) {
                $product = $products[$line[0]] ?? null;

                if ($product === null) {
                    continue;
                }

                $unit = (int) (float) $product['price'];

                $db->statement(
                    'INSERT INTO order_items
                        (order_id, line_public_id, product_id, name, variant_label, size, quantity,
                         unit_price, line_total, return_eligible, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        $orderId,
                        sprintf('%s-l%d', $order['public_id'], $index + 1),
                        (int) $product['id'],
                        (string) $product['name'],
                        sprintf('%s / %s', $product['color'], $line[1]),
                        $line[1],
                        $line[2],
                        $money((float) $unit),
                        $money((float) ($unit * $line[2])),
                        $order['status'] === 'Delivered' ? 1 : 0,
                        $placedAt,
                    ],
                );

                ++$lineCount;
            }

            $db->statement(
                'INSERT INTO order_status_history (order_id, seq, from_status, to_status, actor_type, note, created_at)
                 VALUES (?, 1, \'\', ?, \'system\', \'Order placed\', ?)
                 ON DUPLICATE KEY UPDATE to_status = VALUES(to_status)',
                [$orderId, 'Placed', $placedAt],
            );
        }

        foreach ($historyOrders as $number => $history) {
            [$publicId, $customer, $placed, $pieces, $value, $status] = $history;
            $user = $users[$customer] ?? null;

            $insertOrder([
                'public_id' => $publicId,
                'number' => $number,
                'user_id' => $user === null ? null : (int) $user['id'],
                'status' => $status,
                'console_state' => $status === 'Cancelled' ? 'Cancelled' : 'Confirmed',
                'cancelled_by' => $status === 'Cancelled' ? 'Store' : null,
                'contact_name' => $user === null ? '' : (string) $user['name'],
                'contact_email' => $user === null ? '' : (string) $user['email'],
                'contact_mobile' => $user === null ? '' : (string) $user['phone'],
                'addr_line' => '12 Residency Road',
                'addr_city' => 'Bengaluru',
                'addr_state' => 'Karnataka',
                'addr_postal' => '560001',
                'delivery_label' => 'Iced_out Logistics · Surface',
                'delivery_estimate' => '',
                'delivery_fee' => 0,
                'subtotal' => $value,
                'total' => $value,
                'items_summary' => sprintf('%d piece%s', $pieces, $pieces === 1 ? '' : 's'),
                'cancellation_eligible' => 0,
                'placed_at' => $placed . ' 09:00:00.000000',
            ]);
        }

        $paymentIds = [];

        foreach ($payments as $payment) {
            [$publicId, $number, $masked, $gateway, $method, $amount, $status, $note, $reference, $ageMinutes] = $payment;

            if (!isset($orderIds[$number]) || $orderIds[$number] === 0) {
                continue;
            }

            $createdAt = $now->modify(sprintf('-%d minutes', $ageMinutes))->format('Y-m-d H:i:s.u');

            $db->statement(
                'INSERT INTO payments
                    (public_id, order_id, customer_masked, gateway, method, amount, status, note, reference,
                     signature_verified, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    status = VALUES(status), amount = VALUES(amount), note = VALUES(note),
                    method = VALUES(method), gateway = VALUES(gateway), created_at = VALUES(created_at)',
                [
                    $publicId, $orderIds[$number], $masked, $gateway, $method, $money((float) $amount),
                    $status, $note, $reference, $status === 'Captured' ? 1 : 0, $createdAt,
                ],
            );

            $row = $db->selectOne('SELECT id FROM payments WHERE public_id = ?', [$publicId]);
            $paymentIds[$publicId] = $row === null ? 0 : (int) $row['id'];
        }

        foreach ($refunds as $refund) {
            [$publicId, $paymentPublicId, $number, $amount, $reason, $status] = $refund;

            if (($paymentIds[$paymentPublicId] ?? 0) === 0) {
                continue;
            }

            $db->statement(
                'INSERT INTO refunds (public_id, payment_id, order_number, amount, reason, status)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE amount = VALUES(amount), reason = VALUES(reason), status = VALUES(status)',
                [$publicId, $paymentIds[$paymentPublicId], $number, $money((float) $amount), $reason, $status],
            );
        }

        // Distinct created_at, newest period first: a register ordered by a
        // timestamp every row shares falls back to insertion order, which is
        // not the order an operator expects to read them in.
        foreach ($payouts as $index => $payout) {
            [$publicId, $gateway, $period, $gross, $fees, $status, $paidAt] = $payout;

            $db->statement(
                'INSERT INTO payouts (public_id, gateway, period_label, gross, fees, status, paid_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    gross = VALUES(gross), fees = VALUES(fees), status = VALUES(status), created_at = VALUES(created_at)',
                [
                    $publicId, $gateway, $period, $money((float) $gross), $money((float) $fees), $status, $paidAt,
                    $now->modify(sprintf('-%d days', $index + 1))->format('Y-m-d H:i:s.u'),
                ],
            );
        }

        return sprintf(
            '%d orders (%d lines), %d payments, %d refunds, %d payouts',
            count($registerOrders) + count($historyOrders),
            $lineCount,
            count($payments),
            count($refunds),
            count($payouts),
        );
    });
};
