<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\StaffPresenter;
use Iced\Service\Auth\AuthService;
use Iced\Service\Auth\PasswordResetService;
use Iced\Service\Auth\SessionManager;

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

        return Response::data($this->presenter->session($principal))->withHeader(
            'Set-Cookie',
            $this->sessions->cookieHeader(SessionManager::AUDIENCE_STAFF, $result['token'], $result['expires_at']),
        );
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
