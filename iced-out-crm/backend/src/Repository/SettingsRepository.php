<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;
use Iced\Support\Json;

/**
 * store_settings — the policy value store pricing and checkout read internally.
 * Versioned, so a concurrent console edit loses rather than silently winning.
 */
final class SettingsRepository
{
    public function __construct(private readonly Database $db)
    {
    }

    /** @return array<string, mixed> */
    public function all(): array
    {
        $settings = [];

        foreach ($this->db->select('SELECT `key`, value_json, version FROM store_settings ORDER BY `key`') as $row) {
            $settings[(string) $row['key']] = [
                'value' => Json::decodeArray((string) $row['value_json']) ?? [],
                'version' => (int) $row['version'],
            ];
        }

        return $settings;
    }

    /** @return array<string, mixed>|null */
    public function get(string $key): ?array
    {
        $row = $this->db->selectOne('SELECT value_json, version FROM store_settings WHERE `key` = ?', [$key]);

        if ($row === null) {
            return null;
        }

        return ['value' => Json::decodeArray((string) $row['value_json']) ?? [], 'version' => (int) $row['version']];
    }

    /** @param array<string, mixed> $value */
    public function put(string $key, array $value, ?int $expectedVersion, ?int $actorId): bool
    {
        if ($expectedVersion !== null) {
            return $this->db->statement(
                'UPDATE store_settings SET value_json = ?, version = version + 1, updated_by = ? WHERE `key` = ? AND version = ?',
                [Json::encode($value), $actorId, $key, $expectedVersion],
            ) > 0;
        }

        $this->db->statement(
            'INSERT INTO store_settings (`key`, value_json, version, updated_by) VALUES (?, ?, 1, ?)
             ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), version = version + 1, updated_by = VALUES(updated_by)',
            [$key, Json::encode($value), $actorId],
        );

        return true;
    }

    /** @return list<array<string, mixed>> */
    public function staffActivity(int $staffUserId, int $limit, int $offset): array
    {
        return $this->db->select(
            'SELECT * FROM staff_activity_logs WHERE staff_user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?',
            [$staffUserId, $limit, $offset],
        );
    }

    public function countStaffActivity(int $staffUserId): int
    {
        $row = $this->db->selectOne('SELECT COUNT(*) AS n FROM staff_activity_logs WHERE staff_user_id = ?', [$staffUserId]);

        return $row === null ? 0 : (int) $row['n'];
    }

    /**
     * @param array{entity?: string, actor?: string} $filters
     *
     * @return list<array<string, mixed>>
     */
    public function auditLogs(array $filters, int $limit, int $offset): array
    {
        $where = ['1 = 1'];
        $bindings = [];

        if (($filters['entity'] ?? '') !== '') {
            $where[] = 'a.entity_type = ?';
            $bindings[] = $filters['entity'];
        }

        if (($filters['actor'] ?? '') !== '') {
            $where[] = 'u.public_id = ?';
            $bindings[] = $filters['actor'];
        }

        return $this->db->select(
            'SELECT a.*, u.name AS actor_name, u.public_id AS actor_public_id
               FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY a.id DESC LIMIT ? OFFSET ?',
            [...$bindings, $limit, $offset],
        );
    }
}
