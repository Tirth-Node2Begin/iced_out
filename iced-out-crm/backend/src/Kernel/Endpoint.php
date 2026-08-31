<?php

declare(strict_types=1);

namespace Iced\Kernel;

use Iced\Kernel\Exception\ApiException;
use RuntimeException;

/**
 * Runs one file under api/ as an endpoint.
 *
 * The route table in config/routes/ stays the single source of truth — an
 * endpoint file names the route(s) it serves and nothing else, so a path,
 * permission or validation rule is never declared in two places:
 *
 *     require __DIR__ . '/../bootstrap.php';
 *     Endpoint::serve('admin.auth.login');
 *
 * A file that answers several verbs on one path lists them all:
 *
 *     Endpoint::serve('me.preferences.show', 'me.preferences.update');
 *
 * The request still runs the complete middleware pipeline of spec §2.3 — the
 * file layout changes how a request is routed, never what guards it.
 */
final class Endpoint
{
    public static function serve(string ...$routeNames): void
    {
        if ($routeNames === []) {
            throw new RuntimeException('Endpoint::serve() needs at least one route name.');
        }

        $root = dirname(__DIR__, 2);
        $app = Application::boot($root);

        /** @var Router $table */
        $table = $app->container->get(Router::class);
        $router = new Router();
        $path = null;

        foreach ($routeNames as $name) {
            $route = $table->findByName($name);

            if ($route === null) {
                throw new RuntimeException(sprintf('Unknown route "%s" — check config/routes/.', $name));
            }

            if ($path !== null && $path !== $route->path) {
                throw new RuntimeException(sprintf(
                    'Routes served by one file must share a path: "%s" is %s, expected %s.',
                    $name,
                    $route->path,
                    $path,
                ));
            }

            $path = $route->path;
            $router->add($route);
        }

        $app->container->instance(Router::class, $router);

        $basePath = $app->config()->string('app.base_path', '/api/v1');
        $probe = Request::capture($basePath);

        $app->handle(Request::capture($basePath, self::resolvePath($router, $probe, (string) $path)))->send();
    }

    /**
     * Works out which path to hand the pipeline.
     *
     * A pretty URL (/api/v1/admin/orders/IO-2026-1049/confirm) already carries
     * the route parameters, so it is used as-is. A direct file hit
     * (/api/admin/orders/confirm.php) does not, so the declared path is used and
     * its {placeholders} are filled from the query string.
     */
    private static function resolvePath(Router $router, Request $request, string $declaredPath): string
    {
        try {
            $router->match($request->method, $request->path);

            return $request->path;
        } catch (ApiException) {
            // Fall through to the declared path below.
        }

        $filled = preg_replace_callback(
            '/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/',
            static fn (array $matches): string => rawurlencode($request->queryString($matches[1], $matches[1])),
            $declaredPath,
        );

        return is_string($filled) ? $filled : $declaredPath;
    }
}
