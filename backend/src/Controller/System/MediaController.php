<?php

declare(strict_types=1);

namespace Iced\Controller\System;

use Iced\Domain\Principal;
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

               PRIVATE media is not, and the difference matters: `public` in a
               Cache-Control header authorises SHARED caches — a CDN, a corporate
               proxy — to keep a copy and serve it to whoever asks next, without
               the session check below ever running again. `private, no-store` is
               what keeps the authorisation meaningful. */
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
     * ── WHY THIS EXISTS WHEN NOTHING IS CURRENTLY EXPOSED ───────────────────
     *
     * Every asset id is `med-` plus sixteen hex characters from
     * `random_bytes(8)`. Sixty-four bits is not enumerable, so no customer photo
     * is reachable today by guessing, and the audit found nothing leaking.
     *
     * But an unguessable URL is a CAPABILITY, not an authorisation. Anyone ever
     * handed the link keeps it — a screenshot, a support ticket, a referrer
     * header — and there is no way to take it back short of deleting the file.
     * For product photography that is exactly the trade the store wants. For a
     * customer's face it is not.
     *
     * ── 404, NOT 403 ────────────────────────────────────────────────────────
     *
     * A refusal must not confirm the id exists, or this endpoint becomes an
     * oracle: hand it an id and learn whether it is somebody's private photo.
     * The answer is the same sentence a missing asset gets.
     *
     * ── STAFF ARE NOT ALLOWED THROUGH HERE ──────────────────────────────────
     *
     * This is the STOREFRONT's media route, and its audience is public — a staff
     * principal is never resolved on it. The console has its own copy for its own
     * screens. Adding a staff bypass here would mean this public endpoint had to
     * reason about console permissions, which is exactly the coupling the two
     * deployables exist to avoid.
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
           declares an audience and carries a cookie — best-effort, never a
           failure. That is what makes an owner check possible on a public
           route at all. */
        if (!$principal instanceof Principal
            || $asset['owner_id'] === null
            || (int) $asset['owner_id'] !== $principal->userId) {
            throw new NotFoundException('ICE-MEDIA-404', 'We could not find that image.');
        }
    }
}
