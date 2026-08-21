<?php

declare(strict_types=1);

namespace Iced\Service\Checkout;

use Iced\Domain\Money;
use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Repository\OrderRepository;
use Iced\Service\Inventory\StockService;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;
use Iced\Support\IdAllocator;
use Iced\Support\Validator;

/**
 * The place-order transaction of spec §9.2 — the one write in this system that
 * must be all-or-nothing.
 *
 * The recipe, in order:
 *
 *   BEGIN
 *     re-validate contact and address (§8.4 rules), refuse a blocked customer
 *     lock variant rows in ascending id, reserve stock or fail with ICE-INV-409
 *     re-price EVERYTHING from the catalogue — the client's money block is
 *       cross-checked, never trusted
 *     re-validate the coupon or voucher, claim the voucher
 *     allocate ord-local-* slot, IO-2026-<next> number, track-local-* token
 *     insert order + frozen line snapshots + status history
 *     insert the payment row for the outcome
 *   COMMIT
 *
 * A failed gateway payment STILL creates the order, with status "Payment
 * failed" — throwing away a bag because a card bounced is how a shopper loses
 * an evening's work, and the order screen offers the attempt again.
 */
final class PlaceOrderService
{
    public function __construct(
        private readonly Database $db,
        private readonly OrderRepository $orders,
        private readonly StockService $stock,
        private readonly StoreSettings $settings,
        private readonly IdAllocator $ids,
        private readonly Clock $clock,
    ) {
    }

    /**
     * @param array<string, mixed> $input
     *
     * @return array<string, mixed> the stored order row
     */
    public function place(Principal $customer, array $input): array
    {
        $contact = $this->validateContact($input);
        $address = $this->validateAddress($input);

        /** @var list<array{productId: string, size: string, quantity: int}> $lines */
        $lines = $this->validateLines($input);

        return $this->db->transaction(function () use ($customer, $contact, $address, $lines, $input): array {
            $account = $this->db->selectOne('SELECT status FROM users WHERE id = ? FOR UPDATE', [$customer->userId]);

            if ($account !== null && (string) $account['status'] === 'BLOCKED') {
                throw new ConflictException(
                    'ICE-USR-409',
                    'This account cannot place orders. Please contact support.',
                );
            }

            // ---- price from the catalogue, never from the request ----------
            $priced = [];
            $subtotal = Money::fromRupees(0);

            foreach ($lines as $line) {
                $variant = $this->db->selectOne(
                    'SELECT v.id, v.size, v.color, p.id AS product_id, p.public_id AS slug, p.name, p.price
                       FROM product_variants v
                       JOIN products p ON p.id = v.product_id
                      WHERE p.public_id = ? AND v.size = ? AND v.deleted_at IS NULL AND p.deleted_at IS NULL
                      LIMIT 1',
                    [$line['productId'], $line['size']],
                );

                if ($variant === null) {
                    throw ValidationException::field(
                        'lines',
                        sprintf('%s is no longer available in size %s.', $line['productId'], $line['size']),
                        'ICE-CHK-422',
                    );
                }

                $unit = Money::fromDecimalString((string) $variant['price']);
                $lineTotal = $unit->times($line['quantity']);
                $subtotal = $subtotal->plus($lineTotal);

                $priced[] = [
                    'variant_id' => (int) $variant['id'],
                    'product_id' => (int) $variant['product_id'],
                    'name' => (string) $variant['name'],
                    'variant_label' => sprintf('%s / %s', $variant['color'], $variant['size']),
                    'size' => (string) $variant['size'],
                    'quantity' => $line['quantity'],
                    'unit' => $unit,
                    'line_total' => $lineTotal,
                ];
            }

            // ---- reserve, locking in a stable order so two checkouts racing
            //      for the last piece cannot deadlock against each other ------
            usort($priced, static fn (array $a, array $b): int => $a['variant_id'] <=> $b['variant_id']);

            // ---- discount and delivery, both recomputed --------------------
            $discount = $this->discountFor($customer, $input, $subtotal);
            $delivery = $this->deliveryFee($input, $subtotal);
            $total = $subtotal->minus($discount)->plus($delivery)->atLeastZero();

            $this->crossCheckMoney($input, $subtotal, $discount, $total);

            // ---- ids the static export can address (spec §11) --------------
            $publicId = $this->ids->allocate('order');
            $number = $this->ids->nextOrderNumber();

            $outcome = (string) ($input['payment']['outcome'] ?? 'due');
            $failed = $outcome === 'failed';

            $placedAt = $this->clock->nowString();

            $orderId = $this->db->insert(
                'INSERT INTO orders
                    (public_id, number, user_id, status, console_state, contact_name, contact_email, contact_mobile,
                     addr_line, addr_city, addr_state, addr_postal, delivery_label, delivery_estimate, delivery_fee,
                     subtotal, discount, total, coupon_code, items_summary, cancellation_eligible, placed_at, created_at)
                 VALUES (?, ?, ?, ?, \'Placed\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
                [
                    $publicId, $number, $customer->userId,
                    $failed ? 'Payment failed' : 'Processing',
                    $contact['name'], $contact['email'], $contact['mobile'],
                    $address['line'], $address['city'], $address['state'], $address['postalCode'],
                    (string) ($input['delivery']['label'] ?? 'Standard delivery'),
                    (string) ($input['delivery']['estimate'] ?? ''),
                    $delivery->toDecimalString(),
                    $subtotal->toDecimalString(), $discount->toDecimalString(), $total->toDecimalString(),
                    $input['money']['couponCode'] ?? null,
                    implode(' · ', array_column($priced, 'name')),
                    $placedAt, $placedAt,
                ],
            );

            foreach ($priced as $index => $line) {
                $orderItemId = $this->db->insert(
                    'INSERT INTO order_items
                        (order_id, line_public_id, product_id, name, variant_label, size, quantity,
                         unit_price, line_total, return_eligible, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
                    [
                        $orderId, sprintf('%s-l%d', $publicId, $index + 1), $line['product_id'],
                        $line['name'], $line['variant_label'], $line['size'], $line['quantity'],
                        $line['unit']->toDecimalString(), $line['line_total']->toDecimalString(), $placedAt,
                    ],
                );

                // Held, not sold: dispatch is what turns a reservation into a sale.
                $ttl = $this->settings->int(
                    $outcome === 'captured' ? 'inventory.reservation_ttl_prepaid' : 'inventory.reservation_ttl_cod',
                    900,
                );

                $this->stock->reserve($line['variant_id'], $line['quantity'], $orderId, $orderItemId, null, $ttl);
            }

            $this->orders->appendHistory($orderId, '', 'Placed', 'customer', $customer->userId, 'Order placed');

            $this->writePayment($orderId, $number, $contact['name'], $total, $input, $outcome);
            $this->claimVoucher($customer, $input, $number);

            $order = $this->db->selectOne('SELECT * FROM orders WHERE id = ?', [$orderId]);

            return $order ?? [];
        });
    }

    /** @param array<string, mixed> $input */
    private function writePayment(int $orderId, string $number, string $customer, Money $total, array $input, string $outcome): void
    {
        /** @var array<string, mixed> $payment */
        $payment = is_array($input['payment'] ?? null) ? $input['payment'] : [];
        $method = (string) ($payment['method'] ?? 'Cash on delivery');

        [$status, $gateway, $note] = match ($outcome) {
            'captured' => ['Captured', 'Razorpay', 'Taken at checkout'],
            'failed' => ['Failed', 'Razorpay', (string) ($payment['note'] ?? 'The payment did not go through')],
            default => ['Due', 'Courier', 'The courier collects it at the door'],
        };

        // A ₹0 payable settles as store credit, captured (spec §9.1).
        if ($total->isZero()) {
            [$status, $gateway, $note] = ['Captured', 'Store credit', 'Paid with store credit'];
            $method = 'Store credit';
        }

        $this->db->statement(
            'INSERT INTO payments
                (public_id, order_id, customer_masked, gateway, method, amount, status, note, reference, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $this->ids->allocate('payment'),
                $orderId,
                \Iced\Presenter\Format::maskName($customer),
                $gateway,
                $method,
                $total->toDecimalString(),
                $status,
                $note,
                (string) ($payment['reference'] ?? ''),
                $this->clock->nowString(),
            ],
        );

        unset($number);
    }

    /**
     * A voucher is claimed HERE and nowhere else — inside the same transaction
     * that creates the order, so it can never be spent twice.
     *
     * @param array<string, mixed> $input
     */
    private function claimVoucher(Principal $customer, array $input, string $number): void
    {
        $code = $input['money']['couponCode'] ?? null;

        if (!is_string($code) || $code === '') {
            return;
        }

        $voucher = $this->db->selectOne(
            'SELECT id FROM vouchers WHERE code = ? AND customer_user_id = ? AND claimed_on IS NULL FOR UPDATE',
            [$code, $customer->userId],
        );

        if ($voucher === null) {
            return;
        }

        $this->db->statement(
            'UPDATE vouchers SET claimed_on = ?, claimed_order = ? WHERE id = ?',
            [$this->clock->display($this->clock->now())->format('Y-m-d'), $number, (int) $voucher['id']],
        );
    }

    /** @param array<string, mixed> $input */
    private function discountFor(Principal $customer, array $input, Money $subtotal): Money
    {
        $code = $input['money']['couponCode'] ?? null;

        if (!is_string($code) || $code === '') {
            return Money::fromRupees(0);
        }

        $coupon = $this->db->selectOne(
            'SELECT kind, value, min_subtotal FROM coupons WHERE code = ? AND active = 1',
            [$code],
        );

        if ($coupon === null) {
            $voucher = $this->db->selectOne(
                'SELECT amount FROM vouchers WHERE code = ? AND customer_user_id = ? AND claimed_on IS NULL',
                [$code, $customer->userId],
            );

            if ($voucher === null) {
                throw ValidationException::field('couponCode', sprintf('%s is not a code we know.', $code), 'ICE-CPN-422');
            }

            // Store credit has no minimum: it is money the shop already owes.
            return Money::fromDecimalString((string) $voucher['amount'])->clampTo($subtotal);
        }

        $minimum = Money::fromDecimalString((string) $coupon['min_subtotal']);

        if ($minimum->isGreaterThan($subtotal)) {
            throw ValidationException::field(
                'couponCode',
                sprintf('%s needs a subtotal of ₹%s.', $code, number_format($minimum->rupees())),
                'ICE-CPN-422',
            );
        }

        return (string) $coupon['kind'] === 'percent'
            ? $subtotal->percentFloor((int) (float) $coupon['value'])->clampTo($subtotal)
            : Money::fromDecimalString((string) $coupon['value'])->clampTo($subtotal);
    }

    /** @param array<string, mixed> $input */
    private function deliveryFee(array $input, Money $subtotal): Money
    {
        $express = (string) ($input['delivery']['id'] ?? '') === 'express'
            || str_contains(strtolower((string) ($input['delivery']['label'] ?? '')), 'express');

        if ($express) {
            return Money::fromRupees($this->settings->int('delivery.express_fee', 499));
        }

        // Free over the threshold, measured on the PRE-discount subtotal (§9.1).
        $freeOver = Money::fromRupees($this->settings->int('delivery.free_over', 4999));

        return $freeOver->isGreaterThan($subtotal)
            ? Money::fromRupees($this->settings->int('delivery.standard_fee', 199))
            : Money::fromRupees(0);
    }

    /**
     * The client sends what it charged; the server recomputes and compares.
     * A mismatch is a stale page, so the shopper is asked to refresh rather
     * than being quietly charged a different number than they were shown.
     *
     * @param array<string, mixed> $input
     */
    private function crossCheckMoney(array $input, Money $subtotal, Money $discount, Money $total): void
    {
        $claimed = $input['money']['total'] ?? null;

        if (!is_numeric($claimed)) {
            return;
        }

        if ((int) $claimed !== $total->rupees()) {
            throw new ConflictException(
                'ICE-CHK-409',
                'Prices changed while you were checking out. Please refresh and try again.',
                [['field' => 'money', 'detail' => sprintf('Expected ₹%s.', number_format($total->rupees()))]],
                true,
            );
        }

        unset($subtotal, $discount);
    }

    /**
     * @param array<string, mixed> $input
     *
     * @return array{name: string, email: string, mobile: string}
     */
    private function validateContact(array $input): array
    {
        /** @var array<string, mixed> $contact */
        $contact = is_array($input['contact'] ?? null) ? $input['contact'] : [];

        $name = trim((string) ($contact['name'] ?? ''));
        $email = trim((string) ($contact['email'] ?? ''));
        $mobile = Validator::normalizeMobile((string) ($contact['mobile'] ?? ''));

        if (mb_strlen($name) < 2) {
            throw ValidationException::field('name', 'Enter the name for this delivery.', 'ICE-CHK-422');
        }

        if (preg_match(Validator::EMAIL_PATTERN, $email) !== 1) {
            throw ValidationException::field('email', 'Enter a valid email address.', 'ICE-CHK-422');
        }

        if ($mobile === null) {
            throw ValidationException::field('mobile', 'Enter a 10-digit Indian mobile number.', 'ICE-CHK-422');
        }

        return ['name' => $name, 'email' => $email, 'mobile' => $mobile];
    }

    /**
     * @param array<string, mixed> $input
     *
     * @return array{line: string, city: string, state: string, postalCode: string}
     */
    private function validateAddress(array $input): array
    {
        /** @var array<string, mixed> $address */
        $address = is_array($input['address'] ?? null) ? $input['address'] : [];

        $line = trim((string) ($address['line'] ?? ''));
        $city = trim((string) ($address['city'] ?? ''));
        $state = trim((string) ($address['state'] ?? ''));
        $postal = trim((string) ($address['postalCode'] ?? ''));

        if (mb_strlen($line) < 6) {
            throw ValidationException::field('line', 'Add a landmark — a flat number alone often does not reach.', 'ICE-CHK-422');
        }

        if ($city === '' || $state === '') {
            throw ValidationException::field('city', 'Say which city and state this is going to.', 'ICE-CHK-422');
        }

        if (preg_match(Validator::PINCODE_PATTERN, $postal) !== 1) {
            throw ValidationException::field('postalCode', 'Enter a valid 6-digit PIN code.', 'ICE-CHK-422');
        }

        return ['line' => $line, 'city' => $city, 'state' => $state, 'postalCode' => $postal];
    }

    /**
     * @param array<string, mixed> $input
     *
     * @return list<array{productId: string, size: string, quantity: int}>
     */
    private function validateLines(array $input): array
    {
        /** @var list<mixed> $raw */
        $raw = is_array($input['lines'] ?? null) ? $input['lines'] : [];

        if ($raw === []) {
            throw ValidationException::field('lines', 'There is nothing in the bag.', 'ICE-CHK-422');
        }

        $max = $this->settings->int('inventory.max_per_order', 3);
        $lines = [];

        foreach ($raw as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $quantity = (int) ($entry['quantity'] ?? 0);

            if ($quantity < 1) {
                continue;
            }

            $lines[] = [
                'productId' => (string) ($entry['productId'] ?? ''),
                'size' => (string) ($entry['size'] ?? ''),
                'quantity' => min($quantity, $max),
            ];
        }

        if ($lines === []) {
            throw ValidationException::field('lines', 'There is nothing in the bag.', 'ICE-CHK-422');
        }

        return $lines;
    }
}
