<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;
use Iced\Repository\UserRepository;
use Iced\Service\Auth\PasswordHasher;
use Iced\Support\Clock;

/**
 * The one account that has to exist before anyone can use this install.
 *
 *   staff  admin@gmail.com  /  admin123   "Aarav D."   role ADMIN
 *
 * This is deliberately the ONLY user seeded. A store's customers are people who
 * registered; seeding one meant every fresh install opened onto a shopper
 * nobody had signed up, with orders and addresses attached. The demo shopper
 * now lives in seeds/demo/, which `preflight` never runs.
 *
 * The console, by contrast, cannot be reached without a staff account at all —
 * so one is seeded, and re-seeding resets its password rather than duplicating
 * it, which is how an operator who has locked themselves out gets back in.
 */
return static function (Container $container): string {
    /** @var Database $db */
    $db = $container->get(Database::class);
    /** @var PasswordHasher $hasher */
    $hasher = $container->get(PasswordHasher::class);
    /** @var UserRepository $users */
    $users = $container->get(UserRepository::class);
    /** @var Clock $clock */
    $clock = $container->get(Clock::class);

    return $db->transaction(static function (Database $db) use ($hasher, $users, $clock): string {
        $publicId = 'stf-001';
        $name = 'Aarav D.';
        $email = 'admin@gmail.com';
        $password = 'admin123';

        $existing = $users->findByPublicId($publicId) ?? $users->findByEmail($email, UserRepository::TYPE_STAFF);
        $created = $existing === null;

        if ($created) {
            $userId = $users->create(
                $publicId,
                UserRepository::TYPE_STAFF,
                $name,
                $email,
                $hasher->hash($password),
                '',
            );
        } else {
            $userId = (int) $existing['id'];

            // Re-seeding restores the password without touching anything else,
            // so an operator who changed it can always get back in.
            $db->statement(
                'UPDATE users
                    SET password_hash = ?, name = ?, email = ?, email_normalized = ?, updated_at = ?
                  WHERE id = ?',
                [
                    $hasher->hash($password),
                    $name,
                    $email,
                    UserRepository::normalizeEmail($email),
                    $clock->nowString(),
                    $userId,
                ],
            );
        }

        $role = $db->selectOne('SELECT id FROM roles WHERE code = ?', ['ADMIN']);

        if ($role !== null) {
            $db->statement(
                'INSERT IGNORE INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, ?)',
                [$userId, (int) $role['id'], $clock->nowString()],
            );
        }

        return $created
            ? sprintf('created %s (ADMIN)', $email)
            : sprintf('%s already present (password reset)', $email);
    });
};
