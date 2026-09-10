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
           the database and changed precisely nothing. On THIS side of the wall
           it matters more than on the shop's: the same column is the only thing
           standing between a staff account somebody has revoked and the console.
           Deactivating a departing employee has to actually deactivate them.

           Placed AFTER the password check on purpose. Announcing "this account
           is suspended" to anyone who merely guesses an address turns the block
           list into an account-enumeration oracle; reaching this line means the
           caller already proved the password, so there is nothing left to leak.

           Counted as a failed attempt because it produced no session. Anything
           that is not ACTIVE is refused, not just BLOCKED — the safe reading of
           an account state nobody taught this method about is "not yet". */
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

        /* ---- NO SUCCESS ROW HERE. SEE recordCompletedSignIn() --------------

           A correct password is not a completed sign-in on this side of the
           wall: when the account has MFA enrolled, the caller revokes the
           session this method just minted and answers with a challenge instead.

           Writing `was_success = 1` at this point broke the lockout outright,
           because `recentFailures()` counts failures SINCE THE LAST SUCCESS. An
           attacker holding a phished or reused staff password could therefore
           reset the counter to zero at will — sign in (success recorded), guess
           a code, sign in again (counter reset again) — and grind the six digits
           for as long as they liked without the login lockout ever engaging. The
           per-account MFA lockout in MfaService still bit, so this was not the
           only thing standing there, but it disabled one of two independent
           controls and did it silently.

           It also made the ledger untrue, which matters separately: a table
           called `login_attempts` recording a success for a sign-in that issued
           no session is a table nobody can investigate an incident with. */

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
     * The success row for the ledger, written when a session is actually HANDED
     * OVER rather than when a password happened to be right.
     *
     * Called at the two places a console sign-in can finish: the no-MFA return
     * from `AuthController::login`, and `verifyMfa` once the second factor has
     * been proved. Both hold a resolved Principal by then, so the email is the
     * account's own rather than whatever string was typed at the form — which is
     * also what makes the row worth reading afterwards.
     *
     * Deliberately separate from `login()`: see the long note in there for what
     * went wrong when the two were the same step. A caller that forgets this
     * fails CLOSED — failures stop being cleared, so the account locks out
     * sooner rather than never, which is the right direction for a mistake in
     * this particular method to push.
     */
    public function recordCompletedSignIn(Principal $principal, Request $request): void
    {
        $this->attempts->record($principal->email, $principal->audience, $request->ip, true);
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
