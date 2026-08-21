<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;
use Iced\Repository\UserRepository;
use Iced\Service\Auth\PasswordHasher;
use Iced\Support\Clock;

/**
 * The demo shopper — `shopper@example.com` / `secret1`, public id `cus-2049`.
 *
 * Every other seed in this directory hangs off this account: its orders, its
 * addresses, its returns and its reviews all look it up by public id and skip
 * themselves if it is absent. That is why it sorts first here.
 *
 * It is NOT part of the essential seed set. A real install has no customers
 * until people register; run `php bin/console.php seed --demo` when you want the
 * populated store back for a screenshot or a test run.
 *
 * The id sits just below the cus-2050+ reserved band (spec §11) so it never
 * eats a slot meant for an account created through the storefront.
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
        $email = 'shopper@example.com';
        $name = 'Iced_out Shopper';

        $existing = $users->findByEmail($email, UserRepository::TYPE_CUSTOMER);

        if ($existing === null) {
            $users->create(
                'cus-2049',
                UserRepository::TYPE_CUSTOMER,
                $name,
                $email,
                $hasher->hash('secret1'),
                '9876543210',
            );

            return sprintf('created %s', $email);
        }

        $db->statement(
            'UPDATE users SET password_hash = ?, name = ?, updated_at = ? WHERE id = ?',
            [$hasher->hash('secret1'), $name, $clock->nowString(), (int) $existing['id']],
        );

        return sprintf('%s already present (password reset)', $email);
    });
};
