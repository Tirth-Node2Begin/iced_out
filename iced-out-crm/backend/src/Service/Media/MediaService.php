<?php

declare(strict_types=1);

namespace Iced\Service\Media;

use GdImage;
use Iced\Kernel\Exception\ValidationException;
use Iced\Repository\MediaRepository;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Clock;

/**
 * Uploads, handled the way spec §14 requires:
 *
 *   · the MIME is SNIFFED, never taken from the request — a browser-supplied
 *     content type is an attacker-supplied content type;
 *   · the image is RE-ENCODED rather than copied, which strips EXIF and any
 *     payload smuggled in a comment block, and guarantees the bytes on disk are
 *     the image they claim to be;
 *   · the storage key is RANDOM, so nothing under storage/media is guessable
 *     or reachable by walking a predictable path;
 *   · nothing is ever served from the filesystem path directly — reads go
 *     through the media endpoint, which sets its own content type and nosniff.
 *
 * Size caps and the allowed formats are settings, so tightening them is an
 * operator action.
 */
final class MediaService
{
    /** Extensions are decided here, from the sniffed type — never from the filename. */
    private const ENCODERS = [
        'image/jpeg' => ['ext' => 'jpg', 'type' => IMAGETYPE_JPEG],
        'image/png' => ['ext' => 'png', 'type' => IMAGETYPE_PNG],
        'image/webp' => ['ext' => 'webp', 'type' => IMAGETYPE_WEBP],
    ];

    /** The formats that carry an alpha channel, and so must not be flattened. */
    private const TRANSPARENT = ['image/png', 'image/webp'];

    public function __construct(
        private readonly MediaRepository $media,
        private readonly StoreSettings $settings,
        private readonly Clock $clock,
        private readonly string $root,
    ) {
    }

    /**
     * @param array<string, mixed> $file one entry of $_FILES
     *
     * @return array{media_id: string, url: string, width: int, height: int, bytes: int}
     *
     * @throws ValidationException
     */
    public function store(array $file, string $ownerType, ?int $ownerId, string $capKey = 'media.max_bytes_console'): array
    {
        $error = is_int($file['error'] ?? null) ? $file['error'] : UPLOAD_ERR_NO_FILE;

        if ($error === UPLOAD_ERR_NO_FILE) {
            throw ValidationException::field('file', 'Choose an image to upload.', 'ICE-MEDIA-422');
        }

        if ($error !== UPLOAD_ERR_OK) {
            throw ValidationException::field('file', 'That upload did not complete. Please try again.', 'ICE-MEDIA-422');
        }

        $temporary = is_string($file['tmp_name'] ?? null) ? $file['tmp_name'] : '';

        if ($temporary === '' || !is_readable($temporary)) {
            throw ValidationException::field('file', 'That upload could not be read.', 'ICE-MEDIA-422');
        }

        $cap = $this->settings->int($capKey, 8_388_608);
        $bytes = (int) (filesize($temporary) ?: 0);

        if ($bytes > $cap) {
            throw ValidationException::field(
                'file',
                sprintf('That image is larger than the %d MB limit.', max(1, intdiv($cap, 1_048_576))),
                'ICE-MEDIA-422',
            );
        }

        // Sniff. getimagesize reads the actual header, so a .jpg that is really
        // a script fails here rather than landing on disk.
        $probe = @getimagesize($temporary);

        if ($probe === false || !isset($probe['mime'])) {
            throw ValidationException::field('file', 'That file is not an image.', 'ICE-MEDIA-422');
        }

        return $this->persist(
            (string) file_get_contents($temporary),
            $this->assertStorable((string) $probe['mime']),
            $ownerType,
            $ownerId,
        );
    }

    /**
     * The same pipeline for bytes this server produced rather than received —
     * today, the cutout remove.bg hands back.
     *
     * It still sniffs and still re-encodes. Not because the provider is
     * suspected, but because "trusted source" is exactly the assumption that
     * rots: the caller here is a network reply, what separates it from an
     * upload is a configuration value, and a store that re-encodes one and not
     * the other has two different answers to what is on its disk.
     *
     * @return array{media_id: string, url: string, width: int, height: int, bytes: int}
     *
     * @throws ValidationException
     */
    public function storeBytes(string $bytes, string $ownerType, ?int $ownerId): array
    {
        $probe = @getimagesizefromstring($bytes);

        if ($probe === false || !isset($probe['mime'])) {
            throw ValidationException::field('file', 'That image could not be read.', 'ICE-MEDIA-422');
        }

        return $this->persist($bytes, $this->assertStorable((string) $probe['mime']), $ownerType, $ownerId);
    }

    /**
     * @return string the sniffed MIME, once it is one this store will write
     *
     * @throws ValidationException
     */
    private function assertStorable(string $mime): string
    {
        $allowed = $this->settings->vocabulary('media.allowed_mime', array_keys(self::ENCODERS));

        if (!in_array($mime, $allowed, true) || !isset(self::ENCODERS[$mime])) {
            throw ValidationException::field(
                'file',
                sprintf('Upload a %s image.', implode(', ', array_map(
                    static fn (string $type): string => strtoupper(substr($type, 6)),
                    $allowed,
                ))),
                'ICE-MEDIA-422',
            );
        }

        return $mime;
    }

    /**
     * Decode → bound → re-encode → record. The one path to disk, shared by an
     * upload and by anything this server generates for itself.
     *
     * @return array{media_id: string, url: string, width: int, height: int, bytes: int}
     *
     * @throws ValidationException
     */
    private function persist(string $bytes, string $mime, string $ownerType, ?int $ownerId): array
    {
        $source = @imagecreatefromstring($bytes);

        if ($source === false) {
            throw ValidationException::field('file', 'That image could not be read.', 'ICE-MEDIA-422');
        }

        $this->keepAlpha($source, $mime);

        $maxEdge = $this->settings->int('media.max_edge', 1600);
        $width = imagesx($source);
        $height = imagesy($source);

        if (max($width, $height) > $maxEdge) {
            $scaled = imagescale($source, $width >= $height ? $maxEdge : (int) round($width * $maxEdge / $height));

            if ($scaled !== false) {
                imagedestroy($source);
                $source = $scaled;
                /* imagescale returns a fresh image carrying its own flags, so
                   the transparency has to be declared again on it — otherwise
                   the resize is where a cutout quietly gains a black
                   background. */
                $this->keepAlpha($source, $mime);
                $width = imagesx($source);
                $height = imagesy($source);
            }
        }

        $key = sprintf(
            '%s/%s.%s',
            $this->clock->display($this->clock->now())->format('Y/m'),
            bin2hex(random_bytes(16)),
            self::ENCODERS[$mime]['ext'],
        );

        $path = $this->root . '/' . $key;
        $directory = dirname($path);

        if (!is_dir($directory)) {
            mkdir($directory, 0775, true);
        }

        $quality = $this->settings->int('media.quality', 82);

        $written = match ($mime) {
            'image/png' => imagepng($source, $path, 6),
            'image/webp' => imagewebp($source, $path, $quality),
            default => imagejpeg($source, $path, $quality),
        };

        imagedestroy($source);

        if ($written === false) {
            throw ValidationException::field('file', 'That image could not be saved.', 'ICE-MEDIA-422');
        }

        $publicId = 'med-' . bin2hex(random_bytes(8));

        $this->media->insert([
            'public_id' => $publicId,
            'owner_type' => $ownerType,
            'owner_id' => $ownerId,
            'storage_key' => $key,
            'mime' => $mime,
            'bytes' => (int) (filesize($path) ?: 0),
            'width' => $width,
            'height' => $height,
            'checksum' => hash_file('sha256', $path) ?: '',
        ]);

        return [
            'media_id' => $publicId,
            'url' => self::url($publicId),
            'width' => $width,
            'height' => $height,
            'bytes' => (int) (filesize($path) ?: 0),
        ];
    }

    /**
     * Carries a transparent image's alpha channel through the re-encode.
     *
     * GD defaults to blending: it composites incoming pixels onto whatever is
     * already in the canvas and writes no alpha channel on save, which turns
     * every transparent pixel opaque black. Blending off plus save-alpha on is
     * the pair that makes a PNG come back out the way it went in.
     *
     * Without it a remove.bg cutout would land on the home page as a garment on
     * a black rectangle — which is indistinguishable from a broken image, and
     * would have made this whole feature look like it did not work.
     *
     * JPEG has no alpha to keep and asking GD to write one produces a warning
     * rather than a better file, so it is skipped there.
     */
    private function keepAlpha(GdImage $image, string $mime): void
    {
        if (!in_array($mime, self::TRANSPARENT, true)) {
            return;
        }

        imagealphablending($image, false);
        imagesavealpha($image, true);
    }

    /** Assets are addressed by their public id, never by their path on disk. */
    public static function url(?string $publicId): ?string
    {
        return $publicId === null || $publicId === '' ? null : '/api/v1/media/' . $publicId;
    }

    public function absolutePath(string $storageKey): string
    {
        return $this->root . '/' . $storageKey;
    }
}
