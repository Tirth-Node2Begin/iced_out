<?php

declare(strict_types=1);

namespace Iced\Kernel;

use Iced\Integration\BackgroundRemoval\BackgroundRemover;
use Iced\Integration\BackgroundRemoval\RemoveBgClient;
use Iced\Integration\BackgroundRemoval\UnconfiguredBackgroundRemover;
use Iced\Integration\Mail\LogMailer;
use Iced\Integration\Mail\Mailer;
use Iced\Integration\Mail\SmtpMailer;
use Iced\Integration\Payments\RazorpayGateway;
use Iced\Integration\Tracking\IthinkLogisticsTrackingProvider;
use Iced\Integration\Tracking\PlaceholderTrackingProvider;
use Iced\Integration\Tracking\TrackingProvider;
use Iced\Kernel\Exception\ApiException;
use Iced\Kernel\Exception\RateLimitException;
use Iced\Middleware\Audit;
use Iced\Middleware\Authenticate;
use Iced\Middleware\Authorize;
use Iced\Middleware\BodyLimit;
use Iced\Middleware\Cors;
use Iced\Middleware\HandleErrors;
use Iced\Middleware\Idempotency;
use Iced\Middleware\Maintenance;
use Iced\Middleware\OriginCheck;
use Iced\Middleware\RateLimitByIp;
use Iced\Middleware\RateLimitByPrincipal;
use Iced\Middleware\RequestId;
use Iced\Middleware\ResolveRoute;
use Iced\Middleware\SecurityHeaders;
use Iced\Middleware\Validate;
use Iced\Repository\MediaRepository;
use Iced\Service\Media\MediaService;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Cache\CacheStore;
use Iced\Support\Cache\FileCacheStore;
use Iced\Support\Clock;
use Iced\Support\Config;
use Iced\Support\Env;
use Iced\Support\Logger;
use Iced\Support\RateLimiter;
use Throwable;

/**
 * Bootstraps the container and runs one request through the pipeline of
 * spec §2.3. Uncaught ApiExceptions become the failure envelope; anything else
 * becomes ICE-SYS-500 with the stack trace in the log only.
 */
final class Application
{
    /** @var list<class-string<Middleware>> */
    private const PIPELINE = [
        RequestId::class,
        SecurityHeaders::class,
        Cors::class,
        // Below the two decorators and above everything that throws, so a
        // failure still comes back with CORS and security headers on it.
        HandleErrors::class,
        Maintenance::class,
        ResolveRoute::class,
        BodyLimit::class,
        RateLimitByIp::class,
        Authenticate::class,
        OriginCheck::class,
        RateLimitByPrincipal::class,
        Authorize::class,
        Validate::class,
        Idempotency::class,
        Audit::class,
    ];

    private function __construct(
        public readonly Container $container,
        public readonly string $root,
    ) {
    }

    public static function boot(string $root): self
    {
        Env::load($root . '/.env');

        $config = new Config($root . '/config');
        date_default_timezone_set('UTC');

        $container = new Container();
        $app = new self($container, $root);

        $container->instance(Config::class, $config);
        $container->instance(self::class, $app);
        $container->singleton(Clock::class, static fn (): Clock => new Clock());
        $container->singleton(
            Logger::class,
            static fn (Container $c): Logger => new Logger($root . '/storage/logs', $c->make(Clock::class)),
        );
        $container->singleton(
            CacheStore::class,
            static fn (): CacheStore => new FileCacheStore($root . '/storage/cache'),
        );
        $container->singleton(
            RateLimiter::class,
            static fn (Container $c): RateLimiter => new RateLimiter($c->get(CacheStore::class)),
        );
        $container->singleton(Database::class, static fn (Container $c): Database => new Database($c->make(Config::class)));
        $container->singleton(Router::class, static fn (): Router => Router::fromConfigFiles(self::routeFiles($root)));

        // The media root is deployment wiring, so it comes from config; the
        // caps and formats it enforces are settings.
        $container->singleton(MediaService::class, static function (Container $c) use ($root, $config): MediaService {
            $configured = $config->string('app.media.root', 'storage/media');
            $path = str_starts_with($configured, '/') || preg_match('/^[A-Za-z]:/', $configured) === 1
                ? $configured
                : $root . '/' . $configured;

            return new MediaService(
                $c->make(MediaRepository::class),
                $c->make(StoreSettings::class),
                $c->make(Clock::class),
                rtrim($path, '/\\'),
            );
        });

        /**
         * Background removal for the home page hero's ghost cutouts.
         *
         * Same arrangement as the tracking provider below: a blank credential
         * binds the honest do-nothing rather than a half-working client. The
         * difference between a store with a remove.bg key and a store without
         * one is a line in `.env` — no code path above this binding is
         * conditional on it.
         */
        $container->singleton(BackgroundRemover::class, static function (Container $c) use ($config): BackgroundRemover {
            $key = $config->string('app.remove_bg.api_key');

            if ($key === '') {
                return new UnconfiguredBackgroundRemover();
            }

            return new RemoveBgClient(
                $key,
                $config->string('app.remove_bg.endpoint', 'https://api.remove.bg/v1.0/removebg'),
                $config->string('app.remove_bg.size', 'auto'),
                $config->int('app.remove_bg.timeout', 45),
                $c->make(Logger::class),
            );
        });

        /**
         * Razorpay. Bound rather than autowired because the credentials are
         * strings, and there is only ever one of it per process.
         *
         * Unlike the two integrations either side of this one, a blank
         * credential does NOT bind a different class: there is no honest
         * do-nothing gateway — a payment either happened or it did not. The
         * object reports `isConfigured() === false` and the one endpoint that
         * needs it says so in a sentence.
         */
        $container->singleton(RazorpayGateway::class, static fn (Container $c): RazorpayGateway => new RazorpayGateway(
            $config->string('app.razorpay.key_id'),
            $config->string('app.razorpay.key_secret'),
            $config->int('app.razorpay.timeout', 20),
            $c->make(Logger::class),
        ));

        /**
         * Mail. Same arrangement as the background remover above: a driver that
         * cannot work is never bound. `MAIL_DRIVER=smtp` with a blank
         * `SMTP_HOST` would be a client that fails on every send, so it falls
         * back to the log driver and says so once, where an operator will find
         * it — rather than silently swallowing every recovery code.
         */
        $container->singleton(Mailer::class, static function (Container $c) use ($config): Mailer {
            $driver = strtolower($config->string('app.mail.driver', 'log'));
            $host = $config->string('app.mail.host');
            $logger = $c->make(Logger::class);

            if ($driver !== 'smtp') {
                return new LogMailer($logger);
            }

            if ($host === '') {
                $logger->warning('mail.misconfigured', [
                    'reason' => 'MAIL_DRIVER=smtp with a blank SMTP_HOST — falling back to the log driver.',
                ]);

                return new LogMailer($logger);
            }

            return new SmtpMailer(
                $host,
                $config->int('app.mail.port', 587),
                $config->string('app.mail.username'),
                $config->string('app.mail.password'),
                strtolower($config->string('app.mail.encryption', 'tls')),
                $config->string('app.mail.from', 'no-reply@iced-out.example'),
                $config->string('app.mail.from_name', 'Iced_out'),
                $config->int('app.mail.timeout', 15),
                $logger,
            );
        });

        /**
         * Order tracking (spec §9.8) — iThink Logistics when both halves of the
         * credential are present, the placeholder otherwise.
         *
         * Keyed on the CREDENTIALS rather than the base URL, which has a
         * working default: a server that has the host but no token would
         * otherwise bind a client that can only ever be refused, and every
         * shipment screen would report a 401 where "not connected yet" is the
         * truthful answer.
         */
        $container->singleton(
            TrackingProvider::class,
            static function (Container $c) use ($config): TrackingProvider {
                $token = $config->string('app.tracking.access_token');
                $secret = $config->string('app.tracking.secret_key');

                if ($token === '' || $secret === '') {
                    return new PlaceholderTrackingProvider();
                }

                return new IthinkLogisticsTrackingProvider(
                    $config->string('app.tracking.base_url', 'https://api.ithinklogistics.com/api_v3'),
                    $token,
                    $secret,
                    $config->int('app.tracking.timeout', 20),
                    $c->make(Logger::class),
                );
            },
        );

        return $app;
    }

    /** @return list<string> */
    public static function routeFiles(string $root): array
    {
        $found = glob($root . '/config/routes/*.php');

        return $found === false ? [] : array_values($found);
    }

    public function run(): void
    {
        $basePath = $this->config()->string('app.base_path', '/api/v1');
        $request = Request::capture($basePath);

        $this->handle($request)->send();
    }

    public function handle(Request $request): Response
    {
        try {
            $pipeline = new Pipeline($this->container, self::PIPELINE);

            $response = $pipeline->run($request, fn (Request $request): Response => $this->dispatch($request));
        } catch (ApiException $error) {
            $response = $this->failure($error);
        } catch (Throwable $error) {
            $this->container->make(Logger::class)->exception($error, [
                'request_id' => $request->requestId(),
                'path' => $request->path,
                'method' => $request->method,
            ]);

            $response = $this->failure(new ApiException(
                500,
                'ICE-SYS-500',
                'Something went wrong on our side. Quote the request id if you contact support.',
            ));
        }

        $requestId = $request->requestId();

        if ($requestId !== '') {
            $response = $response->withMeta('request_id', $requestId)->withHeader('X-Request-Id', $requestId);
        }

        /** @var array<string, string> $extra */
        $extra = $request->attribute('response_headers', []);

        return $extra === [] ? $response : $response->withHeaders($extra);
    }

    private function dispatch(Request $request): Response
    {
        $match = $request->attribute('route_match');

        if (!$match instanceof RouteMatch) {
            throw new ApiException(500, 'ICE-SYS-500', 'The router produced no route for this request.');
        }

        [$class, $method] = $match->route->handler;
        $controller = $this->container->make($class);

        if (!method_exists($controller, $method)) {
            throw new ApiException(500, 'ICE-SYS-500', sprintf('Handler %s::%s is missing.', $class, $method));
        }

        /** @var mixed $result */
        $result = $controller->{$method}($request);

        if (!$result instanceof Response) {
            throw new ApiException(500, 'ICE-SYS-500', sprintf('Handler %s::%s did not return a Response.', $class, $method));
        }

        return $result;
    }

    private function failure(ApiException $error): Response
    {
        $response = Response::envelope($error->toEnvelope(), $error->status());

        if ($error instanceof RateLimitException) {
            $response = $response->withHeader('Retry-After', (string) $error->retryAfter);
        }

        return $response;
    }

    public function config(): Config
    {
        return $this->container->make(Config::class);
    }
}
