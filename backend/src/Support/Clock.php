<?php

declare(strict_types=1);

namespace Iced\Support;

use DateTimeImmutable;
use DateTimeZone;

/**
 * Every timestamp in the system comes from here. Storage is UTC DATETIME(6);
 * display formatting is Asia/Kolkata and happens only in presenters (spec §7.1).
 */
class Clock
{
    public const STORAGE_FORMAT = 'Y-m-d H:i:s.u';

    public function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }

    public function nowString(): string
    {
        return $this->now()->format(self::STORAGE_FORMAT);
    }

    public function nowMillis(): int
    {
        return (int) $this->now()->format('Uv');
    }

    public function display(DateTimeImmutable $moment): DateTimeImmutable
    {
        return $moment->setTimezone(new DateTimeZone('Asia/Kolkata'));
    }

    public function addSeconds(int $seconds, ?DateTimeImmutable $from = null): DateTimeImmutable
    {
        return ($from ?? $this->now())->modify(sprintf('%+d seconds', $seconds));
    }
}
