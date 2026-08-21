<?php

declare(strict_types=1);

namespace Iced\Domain;

/**
 * Who the current request is acting as. Built by Authenticate from a session
 * row; permissions are resolved per request from user_roles → role_permissions
 * and are never cached in the cookie (spec §5.5).
 */
final class Principal
{
    /** @param list<string> $permissions */
    public function __construct(
        public readonly int $userId,
        public readonly string $publicId,
        public readonly string $audience,
        public readonly string $name,
        public readonly string $email,
        public readonly string $status,
        public readonly int $sessionId,
        public readonly array $permissions = [],
        public readonly ?string $role = null,
        public readonly ?string $expiresAt = null,
    ) {
    }

    public function isStaff(): bool
    {
        return $this->audience === 'staff';
    }

    public function isBlocked(): bool
    {
        return $this->status === 'BLOCKED';
    }

    public function can(string $permission): bool
    {
        return in_array($permission, $this->permissions, true) || in_array('*', $this->permissions, true);
    }
}
