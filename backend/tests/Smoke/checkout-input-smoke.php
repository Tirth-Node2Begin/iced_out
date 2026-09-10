<?php

declare(strict_types=1);

/**
 * Bounds on what the checkout body may contain.
 *
 *   php tests/Smoke/checkout-input-smoke.php
 *
 * ── WHY THIS ENDPOINT AND NOT ANOTHER ───────────────────────────────────────
 *
 * `POST /checkout/orders` declares no `rules` at all — the only mutation of any
 * size that does not. Every neighbouring route caps its strings; this one takes
 * the body and hands it to PlaceOrderService as typed. `PUT /me/checkout/draft`,
 * which saves the very same fields for later, caps every one of them.
 *
 * ── THE TWO WAYS AN UNBOUNDED STRING FAILS ──────────────────────────────────
 *
 * `orders.contact_name` is varchar(120), `addr_line` varchar(255). What a longer
 * value does depends on a server setting rather than on anything in this
 * repository:
 *
 *   · STRICT_ALL_TABLES on — this development host, and MySQL 8's default —
 *     and the INSERT throws. The transaction rolls back, the payment intent
 *     returns to VERIFIED, and the card has ALREADY cleared. The customer has
 *     paid for an order that does not exist.
 *   · Strict mode off, which is a live possibility on a shared cPanel plan:
 *     MySQL truncates and says nothing. A 300-character delivery address
 *     silently becomes 255 characters and the parcel goes somewhere incomplete.
 *
 * Neither is acceptable and the second is worse, because nobody finds out.
 *
 * ── AND THE ONE THAT IS NOT ABOUT STRINGS ───────────────────────────────────
 *
 * `inventory.max_per_order` capped the quantity ON a line. Nothing capped the
 * NUMBER of lines. Each line does a catalogue lookup and takes a
 * `SELECT … FOR UPDATE` on its stock row inside a single open transaction — so a
 * body with a hundred thousand lines is not a slow request, it is thousands of
 * locked stock rows stalling every other checkout, from an attacker with no
 * account and no payment.
 *
 * Everything runs inside a transaction that is rolled back.
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Domain\Principal;
use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ApiException;
use Iced\Service\Checkout\PlaceOrderService;

$app = Application::boot($root);
/** @var Database $db */
$db = $app->container->get(Database::class);

if (!$db->isHealthy()) {
    fwrite(STDERR, "Database unavailable — run `php bin/console.php migrate && php bin/console.php seed`.\n");

    exit(1);
}

$pass = 0;
$fail = 0;

function ok(string $label, bool $condition, string $detail = ''): void
{
    global $pass, $fail;
    $condition ? ++$pass : ++$fail;
    printf("  %s %-56s %s\n", $condition ? "\033[32mPASS\033[0m" : "\033[31mFAIL\033[0m", $label, $detail);
}

try {
    $db->transaction(static function (Database $db) use ($app): void {
        /* Same workaround the payment suite carries, and for the same reason: a
           seeded database can hold `variant_inventory` rows pointing at
           `stock_items` that were never seeded, and the foreign-key error that
           causes has nothing to do with input validation. The stock is topped up
           so that placing several orders in a row does not run a size out and
           turn a bounds assertion into an out-of-stock one. */
        $db->statement('UPDATE variant_inventory SET stock_item_id = NULL, on_hand = on_hand + 100');

        $user = $db->selectOne(
            "SELECT * FROM users WHERE type = 'CUSTOMER' AND status = 'ACTIVE' AND deleted_at IS NULL LIMIT 1",
        );

        if ($user === null) {
            throw new RuntimeException('Needs a seeded customer — run `php bin/console.php seed`.');
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

        $place = $app->container->make(PlaceOrderService::class);

        $payload = static fn (array $overrides = []): array => array_replace_recursive([
            'lines' => [['productId' => $variant['slug'], 'size' => $variant['size'], 'quantity' => 1]],
            'contact' => ['name' => 'Smoke Shopper', 'email' => 'smoke@example.com', 'mobile' => '9876543210'],
            'address' => [
                'line' => '14 Carter Road, Bandra West',
                'city' => 'Mumbai',
                'state' => 'Maharashtra',
                'postalCode' => '400050',
            ],
            'delivery' => ['id' => 'standard', 'label' => 'Standard delivery', 'estimate' => '3-5 days'],
            'payment' => ['outcome' => 'due'],
            'money' => ['walletApplied' => 0, 'couponCode' => null],
        ], $overrides);

        /**
         * Returns the field a rejection named, or '(accepted)'.
         *
         * A PDOException reaching here rather than an ApiException is the bug
         * itself — that is the "500 after the card cleared" path — so it is
         * caught separately and reported as what it is.
         */
        $attempt = static function (array $overrides) use ($place, $customer, $payload): string {
            try {
                $place->place($customer, $payload($overrides));

                return '(accepted)';
            } catch (ApiException $error) {
                $details = $error->errors();

                return (string) ($details[0]['field'] ?? 'unknown');
            } catch (Throwable $error) {
                return '(500: ' . substr($error->getMessage(), 0, 60) . ')';
            }
        };

        echo "\n\033[1mStrings that are longer than their column\033[0m\n\n";

        $field = $attempt(['contact' => ['name' => str_repeat('a', 121)]]);
        ok('a 121-character name is refused', $field === 'name', "rejected on: $field");

        $field = $attempt(['address' => ['line' => str_repeat('a', 256)]]);
        ok('a 256-character address is refused', $field === 'line', "rejected on: $field");

        $field = $attempt(['address' => ['city' => str_repeat('a', 81)]]);
        ok('an 81-character city is refused', $field === 'city', "rejected on: $field");

        $field = $attempt(['address' => ['state' => str_repeat('a', 81)]]);
        ok('an 81-character state is refused', $field === 'city', "rejected on: $field");

        $field = $attempt(['contact' => ['email' => str_repeat('a', 180) . '@example.com']]);
        ok('a 192-character email is refused', $field === 'email', "rejected on: $field");

        /* Multi-megabyte, which is what an attacker actually sends. The point is
           that it is refused by a rule rather than by a database error. */
        $field = $attempt(['address' => ['line' => str_repeat('x', 2_000_000)]]);
        ok('and so is a two-megabyte one, cleanly', $field === 'line', "rejected on: $field");

        echo "\n\033[1mExactly at the boundary, which must still work\033[0m\n\n";

        /* A cap that is one character tight breaks real customers, and nobody
           would find out until somebody with a long name could not check out. */
        $field = $attempt(['contact' => ['name' => str_repeat('a', 120)]]);
        ok('a 120-character name is ACCEPTED', $field === '(accepted)', "got: $field");

        $field = $attempt(['address' => ['line' => str_repeat('a', 255)]]);
        ok('a 255-character address is ACCEPTED', $field === '(accepted)', "got: $field");

        echo "\n\033[1mHow many lines one order may carry\033[0m\n\n";

        $many = array_fill(0, 500, ['productId' => $variant['slug'], 'size' => $variant['size'], 'quantity' => 1]);
        $field = $attempt(['lines' => $many]);
        ok('500 lines is refused', $field === 'lines', "rejected on: $field");

        /* The cost is per line and paid before the cap would have been reached,
           so the assertion that matters is that it is refused WITHOUT doing the
           work: no catalogue lookups, no stock locks. Timing it is the only way
           to tell "rejected" from "processed and then rejected". */
        $started = microtime(true);
        $huge = array_fill(0, 20000, ['productId' => $variant['slug'], 'size' => $variant['size'], 'quantity' => 1]);
        $field = $attempt(['lines' => $huge]);
        $elapsed = microtime(true) - $started;

        ok('20,000 lines is refused', $field === 'lines', "rejected on: $field");
        ok('...before any row is locked', $elapsed < 2.0, sprintf('%.3fs', $elapsed));

        echo "\n\033[1mAnd the display labels, which are truncated instead\033[0m\n\n";

        /* These two are labels the browser sends back for display. The delivery
           DECISION is made server-side from `delivery.id`, so a shortened label
           misprices nothing — truncating is right here where rejecting is right
           for an address. */
        $order = $place->place($customer, $payload([
            'delivery' => ['id' => 'standard', 'label' => str_repeat('L', 400), 'estimate' => str_repeat('E', 400)],
        ]));

        $row = $db->selectOne('SELECT delivery_label, delivery_estimate FROM orders WHERE id = ?', [(int) $order['id']]);

        ok('a 400-character delivery label is stored at 80', mb_strlen((string) $row['delivery_label']) === 80, mb_strlen((string) $row['delivery_label']) . ' chars');
        ok('...and the estimate at 40', mb_strlen((string) $row['delivery_estimate']) === 40, mb_strlen((string) $row['delivery_estimate']) . ' chars');

        throw new RuntimeException('__rollback__');
    });
} catch (RuntimeException $error) {
    if ($error->getMessage() !== '__rollback__') {
        fwrite(STDERR, "\n  " . $error->getMessage() . "\n\n");

        exit(1);
    }
}

printf("\n  %d passed, %d failed\n\n", $pass, $fail);

exit($fail === 0 ? 0 : 1);
