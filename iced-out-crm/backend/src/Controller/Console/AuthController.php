<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Middleware\RequireStepUp;
use Iced\Presenter\StaffPresenter;
use Iced\Repository\SessionRepository;
use Iced\Repository\UserRepository;
use Iced\Service\Auth\AuthService;
use Iced\Service\Auth\MfaService;
use Iced\Service\Auth\PasswordHasher;
use Iced\Service\Auth\PasswordResetService;
use Iced\Service\Auth\SessionManager;
use Iced\Support\SecuritySignals;

/**
 * Spec §8.17 — staff auth.
 *
 * The staff cookie is a browser-session cookie with a server-side 15-minute
 * idle TTL that slides on every authenticated console request. The UI throttles
 * its activity pings to one per 30 s and force-expires the tab; `touch` exists
 * for tabs that are open but quiet.
 */
final class AuthController
{
    public function __construct(
        private readonly AuthService $auth,
        private readonly SessionManager $sessions,
        private readonly StaffPresenter $presenter,
        private readonly PasswordResetService $reset,
        /* Step-up needs the session ROW, not the manager: the elevation is a
           column on `user_sessions`, and SessionManager deliberately owns tokens
           and cookies rather than session state. */
        private readonly SessionRepository $sessionRows,
        private readonly UserRepository $users,
        private readonly PasswordHasher $hasher,
        private readonly MfaService $mfa,
        private readonly SecuritySignals $signals,
    ) {
    }

    /** #83 POST /admin/auth/login */
    public function login(Request $request): Response
    {
        /** @var array{email: string, password: string} $input */
        $input = $request->validated();

        $result = $this->auth->login(
            $input['email'],
            $input['password'],
            SessionManager::AUDIENCE_STAFF,
            $request,
        );

        // Re-resolving through SessionManager gives the same permission
        // resolution path every other console request uses.
        $principal = $this->sessions->resolveToken($result['token'], SessionManager::AUDIENCE_STAFF);

        if ($principal === null) {
            throw new UnauthorizedException('That console session could not be started.');
        }

        /* ---- the second factor, when the account has one --------------------

           `isEnabled()` is false for every account without a CONFIRMED
           enrolment, which is every account until somebody opts in — so this
           branch does not exist for anyone by default and sign-in is unchanged.

           When it does apply, the session `AuthService` has already minted is
           REVOKED rather than returned. A password alone must not leave a usable
           session lying in the table for the five minutes the challenge lasts,
           and revoking is cheaper and far harder to get wrong than threading a
           "do not issue" flag through a service the storefront also uses.

           The reply carries a challenge, not a cookie. It is not a session: it
           grants nothing, reaches no other endpoint, and expires in five
           minutes. */
        if ($this->mfa->isEnabled($principal->userId)) {
            $this->sessions->revoke($principal->sessionId);

            return Response::data([
                'mfa_required' => true,
                'challenge' => $this->mfa->issueChallenge($principal->userId, SessionManager::AUDIENCE_STAFF, $request),
            ]);
        }

        // A session is going out, so this sign-in is finished and the ledger
        // says so. See AuthService::recordCompletedSignIn.
        $this->auth->recordCompletedSignIn($principal, $request);

        return Response::data($this->presenter->session($principal))->withHeader(
            'Set-Cookie',
            $this->sessions->cookieHeader(SessionManager::AUDIENCE_STAFF, $result['token'], $result['expires_at']),
        );
    }

    /**
     * #— POST /admin/auth/mfa/verify — the second half of a sign-in.
     *
     * Spends the challenge, checks the code, and only then issues the session
     * cookie that `login` withheld. The response is the SAME shape `login`
     * returns without MFA, so everything downstream of sign-in is unchanged.
     *
     * The challenge is consumed BEFORE the code is checked, and deliberately: a
     * ticket that survived a wrong code would let somebody with the password
     * guess codes against one ticket indefinitely. One ticket, one attempt; a
     * fresh sign-in is the way to try again, and that path is itself throttled.
     */
    public function verifyMfa(Request $request): Response
    {
        /** @var array{challenge: string, code: string} $input */
        $input = $request->validated();

        // The request goes in so a challenge redeemed from a different address
        // than it was issued to is REPORTED. It is not refused — see the note in
        // consumeChallenge for why that trade lands where it does.
        $userId = $this->mfa->consumeChallenge($input['challenge'], SessionManager::AUDIENCE_STAFF, $request);

        if ($userId === null) {
            throw new UnauthorizedException('That sign-in has expired. Please start again.');
        }

        if (!$this->mfa->check($userId, $input['code'])) {
            $this->signals->privilegedAction('mfa_failed', ['user_id' => $userId, 'ip' => $request->ip]);

            throw new UnauthorizedException('That code is not right. Please sign in again.');
        }

        $session = $this->sessions->issue($userId, SessionManager::AUDIENCE_STAFF, $request);
        $principal = $this->sessions->resolveToken($session['token'], SessionManager::AUDIENCE_STAFF);

        if ($principal === null) {
            throw new UnauthorizedException('That console session could not be started.');
        }

        // Both factors are proved and a session is going out: NOW it is a
        // successful sign-in, and this is the row that clears the lockout.
        $this->auth->recordCompletedSignIn($principal, $request);

        return Response::data($this->presenter->session($principal))->withHeader(
            'Set-Cookie',
            $this->sessions->cookieHeader(SessionManager::AUDIENCE_STAFF, $session['token'], $session['expires_at']),
        );
    }

    /** #— POST /admin/auth/mfa/begin — mint a secret to scan. Enables nothing. */
    public function beginMfa(Request $request): Response
    {
        $principal = $this->requireStaff($request);

        return Response::data($this->mfa->begin($principal->userId, $principal->email));
    }

    /**
     * #— POST /admin/auth/mfa/confirm — prove a code, switch it on.
     *
     * The recovery codes are in this response and in no other, ever. They are
     * stored hashed, so the server cannot show them again even if asked.
     */
    public function confirmMfa(Request $request): Response
    {
        $principal = $this->requireStaff($request);

        /** @var array{code: string} $input */
        $input = $request->validated();

        return Response::data([
            'enabled' => true,
            'recovery_codes' => $this->mfa->confirm($principal->userId, $input['code']),
        ]);
    }

    /** #— POST /admin/auth/mfa/disable — needs the password AND a current code. */
    public function disableMfa(Request $request): Response
    {
        $principal = $this->requireStaff($request);

        /** @var array{password: string, code: string} $input */
        $input = $request->validated();

        $this->mfa->disable($principal->userId, $input['password'], $input['code']);

        return Response::data(['enabled' => false]);
    }

    private function requireStaff(Request $request): Principal
    {
        $principal = $request->attribute('principal');

        if (!$principal instanceof Principal) {
            throw new UnauthorizedException('Your console session has expired. Please sign in again.');
        }

        return $principal;
    }

    /** #84 POST /admin/auth/logout */
    public function logout(Request $request): Response
    {
        $principal = $request->attribute('principal');

        if ($principal instanceof Principal) {
            $this->auth->logout($principal);
        }

        return Response::noContent()->withHeader(
            'Set-Cookie',
            $this->sessions->clearCookieHeader(SessionManager::AUDIENCE_STAFF),
        );
    }

    /** #85 GET /admin/auth/session */
    public function session(Request $request): Response
    {
        $principal = $request->attribute('principal');

        if (!$principal instanceof Principal) {
            throw new UnauthorizedException('Your console session has expired. Please sign in again.');
        }

        return Response::data($this->presenter->session($principal));
    }

    /** #86 POST /admin/auth/touch — slides the idle window for a quiet tab. */
    public function touch(Request $request): Response
    {
        $principal = $request->attribute('principal');

        if (!$principal instanceof Principal) {
            throw new UnauthorizedException('Your console session has expired. Please sign in again.');
        }

        // Authenticate already slid the window on the way in; report where it landed.
        return Response::data(['expires_at' => StaffPresenter::iso($principal->expiresAt)]);
    }

    /**
     * #— POST /admin/auth/step-up
     *
     * Proves the password again, so the session may perform an action that a
     * session alone is not enough for: approving a refund, marking a payout
     * paid, rewriting store settings. See Middleware\RequireStepUp for why
     * those and not everything.
     *
     * ── IT IS RATE LIMITED AS AN AUTH ENDPOINT ──────────────────────────────
     *
     * Because that is what it is. Without it this would be an oracle for
     * guessing a staff password from INSIDE a stolen session, at whatever speed
     * the network allows — and unlike the sign-in page it would leave the
     * account unlocked while it was guessed.
     *
     * ── A FAILURE IS NOT A 401 ──────────────────────────────────────────────
     *
     * 422, not 401. The session is perfectly valid; what was wrong was the
     * password just typed. Answering 401 would make the console's own
     * interceptor sign the operator out for a typo.
     */
    public function stepUp(Request $request): Response
    {
        $principal = $request->attribute('principal');

        if (!$principal instanceof Principal) {
            throw new UnauthorizedException('Your console session has expired. Please sign in again.');
        }

        /** @var array{password: string} $input */
        $input = $request->validated();

        $user = $this->users->findById($principal->userId);

        if ($user === null || !$this->hasher->verify($input['password'], (string) $user['password_hash'])) {
            $this->signals->privilegedAction('step_up_failed', [
                'actor' => $principal->publicId,
                'request_id' => $request->requestId(),
                'ip' => $request->ip,
            ]);

            throw ValidationException::field('password', 'That is not your password.', 'ICE-AUTH-422');
        }

        $this->sessionRows->markSteppedUp($principal->sessionId);

        $this->signals->privilegedAction('step_up_granted', [
            'actor' => $principal->publicId,
            'request_id' => $request->requestId(),
        ]);

        return Response::data([
            'confirmed' => true,
            // Seconds, so the console can grey the prompt out again on time.
            'expires_in' => RequireStepUp::WINDOW_SECONDS,
        ]);
    }

    /**
     * #87 POST /admin/auth/password/forgot
     *
     * Always 202, always the same body — the recovery page's own copy says so
     * in as many words, and the endpoint has to be worth that promise. Whether
     * an address belongs to a member of staff is exactly the thing a console
     * login screen must not confirm to whoever is typing at it.
     *
     * THE RETURN VALUE IS DROPPED ON PURPOSE. `request()` reports whether it
     * matched an account, and the storefront's twin of this method uses that to
     * answer 422 "no account with that email". This one must not, and the
     * difference is not an oversight:
     *
     *   · The shop has `POST /auth/register`, which already answers "an account
     *     with that email already exists". The oracle is open there whatever
     *     this endpoint does, so refusing to answer only hurts the shopper who
     *     mistyped.
     *   · The console has no public registration. Login and the three password
     *     routes are its ONLY public endpoints, so a "no such account" here
     *     would be the one and only way to learn which addresses are staff —
     *     and a staff address is half of a credential for a console that opens
     *     every order, payment and customer record in the business.
     *
     * If you are here to make the two consistent: they are consistent, on the
     * rule "never be the only oracle". Making the responses identical is what
     * would break it.
     */
    public function forgotPassword(Request $request): Response
    {
        /** @var array{email: string} $input */
        $input = $request->validated();

        $this->reset->request($input['email'], SessionManager::AUDIENCE_STAFF);

        return Response::data(['accepted' => true], 202);
    }

    /**
     * POST /admin/auth/password/verify — checks a code without spending it, so
     * the form can move to the password step on something known good.
     */
    public function verifyPasswordCode(Request $request): Response
    {
        /** @var array{email: string, code: string} $input */
        $input = $request->validated();

        $this->reset->verify($input['email'], $input['code'], SessionManager::AUDIENCE_STAFF);

        return Response::noContent();
    }

    /**
     * #88 POST /admin/auth/password/reset — spends the code, sets the password,
     * and revokes every staff session on the account.
     *
     * No cookie comes back, and for a console account that matters more than it
     * does on the shop: the operator signs in afterwards through the ordinary
     * door, which is the request that writes a `login_attempts` row and starts
     * an audited session with a name on it.
     */
    public function resetPassword(Request $request): Response
    {
        /** @var array{email: string, code: string, password: string} $input */
        $input = $request->validated();

        $this->reset->reset(
            $input['email'],
            $input['code'],
            $input['password'],
            SessionManager::AUDIENCE_STAFF,
        );

        return Response::noContent();
    }
}
