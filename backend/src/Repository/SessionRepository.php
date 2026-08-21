<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;

/**
 * user_sessions. Tokens are never stored — only their SHA-256 (spec §5.1).
 */
final class SessionRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /** @return array<string, mixed>|null */
    public function findActiveByTokenHash(string $tokenHash, string $audience): ?array
    {
        return $this->db->selectOne(
            'SELECT s.id, s.user_id, s.audience, s.idle_expires_at, s.absolute_expires_at,
                    u.public_id, u.name, u.email, u.status, u.type
               FROM user_sessions s
               JOIN users u ON u.id = s.user_id
              WHERE s.token_hash = ?
                AND s.audience = ?
                AND s.revoked_at IS NULL
                AND u.deleted_at IS NULL
                AND (s.idle_expires_at IS NULL OR s.idle_expires_at > ?)
                AND (s.absolute_expires_at IS NULL OR s.absolute_expires_at > ?)
              LIMIT 1',
            [$tokenHash, $audience, $this->clock->nowString(), $this->clock->nowString()],
        );
    }

    public function create(
        int $userId,
        string $audience,
        string $tokenHash,
        ?string $idleExpiresAt,
        ?string $absoluteExpiresAt,
        string $ip,
        string $userAgent,
    ): int {
        return $this->db->insert(
            'INSERT INTO user_sessions
                (user_id, audience, token_hash, ip, user_agent, last_active_at, idle_expires_at, absolute_expires_at, created_at)
             VALUES (?, ?, ?, INET6_ATON(?), ?, ?, ?, ?, ?)',
            [
                $userId,
                $audience,
                $tokenHash,
                $ip === '' ? '0.0.0.0' : $ip,
                mb_substr($userAgent, 0, 255),
                $this->clock->nowString(),
                $idleExpiresAt,
                $absoluteExpiresAt,
                $this->clock->nowString(),
            ],
        );
    }

    /** Slides the idle window — every authenticated console request does this (spec §5.1). */
    public function touch(int $sessionId, ?string $idleExpiresAt): void
    {
        $this->db->statement(
            'UPDATE user_sessions SET last_active_at = ?, idle_expires_at = ? WHERE id = ?',
            [$this->clock->nowString(), $idleExpiresAt, $sessionId],
        );
    }

    public function revoke(int $sessionId): void
    {
        $this->db->statement(
            'UPDATE user_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL',
            [$this->clock->nowString(), $sessionId],
        );
    }

    public function revokeAllForUser(int $userId, string $audience, ?int $exceptSessionId = null): void
    {
        $sql = 'UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND audience = ? AND revoked_at IS NULL';
        $bindings = [$this->clock->nowString(), $userId, $audience];

        if ($exceptSessionId !== null) {
            $sql .= ' AND id <> ?';
            $bindings[] = $exceptSessionId;
        }

        $this->db->statement($sql, $bindings);
    }

    /** @return list<array<string, mixed>> */
    public function listForUser(int $userId, string $audience): array
    {
        return $this->db->select(
            'SELECT id, created_at, last_active_at, INET6_NTOA(ip) AS ip, user_agent
               FROM user_sessions
              WHERE user_id = ? AND audience = ? AND revoked_at IS NULL
              ORDER BY last_active_at DESC, id DESC',
            [$userId, $audience],
        );
    }

    public function purgeExpired(): int
    {
        return $this->db->statement(
            'DELETE FROM user_sessions
              WHERE (revoked_at IS NOT NULL AND revoked_at < DATE_SUB(?, INTERVAL 7 DAY))
                 OR (absolute_expires_at IS NOT NULL AND absolute_expires_at < ?)',
            [$this->clock->nowString(), $this->clock->nowString()],
        );
    }
}
