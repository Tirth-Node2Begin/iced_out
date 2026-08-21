<?php

declare(strict_types=1);

namespace Iced\Kernel;

use Iced\Kernel\Exception\ApiException;
use Iced\Kernel\Exception\NotFoundException;

/**
 * Segment matcher over the route tables in config/routes/. Static segments beat
 * {placeholders}, so /console/orders/{number} never shadows a literal sibling.
 */
final class Router
{
    /** @var list<Route> */
    private array $routes = [];

    /** @param list<string> $files */
    public static function fromConfigFiles(array $files): self
    {
        $router = new self();

        foreach ($files as $file) {
            if (!is_file($file)) {
                continue;
            }

            /** @var mixed $definitions */
            $definitions = require $file;

            if (!is_array($definitions)) {
                continue;
            }

            foreach ($definitions as $definition) {
                if (is_array($definition)) {
                    /** @var array<string, mixed> $definition */
                    $router->add(Route::fromArray($definition));
                }
            }
        }

        return $router;
    }

    public function add(Route $route): void
    {
        $this->routes[] = $route;
    }

    /** @return list<Route> */
    public function all(): array
    {
        return $this->routes;
    }

    /** Endpoint files address routes by name, so the table stays the single source of truth. */
    public function findByName(string $name): ?Route
    {
        foreach ($this->routes as $route) {
            if ($route->name === $name) {
                return $route;
            }
        }

        return null;
    }

    /** @throws ApiException 404 when nothing matches, 405 when only the verb is wrong */
    public function match(string $method, string $path): RouteMatch
    {
        $segments = $path === '/' ? [] : explode('/', trim($path, '/'));
        $pathMatched = false;
        /** @var list<string> $allowed */
        $allowed = [];

        foreach ($this->routes as $route) {
            $params = $this->compare($route->segments(), $segments);

            if ($params === null) {
                continue;
            }

            $pathMatched = true;
            $allowed[] = $route->method;

            if ($route->method === $method) {
                return new RouteMatch($route, $params);
            }
        }

        if ($pathMatched) {
            throw new ApiException(405, 'ICE-REQ-405', 'That method is not supported here.', [
                ['detail' => 'Allowed: ' . implode(', ', array_unique($allowed))],
            ]);
        }

        throw new NotFoundException('ICE-REQ-404', 'That endpoint does not exist.');
    }

    /**
     * @param list<string> $routeSegments
     * @param list<string> $pathSegments
     *
     * @return array<string, string>|null
     */
    private function compare(array $routeSegments, array $pathSegments): ?array
    {
        if (count($routeSegments) !== count($pathSegments)) {
            return null;
        }

        $params = [];

        foreach ($routeSegments as $index => $segment) {
            $actual = $pathSegments[$index];

            if (str_starts_with($segment, '{') && str_ends_with($segment, '}')) {
                $name = substr($segment, 1, -1);

                if ($actual === '') {
                    return null;
                }

                $params[$name] = rawurldecode($actual);

                continue;
            }

            if ($segment !== $actual) {
                return null;
            }
        }

        return $params;
    }
}
