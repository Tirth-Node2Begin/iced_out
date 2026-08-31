<?php

declare(strict_types=1);

namespace Iced\Repository;

use Iced\Kernel\Database;

/**
 * Effective permissions are resolved per request (spec §5.5) — no permission
 * ever rides in a cookie.
 */
final class PermissionRepository
{
    public function __construct(private readonly Database $db)
    {
    }

    /** @return list<string> */
    public function permissionsForUser(int $userId): array
    {
        $rows = $this->db->select(
            'SELECT DISTINCT p.code
               FROM user_roles ur
               JOIN role_permissions rp ON rp.role_id = ur.role_id
               JOIN permissions p ON p.id = rp.permission_id
              WHERE ur.user_id = ?
              ORDER BY p.code',
            [$userId],
        );

        return array_values(array_map(static fn (array $row): string => (string) $row['code'], $rows));
    }

    public function primaryRoleForUser(int $userId): ?string
    {
        $row = $this->db->selectOne(
            'SELECT r.code
               FROM user_roles ur
               JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = ?
              ORDER BY r.id
              LIMIT 1',
            [$userId],
        );

        return $row === null ? null : (string) $row['code'];
    }
}
