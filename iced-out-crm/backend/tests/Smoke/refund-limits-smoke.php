<?php

declare(strict_types=1);

/**
 * Refunds cannot exceed the payment they are against.
 *
 *   php tests/Smoke/refund-limits-smoke.php
 *
 * ── THE BUG THIS PINS ───────────────────────────────────────────────────────
 *
 * `createRefund` guarded against over-refunding by comparing the new amount with
 * `refundedTotal()`. That method sums only refunds whose status is `Succeeded`,
 * and every refund is born `Requested`.
 *
 * So the guard ignored every refund that had been raised and not yet approved.
 * Three refunds for the full amount could each pass it — because at the moment
 * each was checked, none of the others had succeeded yet — and then all three
 * could be approved. The read also had no lock and no transaction around it, so
 * two console requests could pass the same check concurrently.
 *
 * Both are closed: the payment row is held for the duration, and the total now
 * counts everything that is not `Failed` — money committed, not merely money
 * already gone.
 *
 * ── IT STEPS UP FIRST ───────────────────────────────────────────────────────
 *
 * Raising a refund is one of the actions that needs the password again. That is
 * a separate control with its own test (`step-up-smoke.php`); here it is simply
 * a precondition, and doing it up front is what keeps this file about refund
 * arithmetic.
 *
 * Everything runs inside a transaction that is rolled back.
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Request;
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
    printf("  %s %-52s %s\n", $condition ? "\033[32mPASS\033[0m" : "\033[31mFAIL\033[0m", $label, $detail);
}

try {
    $db->transaction(static function (Database $db) use ($app, $sessions, $hasher): void {
        $staff = $db->selectOne("SELECT * FROM users WHERE type = 'STAFF' AND deleted_at IS NULL LIMIT 1");

        if ($staff === null) {
            throw new RuntimeException('Needs a seeded staff account — run `php bin/console.php seed`.');
        }

        $password = 'refund-test-password';
        $db->statement('UPDATE users SET password_hash = ? WHERE id = ?', [$hasher->hash($password), (int) $staff['id']]);
        $db->statement(
            'INSERT IGNORE INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = ?',
            [(int) $staff['id'], 'ADMIN'],
        );

        $token = $sessions->issue((int) $staff['id'], SessionManager::AUDIENCE_STAFF, new Request('GET', '/', [], [], [], '', '127.0.0.1'))['token'];

        // A captured payment of exactly ₹1,000 to refund against.
        $order = $db->selectOne('SELECT id FROM orders ORDER BY id DESC LIMIT 1');
        $db->statement(
            "INSERT INTO payments (public_id, order_id, customer_masked, gateway, method, amount, status, note, reference, created_at)
             VALUES (?, ?, 'T', 'Razorpay', 'UPI', '1000.00', 'Captured', '', 'ref', UTC_TIMESTAMP(6))",
            ['pay-rf-' . bin2hex(random_bytes(3)), (int) $order['id']],
        );
        $paymentId = (int) $db->pdo()->lastInsertId();
        $paymentPublicId = (string) $db->selectOne('SELECT public_id FROM payments WHERE id = ?', [$paymentId])['public_id'];

        $post = static function (string $path, array $body) use ($app, $token): int {
            return $app->handle(new Request(
                method: 'POST',
                path: $path,
                query: [],
                headers: [
                    'x-client-audience' => 'admin',
                    'content-type' => 'application/json',
                    'origin' => 'http://127.0.0.1:8100',
                    'idempotency-key' => 'rf-' . bin2hex(random_bytes(6)),
                ],
                cookies: ['io_ssess' => $token],
                rawBody: (string) json_encode($body),
                ip: '127.0.0.1',
            ))->status();
        };

        // Precondition, tested elsewhere.
        $post('/admin/auth/step-up', ['password' => $password]);

        $refund = static fn (int $rupees): int => $post(
            '/admin/refunds',
            ['payment' => $paymentPublicId, 'amount' => $rupees, 'reason' => 'Goodwill'],
        );

        echo "\n\033[1mRefunds against a Rs 1,000 payment\033[0m\n\n";

        ok('Rs 600 is allowed', $refund(600) === 201);
        ok('a SECOND Rs 600 is refused  [OVER-REFUND]', $refund(600) === 422, 'only Rs 400 remains, and the first is only Requested');
        ok('the remaining Rs 400 is allowed', $refund(400) === 201);
        ok('one more rupee is refused', $refund(1) === 422);

        $committed = (float) $db->selectOne(
            "SELECT COALESCE(SUM(amount), 0) t FROM refunds WHERE payment_id = ? AND status <> 'Failed'",
            [$paymentId],
        )['t'];

        ok('committed refunds never exceed the payment', $committed <= 1000.0, sprintf('Rs %s of Rs 1000', $committed));

        /* A FAILED refund releases its amount again — it sent no money, so it
           must not hold any back. */
        $db->statement("UPDATE refunds SET status = 'Failed' WHERE payment_id = ? ORDER BY id LIMIT 1", [$paymentId]);

        ok('a failed refund frees its amount for another try', $refund(600) === 201);

        echo "\n\033[1mMoney that was never taken cannot be sent back\033[0m\n\n";

        /* ---- WHAT THIS CATCHES --------------------------------------------

           Everything above is about AMOUNT, and every one of those guards
           quietly assumed the money had arrived. Nothing asked.

           `Due` is a cash-on-delivery order nobody has collected yet; `Failed`
           is a payment that did not go through. Both carry a real `amount` — the
           very number the refundable arithmetic works from — so both sailed
           through every check above and produced a refund in `Requested`,
           waiting for an approver who has no way of knowing the payment never
           landed. Approving it moves real money out against money that never
           came in. There are Due and Failed payments in the development database
           right now that were refundable in full before this. */
        $db->statement('DELETE FROM refunds WHERE payment_id = ?', [$paymentId]);

        foreach (['Due' => 'a cash-on-delivery payment nobody has collected', 'Failed' => 'a payment that did not go through'] as $state => $what) {
            $db->statement('UPDATE payments SET status = ? WHERE id = ?', [$state, $paymentId]);
            ok(sprintf('%s cannot be refunded', $what), $refund(100) === 422, "status $state");
        }

        /* And the rule is a rule, not a blanket refusal: collecting the cash
           makes the same payment refundable again. */
        $db->statement("UPDATE payments SET status = 'Captured' WHERE id = ?", [$paymentId]);
        ok('...but once it is Captured the refund goes through', $refund(100) === 201);

        /* Read from the LOCKED row inside the transaction, not from the copy
           fetched before it. `collectCod` flips Due to Captured concurrently,
           and a refund decision made from a stale status is the same bug wearing
           a different hat. */
        $db->statement("UPDATE payments SET status = 'Refunded' WHERE id = ?", [$paymentId]);
        ok('a fully refunded payment says so in its own words', $refund(1) === 422, 'not an arithmetic complaint');

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
