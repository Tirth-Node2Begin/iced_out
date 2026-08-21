<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;

/**
 * users + the customer register the console reads. Email uniqueness is per type
 * (a person may be both a customer and a staff member), which the
 * uq_users_email_per_type index enforces.
 */
final class UserRepository
{
    public const TYPE_CUSTOMER = 'CUSTOMER';
    public const TYPE_STAFF = 'STAFF';

    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    public static function normalizeEmail(string $email): string
    {
        return mb_strtolower(trim($email));
    }

    /** @return array<string, mixed>|null */
    public function findByEmail(string $email, string $type): ?array
    {
        return $this->db->selectOne(
            'SELECT u.*, m.public_id AS photo_public_id
               FROM users u
               LEFT JOIN media_assets m ON m.id = u.photo_media_id AND m.deleted_at IS NULL
              WHERE u.email_normalized = ? AND u.type = ? AND u.deleted_at IS NULL
              LIMIT 1',
            [self::normalizeEmail($email), $type],
        );
    }

    /** @return array<string, mixed>|null */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne(
            'SELECT u.*, m.public_id AS photo_public_id
               FROM users u
               LEFT JOIN media_assets m ON m.id = u.photo_media_id AND m.deleted_at IS NULL
              WHERE u.id = ? AND u.deleted_at IS NULL
              LIMIT 1',
            [$id],
        );
    }

    /** @return array<string, mixed>|null */
    public function findByPublicId(string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM users WHERE public_id = ? AND deleted_at IS NULL LIMIT 1',
            [$publicId],
        );
    }

    public function create(
        string $publicId,
        string $type,
        string $name,
        string $email,
        string $passwordHash,
        string $phone = '',
    ): int {
        return $this->db->insert(
            'INSERT INTO users (public_id, type, status, name, email, email_normalized, phone, password_hash, last_seen_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $publicId,
                $type,
                'ACTIVE',
                $name,
                trim($email),
                self::normalizeEmail($email),
                $phone,
                $passwordHash,
                $this->clock->nowString(),
                $this->clock->nowString(),
            ],
        );
    }

    /** Bumps the register's "seen" column — the server-side half of recordCustomerSignIn(). */
    public function touchLastSeen(int $userId): void
    {
        $this->db->statement('UPDATE users SET last_seen_at = ? WHERE id = ?', [$this->clock->nowString(), $userId]);
    }

    /** @param array<string, mixed> $fields */
    public function updateProfile(int $userId, array $fields): void
    {
        if ($fields === []) {
            return;
        }

        $sets = [];
        $bindings = [];

        foreach ($fields as $column => $value) {
            $sets[] = $column . ' = ?';
            $bindings[] = $value;
        }

        $bindings[] = $this->clock->nowString();
        $bindings[] = $userId;

        $this->db->statement('UPDATE users SET ' . implode(', ', $sets) . ', updated_at = ? WHERE id = ?', $bindings);
    }

    public function updatePasswordHash(int $userId, string $hash): void
    {
        $this->db->statement('UPDATE users SET password_hash = ? WHERE id = ?', [$hash, $userId]);
    }

    public function emailExists(string $email, string $type): bool
    {
        return $this->findByEmail($email, $type) !== null;
    }
}
