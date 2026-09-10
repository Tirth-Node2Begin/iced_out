<?php

declare(strict_types=1);

namespace Iced\Service\Maintenance;

use Iced\Kernel\Database;
use Iced\Repository\AuthTokenRepository;
use Iced\Repository\PaymentIntentRepository;
use Iced\Repository\SessionRepository;
use Iced\Support\Cache\CacheStore;
use Iced\Support\Cache\FileCacheStore;
use Iced\Service\Inventory\StockService;
use Iced\Support\Clock;
use Iced\Support\Logger;
use Iced\Support\SecuritySignals;
use Throwable;

/**
 * The periodic tidy nothing was doing.
 *
 * Five things in this codebase were written with an expiry and no sweeper. Each
 * had a `purgeExpired()` or an `expires_at` that nothing ever read, which is a
 * particular kind of bug: everything looks correct at the point it was written,
 * and the consequence only shows up as the database ages.
 *
 *   inventory_reservations   THE SERIOUS ONE. Placing an order holds stock with a
 *                            TTL, and stock is only ever given back by a manual
 *                            cancellation or a dispatch. An unpaid
 *                            cash-on-delivery order therefore holds its pieces
 *                            FOREVER — so an authenticated shopper can take the
 *                            whole catalogue off sale by ordering it and never
 *                            paying, and an honest abandoned checkout leaks a
 *                            unit a time until sizes read "sold out" that are
 *                            sitting in the warehouse.
 *   payment_intents          `CREATED` rows nobody paid. Retired so the claim
 *                            index stays small and so an intent cannot be banked.
 *   user_sessions            revoked and expired rows, kept forever.
 *   auth_tokens              spent and expired password-reset codes, kept forever.
 *   idempotency_keys         48-hour keys, kept forever.
 *   storage/logs             no rotation at all — and under the flat cPanel
 *                            layout that directory is inside the document root.
 *
 * ── WHY IT IS A COMMAND AND NOT A REQUEST ───────────────────────────────────
 *
 * Because it must be able to run when nobody is shopping, and because doing this
 * work inside a customer's request would make one unlucky shopper pay for
 * everyone's tidying. `php bin/console.php sweep`, from cron, hourly.
 *
 * ── IT IS DELIBERATELY CAUTIOUS ─────────────────────────────────────────────
 *
 * Releasing stock is the only step that changes something a person would notice,
 * so it is the only one with a `--dry-run`, it goes strictly by `expires_at`, and
 * it touches nothing but reservations still marked HELD whose order is not live.
 * Everything else only deletes rows that are already dead by their own
 * definition.
 */
final class SweepService
{
    /** How long a log file is kept before it is deleted. */
    private const LOG_RETENTION_DAYS = 30;

    public function __construct(
        private readonly Database $db,
        private readonly StockService $stock,
        private readonly SessionRepository $sessions,
        private readonly AuthTokenRepository $tokens,
        private readonly PaymentIntentRepository $intents,
        private readonly CacheStore $cache,
        private readonly Logger $logger,
        private readonly SecuritySignals $signals,
        private readonly Clock $clock,
    ) {
    }

    /**
     * @param callable(string): void $report
     *
     * @return array<string, int>
     */
    public function run(callable $report, bool $dryRun = false, string $logDirectory = ''): array
    {
        $counts = [
            'reservations_released' => $this->releaseExpiredReservations($report, $dryRun),
            'intents_expired' => $this->expireIntents($report, $dryRun),
            'sessions_purged' => $this->purgeSessions($report, $dryRun),
            'auth_tokens_purged' => $this->purgeAuthTokens($report, $dryRun),
            'idempotency_keys_purged' => $this->purgeIdempotencyKeys($report, $dryRun),
            'mfa_challenges_purged' => $this->purgeMfaChallenges($report, $dryRun),
            'cache_entries_pruned' => $this->pruneCache($report, $dryRun),
            'logs_deleted' => $logDirectory === '' ? 0 : $this->rotateLogs($report, $dryRun, $logDirectory),
        ];

        $this->reportOrphanedPayments($report);

        return $counts;
    }

    /**
     * Gives back stock that was held for an order that never completed.
     *
     * `HELD` only, and only where the order is no longer live. An order sitting
     * in Processing has not gone anywhere — its reservation is doing its job,
     * and expiring it would sell a piece twice. What this collects is the
     * abandoned and the failed: reservations whose window has passed against
     * orders that were cancelled or whose payment never came.
     */
    private function releaseExpiredReservations(callable $report, bool $dryRun): int
    {
        $expired = $this->db->select(
            "SELECT r.order_id, o.number, COUNT(*) AS lines_held, SUM(r.qty) AS units
               FROM inventory_reservations r
               JOIN orders o ON o.id = r.order_id
              WHERE r.status = 'HELD'
                AND r.expires_at IS NOT NULL
                AND r.expires_at < ?
                AND (o.console_state = 'Cancelled' OR o.status IN ('Cancelled', 'Payment failed'))
              GROUP BY r.order_id, o.number
              ORDER BY r.order_id
              LIMIT 500",
            [$this->clock->nowString()],
        );

        if ($expired === []) {
            $report('  reservations   nothing expired against a dead order');

            return 0;
        }

        $units = 0;

        foreach ($expired as $row) {
            $units += (int) $row['units'];

            if ($dryRun) {
                $report(sprintf('  reservations   WOULD release %d unit(s) held for %s', (int) $row['units'], (string) $row['number']));

                continue;
            }

            try {
                /* The one writer. It moves `reserved` down, marks the rows
                   RELEASED and appends an `inventory_movements` line, so the
                   ledger still explains every count. Per order, so one bad row
                   cannot stop the rest of the sweep. */
                $this->db->transaction(fn () => $this->stock->releaseReservationsForOrder((int) $row['order_id'], null));

                $report(sprintf('  reservations   released %d unit(s) held for %s', (int) $row['units'], (string) $row['number']));
            } catch (Throwable $error) {
                $this->logger->exception($error, ['stage' => 'sweep.reservations', 'order' => (string) $row['number']]);
                $report(sprintf('  reservations   FAILED for %s — %s', (string) $row['number'], $error->getMessage()));
            }
        }

        return $units;
    }

    private function expireIntents(callable $report, bool $dryRun): int
    {
        if ($dryRun) {
            $row = $this->db->selectOne(
                "SELECT COUNT(*) AS c FROM payment_intents WHERE status = 'CREATED' AND expires_at < ?",
                [$this->clock->nowString()],
            );
            $count = (int) ($row['c'] ?? 0);
            $report(sprintf('  intents        WOULD expire %d unpaid intent(s)', $count));

            return $count;
        }

        $count = $this->intents->expireStale();
        $report(sprintf('  intents        expired %d unpaid intent(s)', $count));

        return $count;
    }

    private function purgeSessions(callable $report, bool $dryRun): int
    {
        if ($dryRun) {
            $report('  sessions       WOULD purge revoked and expired rows');

            return 0;
        }

        $count = $this->sessions->purgeExpired();
        $report(sprintf('  sessions       purged %d expired or long-revoked row(s)', $count));

        return $count;
    }

    private function purgeAuthTokens(callable $report, bool $dryRun): int
    {
        if ($dryRun) {
            $report('  auth tokens    WOULD purge spent and expired reset codes');

            return 0;
        }

        $count = $this->tokens->purgeExpired();
        $report(sprintf('  auth tokens    purged %d spent or expired reset code(s)', $count));

        return $count;
    }

    private function purgeIdempotencyKeys(callable $report, bool $dryRun): int
    {
        if ($dryRun) {
            $report('  idempotency    WOULD purge keys past their TTL');

            return 0;
        }

        $count = $this->db->statement('DELETE FROM idempotency_keys WHERE expires_at < ?', [$this->clock->nowString()]);
        $report(sprintf('  idempotency    purged %d expired key(s)', $count));

        return $count;
    }

    /**
     * Expired counter and cache files.
     *
     * Nothing removed these: `FileCacheStore::get()` unlinks only the key it was
     * asked for, and rate-limit counters were never cleaned at all. On shared
     * hosting the ceiling that bites first is the INODE quota, and every bucket
     * that can be reached by an unauthenticated request is a way to approach it
     * — after which `hit()` throws and every fail-closed bucket answers 503.
     * Sign-in and checkout down, from requests to URLs that do not exist.
     */
    private function pruneCache(callable $report, bool $dryRun): int
    {
        if ($dryRun) {
            $report('  cache          WOULD prune expired counters and entries');

            return 0;
        }

        $store = $this->cache;

        if (!$store instanceof FileCacheStore) {
            $report('  cache          not a file store — nothing to prune');

            return 0;
        }

        $count = $store->prune();
        $report(sprintf('  cache          pruned %d expired entr%s', $count, $count === 1 ? 'y' : 'ies'));

        return $count;
    }

    /**
     * Spent and expired half-finished console sign-ins.
     *
     * Raw SQL rather than a call into `MfaService`, because that class lives in
     * the CONSOLE deployable and this sweep runs from the storefront — the two
     * share a database, not a `src/`. The table is written by one and tidied by
     * the other, which is exactly the arrangement `webhook_inbox` and
     * `idempotency_keys` already have.
     *
     * A missing table is not an error here: the console's migrations may not
     * have been applied on a storefront-only deployment, and a sweep that dies
     * on that would take the inventory release down with it.
     */
    private function purgeMfaChallenges(callable $report, bool $dryRun): int
    {
        if ($dryRun) {
            $report('  mfa tickets    WOULD purge spent and expired sign-in challenges');

            return 0;
        }

        try {
            $count = $this->db->statement(
                'DELETE FROM mfa_challenges WHERE expires_at < ? OR consumed_at IS NOT NULL',
                [$this->clock->nowString()],
            );
        } catch (Throwable) {
            $report('  mfa tickets    table not present on this deployment — skipped');

            return 0;
        }

        $report(sprintf('  mfa tickets    purged %d spent or expired challenge(s)', $count));

        return $count;
    }

    /**
     * Deletes log files older than the retention window.
     *
     * Under the flat cPanel layout `storage/logs` sits inside the document root,
     * defended by `.htaccess` alone, and it had no rotation of any kind. When
     * `MAIL_DRIVER=log` — the development default, and a thing that has reached a
     * deployment bundle before now — those files contain whole password-reset
     * emails, codes included. A log that is not there cannot be served.
     */
    private function rotateLogs(callable $report, bool $dryRun, string $directory): int
    {
        if (!is_dir($directory)) {
            return 0;
        }

        $cutoff = $this->clock->addSeconds(-self::LOG_RETENTION_DAYS * 86400)->getTimestamp();
        $files = glob(rtrim($directory, '/\\') . '/app-*.log');
        $deleted = 0;

        foreach ($files === false ? [] : $files as $file) {
            $modified = @filemtime($file);

            if ($modified === false || $modified >= $cutoff) {
                continue;
            }

            if ($dryRun) {
                $report(sprintf('  logs           WOULD delete %s', basename($file)));
                ++$deleted;

                continue;
            }

            if (@unlink($file)) {
                ++$deleted;
            }
        }

        $report(sprintf(
            '  logs           %s %d file(s) older than %d days',
            $dryRun ? 'WOULD delete' : 'deleted',
            $deleted,
            self::LOG_RETENTION_DAYS,
        ));

        return $deleted;
    }

    /**
     * Money the gateway took that no order ever claimed.
     *
     * Reported, never touched. A verified intent still sitting unconsumed well
     * past its window means a shopper was charged and has nothing to show for
     * it — the single worst payment outcome, and the one the whole intent
     * mechanism exists to make visible rather than to fix automatically.
     */
    private function reportOrphanedPayments(callable $report): void
    {
        $orphans = $this->intents->orphanedVerified(900, 50);

        if ($orphans === []) {
            $report('  orphaned pay   none');

            return;
        }

        foreach ($orphans as $intent) {
            $this->signals->orphanedPayment((string) $intent['razorpay_payment_id'], [
                'gateway_order' => (string) $intent['razorpay_order_id'],
                'amount_paise' => (int) $intent['amount_paise'],
                'verified_at' => (string) $intent['verified_at'],
            ]);
        }

        $report(sprintf('  orphaned pay   %d PAYMENT(S) WITH NO ORDER — see the ops board', count($orphans)));
    }
}
