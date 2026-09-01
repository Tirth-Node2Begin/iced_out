<?php

declare(strict_types=1);

namespace Iced\Tests\Contract;

use Iced\Kernel\Application;
use Iced\Kernel\Database;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Support\Json;
use PHPUnit\Framework\TestCase;

/**
 * Spec §5 and §8.17 — STAFF auth, driven through the real pipeline, in process.
 *
 * Needs a migrated + seeded database — the demo accounts of §12 are the
 * fixtures. Cookies are carried by hand because there is no browser here.
 *
 * The customer half of the original AuthFlowTest stayed with the storefront
 * backend, which is the only half that still serves /auth/*.
 *
 * ONE TEST DID NOT SURVIVE THE SPLIT: "a staff cookie cannot open a customer
 * session" needed both surfaces in one process, and no single deployable has
 * them any more. The guarantee still holds — audiences are separate token
 * spaces in SessionManager — but nothing exercises it end to end now. Restoring
 * it means an integration test that boots both apps.
 */
final class StaffAuthFlowTest extends TestCase
{
    private Application $app;

    /** @var array<string, string> */
    private array $cookies = [];

    protected function setUp(): void
    {
        $this->app = Application::boot(dirname(__DIR__, 2));

        /** @var Database $db */
        $db = $this->app->container->get(Database::class);

        if (!$db->isHealthy()) {
            self::markTestSkipped('Database unavailable — run `php bin/console.php migrate && php bin/console.php seed`.');
        }

        $this->cookies = [];
    }

    public function testStaffSignInReturnsTheConsoleSessionPayload(): void
    {
        [$status, $body] = $this->post('/admin/auth/login', 'public', [
            'email' => 'admin@gmail.com',
            'password' => 'admin123',
        ]);

        self::assertSame(200, $status);
        self::assertSame('Aarav D.', $body['data']['name']);
        self::assertSame('ADMIN', $body['data']['role']);
        self::assertContains('*', $body['data']['permissions']);
        self::assertIsString($body['data']['expires_at']);
        self::assertArrayHasKey('io_ssess', $this->cookies);
    }

    public function testTouchSlidesTheIdleWindow(): void
    {
        $this->post('/admin/auth/login', 'public', [
            'email' => 'admin@gmail.com',
            'password' => 'admin123',
        ]);

        [, $first] = $this->get('/admin/auth/session', 'admin');
        sleep(1);
        [$status, $second] = $this->post('/admin/auth/touch', 'admin');

        self::assertSame(200, $status);
        self::assertGreaterThan($first['data']['expires_at'], $second['data']['expires_at']);
    }

    public function testCookieAuthenticatedMutationFromAnUntrustedOriginIsRefused(): void
    {
        $this->post('/admin/auth/login', 'public', [
            'email' => 'admin@gmail.com',
            'password' => 'admin123',
        ]);

        [$status, $body] = $this->send('POST', '/admin/auth/touch', [
            'x-client-audience' => 'admin',
            'origin' => 'http://evil.example',
        ]);

        self::assertSame(403, $status);
        self::assertSame('ICE-AUTH-403', $body['error']['code']);
    }

    /** @return array{0: int, 1: array<string, mixed>} */
    private function get(string $path, string $audience): array
    {
        return $this->send('GET', $path, ['x-client-audience' => $audience]);
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array{0: int, 1: array<string, mixed>}
     */
    private function post(string $path, string $audience, array $body = []): array
    {
        return $this->send(
            'POST',
            $path,
            ['x-client-audience' => $audience, 'origin' => 'http://127.0.0.1:3100', 'content-type' => 'application/json'],
            Json::encode($body),
        );
    }

    /**
     * @param array<string, string> $headers
     *
     * @return array{0: int, 1: array<string, mixed>}
     */
    private function send(string $method, string $path, array $headers, string $rawBody = ''): array
    {
        $response = $this->app->handle(new Request(
            method: $method,
            path: $path,
            query: [],
            headers: $headers,
            cookies: $this->cookies,
            rawBody: $rawBody,
            ip: '127.0.0.1',
        ));

        $this->absorbCookies($response);

        /** @var array<string, mixed> $decoded */
        $decoded = Json::decodeArray($response->body()) ?? [];

        return [$response->status(), $decoded];
    }

    private function absorbCookies(Response $response): void
    {
        $header = $response->headers()['Set-Cookie'] ?? null;

        if (!is_string($header) || preg_match('/^([^=]+)=([^;]*)/', $header, $matches) !== 1) {
            return;
        }

        $name = trim($matches[1]);

        if (trim($matches[2]) === '' || str_contains($header, 'Max-Age=0')) {
            unset($this->cookies[$name]);

            return;
        }

        $this->cookies[$name] = trim($matches[2]);
    }
}
