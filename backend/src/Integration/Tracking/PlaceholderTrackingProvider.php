<?php

declare(strict_types=1);

namespace Iced\Integration\Tracking;

/**
 * The provider bound when this server has no courier credentials.
 *
 * `IthinkLogisticsTrackingProvider` is the real client; this one takes over
 * whenever ITHINK_ACCESS_TOKEN or ITHINK_SECRET_KEY is blank — a developer
 * machine, a fresh checkout, a staging box nobody has issued keys for.
 *
 * It returns nothing at all: the shipment views fall back to the internally
 * known state (Dispatched/Delivered from console actions) with an empty
 * courier-event tail. Pages render; nothing is invented. That last part is the
 * whole point of having this class rather than binding the real client with
 * empty strings — "we have not asked anyone" and "the courier has no scans" are
 * different facts, and a shipment screen must not show one as the other.
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
