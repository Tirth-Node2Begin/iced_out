<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Clock;

final class AddressRepository
{
    public function __construct(
        private readonly Database $db,
        private readonly Clock $clock,
    ) {
    }

    /** @return list<array<string, mixed>> */
    public function forUser(int $userId): array
    {
        return $this->db->select(
            'SELECT * FROM user_addresses WHERE user_id = ? AND deleted_at IS NULL ORDER BY is_default DESC, position, id',
            [$userId],
        );
    }

    /** @return array<string, mixed>|null */
    public function find(int $userId, string $publicId): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM user_addresses WHERE user_id = ? AND public_id = ? AND deleted_at IS NULL LIMIT 1',
            [$userId, $publicId],
        );
    }

    public function nextPublicId(): string
    {
        return 'addr-' . bin2hex(random_bytes(6));
    }

    /** @param array<string, mixed> $fields */
    public function insert(int $userId, string $publicId, array $fields): int
    {
        return $this->db->insert(
            'INSERT INTO user_addresses
                (public_id, user_id, label, name, street, city, state, pincode, phone, is_default, position, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
            [
                $publicId, $userId, $fields['label'], $fields['name'], $fields['street'], $fields['city'],
                $fields['state'], $fields['pincode'], $fields['phone'],
                (int) ($fields['position'] ?? 0), $this->clock->nowString(),
            ],
        );
    }

    /** @param array<string, mixed> $fields */
    public function update(int $userId, string $publicId, array $fields): void
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
        $bindings[] = $publicId;

        $this->db->statement(
            'UPDATE user_addresses SET ' . implode(', ', $sets) . ', updated_at = ? WHERE user_id = ? AND public_id = ?',
            $bindings,
        );
    }

    public function softDelete(int $userId, string $publicId): void
    {
        $this->db->statement(
            'UPDATE user_addresses SET deleted_at = ?, is_default = 0 WHERE user_id = ? AND public_id = ?',
            [$this->clock->nowString(), $userId, $publicId],
        );
    }

    /** Exactly one default per book — set here rather than trusted from a caller. */
    public function makeDefault(int $userId, string $publicId): void
    {
        $this->db->statement('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [$userId]);
        $this->db->statement(
            'UPDATE user_addresses SET is_default = 1 WHERE user_id = ? AND public_id = ? AND deleted_at IS NULL',
            [$userId, $publicId],
        );
    }

    /** Deleting the default promotes whatever is next (spec §8.4 #27). */
    public function promoteIfNoDefault(int $userId): void
    {
        $existing = $this->db->selectOne(
            'SELECT id FROM user_addresses WHERE user_id = ? AND is_default = 1 AND deleted_at IS NULL LIMIT 1',
            [$userId],
        );

        if ($existing !== null) {
            return;
        }

        $next = $this->db->selectOne(
            'SELECT public_id FROM user_addresses WHERE user_id = ? AND deleted_at IS NULL ORDER BY position, id LIMIT 1',
            [$userId],
        );

        if ($next !== null) {
            $this->makeDefault($userId, (string) $next['public_id']);
        }
    }
}
