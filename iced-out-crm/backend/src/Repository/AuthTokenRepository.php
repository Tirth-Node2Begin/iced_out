<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;

/**
 * `auth_tokens` — the single-use, hashed, expiring credentials of spec §5.6.
 *
 * ONLY THE HASH IS STORED. The six digits mailed to somebody exist in this
 * process for as long as it takes to compose the message and nowhere else; a
 * dump of this table cannot be replayed against the reset endpoint.
 *
 * The hash covers the AUDIENCE and the EMAIL as well as the code, not the code
 * alone. Two reasons, and both matter:
 *
 *   · Six digits is a small space. Hashing the code by itself would collide
 *     across users and — worse — would let a code issued to one account verify
 *     against another, because the lookup is by hash and the hash would match.
 *   · A console code must not open a shop account or the reverse, even when
 *     the same person holds both with the same address.
 *
 * So a row is found only by re-deriving the hash from what the caller typed.
 * There is no "look up by email" here on purpose: that shape is how enumeration
 * gets in.
 */
final class AuthTokenRepository
{
    public const PURPOSE_PASSWORD_RESET = 'PASSWORD_RESET';

    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /**
     * The stored form of one code. BINARY(32), so the raw digest, not hex.
     */
    public static function hash(string $audience, string $emailNormalized, string $code): string
    {
        return hash('sha256', $audience . '|' . $emailNormalized . '|' . $code, true);
    }

    /**
     * Replaces every outstanding code of this purpose for this user.
     *
     * DELETE rather than "mark consumed": `uq_auth_tokens_hash` is unique, and
     * two requests a minute apart have a real chance of drawing the same six
     * digits for the same account — a spent row left behind would make the
     * second issue fail on a duplicate key. Nothing is lost by removing them;
     * the audit trail for "who asked for a reset" is `login_attempts` and the
     * mail log, not this table.
     */
    public function supersede(int $userId, string $purpose): void
    {
        $this->db->statement(
            'DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?',
            [$userId, $purpose],
        );
    }

    public function issue(int $userId, string $purpose, string $tokenHash, int $ttlSeconds, string $payload = ''): void
    {
        $this->db->statement(
            'INSERT INTO auth_tokens (user_id, purpose, token_hash, payload_json, attempts, expires_at, created_at)
             VALUES (?, ?, ?, ?, 0, ?, ?)',
            [
                $userId,
                $purpose,
                $tokenHash,
                $payload === '' ? null : $payload,
                $this->clock->addSeconds($ttlSeconds)->format(Clock::STORAGE_FORMAT),
                $this->clock->nowString(),
            ],
        );
    }

    /**
     * The live row for this exact hash, or null.
     *
     * "Live" means unconsumed and unexpired. An expired row is deliberately NOT
     * returned rather than returned-and-checked: the caller has one branch to
     * write and cannot forget the second half of the condition.
     *
     * @return array<string, mixed>|null
     */
    public function findLive(string $tokenHash, string $purpose): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM auth_tokens
              WHERE token_hash = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ?
              LIMIT 1',
            [$tokenHash, $purpose, $this->clock->nowString()],
        );
    }

    /**
     * The most recent live code for a user, whatever its digits.
     *
     * Used only to count wrong guesses and to rate-limit re-sends — never to
     * authenticate. Verification always goes through findLive() with a hash the
     * caller derived from what was typed.
     *
     * @return array<string, mixed>|null
     */
    public function findLatestLiveForUser(int $userId, string $purpose): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM auth_tokens
              WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ?
              ORDER BY id DESC
              LIMIT 1',
            [$userId, $purpose, $this->clock->nowString()],
        );
    }

    /** @return int the new count */
    public function recordFailedAttempt(int $tokenId): int
    {
        $this->db->statement('UPDATE auth_tokens SET attempts = attempts + 1 WHERE id = ?', [$tokenId]);

        $row = $this->db->selectOne('SELECT attempts FROM auth_tokens WHERE id = ? LIMIT 1', [$tokenId]);

        return $row === null ? 0 : (int) $row['attempts'];
    }

    /** Burns the row. A code that has set a password can never set another. */
    public function consume(int $tokenId): void
    {
        $this->db->statement(
            'UPDATE auth_tokens SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL',
            [$this->clock->nowString(), $tokenId],
        );
    }

    public function discard(int $tokenId): void
    {
        $this->db->statement('DELETE FROM auth_tokens WHERE id = ?', [$tokenId]);
    }

    /** Housekeeping for the console's maintenance command. */
    public function purgeExpired(): int
    {
        return $this->db->statement(
            'DELETE FROM auth_tokens WHERE expires_at < ? OR consumed_at IS NOT NULL',
            [$this->clock->addSeconds(-86400)->format(Clock::STORAGE_FORMAT)],
        );
    }
}
