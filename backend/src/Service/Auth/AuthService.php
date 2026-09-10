<?php

declare(strict_types=1);

namespace Iced\Service\Auth;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\ApiException;
use Iced\Kernel\Exception\ForbiddenException;
use Iced\Kernel\Exception\RateLimitException;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Repository\LoginAttemptRepository;
use Iced\Repository\UserRepository;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\IdAllocator;
use Iced\Support\SecuritySignals;

/**
 * Sign-in, registration and sign-out for both audiences (spec §5).
 *
 * Two rules from the spec shape everything here:
 *  · Unknown email and wrong password give the *same* 401 — no user enumeration.
 *  · A Blocked customer still authenticates and stays Blocked; checkout is where
 *    the block bites (spec §5.3), so support can still see their account.
 */
final class AuthService
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly LoginAttemptRepository $attempts,
        private readonly PasswordHasher $hasher,
        private readonly SessionManager $sessions,
        private readonly IdAllocator $ids,
        private readonly StoreSettings $settings,
        private readonly SecuritySignals $signals,
    ) {
    }

    /**
     * @return array{user: array<string, mixed>, token: string, expires_at: string|null}
     *
     * @throws ApiException
     */
    public function login(string $email, string $password, string $audience, Request $request): array
    {
        $this->assertNotLockedOut($email, $audience);

        $type = $audience === SessionManager::AUDIENCE_STAFF ? UserRepository::TYPE_STAFF : UserRepository::TYPE_CUSTOMER;
        $user = $this->users->findByEmail($email, $type);

        if ($user === null || !$this->hasher->verify($password, (string) $user['password_hash'])) {
            $this->attempts->record($email, $audience, $request->ip, false);

            throw new UnauthorizedException('That email and password do not match.');
        }

        $userId = (int) $user['id'];

        /* ---- BLOCKED MEANS BLOCKED ----------------------------------------

           `Principal::isBlocked()` has existed since the console shipped and was
           called from nowhere, so the "Block customer" action wrote BLOCKED to
           the database and changed precisely nothing: the account signed in,
           ordered, and spent wallet credit exactly as before. The register even
           displayed it as Blocked. There are already BLOCKED rows in the
           development database that would sign in today.

           Placed AFTER the password check on purpose. Announcing "this account
           is suspended" to anyone who merely guesses an address turns the block
           list into an account-enumeration oracle; reaching this line means the
           caller already proved the password, so there is nothing left to leak
           and a clear message beats a false "wrong password" that sends a real
           customer round the reset loop for a decision somebody made about them.

           Counted as a failed attempt because it produced no session, and
           because an account that keeps trying after being blocked is exactly
           what the lockout is for. Anything that is not ACTIVE is refused, not
           just BLOCKED: this codebase only ever writes those two values, so an
           unrecognised one means somebody edited the row by hand or a future
           migration introduced a state nobody taught this method about, and the
           safe reading of an unknown account state is "not yet". */
        if ((string) ($user['status'] ?? 'ACTIVE') !== 'ACTIVE') {
            $this->attempts->record($email, $audience, $request->ip, false);

            throw new ForbiddenException(
                'This account has been suspended. Please contact support.',
                'ICE-AUTH-403-BLOCKED',
            );
        }

        if ($this->hasher->needsRehash((string) $user['password_hash'])) {
            $this->users->updatePasswordHash($userId, $this->hasher->hash($password));
        }

        $this->attempts->record($email, $audience, $request->ip, true);

        // Login bumps the register's "seen" column — the server-side half of the
        // frontend's recordCustomerSignIn(). A Blocked account stays Blocked.
        $this->users->touchLastSeen($userId);

        $session = $this->sessions->issue($userId, $audience, $request);

        return [
            'user' => $this->users->findById($userId) ?? $user,
            'token' => $session['token'],
            'expires_at' => $session['expires_at'],
        ];
    }

    /**
     * @return array{user: array<string, mixed>, token: string, expires_at: string|null}
     *
     * @throws ApiException
     */
    public function register(string $name, string $email, string $password, Request $request): array
    {
        if ($this->users->emailExists($email, UserRepository::TYPE_CUSTOMER)) {
            throw ValidationException::field(
                'email',
                'An account with that email already exists.',
                'ICE-AUTH-422',
            );
        }

        // New customers take an id from the reserved cus-2050+ band so the
        // static export has a console page for them (spec §11).
        $publicId = $this->ids->allocate('customer');

        $userId = $this->users->create(
            $publicId,
            UserRepository::TYPE_CUSTOMER,
            $name,
            $email,
            $this->hasher->hash($password),
        );

        $this->attempts->record($email, SessionManager::AUDIENCE_CUSTOMER, $request->ip, true);
        $session = $this->sessions->issue($userId, SessionManager::AUDIENCE_CUSTOMER, $request);

        return [
            'user' => $this->users->findById($userId) ?? [],
            'token' => $session['token'],
            'expires_at' => $session['expires_at'],
        ];
    }

    public function logout(Principal $principal): void
    {
        $this->sessions->revoke($principal->sessionId);
    }

    /**
     * Progressive lockout (spec §5.6). Both numbers are settings, so tightening
     * the policy after an incident is an operator action, not a deploy.
     *
     * @throws RateLimitException
     */
    private function assertNotLockedOut(string $email, string $audience): void
    {
        $after = $this->settings->int('security.login_lockout_after', 20);
        $window = $this->settings->int('security.login_lockout_window', 900);

        if ($this->attempts->recentFailures($email, $audience, $window) >= $after) {
            /* Counted, not just refused. A lockout is either somebody working
               through a password list or somebody deliberately locking a known
               account out of its own shop, and only the RATE of them tells the
               two apart. The address is not logged — an alert needs the shape,
               not the target. */
            $this->signals->authLockout(['audience' => $audience, 'window' => $window, 'threshold' => $after]);

            throw new RateLimitException(
                $window,
                sprintf(
                    'Too many sign-in attempts. Please wait %d minutes and try again.',
                    max(1, intdiv($window, 60)),
                ),
            );
        }
    }
}
