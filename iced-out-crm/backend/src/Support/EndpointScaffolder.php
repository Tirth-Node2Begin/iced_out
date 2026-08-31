<?php

declare(strict_types=1);

namespace Iced\Support;

use Iced\Kernel\Route;
use Iced\Kernel\Router;

/**
 * Writes the file-per-endpoint tree under api/ from the route table.
 *
 * The table stays the single source of truth; these files are its readable map,
 * so they are generated rather than hand-maintained — a route added to
 * config/routes/ and never given a file would otherwise be invisible in the
 * folder that is supposed to show the whole API.
 *
 * ONE FILE PER PATH, not per route. Two verbs on the same URL (GET and PUT
 * /admin/me/profile) must be served by the same file: the web server dispatches
 * on the path alone, so splitting them means whichever file it picks answers
 * 405 to the other verb.
 *
 * The file path mirrors the URL:
 *
 *   /health                                  → api/health.php
 *   /admin/orders                            → api/admin/orders/index.php
 *   /admin/orders/{number}                   → api/admin/orders/show.php
 *   /admin/orders/{number}/confirm           → api/admin/orders/confirm.php
 *   /admin/catalog/products/{slug}/publish   → api/admin/catalog/products/publish.php
 *
 * Parameterised URLs have no literal file to land on, so the web server falls
 * through to the front controller for those — the generated file is the
 * readable map and a directly-callable entry point, never the only way in.
 */
final class EndpointScaffolder
{
    /**
     * Path prefixes that have a parameterised child, and therefore need a
     * directory index rather than a plain file: /admin/orders is a collection
     * because /admin/orders/{number} exists, while /admin/me/profile is not.
     *
     * @var list<string>
     */
    private readonly array $collections;

    public function __construct(
        private readonly Router $router,
        private readonly string $apiRoot,
    ) {
        /** @var list<string> $prefixes */
        $prefixes = [];

        foreach ($router->all() as $route) {
            $segments = $route->segments();

            foreach ($segments as $index => $segment) {
                if (!str_starts_with($segment, '{')) {
                    continue;
                }

                $prefix = implode('/', array_slice($segments, 0, $index));

                if ($prefix !== '' && !in_array($prefix, $prefixes, true)) {
                    $prefixes[] = $prefix;
                }
            }
        }

        $this->collections = $prefixes;
    }

    /**
     * @param callable(string): void $report
     *
     * @return array{written: int, skipped: int}
     */
    public function scaffold(callable $report): array
    {
        $written = 0;
        $skipped = 0;

        foreach ($this->group() as $relative => $routes) {
            $file = $this->apiRoot . '/' . $relative . '.php';

            $names = [];

            foreach ($routes as $route) {
                if ($route->name !== null) {
                    $names[] = $route->name;
                }
            }

            if ($names === []) {
                $report(sprintf('  ! %s has no named route — skipped.', $relative));
                ++$skipped;

                continue;
            }

            $contents = $this->render($routes, $names, $relative);

            if (is_file($file) && file_get_contents($file) === $contents) {
                ++$skipped;

                continue;
            }

            $directory = dirname($file);

            if (!is_dir($directory)) {
                mkdir($directory, 0775, true);
            }

            file_put_contents($file, $contents);
            $report(sprintf('  + api/%s.php  →  %s', $relative, implode(', ', array_map(
                static fn (Route $route): string => $route->method . ' ' . $route->path,
                $routes,
            ))));
            ++$written;
        }

        return ['written' => $written, 'skipped' => $skipped];
    }

    /**
     * Routes keyed by the file that will serve them.
     *
     * @return array<string, list<Route>>
     */
    private function group(): array
    {
        /** @var array<string, list<Route>> $groups */
        $groups = [];

        foreach ($this->router->all() as $route) {
            $groups[$this->fileFor($route)][] = $route;
        }

        ksort($groups);

        return $groups;
    }

    public function fileFor(Route $route): string
    {
        $segments = $route->segments();
        /** @var list<string> $literals */
        $literals = [];
        $sawParam = false;
        /** @var list<string> $afterParam */
        $afterParam = [];

        foreach ($segments as $segment) {
            if (str_starts_with($segment, '{')) {
                $sawParam = true;

                continue;
            }

            if ($sawParam) {
                $afterParam[] = $segment;
            } else {
                $literals[] = $segment;
            }
        }

        if (!$sawParam) {
            // A bare collection URL (/admin/orders) needs a directory index so a
            // sibling detail file can live beside it.
            $isCollection = in_array(implode('/', $literals), $this->collections, true);

            return implode('/', $literals) . ($isCollection ? '/index' : '');
        }

        // The literal that follows the parameter names the action; a URL that
        // ends at the parameter is the detail read.
        $action = $afterParam === [] ? 'show' : implode('_', $afterParam);

        return implode('/', [...$literals, str_replace('-', '_', $action)]);
    }

    /**
     * @param list<Route>  $routes
     * @param list<string> $names
     */
    private function render(array $routes, array $names, string $relative): string
    {
        $depth = substr_count($relative, '/');
        $up = $depth === 0 ? '' : implode('', array_fill(0, $depth, '/..'));

        $doc = implode("\n * ", array_map(
            static fn (Route $route): string => sprintf('%s /api/v1%s', $route->method, $route->path),
            $routes,
        ));

        $served = implode(', ', array_map(static fn (string $name): string => "'" . $name . "'", $names));

        return sprintf(
            <<<'PHP'
                <?php

                declare(strict_types=1);

                /**
                 * %s
                 */

                use Iced\Kernel\Endpoint;

                require __DIR__ . '%s/bootstrap.php';

                Endpoint::serve(%s);

                PHP,
            $doc,
            $up,
            $served,
        );
    }
}
