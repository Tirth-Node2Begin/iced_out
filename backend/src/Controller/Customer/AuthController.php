<?php

declare(strict_types=1);

namespace Iced\Controller\Customer;

use Iced\Domain\Principal;
use Iced\Kernel\Exception\UnauthorizedException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\CustomerPresenter;
use Iced\Repository\UserRepository;
use Iced\Service\Auth\AuthService;
use Iced\Service\Auth\SessionManager;

/** Spec §8.2 — customer auth. */
final class AuthController
{
    public function __construct(
        private readonly AuthService $auth,
        private readonly SessionManager $sessions,
        private readonly UserRepository $users,
        private readonly CustomerPresenter $presenter,
    ) {
    }

    /** #5 POST /auth/register */
    public function register(Request $request): Response
    {
        /** @var array{name: string, email: string, password: string} $input */
        $input = $request->validated();

        $result = $this->auth->register($input['name'], $input['email'], $input['password'], $request);

        return $this->withSessionCookie(
            Response::data(['customer' => $this->presenter->profile($result['user'])], 201),
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
            Response::data(['customer' => $this->presenter->profile($result['user'])]),
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

    private function withSessionCookie(Response $response, string $token, ?string $expiresAt): Response
    {
        return $response->withHeader(
            'Set-Cookie',
            $this->sessions->cookieHeader(SessionManager::AUDIENCE_CUSTOMER, $token, $expiresAt),
        );
    }
}
