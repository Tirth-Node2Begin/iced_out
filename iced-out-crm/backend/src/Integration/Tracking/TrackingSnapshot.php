<?php

declare(strict_types=1);

namespace Iced\Integration\Tracking;

/**
 * What a courier knows about a parcel. Everything here comes from the external
 * tracking API — the backend never fabricates a status or an event.
 */
final class TrackingSnapshot
{
    /** @param list<array{label: string, detail: string, time: string, complete: bool}> $events */
    public function __construct(
        public readonly ?string $status,
        public readonly ?string $estimate,
        public readonly array $events,
        public readonly bool $fromProvider,
        public readonly string $note = '',
    ) {
    }

    public static function empty(string $note = ''): self
    {
        return new self(null, null, [], false, $note);
    }
}
