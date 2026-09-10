<?php

declare(strict_types=1);

/**
 * Step-up authentication — the password again, for the actions that move money.
 *
 *   php tests/Smoke/step-up-smoke.php
 *
 * A console session is a fifteen-minute idle window in which every permission
 * the account holds is available with no further proof. That is right for
 * dispatching orders and wrong for approving refunds: an unattended laptop for
 * two minutes is enough, and the audit trail would record, correctly and
 * uselessly, that the account did it.
 *
 * Everything runs inside a transaction that is rolled back.
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Request;
use Iced\Middleware\RequireStepUp;
use Iced\Service\Auth\PasswordHasher;
use Iced\Service\Auth\SessionManager;

$app = Application::boot($root);
/** @var Database $db */
$db = $app->container->get(Database::class);

if (!$db->isHealthy()) {
    fwrite(STDERR, "Database unavailable — run `php bin/console.php migrate && php bin/console.php seed`.\n");

    exit(1);
}

$sessions = $app->container->make(SessionManager::class);
$hasher = $app->container->make(PasswordHasher::class);

$pass = 0;
$fail = 0;

function ok(string $label, bool $condition, string $detail = ''): void
{
    global $pass, $fail;
    $condition ? ++$pass : ++$fail;
    printf("  %s %-54s %s\n", $condition ? "\033[32mPASS\033[0m" : "\033[31mFAIL\033[0m", $label, $detail);
}

try {
    $db->transaction(static function (Database $db) use ($app, $sessions, $hasher): void {
        $staff = $db->selectOne("SELECT * FROM users WHERE type = 'STAFF' AND deleted_at IS NULL LIMIT 1");

        if ($staff === null) {
            throw new RuntimeException('Needs a seeded staff account — run `php bin/console.php seed`.');
        }

        $password = 'console-password-1';
        $db->statement('UPDATE users SET password_hash = ? WHERE id = ?', [$hasher->hash($password), (int) $staff['id']]);
        $db->statement(
            'INSERT IGNORE INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = ?',
            [(int) $staff['id'], 'ADMIN'],
        );

        $token = $sessions->issue((int) $staff['id'], SessionManager::AUDIENCE_STAFF, new Request('GET', '/', [], [], [], '', '127.0.0.1'))['token'];

        // A captured payment to raise a refund against.
        $order = $db->selectOne('SELECT id, number FROM orders ORDER BY id DESC LIMIT 1');
        $db->statement(
            "INSERT INTO payments (public_id, order_id, customer_masked, gateway, method, amount, status, note, reference, created_at)
             VALUES (?, ?, 'T', 'Razorpay', 'UPI', '1000.00', 'Captured', '', 'ref', UTC_TIMESTAMP(6))",
            ['pay-su-' . bin2hex(random_bytes(3)), (int) $order['id']],
        );
        $paymentPublicId = (string) $db->selectOne('SELECT public_id FROM payments WHERE id = ?', [(int) $db->pdo()->lastInsertId()])['public_id'];

        $post = static function (string $path, array $body) use ($app, $token): array {
            $response = $app->handle(new Request(
                method: 'POST',
                path: $path,
                query: [],
                headers: [
                    'x-client-audience' => 'admin',
                    'content-type' => 'application/json',
                    'origin' => 'http://127.0.0.1:8100',
                    'idempotency-key' => 'su-' . bin2hex(random_bytes(6)),
                ],
                cookies: ['io_ssess' => $token],
                rawBody: (string) json_encode($body),
                ip: '127.0.0.1',
            ));

            return [$response->status(), $response->body()];
        };

        echo "\n\033[1mA privileged action, before and after proving the password\033[0m\n\n";

        [$status, $body] = $post('/admin/refunds', ['payment' => $paymentPublicId, 'amount' => 100, 'reason' => 'Goodwill']);
        ok('a refund WITHOUT step-up is refused', $status === 428, "HTTP $status");
        ok('...with a code the console can act on', str_contains($body, 'ICE-AUTH-428'));
        ok('...and no refund was written', (int) $db->selectOne('SELECT COUNT(*) c FROM refunds')['c'] === 0
            || !str_contains($body, '"data"'));

        [$status] = $post('/admin/auth/step-up', ['password' => 'not-the-password']);
        ok('the wrong password does not elevate', $status === 422, "HTTP $status");

        [$status, $body] = $post('/admin/refunds', ['payment' => $paymentPublicId, 'amount' => 100, 'reason' => 'Goodwill']);
        ok('...and the refund is still refused', $status === 428, "HTTP $status");

        [$status, $body] = $post('/admin/auth/step-up', ['password' => 'console-password-1']);
        ok('the right password elevates', $status === 200 && str_contains($body, '"confirmed":true'), "HTTP $status");

        [$status] = $post('/admin/refunds', ['payment' => $paymentPublicId, 'amount' => 100, 'reason' => 'Goodwill']);
        ok('...and now the refund is allowed', $status === 201, "HTTP $status");

        echo "\n\033[1mThe elevation expires, and does not outlive its password\033[0m\n\n";

        $db->statement(
            'UPDATE user_sessions SET stepped_up_at = DATE_SUB(UTC_TIMESTAMP(6), INTERVAL ? SECOND) WHERE user_id = ?',
            [RequireStepUp::WINDOW_SECONDS + 60, (int) $staff['id']],
        );

        [$status] = $post('/admin/refunds', ['payment' => $paymentPublicId, 'amount' => 100, 'reason' => 'Goodwill']);
        ok('an elevation older than the window is gone', $status === 428, "HTTP $status");

        // Elevate again, then change the password.
        $post('/admin/auth/step-up', ['password' => 'console-password-1']);
        [$status] = $post('/admin/me/password', ['current' => 'console-password-1', 'next' => 'console-password-2']);
        ok('the password change succeeds', $status === 204, "HTTP $status");

        [$status] = $post('/admin/refunds', ['payment' => $paymentPublicId, 'amount' => 100, 'reason' => 'Goodwill']);
        ok('changing the password ends the elevation', $status === 428, "HTTP $status");

        echo "\n\033[1mUnprivileged routes are untouched\033[0m\n\n";

        $read = $app->handle(new Request(
            method: 'GET',
            path: '/admin/orders',
            query: [],
            headers: ['x-client-audience' => 'admin'],
            cookies: ['io_ssess' => $token],
            rawBody: '',
            ip: '127.0.0.1',
        ))->status();

        ok('reading orders needs no step-up', $read === 200, "HTTP $read");

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
