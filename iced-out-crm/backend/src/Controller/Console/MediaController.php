<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Principal;
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

        $this->assertVisible($request, $asset);

        $path = $this->media->absolutePath((string) $asset['storage_key']);

        if (!is_file($path)) {
            throw new NotFoundException('ICE-MEDIA-404', 'We could not find that image.');
        }

        $bytes = file_get_contents($path);

        if ($bytes === false) {
            throw new NotFoundException('ICE-MEDIA-404', 'We could not find that image.');
        }

        $private = (string) ($asset['visibility'] ?? 'public') === 'private';

        return Response::raw($bytes, (string) $asset['mime'], 200, [
            /* Public media is content-addressed by an unguessable id and never
               changes, so it is cached as hard as HTTP allows.

               PRIVATE media is not. `public` in a Cache-Control header
               authorises SHARED caches — a CDN, a corporate proxy — to keep a
               copy and hand it to whoever asks next, without the check below
               ever running again. That would undo the authorisation one hop
               outside the application. */
            'Cache-Control' => $private
                ? 'private, no-store'
                : 'public, max-age=31536000, immutable',
            'Content-Disposition' => 'inline',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Refuses media that is not this caller's to see.
     *
     * ── THIS IS THE COPY THAT RUNS ──────────────────────────────────────────
     *
     * `config/routes/media.php` routes both `POST /admin/media` and
     * `GET /media/{id}` to THIS class. A sibling `Controller\System\
     * MediaController` also exists in this deployable, carrying an identical
     * check, and nothing references it — so for a while the console served every
     * private asset to anonymous callers while a thoroughly documented guard sat
     * one directory away, never executing. Routing decides which code is real.
     *
     * ── STAFF ARE ALLOWED THROUGH, AND ONLY HERE ────────────────────────────
     *
     * Support answers questions about the person whose face is on the screen,
     * and a customer record rendering a broken image would be a worse tool for
     * no security gain — staff can already read that customer's name, email,
     * address and order history two panels away.
     *
     * The STOREFRONT's copy has no staff branch at all, because a public shop
     * endpoint must not reason about console permissions.
     *
     * ── 404, NOT 403 ────────────────────────────────────────────────────────
     *
     * A refusal must not confirm the id exists, or this becomes an oracle: hand
     * it an id and learn whether it is somebody's private photo.
     *
     * @param array<string, mixed> $asset
     */
    private function assertVisible(Request $request, array $asset): void
    {
        if ((string) ($asset['visibility'] ?? 'public') !== 'private') {
            return;
        }

        $principal = $request->attribute('principal');

        /* `Authenticate` resolves a principal on public routes when the client
           declares an audience and carries the matching cookie — best-effort,
           never a failure. That is what makes an owner check possible on a route
           whose audience is public. */
        if (!$principal instanceof Principal) {
            throw new NotFoundException('ICE-MEDIA-404', 'We could not find that image.');
        }

        if ($principal->isStaff()) {
            return;
        }

        if ($asset['owner_id'] === null || (int) $asset['owner_id'] !== $principal->userId) {
            throw new NotFoundException('ICE-MEDIA-404', 'We could not find that image.');
        }
    }
}
