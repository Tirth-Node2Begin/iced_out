<?php

declare(strict_types=1);

namespace Iced\Integration\BackgroundRemoval;

/**
 * The seam for the third-party cutout API.
 *
 * One method, and it is deliberately about BYTES rather than about files or
 * media ids: what the store does with the result — re-encode it, cap it, give
 * it an id, hang it off a slide — is this application's business, and a
 * provider that knew any of that could not be swapped.
 */
interface BackgroundRemover
{
    /**
     * The same image with its background removed, as PNG bytes with an alpha
     * channel.
     *
     * @param string $bytes    the original photograph
     * @param string $filename what to call it in the upload; providers use the
     *                         extension as a hint and some reject a blank name
     *
     * @throws BackgroundRemovalFailed
     */
    public function cutout(string $bytes, string $filename): string;

    /**
     * False while no credential is configured.
     *
     * Endpoints report this honestly rather than pretending a cutout is coming:
     * the console says the key is missing, the slide is saved with its original
     * photograph, and nothing is invented.
     */
    public function isConfigured(): bool;

    /** For the console — "remove.bg", so a screen can name what it is waiting on. */
    public function name(): string;
}
