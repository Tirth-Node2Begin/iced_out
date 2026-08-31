<?php

declare(strict_types=1);

namespace Iced\Controller\System;

use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Repository\MediaRepository;
use Iced\Service\Media\MediaService;

/**
 * Spec §8.31 — media, READ half.
 *
 * Reading is public but indirect: the URL names an asset id, this controller
 * looks up where it actually lives, and the bytes are served with a content
 * type this server decided and `nosniff` set. Nothing under storage/media is
 * web-reachable.
 *
 * The upload half (POST /admin/media) went to the CRM backend along with the
 * rest of the console, which is why this class is `Controller\System` now
 * rather than `Controller\Console`: the storefront has no console to belong to,
 * and this endpoint answers every shopper looking at a product photo.
 *
 * ⚠ Both deployables must resolve MEDIA_ROOT to the SAME directory. The CRM
 * writes the bytes; this serves them. Two folders means every photo uploaded in
 * the CRM 404s here, with nothing to warn you — see the CRM's .env.example.
 */
final class MediaController
{
    public function __construct(
        private readonly MediaService $media,
        private readonly MediaRepository $assets,
    ) {
    }

    /** GET /media/{id} — the only way bytes leave storage/media. */
    public function show(Request $request): Response
    {
        $asset = $this->assets->find($request->routeParam('id'));

        if ($asset === null) {
            throw new NotFoundException('ICE-MEDIA-404', 'We could not find that image.');
        }

        $path = $this->media->absolutePath((string) $asset['storage_key']);

        if (!is_file($path)) {
            throw new NotFoundException('ICE-MEDIA-404', 'We could not find that image.');
        }

        $bytes = file_get_contents($path);

        if ($bytes === false) {
            throw new NotFoundException('ICE-MEDIA-404', 'We could not find that image.');
        }

        return Response::raw($bytes, (string) $asset['mime'], 200, [
            // Content-addressed by a random id, so it can be cached hard.
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'Content-Disposition' => 'inline',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
