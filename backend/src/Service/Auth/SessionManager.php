<?php

declare(strict_types=1);

namespace Iced\Service\Auth;

use Iced\Domain\Principal;
use Iced\Kernel\Request;
use Iced\Repository\PermissionRepository;
use Iced\Repository\SessionRepository;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;
use Iced\Support\Config;

/**
 * Opaque server sessions (spec §5.1). Two cookies, two audiences, two token
 * spaces: a staff cookie can never authorise a customer route and vice versa.
 *
 * Customer: 30-day rolling absolute expiry.
 * Staff:    session cookie + 15-minute sliding idle expiry, mirroring the UI timer.
 */
final class SessionManager
{
    public const AUDIENCE_CUSTOMER = 'customer';
    public const AUDIENCE_STAFF = 'staff';

    public function __construct(
        private readonly SessionRepository $sessions,
        private readonly PermissionRepository $permissions,
        private readonly StoreSettings $settings,
        private readonly Config $config,
        private readonly Clock $clock,
    ) {
    }

    /**
     * Session lifetimes are policy, so `store_settings` owns them; the env
     * value is the fallback used before the settings row exists. Cookie NAMES
     * and the signing secret stay in the environment — they are deployment
     * configuration and a credential, not something an operator tunes.
     */
    public function customerTtl(): int
    {
        return $this->settings->int('sessions.customer_ttl', $this->config->int('app.session.customer_ttl', 2592000));
    }

    public function staffIdleTtl(): int
    {
        return $this->settings->int('sessions.staff_idle_ttl', $this->config->int('app.session.staff_idle_ttl', 900));
    }

    public function cookieName(string $audience): string
    {
        return $audience === self::AUDIENCE_STAFF
            ? $this->config->string('app.session.staff_cookie', 'io_ssess')
            : $this->config->string('app.session.customer_cookie', 'io_csess');
    }

    /** @return array{token: string, session_id: int, expires_at: string|null} */
    public function issue(int $userId, string $audience, Request $request): array
    {
        $token = bin2hex(random_bytes(32));
        $now = $this->clock->now();

        if ($audience === self::AUDIENCE_STAFF) {
            $idleTtl = $this->staffIdleTtl();
            $idleExpiresAt = $now->modify(sprintf('+%d seconds', $idleTtl))->format(Clock::STORAGE_FORMAT);
            $absoluteExpiresAt = $now->modify('+12 hours')->format(Clock::STORAGE_FORMAT);
            $expiresAt = $idleExpiresAt;
        } else {
            $ttl = $this->customerTtl();
            $idleExpiresAt = null;
            $absoluteExpiresAt = $now->modify(sprintf('+%d seconds', $ttl))->format(Clock::STORAGE_FORMAT);
            $expiresAt = $absoluteExpiresAt;
        }

        $sessionId = $this->sessions->create(
            $userId,
            $audience,
            $this->hash($token),
            $idleExpiresAt,
            $absoluteExpiresAt,
            $request->ip,
            $request->header('user-agent'),
        );

        return ['token' => $token, 'session_id' => $sessionId, 'expires_at' => $expiresAt];
    }

    public function resolve(Request $request, string $audience): ?Principal
    {
        $token = $request->cookie($this->cookieName($audience));

        if ($token === null || $token === '') {
            return null;
        }

        return $this->resolveToken($token, $audience);
    }

    /**
     * Same resolution path as a cookie-carrying request, for the moment a
     * session is minted and the caller holds the raw token but no cookie yet.
     */
    public function resolveToken(string $token, string $audience): ?Principal
    {
        $row = $this->sessions->findActiveByTokenHash($this->hash($token), $audience);

        if ($row === null) {
            return null;
        }

        $expectedType = $audience === self::AUDIENCE_STAFF ? 'STAFF' : 'CUSTOMER';

        if ((string) $row['type'] !== $expectedType) {
            return null;
        }

        $userId = (int) $row['user_id'];
        $sessionId = (int) $row['id'];
        $expiresAt = $row['absolute_expires_at'] === null ? null : (string) $row['absolute_expires_at'];

        if ($audience === self::AUDIENCE_STAFF) {
            $expiresAt = $this->slide($sessionId);
            $permissions = $this->permissions->permissionsForUser($userId);
            $role = $this->permissions->primaryRoleForUser($userId);
        } else {
            $permissions = [];
            $role = null;
        }

        return new Principal(
            userId: $userId,
            publicId: (string) $row['public_id'],
            audience: $audience,
            name: (string) $row['name'],
            email: (string) $row['email'],
            status: (string) $row['status'],
            sessionId: $sessionId,
            permissions: $permissions,
            role: $role,
            expiresAt: $expiresAt,
        );
    }

    /** Slides the staff idle window and returns the new expiry. */
    public function slide(int $sessionId): string
    {
        $idleTtl = $this->staffIdleTtl();
        $expiresAt = $this->clock->now()->modify(sprintf('+%d seconds', $idleTtl))->format(Clock::STORAGE_FORMAT);
        $this->sessions->touch($sessionId, $expiresAt);

        return $expiresAt;
    }

    public function revoke(int $sessionId): void
    {
        $this->sessions->revoke($sessionId);
    }

    /** A password change makes every other signed-in copy of this account stale. */
    public function revokeOtherSessions(int $userId, string $audience, int $exceptSessionId): void
    {
        $this->sessions->revokeAllForUser($userId, $audience, $exceptSessionId);
    }

    /** @return array<string, string> the Set-Cookie header value pieces */
    public function cookieHeader(string $audience, string $token, ?string $expiresAt): string
    {
        $secure = str_starts_with($this->config->string('app.url'), 'https://');
        $parts = [
            $this->cookieName($audience) . '=' . $token,
            'Path=' . $this->config->string('app.base_path', '/api/v1'),
            'HttpOnly',
            'SameSite=Lax',
        ];

        if ($secure) {
            $parts[] = 'Secure';
        }

        // Staff sessions are browser-session cookies (no Max-Age) with a
        // server-side idle TTL; customer sessions carry a rolling 30-day expiry.
        if ($audience === self::AUDIENCE_CUSTOMER && $expiresAt !== null) {
            $parts[] = 'Max-Age=' . $this->customerTtl();
        }

        return implode('; ', $parts);
    }

    public function clearCookieHeader(string $audience): string
    {
        $parts = [
            $this->cookieName($audience) . '=',
            'Path=' . $this->config->string('app.base_path', '/api/v1'),
            'HttpOnly',
            'SameSite=Lax',
            'Max-Age=0',
        ];

        if (str_starts_with($this->config->string('app.url'), 'https://')) {
            $parts[] = 'Secure';
        }

        return implode('; ', $parts);
    }

    /** Raw 32 bytes for the BINARY(32) column — the token itself is never stored. */
    public function hash(string $token): string
    {
        return hash_hmac('sha256', $token, $this->config->string('app.session.secret'), true);
    }
}
