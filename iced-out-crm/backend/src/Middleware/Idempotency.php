<?php

declare(strict_types=1);

namespace Iced\Middleware;

use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Middleware;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Kernel\Route;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;
use Iced\Support\Json;
use PDOException;
use Throwable;

/**
 * Spec §4.6. Same key + same body ⇒ the stored response is replayed
 * byte-for-byte. Same key + different body ⇒ 409 ICE-IDMP-409. TTL 48 h.
 *
 * ── CLAIM FIRST, THEN WORK ──────────────────────────────────────────────────
 *
 * This used to read the table, run the handler, and insert afterwards. That is
 * safe against a REPEATED request and useless against a CONCURRENT one: two
 * calls carrying the same key and arriving together both miss the SELECT, both
 * run the handler, and both insert — the unique index quietly collapsing the
 * second row while two orders had already been placed. The double-tap this
 * exists to prevent is precisely the case that produces two requests
 * milliseconds apart rather than seconds.
 *
 * So the row is claimed BEFORE the handler runs and the UNIQUE INDEX decides who
 * won, rather than a read that anyone can race. The loser is refused with a
 * retryable 409 instead of being allowed to do the work a second time.
 *
 * ── A FAILURE MUST NOT POISON THE KEY ───────────────────────────────────────
 *
 * The claim is released when the handler throws or answers 4xx/5xx. Without
 * that, a declined card would hold the key for the full 48-hour TTL and the
 * shopper could never retry with it — the browser generates one key per attempt
 * for exactly this reason, but a retry of the SAME attempt is normal and must
 * work.
 *
 * ── WHY THE CLAIM IS NOT IN THE HANDLER'S TRANSACTION ───────────────────────
 *
 * It cannot be. The handler opens its own transaction; a claim inside it would
 * be invisible to the concurrent request until commit, which is the whole window
 * being closed. The INSERT here runs in autocommit, before the controller is
 * reached, so it is visible to everyone the instant it succeeds.
 */
final class Idempotency implements Middleware
{
    private const IN_FLIGHT = 'IN_FLIGHT';
    private const DONE = 'DONE';

    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
        private readonly StoreSettings $settings,
    ) {
    }

    public function handle(Request $request, callable $next): Response
    {
        $route = $request->attribute('route');

        if (!$route instanceof Route || !$route->idempotent) {
            return $next($request);
        }

        $key = $request->header('idempotency-key');

        if ($key === '') {
            throw ValidationException::field(
                'Idempotency-Key',
                'This action requires an Idempotency-Key header.',
                'ICE-IDMP-422',
            );
        }

        $principal = $request->attribute('principal');
        $scope = $principal instanceof Principal ? $principal->audience . ':' . $principal->publicId : 'anon:' . $request->ip;
        $endpoint = $route->method . ' ' . $route->path;
        $keyHash = hash('sha256', $key, true);
        $requestHash = hash('sha256', $request->rawBody, true);

        if (!$this->claim($scope, $endpoint, $keyHash, $requestHash)) {
            // Somebody already holds this key. Either it is finished — replay it
            // — or it is in flight, and this request must not do the work twice.
            return $this->replayOrRefuse($scope, $endpoint, $keyHash, $requestHash);
        }

        try {
            $response = $next($request);
        } catch (Throwable $error) {
            $this->release($scope, $endpoint, $keyHash);

            throw $error;
        }

        if ($response->status() >= 400) {
            /* A refusal is not an outcome worth replaying — the shopper is meant
               to fix something and try again, with this same key. */
            $this->release($scope, $endpoint, $keyHash);

            return $response;
        }

        $this->complete($scope, $endpoint, $keyHash, $response);

        return $response;
    }

    /**
     * Takes the key, or reports that someone else has it.
     *
     * An expired row is stepped over rather than treated as a conflict: the
     * `ON DUPLICATE KEY UPDATE` re-claims it in place when `expires_at` has
     * passed, so a key reused after its TTL behaves like a fresh one instead of
     * colliding forever with a row nobody will ever replay.
     */
    private function claim(string $scope, string $endpoint, string $keyHash, string $requestHash): bool
    {
        $now = $this->clock->nowString();
        $expiresAt = $this->clock
            ->addSeconds($this->settings->int('security.idempotency_ttl_hours', 48) * 3600)
            ->format(Clock::STORAGE_FORMAT);

        try {
            $rows = $this->db->statement(
                'INSERT INTO idempotency_keys
                    (scope, endpoint, key_hash, request_hash, status, response_status, response_body, expires_at, created_at)
                 VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    request_hash    = IF(expires_at <= VALUES(created_at), VALUES(request_hash), request_hash),
                    status          = IF(expires_at <= VALUES(created_at), VALUES(status), status),
                    response_status = IF(expires_at <= VALUES(created_at), 0, response_status),
                    response_body   = IF(expires_at <= VALUES(created_at), NULL, response_body),
                    created_at      = IF(expires_at <= VALUES(created_at), VALUES(created_at), created_at),
                    expires_at      = IF(expires_at <= VALUES(created_at), VALUES(expires_at), expires_at)',
                [$scope, $endpoint, $keyHash, $requestHash, self::IN_FLIGHT, $expiresAt, $now],
            );
        } catch (PDOException) {
            // Treat any storage refusal as "someone else has it" and fall
            // through to the replay path, which will say something useful.
            return false;
        }

        /* MySQL reports 1 for an insert and 2 for an update that changed
           something; 0 means the row existed and nothing was touched, which is a
           live claim held by someone else. An expired row was re-claimed above
           and reports 2 — that is ours. */
        return $rows === 1 || $rows === 2;
    }

    /**
     * The stored response, or the reason this request may not proceed.
     *
     * @throws ConflictException
     */
    private function replayOrRefuse(string $scope, string $endpoint, string $keyHash, string $requestHash): Response
    {
        $existing = $this->db->selectOne(
            'SELECT request_hash, status, response_status, response_body
               FROM idempotency_keys
              WHERE scope = ? AND endpoint = ? AND key_hash = ? AND expires_at > ?
              LIMIT 1',
            [$scope, $endpoint, $keyHash, $this->clock->nowString()],
        );

        if ($existing === null) {
            // It expired between the claim and this read. Vanishingly unlikely,
            // and a retryable conflict is the honest answer.
            throw new ConflictException(
                'ICE-IDMP-409',
                'That request could not be completed. Please try again.',
                [],
                true,
            );
        }

        if ((string) $existing['request_hash'] !== $requestHash) {
            throw new ConflictException(
                'ICE-IDMP-409',
                'That idempotency key was already used with a different request.',
            );
        }

        if ((string) $existing['status'] === self::IN_FLIGHT) {
            /* The first copy of this request is still running. Retryable, and
               deliberately so: the client should wait and ask again rather than
               treat it as a failure, because the work is very likely about to
               succeed. */
            throw new ConflictException(
                'ICE-IDMP-409',
                'That request is already being processed. Give it a moment and check before trying again.',
                [],
                true,
            );
        }

        $replay = Json::decodeArray((string) $existing['response_body']);

        return Response::envelope(
            is_array($replay) ? $replay : ['data' => null],
            (int) $existing['response_status'],
        )->withHeader('Idempotent-Replay', 'true');
    }

    /** Stores the outcome so a later retry of the same key replays it. */
    private function complete(string $scope, string $endpoint, string $keyHash, Response $response): void
    {
        $envelope = $response->envelopeArray();

        $this->db->statement(
            'UPDATE idempotency_keys
                SET status = ?, response_status = ?, response_body = ?
              WHERE scope = ? AND endpoint = ? AND key_hash = ?',
            [
                self::DONE,
                $response->status(),
                $envelope === null ? '' : Json::encode($envelope),
                $scope,
                $endpoint,
                $keyHash,
            ],
        );
    }

    /**
     * Hands the key back after a failure, so the same attempt can be retried.
     *
     * Deleting rather than marking failed: a key with no row is a key that has
     * never been used, which is exactly what the client should find when it
     * tries again. Never allowed to throw — an idempotency bookkeeping problem
     * must not replace the real error the caller is about to receive.
     */
    private function release(string $scope, string $endpoint, string $keyHash): void
    {
        try {
            $this->db->statement(
                'DELETE FROM idempotency_keys WHERE scope = ? AND endpoint = ? AND key_hash = ? AND status = ?',
                [$scope, $endpoint, $keyHash, self::IN_FLIGHT],
            );
        } catch (Throwable) {
            // Nothing useful to do here; the row expires on its own.
        }
    }
}
