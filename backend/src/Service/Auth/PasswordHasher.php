<?php

declare(strict_types=1);

namespace Iced\Service\Auth;

use Iced\Support\Config;

/**
 * Argon2id with a pepper derived from SESSION_SECRET (spec §14). The pepper
 * lives in the environment, not the database, so a dumped users table alone is
 * not enough to mount an offline attack.
 */
final class PasswordHasher
{
    public function __construct(private readonly Config $config)
    {
    }

    public function hash(string $password): string
    {
        return password_hash($this->pepper($password), PASSWORD_ARGON2ID, [
            'memory_cost' => 65536,
            'time_cost' => 4,
            'threads' => 1,
        ]);
    }

    public function verify(string $password, string $hash): bool
    {
        if ($hash === '') {
            // Still spend the time: an account with no password must not be
            // distinguishable by response time from one with a wrong password.
            password_verify($this->pepper($password), '$argon2id$v=19$m=65536,t=4,p=1$aaaaaaaaaaaaaaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

            return false;
        }

        return password_verify($this->pepper($password), $hash);
    }

    public function needsRehash(string $hash): bool
    {
        return password_needs_rehash($hash, PASSWORD_ARGON2ID, [
            'memory_cost' => 65536,
            'time_cost' => 4,
            'threads' => 1,
        ]);
    }

    private function pepper(string $password): string
    {
        $secret = $this->config->string('app.session.secret');

        return hash_hmac('sha256', $password, 'pwd:' . $secret);
    }
}
