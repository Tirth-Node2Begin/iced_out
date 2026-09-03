<?php

declare(strict_types=1);

namespace Iced\Service\Auth;

use Iced\Integration\Mail\MailFailed;
use Iced\Integration\Mail\Mailer;
use Iced\Kernel\Exception\ServiceUnavailableException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Repository\AuthTokenRepository;
use Iced\Repository\SessionRepository;
use Iced\Repository\UserRepository;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;
use Iced\Support\Config;
use Iced\Support\Logger;

/**
 * Forgotten-password recovery by emailed one-time code (spec §8.2 #10–11,
 * §8.17 #87–88), for both audiences.
 *
 * WHY DIGITS AND NOT A LINK. A reset link has to arrive at a URL, which means
 * the email carries a clickable address to somewhere that will accept a new
 * password — the exact shape of every credential-phishing message ever sent. A
 * code is typed back into the tab the person opened themselves, so no email can
 * put them on the wrong site. It also survives the trip a link does not: a code
 * read on a phone works on the laptop the session was started on.
 *
 * THREE CALLS, ONE CODE.
 *   request() — does the same work either way and REPORTS what it found. It
 *               does not decide whether to say so; see the note below.
 *   verify()  — checks a code WITHOUT spending it, so the UI can move to the
 *               password step before asking for a password. A wrong code is
 *               counted here, which is what stops six digits being guessed.
 *   reset()   — checks and spends it, sets the hash, and revokes every other
 *               session for that audience.
 *
 * WHO GETS TOLD THAT AN ADDRESS IS UNKNOWN — and why the two audiences differ.
 * `request()` returns whether it matched an account. The controller decides
 * what to do with that, because the answer is not the same on both sides:
 *
 *   shop    — says so. `POST /auth/register` already answers "an account with
 *             that email already exists", so anyone can test any address
 *             through the signup form. Staying silent here would cost a
 *             shopper who mistyped their address a wait for mail that is never
 *             coming, and buy nothing: the oracle is already open next door.
 *   console — does not. There is no public registration on the CRM; login and
 *             these three routes are the only public endpoints it has. A
 *             "no such account" here would be the ONE way to discover which
 *             addresses are staff, and a staff address is half of a console
 *             credential.
 *
 * So the neutrality lives in ConsoleAuthController, not in here, and this class
 * does identical work in both cases: the same lookup, the same logging, and the
 * same silent cooldown. Nothing below branches on which caller is asking.
 *
 * WHY VERIFY DOES NOT ISSUE A SECOND TOKEN. It would have to be stored, and a
 * stored "verified" flag is a second credential with its own lifetime and its
 * own replay window. Re-checking the same code at reset() costs one indexed
 * lookup and leaves exactly one secret in play.
 *
 * SESSION REVOCATION. Whoever knew the old password is signed out. A reset
 * that leaves the attacker's session alive is not a reset, and the person doing
 * it has just told us they lost control of the account.
 */
final class PasswordResetService
{
    /** Six digits. Long enough with a 5-attempt cap; short enough to retype. */
    private const CODE_DIGITS = 6;

    public function __construct(
        private readonly UserRepository $users,
        private readonly AuthTokenRepository $tokens,
        private readonly SessionRepository $sessions,
        private readonly PasswordHasher $hasher,
        private readonly Mailer $mailer,
        private readonly RecoveryEmail $email,
        private readonly StoreSettings $settings,
        private readonly Config $config,
        private readonly Clock $clock,
        private readonly Logger $logger,
    ) {
    }

    /**
     * Mails a code, or does nothing, and tells the caller which.
     *
     * The RETURN VALUE is the only thing that distinguishes the two cases —
     * everything else is deliberately identical, so that a caller which chooses
     * to stay neutral (the console) really is neutral. Mail failures are logged
     * rather than raised outside debug, and the resend cooldown declines
     * silently rather than reporting "too soon", which would confirm the
     * address to a caller that had decided not to.
     *
     * @return bool whether an account was found — NOT whether mail was sent.
     *              A throttled re-request and a send that failed both return
     *              true, because in both cases the address is a real account.
     */
    public function request(string $email, string $audience): bool
    {
        $type = $audience === SessionManager::AUDIENCE_STAFF
            ? UserRepository::TYPE_STAFF
            : UserRepository::TYPE_CUSTOMER;

        $user = $this->users->findByEmail($email, $type);

        if ($user === null) {
            $this->logger->info('password.reset.requested', ['audience' => $audience, 'matched' => false]);

            return false;
        }

        $userId = (int) $user['id'];

        // One live code per account. A second request supersedes the first
        // rather than leaving two valid codes in the world.
        $existing = $this->tokens->findLatestLiveForUser($userId, AuthTokenRepository::PURPOSE_PASSWORD_RESET);

        if ($existing !== null && $this->withinCooldown($existing)) {
            // Somebody is pressing "resend", or somebody else is using the form
            // to post mail to an address they do not own. Neither gets another
            // message, and neither is told that.
            $this->logger->info('password.reset.throttled', ['audience' => $audience, 'user_id' => $userId]);

            return true;
        }

        $code = $this->code();
        $ttl = $this->ttlSeconds();

        $this->tokens->supersede($userId, AuthTokenRepository::PURPOSE_PASSWORD_RESET);
        $this->tokens->issue(
            $userId,
            AuthTokenRepository::PURPOSE_PASSWORD_RESET,
            AuthTokenRepository::hash($audience, UserRepository::normalizeEmail($email), $code),
            $ttl,
            (string) json_encode(['audience' => $audience]),
        );

        $address = (string) ($user['email'] ?? $email);
        $name = (string) ($user['name'] ?? '');
        $minutes = max(1, intdiv($ttl, 60));

        $message = $audience === SessionManager::AUDIENCE_STAFF
            ? $this->email->forStaff($address, $name, $code, $minutes)
            : $this->email->forCustomer($address, $name, $code, $minutes);

        try {
            $this->mailer->send($message);
            $this->logger->info('password.reset.sent', [
                'audience' => $audience,
                'user_id' => $userId,
                'driver' => $this->mailer->name(),
            ]);
        } catch (MailFailed $failure) {
            // The row stays. If the operator fixes SMTP within the TTL, the code
            // that was already generated is still the live one — but nobody has
            // it, so the honest outcome is that they ask again after the
            // cooldown. Deleting it here would be tidier and would also mean a
            // transient failure silently invalidated a code that may well have
            // been delivered before the connection dropped.
            $this->logger->error('password.reset.mail_failed', [
                'audience' => $audience,
                'user_id' => $userId,
                'reason' => $failure->getMessage(),
            ]);

            // In development the silence is the bug: a blank screen and a code
            // that never arrives, with the reason sitting in a log nobody is
            // tailing. APP_DEBUG surfaces it. Production stays neutral, because
            // "the mail server refused this address" is an existence oracle.
            if ($this->config->bool('app.debug', false)) {
                throw new ServiceUnavailableException(
                    'The code could not be emailed: ' . $failure->getMessage(),
                    'ICE-MAIL-503',
                );
            }
        }

        return true;
    }

    /**
     * Checks a code and leaves it usable.
     *
     * @throws ValidationException on a wrong, expired, or exhausted code
     */
    public function verify(string $email, string $code, string $audience): void
    {
        $this->findOrFail($email, $code, $audience);
    }

    /**
     * Spends the code and sets the new password.
     *
     * @throws ValidationException
     */
    public function reset(string $email, string $code, string $password, string $audience): void
    {
        $token = $this->findOrFail($email, $code, $audience);
        $userId = (int) $token['user_id'];

        $this->tokens->consume((int) $token['id']);
        $this->users->updatePasswordHash($userId, $this->hasher->hash($password));

        // Everything that was signed in with the old password goes. Not just
        // this audience's other tabs — every session on this account for it.
        $this->sessions->revokeAllForUser($userId, $audience);

        $this->logger->info('password.reset.completed', ['audience' => $audience, 'user_id' => $userId]);
    }

    /**
     * The one place a code is turned into a row.
     *
     * A wrong code and an unknown email produce the SAME message, because the
     * lookup is by hash: an address with no account has no row, exactly like an
     * address with an account and the wrong digits typed against it.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    private function findOrFail(string $email, string $code, string $audience): array
    {
        $normalized = UserRepository::normalizeEmail($email);
        $digits = preg_replace('/\D+/', '', $code) ?? '';

        $token = $this->tokens->findLive(
            AuthTokenRepository::hash($audience, $normalized, $digits),
            AuthTokenRepository::PURPOSE_PASSWORD_RESET,
        );

        if ($token !== null) {
            return $token;
        }

        $this->countGuessAgainstLiveCode($normalized, $audience);

        throw ValidationException::field(
            'code',
            'That code is not right, or it has expired. Request a new one.',
            'ICE-AUTH-OTP-422',
        );
    }

    /**
     * Charges a wrong guess to the account's live code, if it has one.
     *
     * Six digits is a million possibilities and an attacker with the address
     * can post as fast as the rate limiter allows, so the cap is what makes the
     * code safe rather than its length. Hitting it destroys the code — the
     * person has to ask for a new one, which is a fresh million.
     *
     * Nothing here throws differently when there is no account. The lookup
     * happens, the failure above is identical, and the timing difference is one
     * indexed SELECT.
     */
    private function countGuessAgainstLiveCode(string $normalizedEmail, string $audience): void
    {
        $type = $audience === SessionManager::AUDIENCE_STAFF
            ? UserRepository::TYPE_STAFF
            : UserRepository::TYPE_CUSTOMER;

        $user = $this->users->findByEmail($normalizedEmail, $type);

        if ($user === null) {
            return;
        }

        $live = $this->tokens->findLatestLiveForUser((int) $user['id'], AuthTokenRepository::PURPOSE_PASSWORD_RESET);

        if ($live === null) {
            return;
        }

        $attempts = $this->tokens->recordFailedAttempt((int) $live['id']);

        if ($attempts >= $this->maxAttempts()) {
            $this->tokens->discard((int) $live['id']);
            $this->logger->warning('password.reset.code_burned', [
                'audience' => $audience,
                'user_id' => (int) $user['id'],
                'attempts' => $attempts,
            ]);
        }
    }

    /** @param array<string, mixed> $token */
    private function withinCooldown(array $token): bool
    {
        $issued = strtotime((string) $token['created_at']);

        if ($issued === false) {
            return false;
        }

        return ($this->clock->now()->getTimestamp() - $issued) < $this->resendCooldown();
    }

    /**
     * `random_int` and not `rand`: this is a credential, and the difference
     * between the two is whether it can be predicted from an earlier one.
     */
    private function code(): string
    {
        return str_pad(
            (string) random_int(0, (10 ** self::CODE_DIGITS) - 1),
            self::CODE_DIGITS,
            '0',
            STR_PAD_LEFT,
        );
    }

    /**
     * All three knobs are settings, so tightening them after an incident is an
     * operator action rather than a deploy — the same arrangement as the login
     * lockout in AuthService.
     */
    private function ttlSeconds(): int
    {
        return max(60, $this->settings->int('security.password_otp_ttl', 600));
    }

    private function maxAttempts(): int
    {
        return max(1, $this->settings->int('security.password_otp_attempts', 5));
    }

    private function resendCooldown(): int
    {
        return max(0, $this->settings->int('security.password_otp_resend', 60));
    }
}
