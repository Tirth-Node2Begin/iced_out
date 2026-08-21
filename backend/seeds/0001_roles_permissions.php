<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;
use Iced\Support\Config;

/**
 * Mirrors config/permissions.php into the RBAC tables. config is the source of
 * truth; this seed only reconciles the database with it, so adding a code there
 * and re-running `seed` is the whole workflow.
 */
return static function (Container $container): string {
    /** @var Database $db */
    $db = $container->get(Database::class);
    /** @var Config $config */
    $config = $container->get(Config::class);

    /** @var list<string> $codes */
    $codes = $config->array('permissions.codes');
    /** @var array<string, list<string>> $roles */
    $roles = $config->array('permissions.roles');

    return $db->transaction(static function (Database $db) use ($codes, $roles): string {
        foreach ($codes as $code) {
            $db->statement('INSERT IGNORE INTO permissions (code) VALUES (?)', [$code]);
        }

        // '*' is a real stored code: ADMIN holds it and Principal::can() treats
        // it as the wildcard, so a new permission code never needs an ADMIN backfill.
        $db->statement('INSERT IGNORE INTO permissions (code) VALUES (?)', ['*']);

        $permissionIds = [];

        foreach ($db->select('SELECT id, code FROM permissions') as $row) {
            $permissionIds[(string) $row['code']] = (int) $row['id'];
        }

        $grants = 0;

        foreach ($roles as $roleCode => $granted) {
            $db->statement('INSERT IGNORE INTO roles (code, is_system) VALUES (?, 1)', [$roleCode]);

            $roleRow = $db->selectOne('SELECT id FROM roles WHERE code = ?', [$roleCode]);

            if ($roleRow === null) {
                continue;
            }

            $roleId = (int) $roleRow['id'];

            foreach ($granted as $code) {
                if (!isset($permissionIds[$code])) {
                    continue;
                }

                $db->statement(
                    'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                    [$roleId, $permissionIds[$code]],
                );
                ++$grants;
            }
        }

        return sprintf('%d permissions, %d roles, %d grants reconciled', count($permissionIds), count($roles), $grants);
    });
};
