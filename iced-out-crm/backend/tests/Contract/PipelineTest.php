<?php

declare(strict_types=1);

namespace Iced\Tests\Contract;

use Iced\Controller\System\SystemController;
use Iced\Kernel\Application;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Kernel\Route;
use Iced\Kernel\Router;
use Iced\Support\Json;
use PHPUnit\Framework\TestCase;

/**
 * Guards the middleware order of spec §2.3 and the boundary rules of §5.
 * Routes are registered here rather than read from config so the assertions
 * stay true as the real route tables grow.
 *
 * No database is required: without a session cookie, Authenticate short-circuits
 * before it ever queries.
 */
final class PipelineTest extends TestCase
{
    private Application $app;

    protected function setUp(): void
    {
        $this->app = Application::boot(dirname(__DIR__, 2));

        $router = new Router();

        foreach ([
            ['method' => 'GET', 'path' => '/probe/public', 'audience' => Route::AUDIENCE_PUBLIC],
            ['method' => 'GET', 'path' => '/probe/me', 'audience' => Route::AUDIENCE_CUSTOMER],
            ['method' => 'GET', 'path' => '/probe/console', 'audience' => Route::AUDIENCE_STAFF, 'permission' => 'orders.view'],
        ] as $definition) {
            $router->add(Route::fromArray($definition + ['handler' => [SystemController::class, 'health']]));
        }

        $this->app->container->instance(Router::class, $router);
    }

    public function testPublicRouteAnswersWithTheSuccessEnvelope(): void
    {
        [$status, $body] = $this->call('GET', '/probe/public', ['x-client-audience' => 'public']);

        self::assertSame(200, $status);
        self::assertSame(['ok' => true], $body['data']);
        self::assertArrayHasKey('request_id', $body['meta']);
    }

    public function testStaffClientCannotReachACustomerRoute(): void
    {
        // Audience is checked before any cookie is read (spec §5.1).
        [$status, $body] = $this->call('GET', '/probe/me', ['x-client-audience' => 'admin']);

        self::assertSame(403, $status);
        self::assertSame('ICE-AUTH-403', $body['error']['code']);
    }

    public function testMissingAudienceHeaderIsTreatedAsAMismatch(): void
    {
        [$status] = $this->call('GET', '/probe/me', []);

        self::assertSame(403, $status);
    }

    public function testCustomerRouteWithoutASessionIs401(): void
    {
        [$status, $body] = $this->call('GET', '/probe/me', ['x-client-audience' => 'customer']);

        self::assertSame(401, $status);
        self::assertSame('ICE-AUTH-401', $body['error']['code']);
    }

    public function testConsoleRouteWithoutAStaffSessionIs401(): void
    {
        [$status] = $this->call('GET', '/probe/console', ['x-client-audience' => 'admin']);

        self::assertSame(401, $status);
    }

    public function testWrongVerbIs405AndUnknownPathIs404(): void
    {
        [$methodStatus, $methodBody] = $this->call('DELETE', '/probe/public', ['x-client-audience' => 'public']);
        [$pathStatus, $pathBody] = $this->call('GET', '/probe/nothing', ['x-client-audience' => 'public']);

        self::assertSame(405, $methodStatus);
        self::assertSame('ICE-REQ-405', $methodBody['error']['code']);
        self::assertSame(404, $pathStatus);
        self::assertSame('ICE-REQ-404', $pathBody['error']['code']);
    }

    public function testClientRequestIdIsEchoedIntoMetaAndHeaders(): void
    {
        $id = '11111111-2222-4333-8444-555555555555';
        $response = $this->respond('GET', '/probe/public', ['x-client-audience' => 'public', 'x-request-id' => $id]);
        $body = Json::decodeArray($response->body());

        self::assertIsArray($body);
        self::assertSame($id, $body['meta']['request_id']);
        self::assertSame($id, $response->headers()['X-Request-Id']);
    }

    public function testSecurityHeadersAreOnEveryResponse(): void
    {
        $headers = $this->respond('GET', '/probe/public', ['x-client-audience' => 'public'])->headers();

        self::assertSame('nosniff', $headers['X-Content-Type-Options']);
        self::assertSame('DENY', $headers['X-Frame-Options']);
        self::assertSame('strict-origin-when-cross-origin', $headers['Referrer-Policy']);
        self::assertSame("default-src 'none'; frame-ancestors 'none'", $headers['Content-Security-Policy']);
    }

    /**
     * An error response is still a response.
     *
     * Failures used to be built outside the pipeline, so a `throw` unwound past
     * every middleware and the answer came back undecorated — no CORS headers,
     * which meant the browser blocked a 401 and the sign-in screen showed
     * "the request could not be completed" instead of asking for a password.
     *
     * @dataProvider failingRequests
     *
     * @param array<string, string> $headers
     */
    public function testFailureResponsesCarryCorsAndSecurityHeaders(
        string $method,
        string $path,
        array $headers,
        int $expected,
    ): void {
        $response = $this->respond($method, $path, $headers + ['origin' => 'http://127.0.0.1:3000']);

        self::assertSame($expected, $response->status());
        self::assertSame('http://127.0.0.1:3000', $response->headers()['Access-Control-Allow-Origin'] ?? null);
        self::assertSame('true', $response->headers()['Access-Control-Allow-Credentials'] ?? null);
        self::assertSame('nosniff', $response->headers()['X-Content-Type-Options'] ?? null);
    }

    /** @return array<string, array{0: string, 1: string, 2: array<string, string>, 3: int}> */
    public static function failingRequests(): array
    {
        return [
            '401 no session' => ['GET', '/probe/me', ['x-client-audience' => 'customer'], 401],
            '403 wrong audience' => ['GET', '/probe/me', ['x-client-audience' => 'admin'], 403],
            '404 unknown route' => ['GET', '/probe/nothing', ['x-client-audience' => 'public'], 404],
            '405 wrong verb' => ['DELETE', '/probe/public', ['x-client-audience' => 'public'], 405],
        ];
    }

    public function testPreflightIsAnsweredWithoutTouchingTheRouter(): void
    {
        $response = $this->respond('OPTIONS', '/probe/nothing', [
            'x-client-audience' => 'customer',
            'origin' => 'http://127.0.0.1:3000',
        ]);

        self::assertSame(204, $response->status());
        self::assertSame('http://127.0.0.1:3000', $response->headers()['Access-Control-Allow-Origin']);
        self::assertSame('true', $response->headers()['Access-Control-Allow-Credentials']);
    }

    /** @return array{0: int, 1: array<string, mixed>} */
    private function call(string $method, string $path, array $headers): array
    {
        $response = $this->respond($method, $path, $headers);
        $body = Json::decodeArray($response->body());

        /** @var array<string, mixed> $body */
        return [$response->status(), $body ?? []];
    }

    /** @param array<string, string> $headers */
    private function respond(string $method, string $path, array $headers): Response
    {
        return $this->app->handle(new Request(
            method: $method,
            path: $path,
            query: [],
            headers: $headers,
            cookies: [],
            rawBody: '',
            ip: '127.0.0.1',
        ));
    }
}
