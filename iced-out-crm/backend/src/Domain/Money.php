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

    /**
     * A percentage of this amount, as WHOLE RUPEES, rounded half-up.
     *
     * ── WHY THIS IS NOT `intdiv($this->paise * $percent, 100)` ──────────────
     *
     * That is what it used to be, and it floored to PAISE. Its docblock claimed
     * it rounded down "matching the frontend's discountFor()", and the frontend
     * does no such thing — `coupons.ts` computes in rupees and rounds half-up.
     * The two disagreed by up to a rupee on any subtotal where the percentage
     * did not divide evenly.
     *
     * That drift was survivable while nothing compared the figures precisely.
     * `crossCheckMoney()` compares `->rupees()`, so it could not see it, and the
     * shopper was simply charged whatever the browser said.
     *
     * It stopped being survivable the moment payment intents began matching
     * `amount_paise` EXACTLY. A ₹7,999 bag with a 10% code gave the browser
     * ₹7,199 (so an intent for 719900 paise) and the server ₹7,199.10 (719910
     * paise). No intent could ever match, so a genuine shopper was charged and
     * their order was written "Payment failed" — or, when the rupee figures also
     * differed, refused outright with ICE-CHK-409 after the card had cleared,
     * leaving no order row at all and therefore no signal.
     *
     * So the server now computes what the browser computes: whole rupees,
     * half-up. Every price, fee and discount in this application is a whole
     * number of rupees, which is what makes the gateway amount expressible and
     * the intent check meaningful.
     *
     * `+ 5000` before dividing by 10000 is half-up on the rupee: the discount in
     * paise is `paise * percent / 100`, and turning that into rounded rupees is
     * `paise * percent / 10000`.
     */
    public function percentRounded(int $percent): self
    {
        $rupees = intdiv($this->paise * $percent + 5000, 10000);

        return new self($rupees * 100, $this->currency);
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
