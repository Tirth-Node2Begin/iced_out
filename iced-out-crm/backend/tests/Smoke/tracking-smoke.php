<?php

declare(strict_types=1);

/**
 * Order tracking — iThink Logistics.
 *
 * Run:  php tests/Smoke/tracking-smoke.php
 *
 * Two halves, and neither opens a socket:
 *
 *   MAPPING   their documented response body, pasted verbatim from
 *             https://docs.ithinklogistics.com/doc-track-order/3, driven through
 *             the pure `snapshotFrom()`. This is where a tracking integration
 *             actually breaks — a renamed field, a list that is really an object,
 *             a date in the wrong slot — and none of it needs credentials to
 *             catch.
 *   BINDING   that the container hands back the placeholder with no credentials
 *             and the real client with them, because a provider that silently
 *             stays a placeholder in production is the failure that looks like
 *             success.
 *
 * The live call is deliberately NOT exercised here: a test that needs a real
 * AWB and a real account is a test that gets skipped, and this file is meant to
 * run on every checkout.
 */

require __DIR__ . '/../../autoload.php';

use Iced\Integration\Tracking\IthinkLogisticsTrackingProvider as Ithink;
use Iced\Integration\Tracking\PlaceholderTrackingProvider;
use Iced\Integration\Tracking\TrackingProvider;
use Iced\Kernel\Application;
use Iced\Support\Logger;

$passed = 0;
$failed = 0;

function check(string $what, mixed $got, mixed $want): void
{
    global $passed, $failed;

    if ($got === $want) {
        ++$passed;
        printf("  ok    %s  (%s)\n", $what, is_scalar($got) ? var_export($got, true) : gettype($got));

        return;
    }

    ++$failed;
    printf("  FAIL  %s\n          want %s\n          got  %s\n", $what, var_export($want, true), var_export($got, true));
}


/* The same in-process request harness the other smoke tests use, so the refresh
   below goes through the REAL middleware pipeline — audience, origin,
   validation, permissions, audit — and not straight at the controller. */
$cookies = [];

function absorb(Iced\Kernel\Response $r, array &$cookies): void
{
    $header = $r->headers()['Set-Cookie'] ?? null;
    if (!is_string($header) || preg_match('/^([^=]+)=([^;]*)/', $header, $m) !== 1) {
        return;
    }
    $name = trim($m[1]);
    if (trim($m[2]) === '' || str_contains($header, 'Max-Age=0')) {
        unset($cookies[$name]);

        return;
    }
    $cookies[$name] = trim($m[2]);
}

function call(string $method, string $path, ?array $body = null): array
{
    global $app, $cookies;
    $headers = ['x-client-audience' => 'admin', 'origin' => 'http://127.0.0.1:3100'];
    $raw = '';
    if ($body !== null) {
        $headers['content-type'] = 'application/json';
        $raw = Iced\Support\Json::encode($body);
    }
    $res = $app->handle(new Iced\Kernel\Request(
        method: $method, path: $path, query: [], headers: $headers,
        cookies: $cookies, rawBody: $raw, ip: '127.0.0.1',
    ));
    absorb($res, $cookies);

    return ['status' => $res->status(), 'body' => Iced\Support\Json::decodeArray($res->body()) ?? []];
}

/* ------------------------------------------------------------------ mapping */

echo "\n  Their documented response, mapped\n\n";

/** The example body from the docs, field for field. */
$documented = [
    'status_code' => 200,
    'data' => [
        '1369010033902' => [
            'message' => 'success',
            'awb_no' => '1369010033902',
            'logistic' => 'Delhivery',
            'order_type' => 'forward',
            'cancel_status' => 'Approved',
            'current_status' => 'In Transit',
            'current_status_code' => 'UD',
            'ofd_count' => '0',
            'return_tracking_no' => '',
            'expected_delivery_date' => '2017-06-07',
            'promise_delivery_date' => '2017-06-09',
            'last_scan_details' => [
                'status' => 'Undelivered',
                'status_code' => 'UD',
                'status_date_time' => '2017-06-07 18:11:26',
                'scan_location' => 'Surat_Pandesra_Gateway (Gujarat)',
                'remark' => 'CONSIGNEE NOT AVAILABLE',
                'reason' => 'customer not available at the time of delivery',
            ],
            'order_details' => [
                'order_type' => 'COD',
                'order_number' => '11812',
                'net_payment' => '775.00',
            ],
            'order_date_time' => [
                'manifest_date_time' => '2017-06-07 13:34:36',
                'pickup_date' => '2017-06-07',
                'delivery_date' => '',
                'rto_delivered_date' => '',
            ],
            'customer_details' => [
                'customer_name' => 'John Doe',
                'customer_city' => 'Chennai',
                'customer_pincode' => '600030',
            ],
            /* Deliberately out of order — the docs promise no sorting, and a
               timeline that renders in arrival order is a timeline that jumps
               about between refreshes. */
            'scan_details' => [
                [
                    'status' => 'Undelivered',
                    'status_code' => 'UD',
                    'scan_location' => 'Surat_Pandesra_Gateway (Gujarat)',
                    'remark' => 'CONSIGNEE NOT AVAILABLE',
                    'scan_date_time' => '2017-06-07 18:11:26',
                    'status_reason' => 'customer not available at the time of delivery',
                ],
                [
                    'status' => 'Manifested',
                    'status_code' => 'UD',
                    'scan_location' => 'HQ (Haryana)',
                    'remark' => 'Consignment Manifested',
                    'scan_date_time' => '2017-06-07 14:05:57',
                    'status_reason' => '',
                ],
            ],
        ],
    ],
];

$snap = Ithink::snapshotFrom($documented, '1369010033902');

check('the reply is recognised as coming from the courier', $snap->fromProvider, true);
check('current_status is carried through', $snap->status, 'In Transit');
check('the LIVE estimate wins over the booking promise', $snap->estimate, '2017-06-07');
check('both scans are mapped', count($snap->events), 2);
check('scans are sorted oldest first', $snap->events[0]['label'], 'Manifested');
check('the later scan is second', $snap->events[1]['label'], 'Undelivered');
check('a scan carries the courier own timestamp', $snap->events[0]['time'], '2017-06-07 14:05:57');
check('every courier scan is a thing that happened', $snap->events[0]['complete'], true);
check(
    'detail is location then remark',
    $snap->events[0]['detail'],
    'HQ (Haryana) · Consignment Manifested',
);
check(
    'the human reason beats the operational remark',
    $snap->events[1]['detail'],
    'Surat_Pandesra_Gateway (Gujarat) · customer not available at the time of delivery',
);

/* ------------------------------------------------------- the unhappy shapes */

echo "\n  The shapes that are NOT a parcel\n\n";

$wrongAwb = Ithink::snapshotFrom($documented, '9999999999999');
check('an AWB the account does not own returns nothing', $wrongAwb->fromProvider, false);
check('and says why', $wrongAwb->note, 'iThink Logistics does not have a parcel under this AWB.');

$refused = Ithink::snapshotFrom(['status_code' => 401], '1369010033902');
check('a 401 in the envelope is not a parcel', $refused->fromProvider, false);
check(
    'and names the two settings to check',
    $refused->note,
    'iThink Logistics rejected the credentials. Check ITHINK_ACCESS_TOKEN and ITHINK_SECRET_KEY.',
);

$notSuccess = Ithink::snapshotFrom(
    ['status_code' => 200, 'data' => ['123' => ['message' => 'AWB not found', 'current_status' => 'Delivered']]],
    '123',
);
check('message != success is refused even with a status beside it', $notSuccess->fromProvider, false);
check('and no status is taken from it', $notSuccess->status, null);

$empty = Ithink::snapshotFrom(
    ['status_code' => 200, 'data' => ['123' => ['message' => 'success', 'current_status' => 'Manifested']]],
    '123',
);
check('a parcel with no scans yet is still a real answer', $empty->fromProvider, true);
check('with an empty tail rather than an invented one', count($empty->events), 0);
check('and no estimate invented', $empty->estimate, null);

/* --------------------------------------------------------- status vocabulary */

echo "\n  Courier status to console status\n\n";

check('Delivered', Ithink::consoleStatus('Delivered'), 'Delivered');
check('In Transit (case insensitive)', Ithink::consoleStatus('in transit'), 'In transit');
check('Out For Delivery is still in transit', Ithink::consoleStatus('Out For Delivery'), 'In transit');
check('Undelivered is a failure', Ithink::consoleStatus('Undelivered'), 'Failed');
check('RTO Delivered came back to us', Ithink::consoleStatus('RTO Delivered'), 'Delivered');
check('REV Cancelled', Ithink::consoleStatus('REV Cancelled'), 'Cancelled');
check('an unknown status is never guessed at', Ithink::consoleStatus('Teleported'), null);
check('nor is an empty one', Ithink::consoleStatus(''), null);

/* ------------------------------------------------------------------ binding */

echo "\n  What the container binds\n\n";

$root = dirname(__DIR__, 2);

$app = Application::boot($root);
$bound = $app->container->make(TrackingProvider::class);

$config = $app->config();
$hasCredentials = $config->string('app.tracking.access_token') !== ''
    && $config->string('app.tracking.secret_key') !== '';

if ($hasCredentials) {
    check('credentials present, so the real client is bound', $bound instanceof Ithink, true);
    check('and it reports itself connected', $bound->isConnected(), true);
} else {
    check('no credentials, so the placeholder is bound', $bound instanceof PlaceholderTrackingProvider, true);
    check('and it reports itself NOT connected', $bound->isConnected(), false);
    check('and invents nothing', count($bound->fetch('123', 'Delhivery')->events), 0);
}

/* A client built by hand, to prove the switch is on the credentials and that an
   unconfigured one refuses before it ever reaches the network. */
$blank = new Ithink('https://api.ithinklogistics.com/api_v3', '', '', 20, $app->container->make(Logger::class));
check('a client with no token is not connected', $blank->isConnected(), false);
check('and short-circuits without calling out', $blank->fetch('123', 'Delhivery')->fromProvider, false);
check(
    'saying exactly what is missing',
    $blank->fetch('123', 'Delhivery')->note,
    'iThink Logistics credentials are not configured on this server.',
);

$noAwb = new Ithink('https://api.ithinklogistics.com/api_v3', 'tok', 'sec', 20, $app->container->make(Logger::class));
check('a parcel with no AWB is not looked up', $noAwb->fetch('', 'Delhivery')->fromProvider, false);
check(
    'and says so plainly',
    $noAwb->fetch('  ', 'Delhivery')->note,
    'This parcel has no AWB yet, so the courier has nothing to look up.',
);

/* ------------------------------------------------------------- end to end */

/**
 * The half a pure test cannot reach: does a refresh actually CACHE what the
 * courier said, and does a second refresh REPLACE that tail instead of doubling
 * it? `replaceExternalEvents` has sat unused in the repository since the schema
 * was written; this is the first thing that proves it does its job.
 *
 * A stub provider is bound over the real one — what is under test here is the
 * persistence, not the HTTP, which the mapping section above already covers.
 */

echo "\n  Refreshing a real shipment\n\n";

$db = $app->container->make(Iced\Kernel\Database::class);

$stub = new class implements TrackingProvider {
    public int $calls = 0;

    public function fetch(string $awb, string $carrier): Iced\Integration\Tracking\TrackingSnapshot
    {
        ++$this->calls;

        return new Iced\Integration\Tracking\TrackingSnapshot(
            'In Transit',
            '2026-09-09',
            [
                ['label' => 'Manifested', 'detail' => 'HQ (Haryana)', 'time' => '2026-09-05 14:05:57', 'complete' => true],
                ['label' => 'In Transit', 'detail' => 'Surat (Gujarat)', 'time' => '2026-09-06 09:12:03', 'complete' => true],
            ],
            true,
        );
    }

    public function isConnected(): bool
    {
        return true;
    }
};

$app->container->instance(TrackingProvider::class, $stub);

/**
 * The parcel to refresh.
 *
 * Made here rather than borrowed from the seed: a smoke test that only works on
 * a database somebody remembered to populate is a test that reports success by
 * skipping. It hangs off whatever order exists, is the only thing this file
 * writes, and is deleted on the way out — `shipment_events` follows it through
 * ON DELETE CASCADE.
 *
 * A database that is not up is still a skip rather than a failure: everything
 * above this line is pure and has already run, and the mapping is where this
 * integration actually breaks.
 */
$madeShipment = null;

try {
    $shipment = $db->selectOne('SELECT id, public_id, awb FROM shipments ORDER BY id LIMIT 1');

    if ($shipment === null) {
        $order = $db->selectOne('SELECT id, number FROM orders ORDER BY id LIMIT 1');

        if ($order !== null) {
            $madeShipment = 'SMOKE-TRACK-1';
            $db->statement(
                "INSERT INTO shipments
                    (public_id, order_id, order_number, provider, awb, destination,
                     dispatched_label, promise_label, status, tracking_token, created_at)
                 VALUES (?, ?, ?, 'Delhivery', '1369010033902', 'Chennai 600030',
                         'today', 'in 3 days', 'Dispatched', ?, NOW(6))",
                [$madeShipment, (int) $order['id'], (string) $order['number'], 'smoke-track-token-1'],
            );
            $shipment = $db->selectOne('SELECT id, public_id, awb FROM shipments WHERE public_id = ?', [$madeShipment]);

            // one internal milestone, so "the tail sorts after them" means something
            $db->statement(
                "INSERT INTO shipment_events (shipment_id, label, detail, time_label, is_complete, position, source, created_at)
                 VALUES (?, 'Dispatched', 'Handed to the courier.', 'today', 1, 0, 'internal', NOW(6))",
                [(int) $shipment['id']],
            );
        }
    }
} catch (Throwable $unreachable) {
    $shipment = null;
    printf("  ..    database unreachable, skipping the persistence checks (%s)\n", $unreachable->getMessage());
}

if ($shipment === null) {
    echo "  ..    no order to hang a shipment on; the mapping checks above still ran\n";
} else {
    $shipmentId = (int) $shipment['id'];
    $before = $db->selectOne(
        "SELECT COUNT(*) AS c FROM shipment_events WHERE shipment_id = ? AND source = 'internal'",
        [$shipmentId],
    );
    $internalBefore = (int) ($before['c'] ?? 0);

    $login = call('POST', '/admin/auth/login', ['email' => 'admin@gmail.com', 'password' => 'admin123']);
    check('staff sign-in for the refresh', $login['status'], 200);

    $first = call('POST', '/admin/shipments/' . $shipment['public_id'] . '/refresh');
    check('refresh answers 200', $first['status'], 200);
    check('and reports it really refreshed', $first['body']['data']['refreshed'] ?? null, true);
    check('carrying the courier status', $first['body']['data']['courier_status'] ?? null, 'In Transit');
    check('and the courier estimate', $first['body']['data']['courier_estimate'] ?? null, '2026-09-09');
    check('and how many scans it cached', $first['body']['data']['scans'] ?? null, 2);
    check('with no note, because nothing went wrong', $first['body']['data']['note'] ?? null, '');

    $cached = $db->select(
        "SELECT label, detail, time_label, is_complete, position FROM shipment_events
          WHERE shipment_id = ? AND source = 'external' ORDER BY position, id",
        [$shipmentId],
    );
    check('two external rows were written', count($cached), 2);
    check('in the order the provider sorted them', $cached[0]['label'] ?? null, 'Manifested');
    check(
        "carrying the COURIER'S timestamp, not now()",
        $cached[0]['time_label'] ?? null,
        '2026-09-05 14:05:57',
    );
    check('and the scan location', $cached[0]['detail'] ?? null, 'HQ (Haryana)');
    check('marked as having happened', (int) ($cached[0]['is_complete'] ?? 0), 1);
    check('sorted after the internal milestones', (int) ($cached[0]['position'] ?? 0) >= 1000, true);

    $second = call('POST', '/admin/shipments/' . $shipment['public_id'] . '/refresh');
    check('a second refresh also succeeds', $second['status'], 200);

    $again = $db->select(
        "SELECT id FROM shipment_events WHERE shipment_id = ? AND source = 'external'",
        [$shipmentId],
    );
    check('the tail is REPLACED, not doubled', count($again), 2);

    $internalAfter = $db->selectOne(
        "SELECT COUNT(*) AS c FROM shipment_events WHERE shipment_id = ? AND source = 'internal'",
        [$shipmentId],
    );
    check('and the internal milestones are untouched', (int) ($internalAfter['c'] ?? -1), $internalBefore);
    check('the provider was asked once per refresh', $stub->calls, 2);

    $db->statement("DELETE FROM shipment_events WHERE shipment_id = ? AND source = 'external'", [$shipmentId]);

    if ($madeShipment !== null) {
        // events cascade with it
        $db->statement('DELETE FROM shipments WHERE public_id = ?', [$madeShipment]);
    }

    echo "\n  cleaned up the smoke-test shipment.\n";
}

printf("\n  %d passed, %d failed\n\n", $passed, $failed);

exit($failed === 0 ? 0 : 1);
