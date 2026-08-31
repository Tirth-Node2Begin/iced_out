<?php

declare(strict_types=1);

namespace Iced\Presenter;

use DateTimeImmutable;
use DateTimeZone;
use Iced\Domain\Principal;

/**
 * The staff session payload of spec §8.17 #83: { name, role, permissions[],
 * expires_at }. The permission list is returned so the console can hide
 * affordances without inventing a second source of truth.
 */
final class StaffPresenter
{
    /** @return array{name: string, role: string, permissions: list<string>, expires_at: string|null} */
    public function session(Principal $principal): array
    {
        return [
            'name' => $principal->name,
            'role' => $principal->role ?? 'ADMIN',
            'permissions' => $principal->permissions,
            'expires_at' => self::iso($principal->expiresAt),
        ];
    }

    public static function iso(?string $storedUtc): ?string
    {
        if ($storedUtc === null || $storedUtc === '') {
            return null;
        }

        $moment = DateTimeImmutable::createFromFormat('Y-m-d H:i:s.u', $storedUtc, new DateTimeZone('UTC'))
            ?: DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $storedUtc, new DateTimeZone('UTC'));

        return $moment === false ? null : $moment->format('c');
    }
}
