<?php

declare(strict_types=1);

namespace Iced\Support\Cache;

use RuntimeException;

/**
 * The counter store could not be used at all.
 *
 * Raised only where the alternative is worse than an error. `FileCacheStore::hit`
 * used to answer `count: 1` when it could not open its file — an honest-looking
 * value that means "first request in the window", so an unwritable
 * `storage/cache` did not break anything: it silently switched EVERY rate limit
 * in the application off. Login throttling, the gateway bucket, the checkout
 * bucket, all reporting one hit forever, with nothing in a log to say so.
 *
 * A permissions change on a deployment is enough to cause it, and the symptom is
 * indistinguishable from a quiet shop.
 *
 * So the store says it cannot count, and the caller decides what that means.
 * `RateLimiter` catches this and reports `available: false`; the two rate-limit
 * middlewares then fail CLOSED for the buckets that guard credentials and money,
 * and open for the ones that merely protect a catalogue from being read too
 * enthusiastically. Refusing to serve product listings because a cache directory
 * is unwritable would be its own outage.
 */
final class CacheUnavailable extends RuntimeException
{
}
