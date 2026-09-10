<?php

declare(strict_types=1);

namespace Iced\Service\Checkout;

use Iced\Domain\Money;
use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Repository\CartRepository;
use Iced\Repository\OrderRepository;
use Iced\Repository\PaymentIntentRepository;
use Iced\Service\Inventory\StockService;
use Iced\Service\Settings\StoreSettings;
use Iced\Service\Wallet\WalletService;
use Iced\Support\Clock;
use Iced\Support\Config;
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
 *     re-validate the coupon, and SPEND THE WALLET against the total
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
    /**
     * The default for `payments.enforce_intents`, read once at construction.
     *
     * Env rather than a constant so a deployment can be put back to the old
     * trust-the-browser behaviour without a revert; a SETTING on top of it
     * (checked in `settle()`) so the same thing can be done from the console in
     * the minute an incident is discovered, without an SSH session. The env is
     * the floor, the setting is the override, and both default to enforcing.
     */
    private readonly bool $enforceIntents;

    public function __construct(
        private readonly Database $db,
        private readonly OrderRepository $orders,
        private readonly StockService $stock,
        private readonly StoreSettings $settings,
        private readonly WalletService $wallet,
        private readonly CartRepository $carts,
        private readonly CouponResolver $coupons,
        private readonly PaymentIntentRepository $intents,
        private readonly IdAllocator $ids,
        private readonly Clock $clock,
        Config $config,
    ) {
        $this->enforceIntents = $config->bool('app.payments.enforce_intents', true);
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
            $discount = $this->discountFor($input, $subtotal);
            $delivery = $this->deliveryFee($input, $subtotal);
            $total = $subtotal->minus($discount)->plus($delivery)->atLeastZero();

            $this->crossCheckMoney($input, $subtotal, $discount, $total);

            // ---- ids the static export can address (spec §11) --------------
            $publicId = $this->ids->allocate('order');
            $number = $this->ids->nextOrderNumber();

            /* ---- WHO SAYS THIS WAS PAID ------------------------------------

               This used to be one line:

                   $outcome = (string) ($input['payment']['outcome'] ?? 'due');

               — the browser's own word, written straight into `payments` as a
               Captured/Razorpay row. A request carrying `outcome: "captured"`
               produced a real, confirmed, stock-reserving order for nothing, and
               `curl` was the whole exploit. The signature check existed and was
               correct; its answer was simply never kept.

               `settle()` below asks the SERVER instead. The client's claim is
               still read — it is what distinguishes a shopper choosing cash on
               delivery from one who went to the gateway — but a claim of
               "captured" is now only believed when a verified payment intent of
               exactly the right amount is sitting there to be spent.

               The wallet has to be quoted before this and debited after it,
               because the figure the gateway was asked for is what the intent is
               matched against: `total − wallet`. So the order is
               quote → settle → debit, where it used to be settle → debit. */
            $walletWanted = $this->walletWanted($input, $total);
            $settlement = $this->settle($customer, $input, $total->minus($walletWanted)->atLeastZero());

            $outcome = $settlement['outcome'];
            $failed = $outcome === 'failed';

            $placedAt = $this->clock->nowString();

            /* ---- the wallet ------------------------------------------------
               Store credit is a PAYMENT, not a discount, and the distinction is
               load-bearing: `total` stays what the order is worth, the credit
               comes off what the GATEWAY was asked for, and the console's
               revenue and discount figures both stay true. It is also why the
               wallet composes with a promotional code instead of competing with
               it — the old voucher-as-coupon shape made a shopper choose one.

               Debited inside this transaction and after the number exists, so
               the ledger line names the order it paid for, and so an order that
               fails to write below cannot leave a balance spent on nothing.

               A payment the gateway REFUSED spends no credit. The order is
               still written — throwing away a filled bag because a card bounced
               is how a shopper loses an evening — but it is written unpaid, and
               draining the wallet for it would take away the very money the
               retry needs. */
            $walletApplied = $failed
                ? Money::fromRupees(0)
                : $this->spendWallet($customer, $walletWanted, $number);

            $gatewayAmount = $total->minus($walletApplied)->atLeastZero();

            $orderId = $this->db->insert(
                'INSERT INTO orders
                    (public_id, number, user_id, status, console_state, contact_name, contact_email, contact_mobile,
                     addr_line, addr_city, addr_state, addr_postal, delivery_label, delivery_estimate, delivery_fee,
                     subtotal, discount, wallet_applied, total, coupon_code, items_summary,
                     cancellation_eligible, placed_at, created_at)
                 VALUES (?, ?, ?, ?, \'Placed\', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
                [
                    $publicId, $number, $customer->userId,
                    $failed ? 'Payment failed' : 'Processing',
                    $contact['name'], $contact['email'], $contact['mobile'],
                    $address['line'], $address['city'], $address['state'], $address['postalCode'],
                    /* Truncated rather than rejected, unlike the address fields.
                       These two are DISPLAY labels the browser sends back — the
                       delivery decision itself is made server-side in
                       `deliveryFor()` from `delivery.id`, so a shortened label
                       misprices nothing and misdelivers nothing. They are
                       varchar(80) and varchar(40), and were written unbounded.
                       `coupon_code` is varchar(40) and goes the same way; the
                       code is looked up separately and an over-long one simply
                       matches no coupon. */
                    mb_substr((string) ($input['delivery']['label'] ?? 'Standard delivery'), 0, 80),
                    mb_substr((string) ($input['delivery']['estimate'] ?? ''), 0, 40),
                    $delivery->toDecimalString(),
                    $subtotal->toDecimalString(), $discount->toDecimalString(),
                    $walletApplied->toDecimalString(), $total->toDecimalString(),
                    isset($input['money']['couponCode']) ? mb_substr((string) $input['money']['couponCode'], 0, 40) : null,
                    implode(' · ', array_column($priced, 'name')),
                    $placedAt, $placedAt,
                ],
            );

            /* The intent is spent HERE, inside the same transaction that writes
               the order, and never again: `consume()` moves it to CONSUMED under
               the lock `settle()` already took. A payment can therefore back
               exactly one order, and if anything below throws, the rollback puts
               the intent back in VERIFIED for an honest retry. */
            if ($settlement['intent_id'] !== null) {
                $this->intents->consume($settlement['intent_id'], $orderId);
            }

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

            $this->writePayment($orderId, $contact['name'], $gatewayAmount, $walletApplied, $input, $settlement);

            /* The bag becomes the order (spec §8.9 #52).
               Inside the transaction, so a checkout that fails to write leaves
               the bag exactly as it was. This is what stops the pieces a
               shopper has just bought from still sitting in the bag on their
               other device — the failure the whole server-side cart exists to
               remove, arriving one step later. */
            $this->carts->convertActive($customer->userId);

            $order = $this->db->selectOne('SELECT * FROM orders WHERE id = ?', [$orderId]);

            return $order ?? [];
        });
    }

    /**
     * How much store credit this order actually spends.
     *
     * The browser asks for a figure; this decides. Two things are checked and
     * both matter:
     *
     *   · credit cannot pay more than the order costs — there is no change
     *     given, and an order whose wallet line exceeded its total would be the
     *     shop paying the customer to shop;
     *   · the balance has to still be there. `WalletService::debit()` re-reads
     *     it under a row lock and REFUSES rather than quietly taking less,
     *     because the gateway was already charged the remainder — silently
     *     spending ₹200 where the page promised ₹500 would leave the order
     *     ₹300 short with nothing recording why.
     *
     * A refusal here is the same shape as the price cross-check above: a page
     * that has gone stale, and a shopper asked to refresh. The window is the few
     * seconds between opening the gateway and the order landing, and it takes a
     * second tab spending the same credit to open it at all.
     *
     * @param array<string, mixed> $input
     */
    private function spendWallet(Principal $customer, Money $wanted, string $number): Money
    {
        if ($wanted->paise <= 0) {
            return Money::fromRupees(0);
        }

        $this->wallet->debit(
            $customer->userId,
            $wanted,
            WalletService::KIND_ORDER,
            $number,
            sprintf('Spent on %s.', $number),
        );

        return $wanted;
    }

    /**
     * What the browser is ASKING the wallet for, clamped — a quote, not a spend.
     *
     * Split out of `spendWallet()` because the gateway's share of the bill
     * (`total − wallet`) has to be known before `settle()` can look for an
     * intent worth exactly that, and the intent's verdict decides whether the
     * wallet is debited at all. Nothing here touches the ledger; the balance is
     * still re-read under a row lock inside `WalletService::debit()`, which is
     * what makes it safe for this to be a stale figure.
     *
     * @param array<string, mixed> $input
     */
    private function walletWanted(array $input, Money $total): Money
    {
        $asked = $input['money']['walletApplied'] ?? 0;

        if (!is_numeric($asked) || (int) $asked <= 0) {
            return Money::fromRupees(0);
        }

        return Money::fromRupees((int) $asked)->clampTo($total)->atLeastZero();
    }

    /**
     * Whether this order was paid for, decided by the server.
     *
     * The three ways an order can be settled, and what each requires:
     *
     *   nothing payable   the wallet or a full discount covered it. There was no
     *                     gateway, so there is nothing to verify — the existing
     *                     store-credit branch of `writePayment()` handles it.
     *   cash on delivery  the money has not moved and nobody claims it has.
     *   the gateway       a VERIFIED payment intent, belonging to THIS customer,
     *                     worth EXACTLY the gateway's share of this order, still
     *                     inside its fifteen-minute window.
     *
     * That last clause is the amount check the old code had nowhere to put. The
     * browser may ask Razorpay for any figure it likes; the intent records what
     * was actually asked for, and an order priced from the catalogue at ₹50,000
     * will not settle against an intent for ₹1. Under-payment stops being
     * possible without anyone having to compare two numbers by hand.
     *
     * A missing intent is not an error. It is an unpaid order — the same shape
     * as a declined card, which this service has always written rather than
     * thrown away. The shopper keeps their bag and the order screen offers the
     * attempt again. That is also, deliberately, what the degraded "amount-only"
     * checkout now produces: no server-created order means no intent, which
     * means no capture, however loudly the browser claims one.
     *
     * @param array<string, mixed> $input
     *
     * @return array{outcome: string, reference: string, note: string, intent_id: int|null, gateway_order_id: string, verified: bool}
     */
    private function settle(Principal $customer, array $input, Money $gatewayPayable): array
    {
        $claimed = (string) ($input['payment']['outcome'] ?? 'due');

        $unverified = static fn (string $outcome, string $note = ''): array => [
            'outcome' => $outcome,
            'reference' => '',
            'note' => $note,
            'intent_id' => null,
            'gateway_order_id' => '',
            'verified' => false,
        ];

        /* Nothing for a gateway to take. A wallet that covered the bag outright,
           or a discount that did. `writePayment()` records it as store credit,
           captured — unchanged, and correct: no gateway was involved, so there
           is no gateway receipt to demand. */
        if ($gatewayPayable->isZero()) {
            return $unverified($claimed === 'failed' ? 'failed' : 'captured');
        }

        /* Cash on delivery, or a payment the browser is reporting as declined.
           Neither claims money moved, so neither needs proof. `due` is also the
           fallback for anything unrecognised, exactly as the old `match` was. */
        if ($claimed !== 'captured') {
            return $unverified($claimed === 'failed' ? 'failed' : 'due');
        }

        /* The escape hatch, and the only thing in this method that can restore
           the old behaviour. It exists so a deployment that hits something
           unforeseen can be put back within one release without a revert, and it
           is meant to be removed once production has run clean. Setting it is a
           decision to trust the browser about money again. */
        if (!$this->settings->bool('payments.enforce_intents', $this->enforceIntents)) {
            return [
                'outcome' => 'captured',
                'reference' => mb_substr((string) ($input['payment']['reference'] ?? ''), 0, 120),
                'note' => '',
                'intent_id' => null,
                'gateway_order_id' => '',
                'verified' => false,
            ];
        }

        $intent = $this->intents->claimable($customer->userId, $gatewayPayable->paise);

        if ($intent === null) {
            return $unverified(
                'failed',
                'This payment could not be confirmed with the gateway, so nothing has been charged for it.',
            );
        }

        return [
            'outcome' => 'captured',
            // The gateway's id, from OUR row — never the one the request carried.
            'reference' => (string) ($intent['razorpay_payment_id'] ?? ''),
            'note' => '',
            'intent_id' => (int) $intent['id'],
            'gateway_order_id' => (string) $intent['razorpay_order_id'],
            'verified' => true,
        ];
    }

    /**
     * The payment rows. One per thing that actually paid.
     *
     * An order settled partly from the wallet and partly by card is TWO
     * payments, and recording it as one would make both of them wrong: the
     * gateway row would claim money the gateway never took, and the ledger
     * would have no line for the credit that was spent. The console's payments
     * register reads these rows, so a shopper asking "what did I actually pay"
     * gets the true split.
     *
     * An order paid entirely from the wallet writes only the credit row — there
     * is no ₹0 gateway payment, because no gateway was involved.
     *
     * @param array<string, mixed> $input
     */
    private function writePayment(
        int $orderId,
        string $customer,
        Money $gatewayAmount,
        Money $walletApplied,
        array $input,
        array $settlement,
    ): void {
        /** @var array<string, mixed> $payment */
        $payment = is_array($input['payment'] ?? null) ? $input['payment'] : [];
        $outcome = (string) $settlement['outcome'];

        /* The method is a LABEL — what the receipt says the shopper used — and
           it is the one thing here still taken from the request, because only
           the browser knows whether the gateway ended up taking a card or a UPI
           handle. It decides nothing, and it is cut to the column's own width so
           a long string cannot be used to push anything through it. */
        $method = mb_substr((string) ($payment['method'] ?? 'Cash on delivery'), 0, 40);

        if ($walletApplied->paise > 0) {
            $this->insertPayment(
                $orderId,
                $customer,
                'Store credit',
                'Wallet',
                $walletApplied,
                'Captured',
                'Paid from the wallet balance',
                '',
            );
        }

        /* Nothing left for the gateway: the wallet covered the order outright,
           and so did the row above. A second payment for ₹0 would show up in
           every register and reconcile against nothing. */
        if ($gatewayAmount->isZero() && $walletApplied->paise > 0) {
            return;
        }

        [$status, $gateway, $note] = match ($outcome) {
            'captured' => ['Captured', 'Razorpay', 'Taken at checkout'],
            /* When the SERVER downgraded this — no verified intent for the
               amount — its sentence wins. The browser's note would describe
               whatever it thinks happened, which in that case is the thing we
               have just refused to believe. */
            'failed' => ['Failed', 'Razorpay', $settlement['note'] !== ''
                ? (string) $settlement['note']
                : mb_substr((string) ($payment['note'] ?? 'The payment did not go through'), 0, 255)],
            default => ['Due', 'Courier', 'The courier collects it at the door'],
        };

        // A ₹0 payable with no wallet behind it settles as store credit,
        // captured (spec §9.1) — a fully discounted order.
        if ($gatewayAmount->isZero()) {
            [$status, $gateway, $note] = ['Captured', 'Store credit', 'Paid with store credit'];
            $method = 'Store credit';
        }

        $this->insertPayment(
            $orderId,
            $customer,
            $gateway,
            $method,
            $gatewayAmount,
            $status,
            $note,
            /* The reference is the SERVER's now. It used to be
               `$payment['reference']` — a string the browser chose, indexed by
               `ix_payments_reference` and quoted back to the shopper as a
               receipt for money nobody had confirmed. What goes in is the
               `razorpay_payment_id` off the verified intent, or nothing. */
            (string) $settlement['reference'],
            (string) $settlement['gateway_order_id'],
            (bool) $settlement['verified'],
        );
    }

    private function insertPayment(
        int $orderId,
        string $customer,
        string $gateway,
        string $method,
        Money $amount,
        string $status,
        string $note,
        string $reference,
        string $gatewayOrderId = '',
        bool $signatureVerified = false,
    ): void {
        /* `razorpay_order_id` and `signature_verified` have been columns on this
           table since migration 0005 and nothing has ever written to them —
           there was nothing truthful to put in either, because no signature
           result outlived the request that produced it. They are filled now, and
           together they are what the reconciliation query of the monitoring plan
           reads: a Captured row with signature_verified = 0 is money the shop
           believes in for a reason it cannot show. */
        $this->db->statement(
            'INSERT INTO payments
                (public_id, order_id, customer_masked, gateway, method, amount, status, note, reference,
                 razorpay_order_id, signature_verified, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $this->ids->allocate('payment'),
                $orderId,
                \Iced\Presenter\Format::maskName($customer),
                $gateway,
                $method,
                $amount->toDecimalString(),
                $status,
                $note,
                $reference,
                $gatewayOrderId === '' ? null : $gatewayOrderId,
                $signatureVerified ? 1 : 0,
                $this->clock->nowString(),
            ],
        );
    }

    /**
     * What the code on this order takes off it.
     *
     * The rule itself lives in `CouponResolver`, shared with `/me/cart/coupon`,
     * and that sharing is load-bearing rather than tidiness: the bag quotes a
     * discount while the shopper is still shopping and this recomputes it at the
     * moment money moves. Two copies of the rule would eventually disagree, and
     * the disagreement would surface as `crossCheckMoney` below refusing an
     * order for a total the page had just shown.
     *
     * A voucher typed into the coupon field is still REFUSED, with the sentence
     * that points at the wallet — see `CouponResolver::refusal`.
     *
     * @param array<string, mixed> $input
     */
    private function discountFor(array $input, Money $subtotal): Money
    {
        $code = $input['money']['couponCode'] ?? null;

        if (!is_string($code) || $code === '') {
            return Money::fromRupees(0);
        }

        return $this->coupons->discountFor($this->coupons->require($code, $subtotal), $subtotal);
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

        /* ---- UPPER BOUNDS, WHICH THIS ENDPOINT HAD NONE OF -----------------

           `POST /checkout/orders` declares no `rules` at all — every string in
           the body reached the INSERT as typed. `contact_name` is
           varchar(120), and what happens to a longer one depends on a server
           setting rather than on anything in this repository:

             · With STRICT_ALL_TABLES (this development host) the INSERT throws.
               The transaction rolls back, the payment intent goes back to
               VERIFIED — and the card has already cleared. The customer has paid
               for an order that does not exist, which is the same failure the
               order-number overflow produced and the worst shape a checkout bug
               can take.
             · Without it, MySQL truncates and says nothing. A 300-character
               delivery address silently becomes 255 characters, and the parcel
               goes to an address that is missing its end.

           The widths below are the columns' own, and they are also exactly what
           `PUT /me/checkout/draft` two routes away already enforces — so the
           storefront has always sent values that fit, and no legitimate client
           notices this. Rejecting rather than truncating, because a silently
           shortened address is the failure worth preventing here. */
        if (mb_strlen($name) > 120) {
            throw ValidationException::field('name', 'That name is too long — 120 characters at most.', 'ICE-CHK-422');
        }

        if (preg_match(Validator::EMAIL_PATTERN, $email) !== 1 || mb_strlen($email) > 190) {
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

        // The column widths. See the note in validateContact for why an upper
        // bound here is not cosmetic: over-length either 500s the checkout after
        // the card has cleared, or silently truncates a delivery address.
        if (mb_strlen($line) > 255) {
            throw ValidationException::field('line', 'That address is too long — 255 characters at most.', 'ICE-CHK-422');
        }

        if ($city === '' || $state === '') {
            throw ValidationException::field('city', 'Say which city and state this is going to.', 'ICE-CHK-422');
        }

        if (mb_strlen($city) > 80 || mb_strlen($state) > 80) {
            throw ValidationException::field('city', 'That city or state name is too long — 80 characters at most.', 'ICE-CHK-422');
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

        /* ---- A CEILING ON HOW MANY LINES, NOT JUST HOW MANY OF EACH --------

           `inventory.max_per_order` caps the QUANTITY on a line and nothing
           capped the NUMBER of lines, so one request could carry a hundred
           thousand of them. Every line taken past this point does a catalogue
           lookup and takes a `SELECT … FOR UPDATE` on its stock row, inside a
           single transaction that is held open for the duration — so the cost is
           not merely a slow request. It is thousands of stock rows locked at
           once on a shared-host database, which stalls every other checkout
           until it finishes or the host kills it, and an attacker needs no
           account and no payment to send it.

           Fifty distinct products in one order is already far beyond anything
           this shop sells in a single basket, and it is a setting rather than a
           constant so the number can be raised without a deploy if that ever
           stops being true. */
        $maxLines = max(1, $this->settings->int('checkout.max_lines', 50));

        if (count($raw) > $maxLines) {
            throw ValidationException::field(
                'lines',
                sprintf('An order can hold %d different items at most.', $maxLines),
                'ICE-CHK-422',
            );
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
