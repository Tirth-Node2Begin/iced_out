<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Repository\MediaRepository;
use Iced\Service\Media\MediaService;

/**
 * Spec §8.31 — media.
 *
 * Upload is staff-only and permissioned; reading is public but indirect: the
 * URL names an asset id, this controller looks up where it actually lives, and
 * the bytes are served with a content type this server decided and `nosniff`
 * set. Nothing under storage/media is web-reachable.
 */
final class MediaController
{
    public function __construct(
        private readonly MediaService $media,
        private readonly MediaRepository $assets,
    ) {
    }

    /** #178 POST /admin/media — multipart upload from the console. */
    public function upload(Request $request): Response
    {
        /** @var array<string, mixed> $files */
        $files = $request->files;
        /** @var array<string, mixed> $file */
        $file = $files['file'] ?? $files['photo'] ?? $files['image'] ?? [];

        $owner = $request->queryString('owner_type', 'stock_item');

        // Uploaded before the record exists, so it starts unowned and is claimed
        // when the form that requested it is saved.
        $stored = $this->media->store($file, $owner, null);

        $request->setAttribute('audit_entity_type', 'media');
        $request->setAttribute('audit_entity_id', $stored['media_id']);

        return Response::data($stored, 201);
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
