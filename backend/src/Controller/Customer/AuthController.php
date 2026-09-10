<?php

declare(strict_types=1);

namespace Iced\Controller\Customer;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\CustomerPresenter;
use Iced\Repository\UserRepository;
use Iced\Service\Auth\AuthService;
use Iced\Service\Auth\PasswordResetService;
use Iced\Service\Auth\SessionManager;

/** Spec §8.2 — customer auth. */
final class AuthController
{
    public function __construct(
        private readonly AuthService $auth,
        private readonly SessionManager $sessions,
        private readonly UserRepository $users,
        private readonly CustomerPresenter $presenter,
        private readonly PasswordResetService $reset,
    ) {
    }

    /** #5 POST /auth/register */
    public function register(Request $request): Response
    {
        /** @var array{name: string, email: string, password: string} $input */
        $input = $request->validated();

        $result = $this->auth->register($input['name'], $input['email'], $input['password'], $request);

        return $this->withSessionCookie(
            Response::data(
                $this->nativeSession($request, $result['token'], $result['expires_at'])
                    + ['customer' => $this->presenter->profile($result['user'])],
                201,
            ),
            $result['token'],
            $result['expires_at'],
        );
    }

    /** #6 POST /auth/login */
    public function login(Request $request): Response
    {
        /** @var array{email: string, password: string} $input */
        $input = $request->validated();

        $result = $this->auth->login(
            $input['email'],
            $input['password'],
            SessionManager::AUDIENCE_CUSTOMER,
            $request,
        );

        return $this->withSessionCookie(
            Response::data(
                $this->nativeSession($request, $result['token'], $result['expires_at'])
                    + ['customer' => $this->presenter->profile($result['user'])],
            ),
            $result['token'],
            $result['expires_at'],
        );
    }

    /** #7 POST /auth/logout */
    public function logout(Request $request): Response
    {
        $principal = $request->attribute('principal');

        if ($principal instanceof Principal) {
            $this->auth->logout($principal);
        }

        return Response::noContent()->withHeader(
            'Set-Cookie',
            $this->sessions->clearCookieHeader(SessionManager::AUDIENCE_CUSTOMER),
        );
    }

    /** #8 GET /auth/session — what the auth context calls on app load. */
    public function session(Request $request): Response
    {
        $principal = $request->attribute('principal');

        if (!$principal instanceof Principal) {
            throw new UnauthorizedException();
        }

        $user = $this->users->findById($principal->userId);

        if ($user === null) {
            throw new UnauthorizedException();
        }

        return Response::data(['customer' => $this->presenter->profile($user)]);
    }

    /**
     * #10 POST /auth/password/forgot
     *
     * 202 when the code is on its way, 422 on field `email` when there is no
     * such account.
     *
     * THIS IS THE ONE ENDPOINT ON EITHER SIDE THAT NAMES AN UNKNOWN ADDRESS,
     * and the console's twin deliberately does not — so the reasoning belongs
     * here rather than in a commit message.
     *
     * `POST /auth/register` two routes up already answers "an account with that
     * email already exists" (#5, and the signup form shows it). Anyone who wants
     * to know whether an address shops here can already ask, through a route
     * whose rate limit is nowhere near as tight as this one's 5/hour. Staying
     * silent here would therefore protect nothing, while costing every shopper
     * who mistyped their address a ten-minute wait for mail that was never
     * coming.
     *
     * The console has no public registration — login and its three password
     * routes are the only public endpoints it exposes — so there the same answer
     * WOULD be a new oracle, and ConsoleAuthController::forgotPassword() keeps
     * its neutral 202. The two differ on purpose. Do not "make them consistent"
     * without reading that method's note.
     */
    public function forgotPassword(Request $request): Response
    {
        /** @var array{email: string} $input */
        $input = $request->validated();

        if (!$this->reset->request($input['email'], SessionManager::AUDIENCE_CUSTOMER)) {
            throw ValidationException::field(
                'email',
                'We could not find an account with that email address.',
                'ICE-AUTH-EMAIL-422',
            );
        }

        return Response::data(['accepted' => true], 202);
    }

    /**
     * POST /auth/password/verify — checks a code without spending it, so the
     * form can move to the password step on something known good.
     */
    public function verifyPasswordCode(Request $request): Response
    {
        /** @var array{email: string, code: string} $input */
        $input = $request->validated();

        $this->reset->verify($input['email'], $input['code'], SessionManager::AUDIENCE_CUSTOMER);

        return Response::noContent();
    }

    /**
     * #11 POST /auth/password/reset — spends the code, sets the password, and
     * revokes every customer session on the account.
     *
     * No cookie comes back. Somebody who has just proved control of the mailbox
     * still signs in with the password they chose, which is the step that
     * proves they know it.
     */
    public function resetPassword(Request $request): Response
    {
        /** @var array{email: string, code: string, password: string} $input */
        $input = $request->validated();

        $this->reset->reset(
            $input['email'],
            $input['code'],
            $input['password'],
            SessionManager::AUDIENCE_CUSTOMER,
        );

        return Response::noContent();
    }

    private function withSessionCookie(Response $response, string $token, ?string $expiresAt): Response
    {
        return $response->withHeader(
            'Set-Cookie',
            $this->sessions->cookieHeader(SessionManager::AUDIENCE_CUSTOMER, $token, $expiresAt),
        );
    }

    /**
     * The session token in the body — for a native client only.
     *
     * The cookie beside it is `HttpOnly`, and that is the whole reason this is
     * conditional. A browser never needs the token: it holds the cookie and the
     * cookie is unreadable to script, which is what keeps a 30-day session out
     * of reach of an XSS. Putting the same token in a JSON body every client can
     * read would hand that protection back for nothing.
     *
     * A native app has the opposite problem. `HttpOnly` means nothing to an HTTP
     * library — it can read the Set-Cookie header perfectly well — but scraping a
     * cookie to replay it is fragile, and the app needs the raw token anyway: it
     * is what goes in `Authorization: Bearer`, which is what gets its writes past
     * `OriginCheck` (see `SessionManager::resolve`).
     *
     * So the client says what it is, in `X-Client-Platform`, and only a native
     * one is handed the token. A page cannot usefully lie about this — sending
     * the header from a browser would only put the token somewhere the same
     * origin's script could already reach.
     *
     * @return array<string, mixed>
     */
    private function nativeSession(Request $request, string $token, ?string $expiresAt): array
    {
        $platform = strtolower(trim($request->header('x-client-platform')));

        if (!in_array($platform, ['android', 'ios', 'app', 'flutter', 'mobile'], true)) {
            return [];
        }

        return ['session' => ['token' => $token, 'expiresAt' => $expiresAt]];
    }
}
