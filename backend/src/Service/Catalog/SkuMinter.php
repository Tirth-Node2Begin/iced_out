<?php

declare(strict_types=1);

namespace Iced\Service\Catalog;

/**
 * Slugs and SKUs, minted the way `02-products/catalog-seed.ts` mints them.
 *
 * Operators never type either: they answer for the name, and the catalogue
 * files the record. A minted code is held for good — a colour renamed on a
 * variant that has already shipped must not silently re-label what is in the box.
 */
final class SkuMinter
{
    public static function slugify(string $name): string
    {
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT', $name);
        $ascii = $ascii === false ? $name : $ascii;

        $slug = strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', $ascii));

        return trim($slug, '-');
    }

    /**
     * @param iterable<string> $taken
     */
    public static function slug(string $name, iterable $taken): string
    {
        $base = self::slugify($name);

        return self::firstFree($base === '' ? 'record' : $base, $taken, static fn (string $root, int $n): string => $root . '-' . $n);
    }

    /**
     * The three-character stock code a product's SKUs are built from.
     *
     * Initials first — "Core Heavy Tee" is CHT. A two-word name is filled out
     * with the next consonant of the first word rather than a letter nobody
     * would guess, and the filler is inserted after the first letter: AFH reads
     * as a code for "Afterdark Hoodie"; AHF reads as a typo.
     */
    public static function skuCode(string $name): string
    {
        preg_match_all('/[A-Z0-9]+/', strtoupper($name), $matches);
        /** @var list<string> $words */
        $words = $matches[0];

        $initials = implode('', array_map(static fn (string $word): string => $word[0], $words));

        if (strlen($initials) >= 3) {
            return substr($initials, 0, 3);
        }

        $rest = substr($words[0] ?? '', 1);
        $filler = (string) preg_replace('/[AEIOU]/', '', $rest) . $rest . 'XXX';
        $need = 3 - strlen($initials);

        return substr($initials, 0, 1) . substr($filler, 0, $need) . substr($initials, 1);
    }

    /** @param iterable<string> $taken */
    public static function sku(string $name, iterable $taken): string
    {
        $base = self::skuCode($name);

        return self::firstFree($base === '' ? 'SKU' : $base, $taken, static fn (string $root, int $n): string => $root . $n);
    }

    /** `ADH-WSB-L` reads on a picking slip without a lookup, which is the whole job. */
    public static function variantSku(string $productSku, string $colour, string $size): string
    {
        return implode('-', [
            $productSku === '' ? 'SKU' : $productSku,
            $colour === '' ? 'GEN' : $colour,
            $size === '' ? 'OS' : $size,
        ]);
    }

    /** @param iterable<string> $taken */
    public static function uniqueVariantSku(string $productSku, string $colourCode, string $size, iterable $taken): string
    {
        return self::firstFree(
            self::variantSku($productSku, $colourCode, $size),
            $taken,
            static fn (string $root, int $n): string => $root . '-' . $n,
        );
    }

    /**
     * @param iterable<string>                 $taken
     * @param callable(string, int): string    $join
     */
    private static function firstFree(string $base, iterable $taken, callable $join): string
    {
        $used = [];

        foreach ($taken as $entry) {
            $used[$entry] = true;
        }

        if (!isset($used[$base])) {
            return $base;
        }

        $n = 2;

        while (isset($used[$join($base, $n)])) {
            ++$n;
        }

        return $join($base, $n);
    }
}
