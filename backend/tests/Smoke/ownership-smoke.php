<?php

declare(strict_types=1);

/**
 * Object-level authorisation — can one shopper reach another's records?
 *
 *   php tests/Smoke/ownership-smoke.php
 *
 * ── WHY THIS EXISTS EVEN THOUGH THE AUDIT FOUND NOTHING ─────────────────────
 *
 * The security review read every parameterised customer route and found no IDOR:
 * `/me/orders/{id}`, `/me/addresses/{id}` and `/me/sessions/{id}` all filter on
 * the authenticated principal's own id, and several do it twice. That is a good
 * result and it is exactly the kind that quietly stops being true — the scoping
 * lives in a WHERE clause, and a WHERE clause is one refactor away from being
 * dropped by somebody who did not know it was load-bearing.
 *
 * So the property is pinned here rather than left as a finding in a document
 * nobody reads twice. Every check below passes today; the value is entirely in
 * the day one of them stops.
 *
 * ── 404 RATHER THAN 403, DELIBERATELY ───────────────────────────────────────
 *
 * A foreign record must answer "no such thing", not "not yours". 403 confirms
 * the id exists, which turns any of these endpoints into an oracle for
 * enumerating other people's order numbers.
 *
 * Everything runs inside a transaction that is rolled back.
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Request;
use Iced\Service\Auth\SessionManager;

$app = Application::boot($root);
/** @var Database $db */
$db = $app->container->get(Database::class);

if (!$db->isHealthy()) {
    fwrite(STDERR, "Database unavailable — run `php bin/console.php migrate && php bin/console.php seed`.\n");

    exit(1);
}

/** @var SessionManager $sessions */
$sessions = $app->container->make(SessionManager::class);

$pass = 0;
$fail = 0;

function ok(string $label, bool $condition, string $detail = ''): void
{
    global $pass, $fail;
    $condition ? ++$pass : ++$fail;
    printf("  %s %-56s %s\n", $condition ? "\033[32mPASS\033[0m" : "\033[31mFAIL\033[0m", $label, $detail);
}

try {
    $db->transaction(static function (Database $db) use ($app, $sessions): void {
        $db->statement('UPDATE variant_inventory SET stock_item_id = NULL, on_hand = on_hand + 100');

        $customers = $db->select("SELECT * FROM users WHERE type = 'CUSTOMER' AND deleted_at IS NULL ORDER BY id LIMIT 2");

        if (count($customers) < 2) {
            /* One seeded customer is enough to test with: the second is created
               here rather than skipping, because "two accounts exist" is not a
               property this test should depend on the seed for. */
            $db->statement(
                "INSERT INTO users (public_id, type, name, email, email_normalized, password_hash, status, created_at)
                 VALUES (?, 'CUSTOMER', 'Ownership Fixture', ?, ?, '', 'ACTIVE', UTC_TIMESTAMP(6))",
                ['cus-ownership-' . bin2hex(random_bytes(3)), 'fixture@example.test', 'fixture@example.test'],
            );
            $customers[] = $db->selectOne('SELECT * FROM users WHERE id = ?', [(int) $db->pdo()->lastInsertId()]);
        }

        [$alice, $mallory] = $customers;

        $probe = new Request('GET', '/', [], [], [], '', '127.0.0.1');
        $aliceToken = $sessions->issue((int) $alice['id'], SessionManager::AUDIENCE_CUSTOMER, $probe)['token'];
        $malloryToken = $sessions->issue((int) $mallory['id'], SessionManager::AUDIENCE_CUSTOMER, $probe)['token'];

        $call = static function (string $method, string $path, string $token, string $body = '') use ($app): int {
            return $app->handle(new Request(
                method: $method,
                path: $path,
                query: [],
                headers: [
                    'x-client-audience' => 'customer',
                    'content-type' => 'application/json',
                    'origin' => 'http://127.0.0.1:8000',
                ],
                cookies: ['io_csess' => $token],
                rawBody: $body,
                ip: '127.0.0.1',
            ))->status();
        };

        echo "\n\033[1mOne shopper's records, seen by another\033[0m\n\n";

        /* ---- orders ---- */
        $order = $db->selectOne('SELECT public_id, number FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 1', [(int) $alice['id']]);

        if ($order === null) {
            // Give Alice an order to own, so the test does not depend on the seed.
            $db->statement(
                "INSERT INTO orders (public_id, number, user_id, status, console_state, contact_name, contact_email,
                                     contact_mobile, addr_line, addr_city, addr_state, addr_postal, delivery_label,
                                     delivery_estimate, delivery_fee, subtotal, discount, wallet_applied, total,
                                     items_summary, cancellation_eligible, placed_at, created_at)
                 VALUES (?, ?, ?, 'Processing', 'Placed', 'A', 'a@example.test', '9876543210', 'L', 'C', 'S', '400001',
                         'Standard delivery', '', 0, 100, 0, 0, 100, 'x', 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))",
                ['ord-own-' . bin2hex(random_bytes(3)), 'IO-OWN-' . random_int(1000, 9999), (int) $alice['id']],
            );
            $order = $db->selectOne('SELECT public_id, number FROM orders WHERE id = ?', [(int) $db->pdo()->lastInsertId()]);
        }

        ok(
            'the owner can read their own order',
            $call('GET', '/me/orders/' . $order['public_id'], $aliceToken) === 200,
        );
        ok(
            "another shopper gets 404 for that order  [IDOR]",
            $call('GET', '/me/orders/' . $order['public_id'], $malloryToken) === 404,
            'must be 404, never 403 — 403 confirms the id exists',
        );
        ok(
            'and 404 by order NUMBER too',
            $call('GET', '/me/orders/' . $order['number'], $malloryToken) === 404,
        );

        /* ---- sessions ---- */
        $aliceSession = $db->selectOne(
            "SELECT id FROM user_sessions WHERE user_id = ? AND audience = 'customer' AND revoked_at IS NULL ORDER BY id DESC LIMIT 1",
            [(int) $alice['id']],
        );

        ok(
            "another shopper cannot revoke that session  [IDOR]",
            $call('DELETE', '/me/sessions/' . $aliceSession['id'], $malloryToken) === 404,
        );
        ok(
            '...and it is still alive afterwards',
            $db->selectOne('SELECT revoked_at FROM user_sessions WHERE id = ?', [(int) $aliceSession['id']])['revoked_at'] === null,
        );

        /* ---- addresses ---- */
        $db->statement(
            "INSERT INTO user_addresses (public_id, user_id, label, name, street, city, state, pincode, phone, is_default, created_at)
             VALUES (?, ?, 'Home', 'A', '14 Carter Road, Bandra', 'Mumbai', 'Maharashtra', '400050', '9876543210', 1, UTC_TIMESTAMP(6))",
            ['adr-own-' . bin2hex(random_bytes(3)), (int) $alice['id']],
        );
        $address = $db->selectOne('SELECT public_id FROM user_addresses WHERE id = ?', [(int) $db->pdo()->lastInsertId()]);

        ok(
            "another shopper cannot edit that address  [IDOR]",
            $call('PATCH', '/me/addresses/' . $address['public_id'], $malloryToken, '{"city":"Hijacked"}') === 404,
        );
        ok(
            "another shopper cannot delete it  [IDOR]",
            $call('DELETE', '/me/addresses/' . $address['public_id'], $malloryToken) === 404,
        );
        ok(
            '...and it survives unchanged',
            (string) $db->selectOne('SELECT city FROM user_addresses WHERE public_id = ?', [$address['public_id']])['city'] === 'Mumbai',
        );

        /* ---- collections are scoped, not merely filtered in the UI ---- */
        $listed = $app->handle(new Request(
            method: 'GET',
            path: '/me/orders',
            query: [],
            headers: ['x-client-audience' => 'customer'],
            cookies: ['io_csess' => $malloryToken],
            rawBody: '',
            ip: '127.0.0.1',
        ))->body();

        ok(
            "another shopper's order list does not contain it",
            !str_contains($listed, (string) $order['public_id']),
        );

        echo "\n\033[1mUnauthenticated access\033[0m\n\n";

        foreach (['/me', '/me/orders', '/me/wallet', '/me/addresses', '/me/sessions'] as $path) {
            $status = $app->handle(new Request(
                method: 'GET',
                path: $path,
                query: [],
                headers: ['x-client-audience' => 'customer'],
                cookies: [],
                rawBody: '',
                ip: '127.0.0.1',
            ))->status();

            ok(sprintf('%s needs a session', $path), $status === 401, "HTTP $status");
        }

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
