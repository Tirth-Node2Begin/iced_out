<?php

declare(strict_types=1);

/**
 * Router for PHP's built-in server only — it reproduces what api/.htaccess does
 * under Apache, so `php -S` behaves like the real deployment:
 *
 *   php -S 127.0.0.1:8080 -t api dev-server.php
 *
 *   /api/v1/auth/login   → api/auth/login.php
 *   /api/v1/orders/ord-local-07 → api/index.php (parameterised, front controller)
 *
 * Never deployed. Apache and Nginx use their own config.
 */

$apiRoot = __DIR__ . '/api';
$basePath = '/api/v1';

$uri = is_string($_SERVER['REQUEST_URI'] ?? null) ? $_SERVER['REQUEST_URI'] : '/';
$path = parse_url($uri, PHP_URL_PATH);
$path = is_string($path) ? $path : '/';

if (str_starts_with($path, $basePath)) {
    $path = substr($path, strlen($basePath));
}

$relative = '/' . trim($path, '/');

$serve = static function (string $candidate) use ($apiRoot): bool {
    $resolved = realpath($candidate);

    // Containment check: a crafted path must never reach outside api/.
    if ($resolved === false || !str_starts_with($resolved, (string) realpath($apiRoot))) {
        return false;
    }

    if (!is_file($resolved) || !str_ends_with($resolved, '.php')) {
        return false;
    }

    // bootstrap.php is an include, not an endpoint (api/.htaccess denies it too).
    if (basename($resolved) === 'bootstrap.php') {
        return false;
    }

    require $resolved;

    return true;
};

if ($relative !== '/' && ($serve($apiRoot . $relative) || $serve($apiRoot . $relative . '.php'))) {
    return;
}

require $apiRoot . '/index.php';
