<?php

declare(strict_types=1);

/**
 * In-process smoke test of the payment-integrity controls.
 *
 *   php tests/Smoke/payment-security-smoke.php
 *
 * A plain script rather than a PHPUnit case, for the same reason as the CRM's
 * smoke test beside it: it needs no dependencies installed, so it runs on a
 * machine where `composer install` has never happened. The same cases exist as
 * `tests/Contract/PaymentIntegrityTest.php` for when it has.
 *
 * ── WHAT IT PROVES ──────────────────────────────────────────────────────────
 *
 * That the SERVER, not the browser, decides whether a payment happened.
 *
 * `PlaceOrderService` used to take the outcome from the request body — one line,
 * `$input['payment']['outcome']` — and write a Captured/Razorpay row on the
 * strength of it. A POST to /checkout/orders carrying `outcome: "captured"` made
 * a real, confirmed, stock-reserving order for nothing. Everything below is one
 * of the ways that could be abused, plus the shapes of checkout that must keep
 * working exactly as they did.
 *
 * ── IT LEAVES NOTHING BEHIND ────────────────────────────────────────────────
 *
 * Every case runs inside ONE transaction that is rolled back at the end. Nested
 * `Database::transaction()` calls become savepoints, so the service behaves
 * exactly as it does in production while the database ends up untouched — the
 * row counts are printed at the end to show it.
 *
 * `variant_inventory.stock_item_id` is nulled inside that transaction because a
 * seeded database can carry rows pointing at `stock_items` that were never
 * seeded; the foreign-key error that causes has nothing to do with payments.
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Domain\Principal;
use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ApiException;
use Iced\Kernel\Request;
use Iced\Repository\PaymentIntentRepository;
use Iced\Service\Checkout\PlaceOrderService;

/* A throwaway webhook secret, injected before boot so the webhook cases have
   something to sign with on a machine that has no Razorpay account. */
$webhookSecret = 'whsec_smoke_' . bin2hex(random_bytes(8));
$_SERVER['RAZORPAY_WEBHOOK_SECRET'] = $webhookSecret;

$app = Application::boot($root);
/** @var Database $db */
$db = $app->container->get(Database::class);

if (!$db->isHealthy()) {
    fwrite(STDERR, "Database unavailable — run `php bin/console.php migrate && php bin/console.php seed`.\n");

    exit(1);
}

$place = $app->container->make(PlaceOrderService::class);
/** @var PaymentIntentRepository $intents */
$intents = $app->container->make(PaymentIntentRepository::class);

$pass = 0;
$fail = 0;

function ok(string $label, bool $condition, string $detail = ''): void
{
    global $pass, $fail;
    $condition ? ++$pass : ++$fail;
    printf("  %s %-54s %s\n", $condition ? "\033[32mPASS\033[0m" : "\033[31mFAIL\033[0m", $label, $detail);
}

function heading(string $text): void
{
    printf("\n\033[1m%s\033[0m\n\n", $text);
}

try {
    $db->transaction(static function (Database $db) use ($app, $place, $intents, $webhookSecret): void {
        $db->statement('UPDATE variant_inventory SET stock_item_id = NULL, on_hand = on_hand + 100');

        $user = $db->selectOne(
            "SELECT * FROM users WHERE type = 'CUSTOMER' AND status = 'ACTIVE' AND deleted_at IS NULL ORDER BY id LIMIT 1",
        );

        if ($user === null) {
            throw new RuntimeException('No seeded customer — run `php bin/console.php seed`.');
        }

        $customer = new Principal(
            userId: (int) $user['id'],
            publicId: (string) $user['public_id'],
            audience: 'customer',
            name: (string) $user['name'],
            email: (string) $user['email'],
            status: (string) $user['status'],
            sessionId: 0,
        );

        $variant = $db->selectOne(
            'SELECT p.public_id AS slug, v.size FROM product_variants v
               JOIN products p ON p.id = v.product_id
              WHERE v.deleted_at IS NULL AND p.deleted_at IS NULL AND p.price > 0
              ORDER BY v.id LIMIT 1',
        );

        if ($variant === null) {
            throw new RuntimeException('No seeded product variant.');
        }

        $payload = static fn (array $payment, array $money = []): array => [
            'lines' => [['productId' => $variant['slug'], 'size' => $variant['size'], 'quantity' => 1]],
            'contact' => ['name' => 'Smoke Shopper', 'email' => 'smoke@example.com', 'mobile' => '9876543210'],
            'address' => [
                'line' => '14 Carter Road, Bandra West',
                'city' => 'Mumbai',
                'state' => 'Maharashtra',
                'postalCode' => '400050',
            ],
            'delivery' => ['id' => 'standard', 'label' => 'Standard delivery', 'estimate' => '3-5 days'],
            'payment' => $payment,
            'money' => $money + ['walletApplied' => 0, 'couponCode' => null],
        ];

        /** The gateway row for an order, never the store-credit one beside it. */
        $gatewayRow = static fn (array $order): array => $db->selectOne(
            "SELECT * FROM payments WHERE order_id = ? AND gateway <> 'Store credit' ORDER BY id DESC LIMIT 1",
            [(int) $order['id']],
        ) ?? ['status' => '(none)', 'reference' => '', 'signature_verified' => 0, 'gateway' => '-'];

        /* The payable is DERIVED, not assumed: the delivery fee depends on
           `delivery.free_over`, which an operator can move. One cash-on-delivery
           order establishes it and doubles as the first regression check. */
        $baseline = $place->place($customer, $payload(['outcome' => 'due', 'method' => 'Cash on delivery']));
        $payablePaise = (int) round(((float) $baseline['total']) * 100);

        $mintVerified = static function (int $amountPaise, ?int $userId = null) use ($intents, $customer): string {
            $gatewayOrderId = 'order_S' . bin2hex(random_bytes(8));
            $paymentId = 'pay_S' . bin2hex(random_bytes(8));
            $intents->create($gatewayOrderId, $userId ?? $customer->userId, $amountPaise, 'INR');
            $intents->markVerified($gatewayOrderId, $userId ?? $customer->userId, $paymentId, 'captured', 'upi');

            return $paymentId;
        };

        heading('Payment integrity — the browser is not the authority');

        ok(
            'cash on delivery still places normally',
            (string) $baseline['status'] === 'Processing' && (string) $gatewayRow($baseline)['status'] === 'Due',
            sprintf('payable = %d paise', $payablePaise),
        );

        $order = $place->place($customer, $payload([
            'outcome' => 'captured',
            'method' => 'Razorpay · Card / UPI / Netbanking',
            'reference' => 'pay_ATTACKER_INVENTED_THIS',
        ]));
        $row = $gatewayRow($order);
        ok(
            'claimed capture with no intent buys nothing  [THE EXPLOIT]',
            (string) $order['status'] === 'Payment failed' && (string) $row['status'] === 'Failed',
            (string) $order['status'],
        );
        ok("...and the client's reference is not recorded", (string) $row['reference'] === '');

        $order = $place->place($customer, $payload([
            'outcome' => 'captured',
            'method' => 'Visa ···· 4242',
            'reference' => 'Authorised on device',
        ]));
        ok('the simulated card sheet buys nothing', (string) $order['status'] === 'Payment failed');

        $paymentId = $mintVerified($payablePaise);
        $order = $place->place($customer, $payload([
            'outcome' => 'captured',
            'method' => 'Razorpay · Card / UPI / Netbanking',
            'reference' => 'pay_THE_CLIENT_LIED',
        ]));
        $row = $gatewayRow($order);
        ok(
            'a verified intent of the exact amount settles  [HAPPY PATH]',
            (string) $order['status'] === 'Processing' && (string) $row['status'] === 'Captured',
            (string) $order['status'],
        );
        ok('...recording OUR payment id, not the request\'s', (string) $row['reference'] === $paymentId, (string) $row['reference']);
        ok('...and marking the signature verified', (int) $row['signature_verified'] === 1);

        $order = $place->place($customer, $payload(['outcome' => 'captured']));
        ok('the same intent cannot back a second order', (string) $order['status'] === 'Payment failed');

        $mintVerified(100);
        $order = $place->place($customer, $payload(['outcome' => 'captured']));
        ok('an intent worth Rs 1 cannot settle a full order', (string) $order['status'] === 'Payment failed');

        $other = $db->selectOne("SELECT id FROM users WHERE type = 'CUSTOMER' AND id <> ? LIMIT 1", [$customer->userId]);

        if ($other !== null) {
            $mintVerified($payablePaise, (int) $other['id']);
            $order = $place->place($customer, $payload(['outcome' => 'captured']));
            ok("another customer's intent cannot be spent", (string) $order['status'] === 'Payment failed');
        }

        $stale = 'order_S' . bin2hex(random_bytes(8));
        $intents->create($stale, $customer->userId, $payablePaise, 'INR');
        $intents->markVerified($stale, $customer->userId, 'pay_S' . bin2hex(random_bytes(8)), 'captured', 'upi');
        $db->statement(
            'UPDATE payment_intents SET expires_at = DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 HOUR) WHERE razorpay_order_id = ?',
            [$stale],
        );
        $order = $place->place($customer, $payload(['outcome' => 'captured']));
        ok('an expired intent cannot be spent', (string) $order['status'] === 'Payment failed');

        heading('Regression guards — the flows that must not change');

        $db->statement(
            'INSERT INTO wallet_accounts (user_id, balance, created_at) VALUES (?, ?, UTC_TIMESTAMP(6))
             ON DUPLICATE KEY UPDATE balance = VALUES(balance)',
            [$customer->userId, '900000.00'],
        );

        $rupees = intdiv($payablePaise, 100);
        $order = $place->place($customer, $payload(
            ['outcome' => 'captured', 'method' => 'Wallet · store credit'],
            ['walletApplied' => $rupees],
        ));
        $credit = $db->selectOne(
            "SELECT status FROM payments WHERE order_id = ? AND gateway = 'Store credit' LIMIT 1",
            [(int) $order['id']],
        );
        ok(
            'a wallet-covered order needs no gateway receipt',
            (string) $order['status'] === 'Processing' && $credit !== null && (string) $credit['status'] === 'Captured',
            (string) $order['status'],
        );

        $db->statement('UPDATE wallet_accounts SET balance = ? WHERE user_id = ?', ['500.00', $customer->userId]);
        $order = $place->place($customer, $payload(
            ['outcome' => 'failed', 'method' => 'Razorpay'],
            ['walletApplied' => 500],
        ));
        ok(
            'a declined payment spends no store credit',
            (string) $order['status'] === 'Payment failed' && (float) $order['wallet_applied'] === 0.0,
        );

        $refused = false;

        try {
            $place->place($customer, $payload(['outcome' => 'due'], ['total' => 1]));
        } catch (ApiException) {
            $refused = true;
        }

        ok('a stale total is still refused', $refused);

        heading('Webhook — what the gateway says, signature-checked');

        $deliver = static function (string $body, ?string $signature, string $eventId) use ($app): array {
            $headers = ['content-type' => 'application/json'];

            if ($signature !== null) {
                $headers['x-razorpay-signature'] = $signature;
            }

            $headers['x-razorpay-event-id'] = $eventId;

            $response = $app->handle(new Request(
                method: 'POST',
                path: '/webhooks/razorpay',
                query: [],
                headers: $headers,
                cookies: [],
                rawBody: $body,
                ip: '203.0.113.9',
            ));

            return [$response->status(), $response->body()];
        };

        $event = static fn (string $name, string $gwOrder, string $payment, int $paise): string => (string) json_encode([
            'event' => $name,
            'payload' => ['payment' => ['entity' => [
                'id' => $payment,
                'order_id' => $gwOrder,
                'amount' => $paise,
                'currency' => 'INR',
                'status' => $name === 'payment.failed' ? 'failed' : 'captured',
                'method' => 'upi',
            ]]],
        ]);

        $gwOrder = 'order_W' . bin2hex(random_bytes(8));
        $intents->create($gwOrder, $customer->userId, $payablePaise, 'INR');

        $body = $event('payment.captured', $gwOrder, 'pay_FORGED', $payablePaise);
        [$status] = $deliver($body, str_repeat('a', 64), 'evt_forged');
        ok('a forged signature is refused with 400', $status === 400, "HTTP $status");
        ok(
            '...is recorded with signature_ok = 0',
            (int) ($db->selectOne('SELECT signature_ok FROM webhook_inbox WHERE event_id = ?', ['evt_forged'])['signature_ok'] ?? 1) === 0,
        );
        ok('...and promotes nothing', (string) $intents->findByGatewayOrderId($gwOrder)['status'] === 'CREATED');

        $realPayment = 'pay_W' . bin2hex(random_bytes(8));
        $body = $event('payment.captured', $gwOrder, $realPayment, $payablePaise);
        $signature = hash_hmac('sha256', $body, $webhookSecret);

        [$status] = $deliver($body, $signature, 'evt_real');
        ok('a signed payment.captured is accepted', $status === 200, "HTTP $status");
        $intent = $intents->findByGatewayOrderId($gwOrder);
        ok('...promoting the intent to VERIFIED', (string) $intent['status'] === 'VERIFIED');
        ok('...binding the gateway payment id', (string) $intent['razorpay_payment_id'] === $realPayment);

        [$status, $out] = $deliver($body, $signature, 'evt_real');
        $rows = (int) $db->selectOne('SELECT COUNT(*) c FROM webhook_inbox WHERE event_id = ?', ['evt_real'])['c'];
        ok('a duplicate delivery is 200 and stored once', $status === 200 && $rows === 1, "HTTP $status, rows=$rows");
        ok('...and says so', str_contains($out, '"duplicate":true'));

        $before = (int) $db->selectOne('SELECT COUNT(*) c FROM orders')['c'];
        $gw2 = 'order_W' . bin2hex(random_bytes(8));
        $intents->create($gw2, $customer->userId, $payablePaise, 'INR');
        $body = $event('order.paid', $gw2, 'pay_' . bin2hex(random_bytes(6)), $payablePaise);
        $deliver($body, hash_hmac('sha256', $body, $webhookSecret), 'evt_orderpaid');
        $after = (int) $db->selectOne('SELECT COUNT(*) c FROM orders')['c'];
        ok('the webhook creates no orders', $before === $after, "orders $before → $after");

        $body = (string) json_encode(['event' => 'subscription.charged', 'payload' => []]);
        [$status, $out] = $deliver($body, hash_hmac('sha256', $body, $webhookSecret), 'evt_unknown_type');
        ok('an unhandled event type is 200, unhandled', $status === 200 && str_contains($out, '"handled":false'));

        throw new RuntimeException('__rollback__');
    });
} catch (RuntimeException $error) {
    if ($error->getMessage() !== '__rollback__') {
        fwrite(STDERR, "\n  " . $error->getMessage() . "\n\n");

        exit(1);
    }
}

printf("\n  %d passed, %d failed\n", $pass, $fail);
printf(
    "  rolled back — payment_intents = %d, webhook_inbox = %d\n\n",
    (int) $db->selectOne('SELECT COUNT(*) c FROM payment_intents')['c'],
    (int) $db->selectOne('SELECT COUNT(*) c FROM webhook_inbox')['c'],
);

exit($fail === 0 ? 0 : 1);
