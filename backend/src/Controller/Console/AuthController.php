<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\StaffPresenter;
use Iced\Service\Auth\AuthService;
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
}
