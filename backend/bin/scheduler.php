<?php

declare(strict_types=1);

/**
 * Cron entry point — run every minute (spec §13):
 *
 *   * * * * * php /path/to/backend/bin/scheduler.php
 *
 * It only enqueues; the work itself happens in bin/worker.php so a slow job can
 * never delay the tick.
 */

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Support\Clock;
use Iced\Support\Json;
use Iced\Support\Logger;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);

    exit;
}

$root = dirname(__DIR__);

require $root . '/autoload.php';

$app = Application::boot($root);
/** @var Database $db */
$db = $app->container->get(Database::class);
/** @var Clock $clock */
$clock = $app->container->get(Clock::class);
/** @var Logger $logger */
$logger = $app->container->get(Logger::class);

$now = $clock->now();
$minute = (int) $now->format('i');
$hour = (int) $now->format('H');

$enqueue = static function (string $queue, string $type, array $payload = []) use ($db, $clock): void {
    $db->statement(
        'INSERT INTO job_queue (queue, type, payload_json, run_after, created_at) VALUES (?, ?, ?, ?, ?)',
        [$queue, $type, Json::encode($payload), $clock->nowString(), $clock->nowString()],
    );
};

try {
    // Every minute — reservations must expire promptly or stock stays trapped.
    $enqueue('critical', 'inventory.expire_reservations');
    $enqueue('critical', 'orders.fail_unpaid_prepaid');

    if ($minute % 5 === 0) {
        $enqueue('analytics', 'dashboard.refresh_trading_day');
        $enqueue('critical', 'payments.reconcile_pending');
    }

    if ($minute % 15 === 0) {
        $enqueue('analytics', 'ops.compact_signals');
        $enqueue('analytics', 'activity.trim_retention');
    }

    if ($minute === 0) {
        // Courier silence detector is DEFERRED until the external tracking API
        // is connected (spec §9.8) — the slot exists, the body is a logged no-op.
        $logger->info('scheduler.courier_silence_detector.skipped', ['reason' => 'external tracking API not connected']);
    }

    if ($hour === 2 && $minute === 0) {
        $enqueue('critical', 'vouchers.expire');
        $enqueue('critical', 'idempotency.purge');
        $enqueue('critical', 'sessions.purge');
        $enqueue('documents', 'payouts.ingest');
        $enqueue('analytics', 'audit.trim_retention');
    }

    fwrite(STDOUT, 'scheduler tick queued' . PHP_EOL);
} catch (Throwable $error) {
    $logger->exception($error, ['stage' => 'scheduler']);
    fwrite(STDERR, $error->getMessage() . PHP_EOL);

    exit(1);
}
