<?php

declare(strict_types=1);

namespace Iced\Integration\BackgroundRemoval;

/**
 * Bound automatically whenever REMOVE_BG_API_KEY is blank.
 *
 * It refuses rather than returns the image untouched. Handing back the original
 * would put a photograph with its background still in it onto the home page as
 * though it were a cutout, and the operator would have no way to tell — the one
 * failure mode worth being loud about.
 */
final class UnconfiguredBackgroundRemover implements BackgroundRemover
{
    public const NOTE = 'Background removal is not connected — set REMOVE_BG_API_KEY in backend/.env.';

    public function cutout(string $bytes, string $filename): string
    {
        throw new BackgroundRemovalFailed(self::NOTE);
    }

    public function isConfigured(): bool
    {
        return false;
    }

    public function name(): string
    {
        return 'remove.bg';
    }
}
