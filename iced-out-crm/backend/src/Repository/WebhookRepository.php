<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;
use PDOException;

/**
 * `webhook_inbox` — every webhook this server has been sent, valid or not.
 *
 * The table has existed since migration 0005 and nothing has ever written to it.
 * It is the right shape already, and the one column that makes it work is
 * `UNIQUE (provider, event_id)`: a gateway that retries — and Razorpay retries
 * for hours — must not be able to make the same thing happen twice.
 *
 * THE ORDER OF OPERATIONS IS THE DESIGN. The row is inserted BEFORE the event is
 * acted on, and the insert failing on the unique index is how a duplicate is
 * detected. Reading first and then inserting would leave a window in which two
 * concurrent deliveries of the same event both see nothing and both process it,
 * which is precisely the retry storm a gateway produces when it thinks we are
 * slow.
 *
 * Bad signatures are stored too, with `signature_ok = 0`. They are refused, but
 * an attempt to forge a payment notification is exactly the thing an operator
 * needs the body of afterwards.
 */
final class WebhookRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /**
     * Claims this event for processing. False means it has been seen before.
     *
     * `INSERT` rather than a check, so the unique index arbitrates rather than
     * this code. A caller that gets false must do nothing and answer 200 — the
     * work was done the first time, and telling the gateway otherwise buys
     * another retry of something already handled.
     */
    public function claim(string $provider, string $eventId, string $payload, bool $signatureOk): bool
    {
        try {
            $this->db->statement(
                'INSERT INTO webhook_inbox (provider, event_id, signature_ok, payload, created_at)
                 VALUES (?, ?, ?, ?, ?)',
                [
                    mb_substr($provider, 0, 40),
                    mb_substr($eventId, 0, 190),
                    $signatureOk ? 1 : 0,
                    $payload,
                    $this->clock->nowString(),
                ],
            );

            return true;
        } catch (PDOException) {
            // uq_webhook_inbox_event: already delivered. Not an error.
            return false;
        }
    }

    /** Marks an event handled. Anything still null is work the sweep will retry. */
    public function markProcessed(string $provider, string $eventId): void
    {
        $this->db->statement(
            'UPDATE webhook_inbox SET processed_at = ? WHERE provider = ? AND event_id = ? AND processed_at IS NULL',
            [$this->clock->nowString(), $provider, $eventId],
        );
    }

    /**
     * Events that were accepted and never finished.
     *
     * Only `signature_ok = 1` rows: an unsigned event is not work in progress,
     * it is an intrusion attempt, and retrying it would be acting on it.
     *
     * @return list<array<string, mixed>>
     */
    public function unprocessed(string $provider, int $limit = 50): array
    {
        return $this->db->select(
            'SELECT * FROM webhook_inbox
              WHERE provider = ? AND processed_at IS NULL AND signature_ok = 1
              ORDER BY id
              LIMIT ' . max(1, min(200, $limit)),
            [$provider],
        );
    }

    /** How many forged or misconfigured deliveries arrived in a window. */
    public function rejectedSince(string $provider, int $seconds): int
    {
        $row = $this->db->selectOne(
            'SELECT COUNT(*) AS c FROM webhook_inbox WHERE provider = ? AND signature_ok = 0 AND created_at > ?',
            [$provider, $this->clock->addSeconds(-$seconds)->format(Clock::STORAGE_FORMAT)],
        );

        return (int) ($row['c'] ?? 0);
    }
}
