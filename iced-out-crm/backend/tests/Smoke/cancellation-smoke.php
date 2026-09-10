<?php

declare(strict_types=1);

/**
 * Cancelling an order gives back the store credit it spent.
 *
 *   php tests/Smoke/cancellation-smoke.php
 *
 * ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
 *
 * `OrderConsoleService::cancel()` released the stock, cancelled the shipments and
 * wrote the history — and never touched the wallet, even though the order row
 * carries `wallet_applied`. `WalletService::reverseOrder()` had been written for
 * exactly this and was called from nowhere in either deployable.
 *
 * The result was quiet and entirely one-sided: a shopper who spent Rs 2,000 of
 * credit on an order the store then cancelled lost Rs 2,000, with a ledger
 * showing the debit and no matching return.
 *
 * `KIND_REVERSAL` carries its own idempotency key, so cancelling twice credits
 * once — which matters because the console's cancel button is retryable.
 *
 * Everything runs inside a transaction that is rolled back.
 */

$root = dirname(__DIR__, 2);
require $root . '/autoload.php';

use Iced\Domain\Principal;
use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Service\Checkout\PlaceOrderService;
use Iced\Service\Order\OrderConsoleService;
use Iced\Service\Wallet\WalletService;

$app = Application::boot($root);
/** @var Database $db */
$db = $app->container->get(Database::class);

if (!$db->isHealthy()) {
    fwrite(STDERR, "Database unavailable — run `php bin/console.php migrate && php bin/console.php seed`.
");

    exit(1);
}

$cancel = $app->container->make(OrderConsoleService::class);
$wallet = $app->container->make(WalletService::class);
$place = $app->container->make(PlaceOrderService::class);

$pass = 0;
$fail = 0;

function ok(string $label, bool $condition, string $detail = ''): void
{
    global $pass, $fail;
    $condition ? ++$pass : ++$fail;
    printf("  %s %-50s %s
", $condition ? "[32mPASS[0m" : "[31mFAIL[0m", $label, $detail);
}

try {
    $db->transaction(static function (Database $db) use ($app, $cancel, $wallet, $place): void {
        $db->statement('UPDATE variant_inventory SET stock_item_id = NULL, on_hand = on_hand + 50');

        $user = $db->selectOne("SELECT * FROM users WHERE type = 'CUSTOMER' AND status = 'ACTIVE' ORDER BY id LIMIT 1");
        $staff = $db->selectOne("SELECT * FROM users WHERE type = 'STAFF' LIMIT 1");
        $variant = $db->selectOne(
            'SELECT p.public_id AS slug, v.size FROM product_variants v
               JOIN products p ON p.id = v.product_id
              WHERE v.deleted_at IS NULL AND p.price > 0 ORDER BY v.id LIMIT 1',
        );

        if ($user === null || $staff === null || $variant === null) {
            throw new RuntimeException('Needs a seeded customer, staff account and product — run `php bin/console.php seed`.');
        }

        $uid = (int) $user['id'];

        $db->statement(
            'INSERT INTO wallet_accounts (user_id, balance, created_at) VALUES (?, ?, UTC_TIMESTAMP(6))
             ON DUPLICATE KEY UPDATE balance = VALUES(balance)',
            [$uid, '5000.00'],
        );

        echo "
[1mAn order part-paid from the wallet, then cancelled[0m

";

        ok('the wallet starts at Rs 5,000', $wallet->balance($uid)->rupees() === 5000);

        $order = $place->place(
            new Principal($uid, (string) $user['public_id'], 'customer', (string) $user['name'], (string) $user['email'], (string) $user['status'], 0),
            [
                'lines' => [['productId' => $variant['slug'], 'size' => $variant['size'], 'quantity' => 1]],
                'contact' => ['name' => 'Test Shopper', 'email' => 't@example.test', 'mobile' => '9876543210'],
                'address' => ['line' => '14 Carter Road, Bandra', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'postalCode' => '400050'],
                'delivery' => ['id' => 'standard', 'label' => 'Standard delivery', 'estimate' => '3-5'],
                'payment' => ['outcome' => 'due', 'method' => 'Cash on delivery'],
                'money' => ['walletApplied' => 2000, 'couponCode' => null],
            ],
        );

        ok('the order spent Rs 2,000 of it', (int) (float) $order['wallet_applied'] === 2000, (string) $order['number']);
        ok('...leaving Rs 3,000', $wallet->balance($uid)->rupees() === 3000);

        $actor = new Principal(
            (int) $staff['id'], (string) $staff['public_id'], 'staff',
            (string) $staff['name'], (string) $staff['email'], (string) $staff['status'], 0,
        );

        $cancel->cancel((string) $order['number'], 'Store', $actor);

        ok('cancelling returns the credit  [SEC-WAL-01]', $wallet->balance($uid)->rupees() === 5000, 'was silently destroyed before');

        $cancel->cancel((string) $order['number'], 'Store', $actor);

        ok('cancelling twice credits once', $wallet->balance($uid)->rupees() === 5000);

        $entries = $db->select(
            'SELECT direction, amount, kind, reference FROM wallet_entries e
               JOIN wallet_accounts a ON a.id = e.account_id
              WHERE a.user_id = ? ORDER BY e.id',
            [$uid],
        );

        $kinds = array_column($entries, 'kind');
        ok('the ledger shows the debit and its reversal', $kinds === ['order', 'reversal'], implode(' then ', $kinds));

        $reserved = (int) $db->selectOne(
            "SELECT COUNT(*) c FROM inventory_reservations WHERE order_id = ? AND status = 'HELD'",
            [(int) $order['id']],
        )['c'];
        ok('and the stock is released too', $reserved === 0);

        echo "\n\033[1mBut not once it has been delivered\033[0m\n\n";

        /* ---- THE OTHER HALF OF THE WALLET FIX -----------------------------

           Making the reversal work is only right if cancellation is restricted
           to orders that have not gone anywhere. There was no state guard at
           all: `console_state` holds only Placed, Confirmed and Cancelled —
           delivery is recorded on the SHIPMENT and mirrored into `orders.status`
           — so a delivered order still read as `Confirmed` and cancelled
           happily. With the reversal now working, that hands back the store
           credit for goods the customer already has.

           A fresh order, because the one above is Cancelled by now. */
        $delivered = $place->place(
            new Principal($uid, (string) $user['public_id'], 'customer', (string) $user['name'], (string) $user['email'], (string) $user['status'], 0),
            [
                'lines' => [['productId' => $variant['slug'], 'size' => $variant['size'], 'quantity' => 1]],
                'contact' => ['name' => 'Test Shopper', 'email' => 't@example.test', 'mobile' => '9876543210'],
                'address' => ['line' => '14 Carter Road, Bandra', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'postalCode' => '400050'],
                'delivery' => ['id' => 'standard', 'label' => 'Standard delivery', 'estimate' => '3-5'],
                'payment' => ['outcome' => 'due', 'method' => 'Cash on delivery'],
                'money' => ['walletApplied' => 1000, 'couponCode' => null],
            ],
        );

        $db->statement("UPDATE orders SET status = 'Delivered' WHERE id = ?", [(int) $delivered['id']]);
        $before = $wallet->balance($uid)->rupees();

        $refused = false;

        try {
            $cancel->cancel((string) $delivered['number'], 'Store', $actor);
        } catch (ConflictException $error) {
            $refused = str_contains($error->getMessage(), 'delivered');
        }

        ok('a DELIVERED order cannot be cancelled', $refused, 'raise a return instead');
        ok('...so no credit is handed back for it', $wallet->balance($uid)->rupees() === $before, "Rs $before still");

        throw new RuntimeException('__rollback__');
    });
} catch (RuntimeException $error) {
    if ($error->getMessage() !== '__rollback__') {
        fwrite(STDERR, "
  " . $error->getMessage() . "

");

        exit(1);
    }
}

printf("
  %d passed, %d failed

", $pass, $fail);

exit($fail === 0 ? 0 : 1);
