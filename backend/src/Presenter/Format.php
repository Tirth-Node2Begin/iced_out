<?php

declare(strict_types=1);

namespace Iced\Presenter;

use DateTimeImmutable;
use DateTimeZone;
use Iced\Domain\Money;

/**
 * The formatting table of spec §7.1, and the only place these strings are made.
 * Everything renders en-IN in Asia/Kolkata regardless of the caller's timezone —
 * X-Client-Timezone is analytics data, never a display input.
 *
 * These outputs are a contract with rendered UI text, so each helper below
 * names the exact shape it produces.
 */
final class Format
{
    private const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    /** Customer-facing money: "₹17,800" — en-IN grouping, no decimals. */
    public static function rupees(Money $money): string
    {
        return '₹' . self::groupIndian($money->rupees());
    }

    /** Console register money: "17800" — a plain integer string. */
    public static function plainAmount(Money $money): string
    {
        return (string) $money->rupees();
    }

    /**
     * Indian digit grouping: last three digits, then pairs.
     * 17800 → "17,800" · 428420 → "4,28,420" · 100000 → "1,00,000"
     */
    public static function groupIndian(int $amount): string
    {
        $sign = $amount < 0 ? '-' : '';
        $digits = (string) abs($amount);

        if (strlen($digits) <= 3) {
            return $sign . $digits;
        }

        $last3 = substr($digits, -3);
        $rest = substr($digits, 0, -3);
        $groups = [];

        while (strlen($rest) > 2) {
            $groups[] = substr($rest, -2);
            $rest = substr($rest, 0, -2);
        }

        if ($rest !== '') {
            $groups[] = $rest;
        }

        return $sign . implode(',', array_reverse($groups)) . ',' . $last3;
    }

    /** Customer order date: "04 Aug 2026". */
    public static function longDate(DateTimeImmutable $moment): string
    {
        $local = self::local($moment);

        return sprintf('%02d %s %s', (int) $local->format('j'), self::month($local), $local->format('Y'));
    }

    /** Ledger timestamp: "04 Aug, 14:32". */
    public static function ledgerStamp(DateTimeImmutable $moment): string
    {
        $local = self::local($moment);

        return sprintf('%02d %s, %s', (int) $local->format('j'), self::month($local), $local->format('H:i'));
    }

    /** Short date: "05 Aug". */
    public static function shortDate(DateTimeImmutable $moment): string
    {
        $local = self::local($moment);

        return sprintf('%02d %s', (int) $local->format('j'), self::month($local));
    }

    /** Support "sent" label: "14 Aug 2026 · 09:18". */
    public static function sentAt(DateTimeImmutable $moment): string
    {
        return self::longDate($moment) . ' · ' . self::local($moment)->format('H:i');
    }

    /** ISO date for vouchers: "2026-08-04". */
    public static function isoDate(DateTimeImmutable $moment): string
    {
        return self::local($moment)->format('Y-m-d');
    }

    /**
     * Delivery estimate window, spaced en dash: "12 – 14 Aug".
     * Used for the customer-facing estimate.
     */
    public static function spacedWindow(DateTimeImmutable $from, DateTimeImmutable $to): string
    {
        $start = self::local($from);
        $end = self::local($to);

        // A window that crosses a month boundary needs both month names, or
        // "30 – 02 Sep" would read as a window that runs backwards.
        if ($start->format('n') !== $end->format('n')) {
            return sprintf('%s – %s', self::shortDate($from), self::shortDate($to));
        }

        return sprintf('%02d – %02d %s', (int) $start->format('j'), (int) $end->format('j'), self::month($end));
    }

    /**
     * Shipment promise window, tight en dash: "08–09 Aug".
     * Used for the console shipment register.
     */
    public static function tightWindow(DateTimeImmutable $from, DateTimeImmutable $to): string
    {
        $start = self::local($from);
        $end = self::local($to);

        if ($start->format('n') !== $end->format('n')) {
            return sprintf('%s–%s', self::shortDate($from), self::shortDate($to));
        }

        return sprintf('%02d–%02d %s', (int) $start->format('j'), (int) $end->format('j'), self::month($end));
    }

    /** Order age: "1 h 04 min" under a day, "2 d 6 h" beyond it. */
    public static function age(DateTimeImmutable $since, DateTimeImmutable $now): string
    {
        $seconds = max(0, $now->getTimestamp() - $since->getTimestamp());
        $hours = intdiv($seconds, 3600);

        if ($hours >= 24) {
            return sprintf('%d d %d h', intdiv($hours, 24), $hours % 24);
        }

        return sprintf('%d h %02d min', $hours, intdiv($seconds % 3600, 60));
    }

    /** Masked customer name for the payments ledger: "Aarav Kapoor" → "A•••• K••••". */
    public static function maskName(string $name): string
    {
        $words = preg_split('/\s+/', trim($name)) ?: [];
        $masked = [];

        foreach ($words as $word) {
            if ($word === '') {
                continue;
            }

            $masked[] = mb_substr($word, 0, 1) . '••••';
        }

        return implode(' ', $masked);
    }

    /** Machine timestamp for OrderRecord.placedAt — epoch milliseconds. */
    public static function epochMillis(DateTimeImmutable $moment): int
    {
        return (int) $moment->format('Uv');
    }

    /**
     * A stored DATETIME(6) back into a UTC moment. Every presenter reads
     * timestamps through this, so none of them re-guesses the storage format.
     */
    public static function parse(?string $stored): ?DateTimeImmutable
    {
        if ($stored === null || $stored === '') {
            return null;
        }

        $utc = new DateTimeZone('UTC');
        $moment = DateTimeImmutable::createFromFormat('Y-m-d H:i:s.u', $stored, $utc)
            ?: DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $stored, $utc)
            ?: DateTimeImmutable::createFromFormat('Y-m-d', $stored, $utc);

        return $moment === false ? null : $moment;
    }

    private static function local(DateTimeImmutable $moment): DateTimeImmutable
    {
        return $moment->setTimezone(new DateTimeZone('Asia/Kolkata'));
    }

    private static function month(DateTimeImmutable $local): string
    {
        return self::MONTHS[(int) $local->format('n') - 1];
    }
}
