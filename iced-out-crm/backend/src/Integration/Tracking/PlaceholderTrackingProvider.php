<?php

declare(strict_types=1);

namespace Iced\Integration\Tracking;

/**
 * TODO(EXTERNAL-TRACKING-API): replace with the real client once the provider's
 * docs and credentials arrive. Bound automatically whenever
 * TRACKING_API_BASE_URL is blank.
 *
 * Until then it returns nothing at all: /track and the shipment views fall back
 * to the internally known state (Dispatched/Delivered from console actions)
 * with an empty courier-event tail. Pages render; nothing is invented.
 */
final class PlaceholderTrackingProvider implements TrackingProvider
{
    public const NOTE = 'External tracking API not yet connected';

    public function fetch(string $awb, string $carrier): TrackingSnapshot
    {
        return TrackingSnapshot::empty(self::NOTE);
    }

    public function isConnected(): bool
    {
        return false;
    }
}
