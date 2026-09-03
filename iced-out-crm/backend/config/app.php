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
        // Checking a code someone was emailed. A person doing this honestly
        // spends two of these (verify, then reset) and mistypes once or twice;
        // the per-code attempt cap in PasswordResetService is what actually
        // guards the six digits, and this is the ceiling on how fast an IP can
        // work through accounts.
        'password_otp' => ['limit' => 30, 'window' => 3600, 'scope' => 'ip'],
        'catalog' => ['limit' => 120, 'window' => 60, 'scope' => 'ip'],
        'cart' => ['limit' => 30, 'window' => 60, 'scope' => 'principal'],
        // Gateway calls cost money and time on someone else's API. A shopper
        // retrying a declined card a few times fits comfortably; a script
        // opening orders in a loop does not.
        'payments' => ['limit' => 20, 'window' => 60, 'scope' => 'principal'],
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

    /**
     * Razorpay. `key_id` is PUBLIC — it is served to the storefront by
     * GET /config/storefront and appears in the page source of every Razorpay
     * checkout in existence. `key_secret` is not, and is read only by
     * RazorpayGateway; it never reaches a response body, a log line or
     * `store_settings` (spec §14 forbids secrets there).
     *
     * Both blank ⇒ the gateway reports itself unconfigured, the order endpoint
     * answers 503 with a sentence saying so, and the browser falls back to the
     * amount-only checkout rather than opening a frame that cannot work.
     */
    'razorpay' => [
        'key_id' => Env::string('RAZORPAY_KEY_ID'),
        'key_secret' => Env::string('RAZORPAY_KEY_SECRET'),
        'webhook_secret' => Env::string('RAZORPAY_WEBHOOK_SECRET'),
        // Seconds. A shopper is watching a spinner behind this call, so it is
        // deliberately far shorter than the media-side integrations.
        'timeout' => Env::int('RAZORPAY_TIMEOUT', 20),
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

    /**
     * Mail. `driver=log` writes the whole message to storage/logs and sends
     * nothing — the development default, and the reason the recovery flow is
     * exercisable on a laptop with no credentials. `driver=smtp` needs a host.
     *
     * SMTP_PASS is a SECRET and lives here (env) rather than in `store_settings`
     * — spec §14 forbids secrets in operator data. It is never logged and never
     * reaches a response body.
     *
     * `encryption` is derived from the port when it is not set, because the two
     * are conventionally locked together and one fewer thing to get wrong is
     * worth the inference: 465 ⇒ implicit TLS, anything else ⇒ STARTTLS.
     */
    'mail' => [
        'driver' => Env::string('MAIL_DRIVER', 'log'),
        'from' => Env::string('MAIL_FROM', 'no-reply@iced-out.example'),
        'from_name' => Env::string('MAIL_FROM_NAME', 'Iced_out'),
        'host' => Env::string('SMTP_HOST'),
        'port' => Env::int('SMTP_PORT', 587),
        'username' => Env::string('SMTP_USER'),
        'password' => Env::string('SMTP_PASS'),
        'encryption' => Env::string('SMTP_ENCRYPTION', Env::int('SMTP_PORT', 587) === 465 ? 'ssl' : 'tls'),
        // Seconds. Somebody is watching a spinner behind this call, so it is
        // kept close to the storefront's other user-facing integrations.
        'timeout' => Env::int('SMTP_TIMEOUT', 15),
    ],

    /**
     * External delivery tracking — iThink Logistics (spec §9.8).
     * https://docs.ithinklogistics.com/doc-track-order/3
     *
     * Both credentials blank ⇒ PlaceholderTrackingProvider is bound and no
     * courier data is ever invented. They live in the request BODY rather than
     * a header, which is their design, so `secret_key` is as sensitive as any
     * password and never leaves the server.
     *
     * The base URL carries the version segment because their staging host uses
     * the same path under a different name:
     *   production  https://api.ithinklogistics.com/api_v3
     *   staging     https://pre-alpha.ithinklogistics.com/api_v3
     */
    'tracking' => [
        'base_url' => Env::string('ITHINK_BASE_URL', 'https://api.ithinklogistics.com/api_v3'),
        'access_token' => Env::string('ITHINK_ACCESS_TOKEN'),
        'secret_key' => Env::string('ITHINK_SECRET_KEY'),
        // Seconds. A person is watching a spinner behind this call.
        'timeout' => Env::int('ITHINK_TIMEOUT', 20),
        'webhook_secret' => Env::string('TRACKING_API_WEBHOOK_SECRET'),
    ],
];
