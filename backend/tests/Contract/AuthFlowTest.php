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
 * Spec §5 and §8.2 — CUSTOMER auth, driven through the real pipeline, in process.
 *
 * The staff half moved to the CRM backend (tests/Contract/StaffAuthFlowTest),
 * which is the only deployable that still serves /admin/auth/*.
 *
 * Needs a migrated + seeded database — the demo accounts of §12 are the
 * fixtures. Cookies are carried by hand because there is no browser here.
 */
final class AuthFlowTest extends TestCase
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

    public function testCustomerSignsInAndOut(): void
    {
        [$status, $body] = $this->post('/auth/login', 'public', [
            'email' => 'shopper@example.com',
            'password' => 'secret1',
        ]);

        self::assertSame(200, $status);
        // CustomerProfile is exactly these four keys (spec §7.7).
        self::assertSame(['name', 'email', 'mobile', 'photo'], array_keys($body['data']['customer']));
        self::assertSame('Iced_out Shopper', $body['data']['customer']['name']);
        self::assertArrayHasKey('io_csess', $this->cookies);

        [$status, $body] = $this->get('/auth/session', 'customer');
        self::assertSame(200, $status);
        self::assertSame('shopper@example.com', $body['data']['customer']['email']);

        [$status] = $this->post('/auth/logout', 'customer');
        self::assertSame(204, $status);
        self::assertArrayNotHasKey('io_csess', $this->cookies);

        [$status, $body] = $this->get('/auth/session', 'customer');
        self::assertSame(401, $status);
        self::assertSame('ICE-AUTH-401', $body['error']['code']);
    }

    public function testUnknownEmailAndWrongPasswordAreIndistinguishable(): void
    {
        // No user enumeration (spec §5.6) — same status, same sentence.
        [$wrongStatus, $wrongBody] = $this->post('/auth/login', 'public', [
            'email' => 'shopper@example.com',
            'password' => 'not-the-password',
        ]);
        [$unknownStatus, $unknownBody] = $this->post('/auth/login', 'public', [
            'email' => 'nobody@example.com',
            'password' => 'not-the-password',
        ]);

        self::assertSame(401, $wrongStatus);
        self::assertSame(401, $unknownStatus);
        self::assertSame($wrongBody['error']['message'], $unknownBody['error']['message']);
    }

    public function testRegisterReportsEveryBadFieldAtOnce(): void
    {
        [$status, $body] = $this->post('/auth/register', 'public', [
            'name' => 'A',
            'email' => 'not-an-email',
            'password' => '123',
        ]);

        self::assertSame(422, $status);

        $fields = array_column($body['error']['errors'], 'field');
        self::assertEqualsCanonicalizing(['name', 'email', 'password'], $fields);
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
            ['x-client-audience' => $audience, 'origin' => 'http://127.0.0.1:3000', 'content-type' => 'application/json'],
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
