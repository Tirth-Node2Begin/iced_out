<?php

declare(strict_types=1);

namespace Iced\Presenter;

use Iced\Service\Media\MediaService;

/**
 * CustomerProfile (spec §7.7): { name, email, mobile, photo: string|null }.
 * Exactly four keys — profile-context.tsx reads no others.
 */
final class CustomerPresenter
{
    /**
     * @param array<string, mixed> $user
     *
     * @return array{name: string, email: string, mobile: string, photo: string|null}
     */
    public function profile(array $user): array
    {
        return [
            'name' => (string) ($user['name'] ?? ''),
            'email' => (string) ($user['email'] ?? ''),
            'mobile' => self::displayMobile((string) ($user['phone'] ?? '')),
            'photo' => MediaService::url(
                isset($user['photo_public_id']) ? (string) $user['photo_public_id'] : null,
            ),
        ];
    }

    /** Stored as ten digits; shown the way the account screens write it. */
    public static function displayMobile(string $stored): string
    {
        $digits = preg_replace('/\D+/', '', $stored) ?? '';

        if (strlen($digits) !== 10) {
            return $stored;
        }

        return sprintf('+91 %s %s', substr($digits, 0, 5), substr($digits, 5));
    }

    /**
     * Address (spec §7.7). `lines` is what the card prints, built here so the
     * region line reads "Bengaluru, Karnataka 560001" on every screen.
     *
     * The phone is NOT masked, and that is a deliberate correction.
     *
     * This presenter serves one audience: the signed-in shopper reading their own
     * account (`/me/*`). Staff screens have their own presenters — masking there
     * is what stops an operator's screen carrying a customer's number around, and
     * `ConsoleCustomerPresenter` still does it. Masking the shopper's own number
     * back to them protects nobody and cost something real: checkout prefills the
     * mobile from the chosen address, and `addressToDraft` correctly refuses a
     * masked value — a mask is not a number and must never reach a field the
     * courier dials. So the number the shopper had just typed into their address
     * arrived back as `+91 ••••• 43210`, was rejected, and checkout asked for it
     * again with an empty field.
     *
     * `displayMobile` rather than the raw column, so the address card and the
     * profile screen write the same number the same way.
     *
     * @param array<string, mixed> $row
     *
     * @return array{id: string, label: string, name: string, lines: list<string>, phone: string}
     */
    public function address(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'label' => (string) $row['label'],
            'name' => (string) $row['name'],
            'lines' => [
                (string) $row['street'],
                sprintf('%s, %s %s', $row['city'], $row['state'], $row['pincode']),
            ],
            'phone' => self::displayMobile((string) $row['phone']),
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return array{addresses: list<array<string, mixed>>, defaultId: string}
     */
    public function addressBook(array $rows): array
    {
        $defaultId = '';

        foreach ($rows as $row) {
            if ((bool) $row['is_default']) {
                $defaultId = (string) $row['public_id'];
            }
        }

        return [
            'addresses' => array_map(fn (array $row): array => $this->address($row), $rows),
            'defaultId' => $defaultId,
        ];
    }

    /** "+91 ••••• 43210" — the account cards never print a full number. */
    public static function maskedMobile(string $stored): string
    {
        $digits = preg_replace('/\D+/', '', $stored) ?? '';

        if (strlen($digits) !== 10) {
            return $stored;
        }

        return sprintf('+91 ••••• %s', substr($digits, 5));
    }
}
