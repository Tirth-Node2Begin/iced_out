<?php

declare(strict_types=1);

use Iced\Support\Env;

/**
 * Env-driven application config. Nothing outside Iced\Support\Env reads the
 * environment directly, so this file is the whole surface of configuration.
 */
return [
    'env' => Env::string('APP_ENV', 'dev'),
    'debug' => Env::bool('APP_DEBUG', Env::string('APP_ENV', 'dev') === 'dev'),
    'url' => Env::string('APP_URL', 'http://127.0.0.1:8080'),
    'base_path' => '/api/v1',
    'maintenance' => Env::bool('APP_MAINTENANCE', false),
    'version' => '1.0.0',
    'timezone_display' => 'Asia/Kolkata',
    'locale' => 'en-IN',
    'currency' => 'INR',

    'cors_allowed_origins' => Env::list('CORS_ALLOWED_ORIGINS'),

    'session' => [
        'customer_cookie' => Env::string('SESSION_COOKIE_CUSTOMER', 'io_csess'),
        'staff_cookie' => Env::string('SESSION_COOKIE_STAFF', 'io_ssess'),
        'secret' => Env::string('SESSION_SECRET'),
        'customer_ttl' => Env::int('CUSTOMER_SESSION_TTL', 2592000),
        'staff_idle_ttl' => Env::int('STAFF_SESSION_IDLE_TTL', 900),
    ],

    /**
     * Spec §4.7. `scope` decides which of the two rate-limit middlewares owns
     * the bucket: ip, principal, or both.
     */
    'rate_limits' => [
        'default' => ['limit' => 240, 'window' => 60, 'scope' => 'ip'],
        'auth' => ['limit' => 10, 'window' => 60, 'scope' => 'ip'],
        'password_forgot' => ['limit' => 5, 'window' => 3600, 'scope' => 'ip'],
        'catalog' => ['limit' => 120, 'window' => 60, 'scope' => 'ip'],
        'cart' => ['limit' => 30, 'window' => 60, 'scope' => 'principal'],
        'contact' => ['limit' => 5, 'window' => 3600, 'scope' => 'both'],
        'console_read' => ['limit' => 300, 'window' => 60, 'scope' => 'principal'],
        'console_write' => ['limit' => 60, 'window' => 60, 'scope' => 'principal'],
        'exports' => ['limit' => 5, 'window' => 3600, 'scope' => 'principal'],
        'webhooks' => ['limit' => 1000, 'window' => 60, 'scope' => 'ip'],
    ],

    /** Storefront knobs the UI reads from GET /config/storefront (endpoint #4). */
    'storefront' => [
        'free_delivery_over' => 4999,
        'delivery' => [
            'standard' => ['fee' => 199, 'window' => [3, 5]],
            'express' => ['fee' => 499, 'window' => [1, 2]],
        ],
        'cod' => ['max' => 5000, 'fee' => 0],
        'low_stock_at' => 4,
        'max_per_order' => 3,
        'reservation_ttl' => ['prepaid' => 900, 'cod' => 600],
    ],

    'razorpay' => [
        'key_id' => Env::string('RAZORPAY_KEY_ID'),
        'key_secret' => Env::string('RAZORPAY_KEY_SECRET'),
        'webhook_secret' => Env::string('RAZORPAY_WEBHOOK_SECRET'),
    ],

    'media' => [
        'driver' => Env::string('MEDIA_DRIVER', 'local'),
        'root' => Env::string('MEDIA_ROOT', 'storage/media'),
    ],

    /**
     * remove.bg — the ghost-mannequin cutouts behind the home page hero.
     *
     * The key is a SECRET, so it lives here (env) and never in `store_settings`
     * (operator data, spec §14 forbids secrets there). Blank key ⇒
     * `UnconfiguredBackgroundRemover` is bound, uploads still save, and every
     * slide reports `Skipped` with the reason rather than pretending.
     *
     * `size=auto` bills by the output resolution; `preview` is the free tier's
     * 0.25MP and is the one to set while testing.
     */
    'remove_bg' => [
        'api_key' => Env::string('REMOVE_BG_API_KEY'),
        'endpoint' => Env::string('REMOVE_BG_ENDPOINT', 'https://api.remove.bg/v1.0/removebg'),
        'size' => Env::string('REMOVE_BG_SIZE', 'auto'),
        'timeout' => Env::int('REMOVE_BG_TIMEOUT', 45),
    ],

    'mail' => [
        'driver' => Env::string('MAIL_DRIVER', 'log'),
        'from' => Env::string('MAIL_FROM', 'no-reply@iced-out.example'),
    ],

    /**
     * External delivery-tracking API — placeholders only (spec §9.8).
     * Blank base URL ⇒ PlaceholderTrackingProvider is bound and no courier
     * data is ever invented.
     */
    'tracking' => [
        'base_url' => Env::string('TRACKING_API_BASE_URL'),
        'api_key' => Env::string('TRACKING_API_KEY'),
        'webhook_secret' => Env::string('TRACKING_API_WEBHOOK_SECRET'),
    ],
];
