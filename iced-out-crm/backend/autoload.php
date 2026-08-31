<?php

declare(strict_types=1);

/**
 * Composer is the supported autoloader (PSR-4 "Iced\\" => src/).
 * This shim keeps the app runnable on machines without Composer installed —
 * it registers the identical PSR-4 mapping by hand. Once `composer install`
 * has run, vendor/autoload.php wins and this file is a no-op passthrough.
 */

$vendor = __DIR__ . '/vendor/autoload.php';

if (is_file($vendor)) {
    require $vendor;

    return;
}

spl_autoload_register(static function (string $class): void {
    $prefix = 'Iced\\';

    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $path = __DIR__ . '/src/' . str_replace('\\', '/', $relative) . '.php';

    if (is_file($path)) {
        require $path;
    }
});
