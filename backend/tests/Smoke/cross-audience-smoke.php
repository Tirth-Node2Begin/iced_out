<?php

declare(strict_types=1);

/**
 * The test that did not survive the CRM split — restored.
 *
 *   php tests/Smoke/cross-audience-smoke.php
 *
 * ── WHAT IT GUARDS ──────────────────────────────────────────────────────────
 *
 * That a STAFF session can never act as a customer. Three independent mechanisms
 * are supposed to make that true and none of them was exercised end to end:
 *
 *   1. `Authenticate` refuses when X-Client-Audience does not match the route's
 *      own audience — before any cookie is read.
 *   2. `SessionManager::resolve()` reads a DIFFERENT COOKIE NAME per audience,
 *      so a staff cookie is not even looked for on a customer route.
 *   3. `SessionManager::resolveToken()` cross-checks `users.type` against the
 *      audience, so even a token pasted into the right cookie resolves to null.
 *
 * ── WHY IT IS NOT ONE TEST BOOTING BOTH APPS ────────────────────────────────
 *
 * It cannot be. Both deployables define `Iced\Kernel\Application` from their own
 * `src/`, so loading the two autoloaders in one process gives two different
 * classes the same name. The note left in the CRM's StaffAuthFlowTest said
 * restoring this "means an integration test that boots both apps", and that is
 * the one thing PHP will not do.
 *
 * The way through is that the two apps SHARE the session table and the signing
 * secret. A session row minted by either is valid for the other — which is the
 * whole reason the isolation guarantee has to hold in the first place. So this
 * mints a STAFF session using the storefront's own SessionManager, exactly as
 * the CRM would have written it, and then presents it to the storefront's
 * customer routes. No second codebase required, and it tests the surface that
 * actually has to refuse it.
 *
 * The mirror image — a customer session presented to the console — lives in
 * `iced-out-crm/backend/tests/Smoke/cross-audience-smoke.php`.
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
        $staff = $db->selectOne("SELECT * FROM users WHERE type = 'STAFF' AND deleted_at IS NULL LIMIT 1");
        $customer = $db->selectOne("SELECT * FROM users WHERE type = 'CUSTOMER' AND deleted_at IS NULL LIMIT 1");

        if ($staff === null || $customer === null) {
            throw new RuntimeException('Needs a seeded staff and customer account — run `php bin/console.php seed`.');
        }

        $probe = new Request('GET', '/', [], [], [], '', '127.0.0.1');

        // A genuine staff session, minted exactly as the console would mint it.
        $staffToken = $sessions->issue((int) $staff['id'], SessionManager::AUDIENCE_STAFF, $probe)['token'];
        // And a genuine customer session, for the control case.
        $customerToken = $sessions->issue((int) $customer['id'], SessionManager::AUDIENCE_CUSTOMER, $probe)['token'];

        $get = static function (string $path, string $audience, array $cookies) use ($app): int {
            return $app->handle(new Request(
                method: 'GET',
                path: $path,
                query: [],
                headers: ['x-client-audience' => $audience],
                cookies: $cookies,
                rawBody: '',
                ip: '127.0.0.1',
            ))->status();
        };

        echo "\n\033[1mA staff session against the storefront's customer routes\033[0m\n\n";

        // The control: the guarantee is only interesting if the route works.
        ok(
            'a real customer session opens /me',
            $get('/me', 'customer', ['io_csess' => $customerToken]) === 200,
        );

        /* 1 — the staff token in the STAFF cookie, declaring itself staff.
           The route is customer-audience, so Authenticate refuses on the
           audience alone, before any cookie is read. */
        ok(
            'staff cookie + admin audience on /me is refused',
            $get('/me', 'admin', ['io_ssess' => $staffToken]) === 403,
        );

        /* 2 — the same cookie, now LYING about its audience. The header matches
           the route, so the audience gate passes; what refuses it is that
           `io_csess` is a different cookie and is simply not there. */
        ok(
            'staff cookie claiming to be a customer is refused',
            $get('/me', 'customer', ['io_ssess' => $staffToken]) === 401,
        );

        /* 3 — THE REAL TEST. The raw staff token pasted into the CUSTOMER
           cookie. Both earlier defences are now bypassed: the audience matches
           and the cookie name is right. What must stop it is the token space
           itself — `user_sessions.audience` and the `users.type` cross-check in
           resolveToken(). */
        ok(
            'staff TOKEN inside the customer cookie is refused  [THE GUARANTEE]',
            $get('/me', 'customer', ['io_csess' => $staffToken]) === 401,
        );

        // The same three, against endpoints that carry money and history.
        foreach (['/me/orders', '/me/wallet', '/me/addresses', '/me/sessions'] as $path) {
            ok(
                sprintf('staff token cannot read %s', $path),
                $get($path, 'customer', ['io_csess' => $staffToken]) === 401,
            );
        }

        /* 4 — and the reverse of the audience gate: a customer session cannot
           address a route that does not exist on this deployable as staff. */
        ok(
            'customer cookie + admin audience is refused',
            in_array($get('/me', 'admin', ['io_csess' => $customerToken]), [403, 404], true),
        );

        echo "\n\033[1mSession resolution, directly\033[0m\n\n";

        ok(
            'the staff token resolves to nobody as a customer',
            $sessions->resolveToken($staffToken, SessionManager::AUDIENCE_CUSTOMER) === null,
        );
        ok(
            'the customer token resolves to nobody as staff',
            $sessions->resolveToken($customerToken, SessionManager::AUDIENCE_STAFF) === null,
        );
        ok(
            'each token still resolves in its own space',
            $sessions->resolveToken($staffToken, SessionManager::AUDIENCE_STAFF) !== null
                && $sessions->resolveToken($customerToken, SessionManager::AUDIENCE_CUSTOMER) !== null,
        );

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
