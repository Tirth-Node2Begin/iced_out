<?php

declare(strict_types=1);

namespace Iced\Support;

use JsonException;

final class Json
{
    public const ENCODE_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;

    public static function encode(mixed $value): string
    {
        try {
            return json_encode($value, self::ENCODE_FLAGS | JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return '{}';
        }
    }

    /** @return array<array-key, mixed>|null */
    public static function decodeArray(string $raw): ?array
    {
        if (trim($raw) === '') {
            return [];
        }

        try {
            $decoded = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }

        return is_array($decoded) ? $decoded : null;
    }
}
