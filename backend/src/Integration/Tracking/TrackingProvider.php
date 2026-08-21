<?php

declare(strict_types=1);

namespace Iced\Integration\Tracking;

/**
 * The seam for the third-party delivery-tracking API (spec §9.8).
 *
 * Per the project decision of 2026-08-14, live tracking is NOT built in-house.
 * The backend owns fulfilment (shipments, dispatch, the console state machine,
 * pickups, labels, tokens) and delegates courier scans, in-transit status, EDD
 * refresh and NDR detection to whichever provider is supplied later.
 */
interface TrackingProvider
{
    public function fetch(string $awb, string $carrier): TrackingSnapshot;

    /** False while the placeholder is bound — endpoints report this honestly rather than faking a refresh. */
    public function isConnected(): bool;
}
