<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;
use Iced\Repository\UserRepository;
use Iced\Support\Clock;

/**
 * The customer register the console reads —
 * `features/01-users/customers-data.ts`.
 *
 * Their order histories are seeded as real `orders` rows in 0007, so a customer
 * listed with four orders opens onto exactly four, and their lifetime value is
 * the sum of them rather than a second figure sitting nearby.
 *
 * These accounts have no password: they are register entries, not sign-ins.
 * `password_verify` against an empty hash always fails (and still burns the
 * time), so none of them is a way in.
 */
return static function (Container $container): string {
    /** @var Database $db */
    $db = $container->get(Database::class);
    /** @var Clock $clock */
    $clock = $container->get(Clock::class);

    // "11 Aug, 18:40" in the fixture — stored UTC, rendered back to IST by the presenter.
    $customers = [
        ['cus-2048', 'Aarav Kapoor', 'aarav.kapoor@example.com', '9876543210', 'ACTIVE', '2026-08-11 13:10:00'],
        ['cus-2047', 'Riya Sharma', 'riya.sharma@example.com', '9811022417', 'ACTIVE', '2026-08-09 05:32:00'],
        ['cus-2031', 'Meera Patel', 'meera.patel@example.com', '9920051188', 'ACTIVE', '2026-08-12 03:56:00'],
        ['cus-2019', 'Dev Walia', 'dev.walia@example.com', '9740066302', 'ACTIVE', '2026-07-28 14:45:00'],
        ['cus-1984', 'Sana Rahman', 'sana.rahman@example.com', '9845071923', 'BLOCKED', '2026-08-02 11:18:00'],
    ];

    return $db->transaction(static function (Database $db) use ($customers, $clock): string {
        foreach ($customers as $customer) {
            [$publicId, $name, $email, $phone, $status, $seenUtc] = $customer;

            $db->statement(
                'INSERT INTO users
                    (public_id, type, status, name, email, email_normalized, phone, password_hash, last_seen_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, \'\', ?, ?)
                 ON DUPLICATE KEY UPDATE
                    name = VALUES(name), phone = VALUES(phone), status = VALUES(status),
                    last_seen_at = VALUES(last_seen_at)',
                [
                    $publicId,
                    UserRepository::TYPE_CUSTOMER,
                    $status,
                    $name,
                    $email,
                    UserRepository::normalizeEmail($email),
                    $phone,
                    $seenUtc . '.000000',
                    $clock->nowString(),
                ],
            );
        }

        return sprintf('%d register customers', count($customers));
    });
};
