<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;
use Iced\Repository\AddressRepository;

/**
 * The demo shopper's address book — the two cards
 * `01-users/addresses-context.tsx` seeded into the browser.
 *
 * They belong to the seeded account only. A visitor who registers gets an empty
 * book, which is the correct thing for a new account to have: the old fixture
 * showed everyone the same two addresses because it lived in localStorage
 * rather than against a user.
 */
return static function (Container $container): string {
    /** @var Database $db */
    $db = $container->get(Database::class);
    /** @var AddressRepository $addresses */
    $addresses = $container->get(AddressRepository::class);

    $book = [
        ['addr-home', 'Home', 'Iced_out Shopper', '12 Preview Street', 'Bengaluru', 'Karnataka', '560001', '9876543210', true],
        ['addr-work', 'Studio', 'Iced_out Shopper', '4th Floor, Block C', 'New Delhi', 'Delhi', '110001', '9876543210', false],
    ];

    return $db->transaction(static function (Database $db) use ($addresses, $book): string {
        $shopper = $db->selectOne("SELECT id FROM users WHERE public_id = 'cus-2049'");

        if ($shopper === null) {
            return 'no seeded shopper — skipped';
        }

        $userId = (int) $shopper['id'];
        $written = 0;

        foreach ($book as $position => $entry) {
            [$publicId, $label, $name, $street, $city, $state, $pincode, $phone, $isDefault] = $entry;

            if ($addresses->find($userId, $publicId) !== null) {
                continue;
            }

            $addresses->insert($userId, $publicId, [
                'label' => $label,
                'name' => $name,
                'street' => $street,
                'city' => $city,
                'state' => $state,
                'pincode' => $pincode,
                'phone' => $phone,
                'position' => $position,
            ]);

            if ($isDefault) {
                $addresses->makeDefault($userId, $publicId);
            }

            ++$written;
        }

        return sprintf('%d addresses for the demo shopper', $written);
    });
};
