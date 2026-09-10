<?php

declare(strict_types=1);

namespace Iced\Controller\System;

use Iced\Kernel\Database;
use Iced\Kernel\Request;
use Iced\Middleware\OriginCheck;
use Iced\Kernel\Response;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Cache\CacheStore;
use Iced\Support\Config;

/** Spec §8.1 — the four system endpoints. */
final class SystemController
{
    public function __construct(
        private readonly Config $config,
        private readonly Database $db,
        private readonly CacheStore $cache,
        private readonly StoreSettings $settings,
    ) {
    }

    /** #1 GET /health — liveness. Never touches a dependency. */
    public function health(Request $request): Response
    {
        return Response::data(['ok' => true]);
    }

    /**
     * #2 GET /ready — dependencies reachable, AND the configuration sane.
     *
     * The dependency half is unchanged. What is new is the second half, and the
     * reason for it is a specific failure this project has already produced: a
     * deployment bundle carrying a DEVELOPMENT `.env` — `APP_ENV=dev`,
     * `APP_DEBUG=true`, `APP_URL=http://127.0.0.1:8000`, `MAIL_DRIVER=log`.
     *
     * Every one of those is silent. Cookies stop being marked `Secure` because
     * that flag is derived from the scheme in `APP_URL`; HSTS stops being sent
     * for the same reason; password-reset codes start being written to
     * `storage/logs` in full because the log mailer is honest about what it
     * does. The shop looks completely normal while all of it is true. Nothing
     * anywhere reported it, and `LogMailer`'s own docblock promised a warning
     * "in GET /ready" that had never been written.
     *
     * So it is written here. This endpoint is the one thing a deployment checks
     * that already knows the whole configuration, and a misconfiguration that
     * shows up as a red line on a probe is a misconfiguration somebody fixes.
     *
     * BOOLEANS ONLY. `/ready` is public — it has to be, monitors are not signed
     * in — so it may report WHETHER a secret is sane and never what it is. No
     * value from the environment appears in this response, and none should ever
     * be added: `session_secret` below says "long enough and not the sample
     * one", which is exactly as much as an unauthenticated caller may know.
     *
     * The envelope is unchanged: `ok` plus a `checks` object. Existing consumers
     * read `ok` and ignore keys they do not recognise.
     */
    public function ready(Request $request): Response
    {
        $database = $this->db->isHealthy();

        $this->cache->put('readiness-probe', 1, 5);
        $cache = $this->cache->get('readiness-probe') !== null;

        $checks = ['database' => $database, 'cache' => $cache];
        $ok = $database && $cache;

        foreach ($this->productionChecks() as $name => $passed) {
            $checks[$name] = $passed;
            $ok = $ok && $passed;
        }

        return Response::data(['ok' => $ok, 'checks' => $checks], $ok ? 200 : 503);
    }

    /**
     * The configuration checks, which only apply once `APP_ENV=production`.
     *
     * Empty in development on purpose. A laptop runs with debug on, mail to the
     * log and an http URL, and all three are correct there — reporting them as
     * faults would train everyone to ignore this endpoint, which is the one
     * thing it must never become.
     *
     * @return array<string, bool>
     */
    private function productionChecks(): array
    {
        if (strtolower($this->config->string('app.env', 'dev')) !== 'production') {
            return [];
        }

        $secret = $this->config->string('app.session.secret');

        return [
            // A stack trace in an API response, and SMTP failure detail in a
            // password-reset error.
            'debug_off' => !$this->config->bool('app.debug', false),

            // The scheme here is what marks cookies Secure and what sends HSTS.
            // Over http neither happens and nobody can stay signed in anyway.
            'https_url' => str_starts_with($this->config->string('app.url'), 'https://'),

            // MAIL_DRIVER=log writes the whole recovery email, code included,
            // into storage/logs. It is the development default and a disclosure
            // of every password-reset code in production.
            'mail_driver' => strtolower($this->config->string('app.mail.driver', 'log')) !== 'log',

            // 32 bytes of entropy, and not the value shipped in .env.example —
            // which is public, and is also the password pepper, so a deployment
            // running the sample secret has no password hashing worth the name.
            'session_secret' => strlen($secret) >= 32 && !str_contains(strtolower($secret), 'change'),

            // Both halves present, or no card can be taken.
            'razorpay_configured' => $this->config->string('app.razorpay.key_id') !== ''
                && $this->config->string('app.razorpay.key_secret') !== '',

            // Without this the webhook endpoint refuses every delivery, so the
            // gateway's own account of what happened never reaches us.
            'webhook_secret' => $this->config->string('app.razorpay.webhook_secret') !== '',

            // The escape hatch of the payment work. On, the server decides
            // whether a payment happened; off, the browser does. Off in
            // production is a decision to accept free orders, and it must not be
            // possible to leave it that way by accident.
            'payment_intents_enforced' => $this->config->bool('app.payments.enforce_intents', true)
                && $this->settings->bool('payments.enforce_intents', true),

            /* ---- NO DEVELOPMENT ORIGIN MAY DRIVE A WRITE IN PRODUCTION -----
             *
             * `TRUSTED_ORIGINS` is the list allowed to make a cookie-authenticated
             * mutation — to place an order or change a password. Left unset it
             * falls back to `CORS_ALLOWED_ORIGINS`, deliberately, so that no
             * existing deployment broke when the two were separated. The cost of
             * that kindness is that a `http://localhost:3000` left in the CORS
             * list from development is silently trusted to spend a customer's
             * money in production.
             *
             * `APP_URL` is the other way in: it defaults to
             * `http://127.0.0.1:8080` and is appended to the list unconditionally,
             * so a deployment that never set it trusts loopback. `https_url`
             * above would also fail in that case, but this says which of the two
             * problems it is, and a reader of a failing check should not have to
             * infer the second from the first.
             *
             * Reported rather than enforced. Refusing to boot on a trusted
             * localhost origin would turn a misconfiguration into an outage, and
             * `/ready` is exactly the gate that is supposed to catch this before
             * anyone is looking at an outage. The deploy probe fails the release
             * on any false key here. */
            'trusted_origins_clean' => $this->trustedOriginsAreProduction(),
        ];
    }

    /**
     * True when nothing in the trusted-write list points at this machine or a
     * private network.
     *
     * Matched on the HOST, not on the string, because `http://localhost.evil.com`
     * contains "localhost" and is not loopback, while `http://[::1]:3000` is
     * loopback and contains neither "localhost" nor "127.".
     */
    private function trustedOriginsAreProduction(): bool
    {
        foreach (OriginCheck::trustedOrigins($this->config) as $origin) {
            $host = parse_url($origin, PHP_URL_HOST);

            if (!is_string($host) || $host === '') {
                // Unparseable is not "clean" — it is unknown, and unknown fails.
                return false;
            }

            $host = strtolower(trim($host, '[]'));

            if ($host === 'localhost' || str_ends_with($host, '.localhost')) {
                return false;
            }

            if (filter_var($host, FILTER_VALIDATE_IP) !== false
                && filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
                // A literal address in a private or reserved range: 127.0.0.1,
                // ::1, 10.x, 192.168.x, 169.254.x.
                return false;
            }
        }

        return true;
    }

    /** #3 GET /version */
    public function version(Request $request): Response
    {
        return Response::data([
            'version' => $this->config->string('app.version', '1.0.0'),
            'commit' => $this->commit(),
            'built_at' => gmdate('c', (int) filemtime(__FILE__)),
        ]);
    }

    /**
     * #4 GET /config/storefront — the shape the storefront reads on boot.
     *
     * Read from `store_settings`, not from config: a delivery fee changed in the
     * console has to reach the shopper without a deploy, and there must be
     * exactly one number behind the settings screen and the checkout summary.
     * Only the Razorpay PUBLIC key comes from the environment, because it is a
     * credential rather than a policy.
     */
    public function storefront(Request $request): Response
    {
        return Response::data([
            'currency' => $this->config->string('app.currency', 'INR'),
            'free_delivery_over' => $this->settings->int('delivery.free_over', 4999),
            'delivery' => [
                'standard' => [
                    'fee' => $this->settings->int('delivery.standard_fee', 199),
                    'window' => $this->settings->map('delivery.standard_window', [3, 5]),
                ],
                'express' => [
                    'fee' => $this->settings->int('delivery.express_fee', 499),
                    'window' => $this->settings->map('delivery.express_window', [1, 2]),
                ],
            ],
            'razorpay_key_id' => $this->config->string('app.razorpay.key_id'),
        ]);
    }

    private function commit(): string
    {
        $head = dirname(__DIR__, 4) . '/.git/HEAD';

        if (!is_file($head)) {
            return 'unknown';
        }

        $contents = trim((string) file_get_contents($head));

        if (str_starts_with($contents, 'ref: ')) {
            $ref = dirname(__DIR__, 4) . '/.git/' . substr($contents, 5);

            return is_file($ref) ? substr(trim((string) file_get_contents($ref)), 0, 12) : 'unknown';
        }

        return substr($contents, 0, 12);
    }
}
