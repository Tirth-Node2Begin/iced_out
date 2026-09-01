<?php

declare(strict_types=1);

namespace Iced\Tests\Contract;

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Request;
use Iced\Kernel\Router;
use Iced\Support\Json;
use PHPUnit\Framework\TestCase;

/**
 * Every console register must render exactly what the frontend fixture rendered.
 *
 * This is the prime directive of backend_setup.md made executable: each
 * expectation below is copied from the fixture module named in the test, so a
 * seed or presenter change that would move a cell on screen fails here rather
 * than in someone's browser.
 *
 * Needs a migrated + seeded database.
 */
final class FixtureParityTest extends TestCase
{
    private Application $app;

    /** @var array<string, string> */
    private array $cookies = [];

    protected function setUp(): void
    {
        $this->app = Application::boot(dirname(__DIR__, 2));

        /** @var Database $db */
        $db = $this->app->container->get(Database::class);

        if (!$db->isHealthy()) {
            self::markTestSkipped('Database unavailable — run `php bin/console.php migrate && php bin/console.php seed`.');
        }

        $this->cookies = [];
        $this->signIn();
    }

    /** 07-orders/data/admin-order-fixtures.ts */
    public function testOrderRegisterRowsAreUnchanged(): void
    {
        $rows = $this->index($this->get('/admin/orders?per_page=100'));

        $expected = [
            'IO-2026-1048' => ['Aarav K.', '3', '18100', 'Captured', 'Placed', 'Bengaluru'],
            'IO-2026-1047' => ['Riya S.', '1', '11400', 'Pending', 'Placed', 'Mumbai'],
            'IO-2026-1046' => ['Maya P.', '3', '23300', 'Captured', 'Confirmed', 'Delhi'],
            'IO-2026-1045' => ['Ishan T.', '2', '17800', 'Captured', 'Confirmed', 'Bengaluru'],
            'IO-2026-1044' => ['Dev W.', '1', '4600', 'Refunded', 'Confirmed', 'Pune'],
            'IO-2026-1042' => ['Sana R.', '2', '14400', 'Refunded', 'Cancelled', 'Chennai'],
            'IO-2026-1039' => ['Noor A.', '1', '8900', 'Captured', 'Confirmed', 'Kolkata'],
        ];

        foreach ($expected as $number => [$customer, $items, $value, $payment, $status, $destination]) {
            self::assertArrayHasKey($number, $rows);
            self::assertSame($customer, $rows[$number]['customer'], $number);
            self::assertSame($items, $rows[$number]['items'], $number);
            self::assertSame($value, $rows[$number]['value'], $number);
            self::assertSame($payment, $rows[$number]['payment'], $number);
            self::assertSame($status, $rows[$number]['status'], $number);
            self::assertSame($destination, $rows[$number]['destination'], $number);
            // The register renders flat string maps — nothing may arrive typed.
            self::assertSame(['string'], array_values(array_unique(array_map('gettype', $rows[$number]))), $number);
        }

        self::assertSame('Customer', $rows['IO-2026-1042']['cancelledBy']);
        self::assertArrayNotHasKey('cancelledBy', $rows['IO-2026-1048']);
    }

    /** 09-payment/payment-data.ts */
    public function testPaymentLedgerRowsAreUnchanged(): void
    {
        $rows = $this->index($this->get('/admin/payments?per_page=100'));

        $expected = [
            'pay_ICE1048' => ['IO-2026-1048', 'A•••• K••••', 'Razorpay', 'UPI ••••42', '11400', 'Captured'],
            'pay_ICE1047' => ['IO-2026-1047', 'R•••• S••••', 'Courier', 'Cash on delivery', '8900', 'Due'],
            'pay_ICE1046' => ['IO-2026-1046', 'M•••• P••••', 'Razorpay', 'Netbanking', '18700', 'Failed'],
            'pay_ICE1045' => ['IO-2026-1045', 'S•••• N••••', 'Razorpay', 'UPI ••••11', '6200', 'Captured'],
            'pay_ICE1044' => ['IO-2026-1044', 'K•••• V••••', 'Cashfree', 'Mastercard ••••7731', '12400', 'Refunded'],
            'pay_ICE1043' => ['IO-2026-1043', 'D•••• J••••', 'Courier', 'Cash on delivery', '24800', 'Due'],
        ];

        foreach ($expected as $id => [$order, $customer, $gateway, $method, $amount, $status]) {
            self::assertArrayHasKey($id, $rows);
            self::assertSame($order, $rows[$id]['order'], $id);
            self::assertSame($customer, $rows[$id]['customer'], $id);
            self::assertSame($gateway, $rows[$id]['gateway'], $id);
            self::assertSame($method, $rows[$id]['method'], $id);
            self::assertSame($amount, $rows[$id]['amount'], $id);
            self::assertSame($status, $rows[$id]['status'], $id);
        }
    }

    /** Payouts derive net; the fixture states it, so the two must agree. */
    public function testPayoutNetIsDerivedAndMatchesTheFixture(): void
    {
        $rows = $this->index($this->get('/admin/payouts'));

        self::assertSame(['284600', '5692', '278908', 'Pending'], [
            $rows['out_ICE084']['gross'], $rows['out_ICE084']['fees'], $rows['out_ICE084']['net'], $rows['out_ICE084']['status'],
        ]);
        self::assertSame('92034', $rows['out_ICE083']['net']);
        self::assertSame('192374', $rows['out_ICE082']['net']);
    }

    /** 17-shipping/data/shipment-fixtures.ts */
    public function testShipmentRowsAreUnchanged(): void
    {
        $rows = $this->index($this->get('/admin/shipments'));

        self::assertSame(['IO-2026-1045', 'Blue Dart', '••••1045', '05 Aug', '08–09 Aug', 'In transit'], [
            $rows['shp-1045']['order'], $rows['shp-1045']['provider'], $rows['shp-1045']['awb'],
            $rows['shp-1045']['dispatched'], $rows['shp-1045']['promise'], $rows['shp-1045']['status'],
        ]);
        self::assertSame('Delivered', $rows['shp-1044']['status']);
        self::assertSame('Failed', $rows['shp-1039']['status']);
    }

    /** 18-returns/data/admin-return-fixtures.ts */
    public function testReturnRowsAreUnchanged(): void
    {
        $rows = $this->index($this->get('/admin/returns'));

        $expected = [
            'ret-072' => ['IO-2026-1027', 'Aarav Mehta', 'Bone Utility Overshirt · L', 'Exchange', '11400', 'New'],
            'ret-071' => ['IO-2026-1024', 'Ishita Rao', 'Shadow Cargo 02 · M', 'Voucher', '9800', 'New'],
            'ret-069' => ['IO-2026-1018', 'Kabir Shah', 'Afterdark Hoodie · M', 'Exchange', '8900', 'Approved'],
            'ret-066' => ['IO-2026-1011', 'Meera Nair', 'Core Heavy Tee · S', 'Voucher', '4600', 'Approved'],
            'ret-064' => ['IO-2026-1008', 'Ananya Bose', 'Core Heavy Tee · S', 'Exchange', '4600', 'Completed'],
            'ret-058' => ['IO-2026-0996', 'Diya Kapoor', 'Afterdark Hoodie · XL', 'Voucher', '8900', 'Rejected'],
        ];

        foreach ($expected as $id => [$order, $customer, $item, $outcome, $amount, $state]) {
            self::assertSame([$order, $customer, $item, $outcome, $amount, $state], [
                $rows[$id]['order'], $rows[$id]['customer'], $rows[$id]['item'],
                $rows[$id]['outcome'], $rows[$id]['amount'], $rows[$id]['state'],
            ], $id);
        }
    }

    /** 03-inventory/data/stock-fixtures.ts */
    public function testStockRowsAreUnchangedAndCarryNoAvailableColumn(): void
    {
        $rows = $this->index($this->get('/admin/inventory/items'));

        self::assertSame(['Afterdark Hoodie', 'Top', 'Hoodie', 'S, M, L, XL', 'BLR-01', '48', '12'], [
            $rows['ITM-001']['itemName'], $rows['ITM-001']['category'], $rows['ITM-001']['itemType'],
            $rows['ITM-001']['sizes'], $rows['ITM-001']['warehouse'],
            $rows['ITM-001']['totalUnits'], $rows['ITM-001']['reservedUnits'],
        ]);

        // available is always total − reserved, so storing it would be storing a
        // number that can disagree with the two it comes from.
        self::assertArrayNotHasKey('available', $rows['ITM-001']);
        self::assertSame('6', $rows['ITM-002']['totalUnits']);
        self::assertSame('9', $rows['ITM-005']['totalUnits']);
    }

    /**
     * 01-users/customers-data.ts — the invariant the fixture states in prose:
     * "a customer listed with three orders opens onto exactly three orders".
     */
    public function testCustomerCountsMatchTheirHistories(): void
    {
        $rows = $this->index($this->get('/admin/customers?per_page=100'));

        $expected = [
            'cus-2048' => ['Aarav Kapoor', '4', 'Active'],
            'cus-2047' => ['Riya Sharma', '2', 'Active'],
            'cus-2031' => ['Meera Patel', '7', 'Active'],
            'cus-2019' => ['Dev Walia', '1', 'Active'],
            'cus-1984' => ['Sana Rahman', '3', 'Blocked'],
        ];

        foreach ($expected as $id => [$name, $orders, $state]) {
            self::assertSame([$name, $orders, $state], [$rows[$id]['name'], $rows[$id]['orders'], $rows[$id]['state']], $id);

            $history = $this->get(sprintf('/admin/customers/%s/orders', $id));
            self::assertCount((int) $orders, $history, $id . ' history');
        }
    }

    /** 11-reviews/reviews.ts — rating is a STRING on the wire. */
    public function testReviewRowsAreUnchanged(): void
    {
        $rows = $this->index($this->get('/admin/reviews'));

        self::assertSame(['Afterdark Hoodie', '5', 'A•••• K••••', 'Pending', 'Console'], [
            $rows['REV-2041']['product'], $rows['REV-2041']['rating'], $rows['REV-2041']['customer'],
            $rows['REV-2041']['status'], $rows['REV-2041']['origin'],
        ]);
        self::assertSame('Nocturne Cap', $rows['REV-2031']['product']);
        self::assertSame('Customer', $rows['REV-2028']['origin']);
        self::assertCount(7, $rows);
    }

    /** 14-support/data/support-queries.ts */
    public function testSupportQueriesAreUnchanged(): void
    {
        $rows = $this->index($this->get('/admin/support/queries?status=all'), 'reference');

        self::assertSame(['Riya S.', 'Payment or refund', 'IO-2026-1047', '04 Aug 2026 · 14:18', 'Open'], [
            $rows['IO-Q-1003']['customer'], $rows['IO-Q-1003']['topic'], $rows['IO-Q-1003']['order'],
            $rows['IO-Q-1003']['sentAt'], $rows['IO-Q-1003']['status'],
        ]);
        self::assertSame('No order', $rows['IO-Q-1001']['order']);
        self::assertStringContainsString('cut loose', $rows['IO-Q-1001']['reply']);
    }

    /** 02-products/catalog-seed.ts */
    public function testCatalogRegisterRowsAreUnchanged(): void
    {
        $rows = $this->index($this->get('/admin/catalog/products'));

        $expected = [
            'afterdark-hoodie' => ['Afterdark Hoodie', 'ITM-001', 'M', 'ADH', 'Published'],
            'bone-utility-overshirt' => ['Bone Utility Overshirt', 'ITM-002', 'S', 'BUO', 'Published'],
            'midnight-denim' => ['Midnight Denim', 'ITM-005', '34', 'MDD', 'Scheduled'],
            'core-heavy-tee' => ['Core Heavy Tee', 'ITM-003', 'M', 'CHT', 'Published'],
            'shadow-cargo-02' => ['Shadow Cargo 02', 'ITM-004', '32', 'SC2', 'Published'],
        ];

        foreach ($expected as $slug => [$name, $item, $size, $sku, $status]) {
            self::assertSame([$name, $item, $size, $sku, $status], [
                $rows[$slug]['name'], $rows[$slug]['item'], $rows[$slug]['size'],
                $rows[$slug]['sku'], $rows[$slug]['status'],
            ], $slug);
        }
    }

    /** 02-products/api/product-fixtures.ts — the numbers the PDP e2e asserts. */
    public function testPerSizeStockMatchesTheStorefrontFixture(): void
    {
        $detail = $this->get('/admin/catalog/products/afterdark-hoodie');
        $variants = $this->index($detail['variants']);

        self::assertSame('0', $variants['ADH-WSB-XS']['stock'], 'XS is sold out');
        self::assertSame('2', $variants['ADH-WSB-L']['stock'], 'L has only two left');
        self::assertSame('6', $variants['ADH-WSB-M']['stock']);
    }

    /** 15-dashboard/data/trading-series.ts — offset 0 is stated, not generated. */
    public function testTodaysTradingFiguresAreUnchanged(): void
    {
        $trading = $this->get('/admin/dashboard/trading?days=200');
        $today = $trading['series'][0];

        self::assertSame(0, $today['offset']);
        self::assertSame(428420, $today['revenue']);
        self::assertSame(48, $today['orders']);
        self::assertSame(1249, $today['sessions']);
        self::assertSame(5, $today['returns']);
        self::assertCount(200, $trading['series']);
    }

    /** The dashboard counts what the registers hold — nothing is kept as a total. */
    public function testDashboardQueuesAgreeWithTheRegisters(): void
    {
        $queues = $this->get('/admin/dashboard/queues');

        self::assertSame(1, $queues['paymentExceptions']['count'], 'one Failed payment');
        self::assertSame(2, $queues['returnsToReview']['count'], 'two New returns');
        self::assertSame(2, $queues['openTickets']['count'], 'two Open queries');
    }

    /* ------------------------------------------------------------- harness */

    private function signIn(): void
    {
        $this->send('POST', '/admin/auth/login', 'public', Json::encode([
            'email' => 'admin@gmail.com',
            'password' => 'admin123',
        ]));
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return array<string, array<string, mixed>>
     */
    private function index(array $rows, string $key = 'id'): array
    {
        $indexed = [];

        foreach ($rows as $row) {
            $indexed[(string) $row[$key]] = $row;
        }

        return $indexed;
    }

    /** @return array<array-key, mixed> */
    private function get(string $path): array
    {
        $body = $this->send('GET', $path, 'admin');

        /** @var array<array-key, mixed> $data */
        $data = $body['data'] ?? [];

        return $data;
    }

    /** @return array<string, mixed> */
    private function send(string $method, string $path, string $audience, string $rawBody = ''): array
    {
        $query = [];
        $parts = explode('?', $path, 2);

        if (isset($parts[1])) {
            parse_str($parts[1], $query);
        }

        /** @var array<string, string> $query */
        $response = $this->app->handle(new Request(
            method: $method,
            path: $parts[0],
            query: $query,
            headers: [
                'x-client-audience' => $audience,
                'origin' => 'http://127.0.0.1:3000',
                'content-type' => 'application/json',
            ],
            cookies: $this->cookies,
            rawBody: $rawBody,
            ip: '127.0.0.1',
        ));

        $header = $response->headers()['Set-Cookie'] ?? null;

        if (is_string($header) && preg_match('/^([^=]+)=([^;]*)/', $header, $matches) === 1 && trim($matches[2]) !== '') {
            $this->cookies[trim($matches[1])] = trim($matches[2]);
        }

        /** @var array<string, mixed> $decoded */
        $decoded = Json::decodeArray($response->body()) ?? [];

        return $decoded;
    }
}
