<?php

declare(strict_types=1);

namespace Iced\Domain;

use InvalidArgumentException;

/**
 * Money is integer paise inside the app, DECIMAL(12,2) in the database, and a
 * formatted string only at the presenter edge (spec §1.8). Floats never touch
 * it — every arithmetic operation here is integer arithmetic.
 */
final class Money
{
    private function __construct(
        public readonly int $paise,
        public readonly string $currency,
    ) {
    }

    public static function fromPaise(int $paise, string $currency = 'INR'): self
    {
        return new self($paise, $currency);
    }

    public static function fromRupees(int $rupees, string $currency = 'INR'): self
    {
        return new self($rupees * 100, $currency);
    }

    /** Reads a DECIMAL(12,2) column string without ever going through a float. */
    public static function fromDecimalString(string $decimal, string $currency = 'INR'): self
    {
        $trimmed = trim($decimal);

        if ($trimmed === '') {
            return new self(0, $currency);
        }

        if (preg_match('/^(-?)(\d+)(?:\.(\d{1,2}))?$/', $trimmed, $matches) !== 1) {
            throw new InvalidArgumentException(sprintf('"%s" is not a decimal amount.', $decimal));
        }

        $fraction = str_pad($matches[3] ?? '', 2, '0');
        $paise = (int) $matches[2] * 100 + (int) $fraction;

        return new self($matches[1] === '-' ? -$paise : $paise, $currency);
    }

    public function plus(self $other): self
    {
        $this->assertSameCurrency($other);

        return new self($this->paise + $other->paise, $this->currency);
    }

    public function minus(self $other): self
    {
        $this->assertSameCurrency($other);

        return new self($this->paise - $other->paise, $this->currency);
    }

    public function times(int $factor): self
    {
        return new self($this->paise * $factor, $this->currency);
    }

    /** Percent discounts round DOWN, matching the frontend's discountFor(). */
    public function percentFloor(int $percent): self
    {
        return new self(intdiv($this->paise * $percent, 100), $this->currency);
    }

    public function clampTo(self $ceiling): self
    {
        $this->assertSameCurrency($ceiling);

        return new self(min($this->paise, $ceiling->paise), $this->currency);
    }

    public function atLeastZero(): self
    {
        return new self(max(0, $this->paise), $this->currency);
    }

    public function isZero(): bool
    {
        return $this->paise === 0;
    }

    public function isGreaterThan(self $other): bool
    {
        $this->assertSameCurrency($other);

        return $this->paise > $other->paise;
    }

    /** Whole rupees — what the catalogue and the UI's `price: number` speak. */
    public function rupees(): int
    {
        return intdiv($this->paise, 100);
    }

    /** The DECIMAL(12,2) literal for storage. */
    public function toDecimalString(): string
    {
        $sign = $this->paise < 0 ? '-' : '';
        $absolute = abs($this->paise);

        return sprintf('%s%d.%02d', $sign, intdiv($absolute, 100), $absolute % 100);
    }

    private function assertSameCurrency(self $other): void
    {
        if ($other->currency !== $this->currency) {
            throw new InvalidArgumentException(sprintf(
                'Cannot mix %s and %s.',
                $this->currency,
                $other->currency,
            ));
        }
    }
}
