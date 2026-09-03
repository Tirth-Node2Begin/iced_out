<?php

declare(strict_types=1);

use Iced\Kernel\Container;
use Iced\Kernel\Database;
use Iced\Service\Media\MediaService;

/**
 * Gives every product and stock item a real photograph.
 *
 * ── THE PROBLEM ─────────────────────────────────────────────────────────────
 *
 * The shop shipped five photographs and drew every one of its tiles as a CSS CROP
 * of one of them — `object-position: 25% 75%` with a scale, cut at render time in
 * the browser. Nothing was ever a file. So the inventory register, which shows an
 * item's photo from `stock_items.image_media_id`, had nothing to show for any of
 * the thirty-two items, and neither did the product register.
 *
 * ── WHAT THIS DOES ──────────────────────────────────────────────────────────
 *
 * Cuts each of those crops ONCE, as a real image, and stores it the way an upload
 * is stored: through `MediaService::store`, which sniffs the type, caps the size,
 * caps the longest edge, re-encodes it and writes the `media_assets` row. An
 * imported photo is therefore indistinguishable from one an operator uploaded —
 * same table, same guarded endpoint, same delete behaviour — and can be replaced
 * from the console like any other.
 *
 * The crop regions are the ones the tiles were already using, so a product looks
 * like what it looked like before; it is simply a picture now rather than an
 * instruction to a stylesheet.
 *
 * The same asset is attached to BOTH the product and the stock item behind it,
 * because they are one garment photographed once.
 *
 * ── IDEMPOTENCE ─────────────────────────────────────────────────────────────
 *
 * A piece that already has an image is skipped. Re-running costs nothing, and a
 * photo an operator uploaded is never overwritten by the seeded crop.
 *
 * Runs last, because it needs the products and stock items to exist.
 */
return static function (Container $container): string {
    /** @var Database $db */
    $db = $container->get(Database::class);
    /** @var MediaService $media */
    $media = $container->get(MediaService::class);

    /** @var list<array<string, mixed>> $catalogue */
    $catalogue = require __DIR__ . '/data/catalogue.php';

    /**
     * Where the source photographs live.
     *
     * In the repository that is the frontend's `public/` folder — they are the
     * shop's own art, and this is the one place the two halves of the project
     * share a file. A deployed backend has no frontend beside it, so the live
     * bundle carries the handful of sheets this seed actually cuts from in
     * `seeds/data/images/` and that is checked second. Neither present ⇒ the
     * seed says so and does nothing rather than failing.
     */
    $images = '';

    foreach ([dirname(__DIR__, 2) . '/frontend/public/images', __DIR__ . '/data/images'] as $candidate) {
        if (is_dir($candidate)) {
            $images = $candidate;

            break;
        }
    }

    /**
     * The crop library, mirroring `components/gender/data.ts`.
     *
     * The pair is the point the crop centres on, as a fraction of the source; the
     * last number is how far in. A zoom of 2 takes a quarter of the frame — which
     * on the 2x2 contact sheet is exactly one garment.
     */
    $crops = [
        'hoodie' => ['drop-001-products.webp', 0.25, 0.25, 2.0],
        'overshirt' => ['drop-001-products.webp', 0.75, 0.25, 2.0],
        'cargo' => ['drop-001-products.webp', 0.25, 0.75, 2.0],
        'tee' => ['drop-001-products.webp', 0.75, 0.75, 2.0],
        'hoodieWide' => ['drop-001-products.webp', 0.25, 0.25, 1.6],
        'overshirtWide' => ['drop-001-products.webp', 0.75, 0.25, 1.6],
        'cargoWide' => ['drop-001-products.webp', 0.25, 0.75, 1.6],
        'teeWide' => ['drop-001-products.webp', 0.75, 0.75, 1.6],

        'stillHoodie' => ['product-still-life-v2.webp', 0.43, 0.46, 2.4],
        'stillJacket' => ['product-still-life-v2.webp', 0.72, 0.38, 2.4],
        'stillCargo' => ['product-still-life-v2.webp', 0.70, 0.78, 2.4],
        'stillPouch' => ['product-still-life-v2.webp', 0.21, 0.85, 2.9],
        'stillHardware' => ['product-still-life-v2.webp', 0.14, 0.60, 3.4],
        'stillCollar' => ['product-still-life-v2.webp', 0.66, 0.20, 3.2],
        'stillFlat' => ['product-still-life-v2.webp', 0.52, 0.52, 1.25],

        'campWoman' => ['campaign-after-hours-v2.webp', 0.57, 0.54, 2.05],
        'campMan' => ['campaign-after-hours-v2.webp', 0.74, 0.52, 2.05],
        'campPair' => ['campaign-after-hours-v2.webp', 0.66, 0.55, 1.5],
        'campBoots' => ['campaign-after-hours-v2.webp', 0.72, 0.90, 3.1],

        'heroWoman' => ['iced-out-hero.webp', 0.60, 0.54, 2.05],
        'heroMan' => ['iced-out-hero.webp', 0.74, 0.50, 2.05],
        'heroPair' => ['iced-out-hero.webp', 0.67, 0.54, 1.55],

        'wideWoman' => ['iced-out-og.jpg', 0.58, 0.48, 1.9],
        'wideMan' => ['iced-out-og.jpg', 0.75, 0.48, 1.9],
    ];

    if ($images === '') {
        return 'no source images in frontend/public/images or seeds/data/images — skipped';
    }

    $made = 0;
    $skipped = 0;
    $missing = [];

    foreach ($catalogue as $piece) {
        $slug = trim(
            strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', (string) $piece['name'])),
            '-',
        );

        $product = $db->selectOne(
            'SELECT id, image_media_id FROM products WHERE public_id = ? LIMIT 1',
            [$slug],
        );
        $item = $db->selectOne(
            'SELECT id, image_media_id FROM stock_items WHERE public_id = ? LIMIT 1',
            [$piece['item']],
        );

        /* Already photographed — by an earlier run, or by an operator. Left alone
           either way: this seed adds what is missing, it does not overwrite. */
        if (($product['image_media_id'] ?? null) !== null && ($item['image_media_id'] ?? null) !== null) {
            ++$skipped;

            continue;
        }

        $crop = $crops[$piece['shot']] ?? null;

        if ($crop === null) {
            $missing[] = (string) $piece['shot'];

            continue;
        }

        [$file, $x, $y, $zoom] = $crop;
        $path = $images . '/' . $file;

        if (!is_file($path)) {
            $missing[] = $file;

            continue;
        }

        $cut = iced_crop_region($path, (float) $x, (float) $y, (float) $zoom);

        if ($cut === null) {
            $missing[] = $file . ' (unreadable)';

            continue;
        }

        try {
            /* Stored exactly as an upload is — see the note at the top. The
               uploaded-file shape is what `store()` speaks, so the whole pipeline
               (sniff, cap, resize, re-encode, insert) runs unchanged. */
            $stored = $media->store(
                ['error' => UPLOAD_ERR_OK, 'tmp_name' => $cut],
                'product',
                $product === null ? null : (int) $product['id'],
            );
        } finally {
            @unlink($cut);
        }

        $asset = $db->selectOne('SELECT id FROM media_assets WHERE public_id = ?', [$stored['media_id']]);

        if ($asset === null) {
            continue;
        }

        $assetId = (int) $asset['id'];

        /* One garment, photographed once — the product and the item it is listed
           from point at the same asset. */
        if ($product !== null && ($product['image_media_id'] ?? null) === null) {
            $db->statement('UPDATE products SET image_media_id = ? WHERE id = ?', [$assetId, (int) $product['id']]);
        }

        if ($item !== null && ($item['image_media_id'] ?? null) === null) {
            $db->statement('UPDATE stock_items SET image_media_id = ? WHERE id = ?', [$assetId, (int) $item['id']]);
        }

        ++$made;
    }

    return sprintf(
        '%d photographed, %d already had one%s',
        $made,
        $skipped,
        $missing === []
            ? ''
            : sprintf(', %d source(s) missing: %s', count($missing), implode(', ', array_unique($missing))),
    );
};

/**
 * Cuts one region out of a source photograph, into a temporary webp.
 *
 * The region is a box of 1/zoom of each edge, centred on (x, y) as a fraction of
 * the source and clamped so a centre near an edge slides the box inwards rather
 * than reading past it. That is the same arrangement `object-position` plus
 * `transform: scale()` produces in the browser, which is why a crop cut here looks
 * like the tile that used to draw it.
 *
 * Prefixed rather than named `cropRegion`: a seed file is `require`d into a live
 * process, so a bare function name here could collide with anything else.
 *
 * Returns the temp path, or null if the source could not be read.
 */
function iced_crop_region(string $path, float $x, float $y, float $zoom): ?string
{
    $source = @imagecreatefromstring((string) file_get_contents($path));

    if ($source === false) {
        return null;
    }

    $width = imagesx($source);
    $height = imagesy($source);

    $zoom = max(1.0, $zoom);
    $cutWidth = (int) round($width / $zoom);
    $cutHeight = (int) round($height / $zoom);

    $left = (int) round($x * $width - $cutWidth / 2);
    $top = (int) round($y * $height - $cutHeight / 2);

    // Slid back inside the frame rather than clipped, so the crop keeps its size.
    $left = max(0, min($left, $width - $cutWidth));
    $top = max(0, min($top, $height - $cutHeight));

    $cut = imagecrop($source, ['x' => $left, 'y' => $top, 'width' => $cutWidth, 'height' => $cutHeight]);
    imagedestroy($source);

    if ($cut === false) {
        return null;
    }

    $temp = tempnam(sys_get_temp_dir(), 'iced-crop-') ?: null;

    if ($temp === null) {
        imagedestroy($cut);

        return null;
    }

    /* Written at full quality: `MediaService::store` re-encodes it to the store's
       own quality setting, and compressing twice would only lose detail. */
    $written = imagewebp($cut, $temp, 100);
    imagedestroy($cut);

    return $written ? $temp : null;
}
