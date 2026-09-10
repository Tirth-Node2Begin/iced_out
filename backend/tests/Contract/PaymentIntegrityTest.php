<?php

declare(strict_types=1);

namespace Iced\Tests\Contract;

use Iced\Domain\Principal;
use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ApiException;
use Iced\Repository\PaymentIntentRepository;
use Iced\Service\Checkout\PlaceOrderService;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * The server, not the browser, decides that a payment happened.
 *
 * WHAT THIS TEST IS GUARDING. `PlaceOrderService` used to take the payment
 * outcome from the request body:
 *
 *     $outcome = (string) ($input['payment']['outcome'] ?? 'due');
 *
 * and write a Captured/Razorpay row on the strength of it. A POST to
 * /checkout/orders carrying `payment.outcome: "captured"` produced a real,
 * confirmed, stock-reserving order for nothing, and `curl` with a session cookie
 * was the whole exploit. The signature check existed and was correct; its result
 * was handed to the browser and then forgotten.
 *
 * Every case below is one of the ways that could be abused, plus the two shapes
 * of checkout that must keep working untouched. If any of them ever goes green
 * the other way, the shop is giving stock away.
 *
 * ── HOW IT RUNS ─────────────────────────────────────────────────────────────
 *
 * Against the developer database, entirely inside ONE transaction that is rolled
 * back in tearDown. Nested `Database::transaction()` calls become savepoints, so
 * the service's own transaction still behaves exactly as it does in production
 * while the whole test leaves nothing behind.
 *
 * `variant_inventory.stock_item_id` is nulled inside that transaction because a
 * seeded database can carry rows pointing at `stock_items` that were never
 * seeded, and the resulting foreign-key error has nothing to do with payments.
 */
final class PaymentIntegrityTest extends TestCase
{
    private Application $app;

    private Database $db;

    private PlaceOrderService $place;

    private PaymentIntentRepository $intents;

    private Principal $customer;

    private int $payablePaise = 0;

    private string $slug = '';

    private string $size = '';

    protected function setUp(): void
    {
        $this->app = Application::boot(dirname(__DIR__, 2));

        /** @var Database $db */
        $db = $this->app->container->get(Database::class);
        $this->db = $db;

        if (!$db->isHealthy()) {
            self::markTestSkipped('Database unavailable — run `php bin/console.php migrate && php bin/console.php seed`.');
        }

        $this->place = $this->app->container->make(PlaceOrderService::class);
        $this->intents = $this->app->container->make(PaymentIntentRepository::class);

        $this->db->pdo()->beginTransaction();

        // See the class docblock: seed drift, not a payment concern.
        $this->db->statement('UPDATE variant_inventory SET stock_item_id = NULL, on_hand = on_hand + 100');

        $user = $this->db->selectOne(
            "SELECT * FROM users WHERE type = 'CUSTOMER' AND status = 'ACTIVE' AND deleted_at IS NULL ORDER BY id LIMIT 1",
        );

        if ($user === null) {
            self::markTestSkipped('No seeded customer — run `php bin/console.php seed`.');
        }

        $this->customer = new Principal(
            userId: (int) $user['id'],
            publicId: (string) $user['public_id'],
            audience: 'customer',
            name: (string) $user['name'],
            email: (string) $user['email'],
            status: (string) $user['status'],
            sessionId: 0,
        );

        $variant = $this->db->selectOne(
            'SELECT p.public_id AS slug, v.size, p.price
               FROM product_variants v
               JOIN products p ON p.id = v.product_id
               JOIN variant_inventory vi ON vi.variant_id = v.id
              WHERE v.deleted_at IS NULL AND p.deleted_at IS NULL AND p.price > 0
              ORDER BY v.id
              LIMIT 1',
        );

        if ($variant === null) {
            self::markTestSkipped('No seeded product variant.');
        }

        $this->slug = (string) $variant['slug'];
        $this->size = (string) $variant['size'];

        /* What the gateway's share of this order will be, derived the same way
           the service derives it rather than assumed — the delivery fee depends
           on `delivery.free_over`, which is a setting an operator can move. */
        $order = $this->place->place($this->customer, $this->payload(['outcome' => 'due', 'method' => 'Cash on delivery']));
        $this->payablePaise = (int) round(((float) $order['total']) * 100);
    }

    protected function tearDown(): void
    {
        if ($this->db->pdo()->inTransaction()) {
            $this->db->pdo()->rollBack();
        }
    }

    /** THE EXPLOIT. A claim of capture with nothing behind it buys nothing. */
    public function testClaimedCaptureWithNoIntentIsNotPaid(): void
    {
        $order = $this->place->place($this->customer, $this->payload([
            'outcome' => 'captured',
            'method' => 'Razorpay · Card / UPI / Netbanking',
            'reference' => 'pay_ATTACKER_INVENTED_THIS',
        ]));

        self::assertSame('Payment failed', (string) $order['status']);
        self::assertSame('Failed', $this->gatewayPayment($order)['status']);
        self::assertSame('', (string) $this->gatewayPayment($order)['reference']);
        self::assertSame(0, (int) $this->gatewayPayment($order)['signature_verified']);
    }

    /**
     * The simulated card sheet settles `outcome: captured` with the reference
     * "Authorised on device" and never speaks to a gateway. It produces no
     * intent, so it can no longer produce a paid order either.
     */
    public function testSimulatedCardSheetIsNotPaid(): void
    {
        $order = $this->place->place($this->customer, $this->payload([
            'outcome' => 'captured',
            'method' => 'Visa ···· 4242',
            'reference' => 'Authorised on device',
        ]));

        self::assertSame('Payment failed', (string) $order['status']);
        self::assertSame('Failed', $this->gatewayPayment($order)['status']);
    }

    /** The happy path, and the only one that may write a capture. */
    public function testVerifiedIntentOfTheExactAmountSettlesTheOrder(): void
    {
        $paymentId = $this->verifiedIntent($this->payablePaise);

        $order = $this->place->place($this->customer, $this->payload([
            'outcome' => 'captured',
            'method' => 'Razorpay · Card / UPI / Netbanking',
            'reference' => 'pay_THE_CLIENT_LIED',
        ]));

        $payment = $this->gatewayPayment($order);

        self::assertSame('Processing', (string) $order['status']);
        self::assertSame('Captured', (string) $payment['status']);
        self::assertSame('Razorpay', (string) $payment['gateway']);
        // OUR payment id, off the intent — never the one the request carried.
        self::assertSame($paymentId, (string) $payment['reference']);
        self::assertSame(1, (int) $payment['signature_verified']);
    }

    /** One payment backs one order. The second attempt finds nothing to spend. */
    public function testAVerifiedIntentCannotBackTwoOrders(): void
    {
        $this->verifiedIntent($this->payablePaise);

        $first = $this->place->place($this->customer, $this->payload(['outcome' => 'captured']));
        self::assertSame('Processing', (string) $first['status']);

        $second = $this->place->place($this->customer, $this->payload(['outcome' => 'captured']));
        self::assertSame('Payment failed', (string) $second['status']);
    }

    /**
     * UNDER-PAYMENT. The browser may ask Razorpay for any figure it likes; the
     * order only settles against an intent worth what the bag actually came to.
     */
    public function testAnIntentWorthLessThanTheOrderIsRefused(): void
    {
        self::assertGreaterThan(100, $this->payablePaise, 'the fixture must cost more than a rupee');
        $this->verifiedIntent(100);

        $order = $this->place->place($this->customer, $this->payload(['outcome' => 'captured']));

        self::assertSame('Payment failed', (string) $order['status']);
    }

    /** An intent is not a bearer token: it belongs to the account that made it. */
    public function testAnotherCustomersIntentCannotBeSpent(): void
    {
        $other = $this->db->selectOne(
            "SELECT id FROM users WHERE type = 'CUSTOMER' AND id <> ? LIMIT 1",
            [$this->customer->userId],
        );

        if ($other === null) {
            self::markTestSkipped('Needs a second seeded customer.');
        }

        $this->verifiedIntent($this->payablePaise, (int) $other['id']);

        $order = $this->place->place($this->customer, $this->payload(['outcome' => 'captured']));

        self::assertSame('Payment failed', (string) $order['status']);
    }

    /** A verified payment nobody used goes stale rather than banking forever. */
    public function testAnExpiredIntentIsRefused(): void
    {
        $gatewayOrderId = $this->verifiedIntentReturningOrderId($this->payablePaise);

        $this->db->statement(
            'UPDATE payment_intents SET expires_at = DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 HOUR) WHERE razorpay_order_id = ?',
            [$gatewayOrderId],
        );

        $order = $this->place->place($this->customer, $this->payload(['outcome' => 'captured']));

        self::assertSame('Payment failed', (string) $order['status']);
    }

    /** REGRESSION GUARD: cash on delivery never needed a gateway and still does not. */
    public function testCashOnDeliveryStillPlacesNormally(): void
    {
        $order = $this->place->place($this->customer, $this->payload([
            'outcome' => 'due',
            'method' => 'Cash on delivery',
        ]));

        self::assertSame('Processing', (string) $order['status']);
        self::assertSame('Due', $this->gatewayPayment($order)['status']);
    }

    /**
     * REGRESSION GUARD: an order the wallet settles outright involves no gateway,
     * so it must not be asked for a gateway receipt.
     */
    public function testAnOrderCoveredEntirelyByTheWalletNeedsNoIntent(): void
    {
        $this->db->statement(
            'INSERT INTO wallet_accounts (user_id, balance, created_at) VALUES (?, ?, UTC_TIMESTAMP(6))
             ON DUPLICATE KEY UPDATE balance = VALUES(balance)',
            [$this->customer->userId, '900000.00'],
        );

        $rupees = intdiv($this->payablePaise, 100);

        $order = $this->place->place($this->customer, $this->payload(
            ['outcome' => 'captured', 'method' => 'Wallet · store credit'],
            ['walletApplied' => $rupees],
        ));

        self::assertSame('Processing', (string) $order['status']);
        self::assertSame(
            $rupees,
            (int) round(((float) $order['wallet_applied']) * 100 / 100),
            'the wallet should have covered the order',
        );

        $credit = $this->db->selectOne(
            "SELECT status FROM payments WHERE order_id = ? AND gateway = 'Store credit' LIMIT 1",
            [(int) $order['id']],
        );

        self::assertNotNull($credit);
        self::assertSame('Captured', (string) $credit['status']);
    }

    /** A payment the browser reports as declined spends no store credit. */
    public function testAFailedPaymentSpendsNoWallet(): void
    {
        $this->db->statement(
            'INSERT INTO wallet_accounts (user_id, balance, created_at) VALUES (?, ?, UTC_TIMESTAMP(6))
             ON DUPLICATE KEY UPDATE balance = VALUES(balance)',
            [$this->customer->userId, '500.00'],
        );

        $order = $this->place->place($this->customer, $this->payload(
            ['outcome' => 'failed', 'method' => 'Razorpay'],
            ['walletApplied' => 500],
        ));

        self::assertSame('Payment failed', (string) $order['status']);
        self::assertSame(0.0, (float) $order['wallet_applied']);
    }

    /** A stale bag is refused rather than quietly charged a different number. */
    public function testAStaleTotalIsRefused(): void
    {
        $this->expectException(ApiException::class);

        $this->place->place($this->customer, $this->payload(
            ['outcome' => 'due'],
            ['total' => 1],
        ));
    }

    /* ─────────────────────────────────────────────────────────── helpers ── */

    /**
     * @param array<string, mixed> $payment
     * @param array<string, mixed> $money
     *
     * @return array<string, mixed>
     */
    private function payload(array $payment, array $money = []): array
    {
        return [
            'lines' => [['productId' => $this->slug, 'size' => $this->size, 'quantity' => 1]],
            'contact' => ['name' => 'Test Shopper', 'email' => 'test@example.com', 'mobile' => '9876543210'],
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
    }

    /** Mints a VERIFIED intent and returns the gateway payment id bound to it. */
    private function verifiedIntent(int $amountPaise, ?int $userId = null): string
    {
        $gatewayOrderId = 'order_T' . bin2hex(random_bytes(8));
        $paymentId = 'pay_T' . bin2hex(random_bytes(8));

        $this->intents->create($gatewayOrderId, $userId ?? $this->customer->userId, $amountPaise, 'INR');

        if (!$this->intents->markVerified($gatewayOrderId, $userId ?? $this->customer->userId, $paymentId, 'captured', 'upi')) {
            throw new RuntimeException('the fixture intent could not be promoted');
        }

        return $paymentId;
    }

    private function verifiedIntentReturningOrderId(int $amountPaise): string
    {
        $gatewayOrderId = 'order_T' . bin2hex(random_bytes(8));

        $this->intents->create($gatewayOrderId, $this->customer->userId, $amountPaise, 'INR');
        $this->intents->markVerified($gatewayOrderId, $this->customer->userId, 'pay_T' . bin2hex(random_bytes(8)), 'captured', 'upi');

        return $gatewayOrderId;
    }

    /**
     * The gateway row for an order — never the store-credit one beside it.
     *
     * @param array<string, mixed> $order
     *
     * @return array<string, mixed>
     */
    private function gatewayPayment(array $order): array
    {
        $row = $this->db->selectOne(
            "SELECT * FROM payments WHERE order_id = ? AND gateway <> 'Store credit' ORDER BY id DESC LIMIT 1",
            [(int) $order['id']],
        );

        self::assertNotNull($row, 'the order recorded no gateway payment at all');

        return $row;
    }
}
