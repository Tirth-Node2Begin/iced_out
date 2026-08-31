<?php

declare(strict_types=1);

namespace Iced\Kernel;

/**
 * One row of config/routes/*.php, typed. `audience` is the route's own class —
 * it is matched against the X-Client-Audience header before any auth work
 * happens (spec §5.1).
 */
final class Route
{
    public const AUDIENCE_PUBLIC = 'public';
    public const AUDIENCE_CUSTOMER = 'customer';
    public const AUDIENCE_STAFF = 'staff';

    /**
     * @param array{0: class-string, 1: string} $handler
     * @param array<string, string>             $rules
     */
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $handler,
        public readonly string $audience,
        public readonly ?string $permission = null,
        public readonly bool $idempotent = false,
        public readonly string $rateLimit = 'default',
        public readonly ?string $name = null,
        public readonly array $rules = [],
        public readonly bool $audit = false,
    ) {
    }

    /** @param array<string, mixed> $definition */
    public static function fromArray(array $definition): self
    {
        /** @var array{0: class-string, 1: string} $handler */
        $handler = $definition['handler'] ?? [];

        /** @var array<string, string> $rules */
        $rules = is_array($definition['rules'] ?? null) ? $definition['rules'] : [];

        $method = is_string($definition['method'] ?? null) ? strtoupper($definition['method']) : 'GET';
        $path = is_string($definition['path'] ?? null) ? $definition['path'] : '/';
        $audience = is_string($definition['audience'] ?? null) ? $definition['audience'] : self::AUDIENCE_PUBLIC;

        return new self(
            method: $method,
            path: '/' . trim($path, '/'),
            handler: $handler,
            audience: $audience,
            permission: is_string($definition['permission'] ?? null) ? $definition['permission'] : null,
            idempotent: (bool) ($definition['idempotent'] ?? false),
            rateLimit: is_string($definition['rate_limit'] ?? null) ? $definition['rate_limit'] : 'default',
            name: is_string($definition['name'] ?? null) ? $definition['name'] : null,
            rules: $rules,
            audit: (bool) ($definition['audit'] ?? ($audience === self::AUDIENCE_STAFF && !in_array($method, ['GET', 'HEAD'], true))),
        );
    }

    /** @return list<string> */
    public function segments(): array
    {
        return $this->path === '/' ? [] : explode('/', trim($this->path, '/'));
    }
}
