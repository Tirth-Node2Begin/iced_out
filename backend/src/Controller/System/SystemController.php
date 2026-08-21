<?php

declare(strict_types=1);

namespace Iced\Controller\System;

use Iced\Kernel\Database;
use Iced\Kernel\Request;
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

    /** #2 GET /ready — DB + cache reachable. */
    public function ready(Request $request): Response
    {
        $database = $this->db->isHealthy();

        $this->cache->put('readiness-probe', 1, 5);
        $cache = $this->cache->get('readiness-probe') !== null;

        $ok = $database && $cache;

        return Response::data([
            'ok' => $ok,
            'checks' => [
                'database' => $database,
                'cache' => $cache,
            ],
        ], $ok ? 200 : 503);
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
