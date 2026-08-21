<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;

/** Append-only ledger behind the progressive lockout of spec §5.6. */
final class LoginAttemptRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    public function record(string $email, string $audience, string $ip, bool $wasSuccess): void
    {
        $this->db->statement(
            'INSERT INTO login_attempts (email_normalized, audience, ip, was_success, created_at)
             VALUES (?, ?, INET6_ATON(?), ?, ?)',
            [
                UserRepository::normalizeEmail($email),
                $audience,
                $ip === '' ? '0.0.0.0' : $ip,
                $wasSuccess ? 1 : 0,
                $this->clock->nowString(),
            ],
        );
    }

    /** Consecutive failures since the last success, inside the lockout window. */
    public function recentFailures(string $email, string $audience, int $windowSeconds): int
    {
        $since = $this->clock->addSeconds(-$windowSeconds)->format(Clock::STORAGE_FORMAT);

        $lastSuccess = $this->db->selectOne(
            'SELECT created_at FROM login_attempts
              WHERE email_normalized = ? AND audience = ? AND was_success = 1 AND created_at >= ?
              ORDER BY id DESC LIMIT 1',
            [UserRepository::normalizeEmail($email), $audience, $since],
        );

        $from = $lastSuccess === null ? $since : (string) $lastSuccess['created_at'];

        $row = $this->db->selectOne(
            'SELECT COUNT(*) AS failures FROM login_attempts
              WHERE email_normalized = ? AND audience = ? AND was_success = 0 AND created_at > ?',
            [UserRepository::normalizeEmail($email), $audience, $from],
        );

        return $row === null ? 0 : (int) $row['failures'];
    }
}
