<?php

declare(strict_types=1);

namespace Iced\Service\Media;

use Iced\Integration\BackgroundRemoval\BackgroundRemovalFailed;
use Iced\Integration\BackgroundRemoval\BackgroundRemover;
use Iced\Kernel\Exception\ValidationException;
use Iced\Repository\HomeHeroRepository;
use Iced\Repository\MediaRepository;
use Iced\Support\Clock;
use Iced\Support\Logger;

/**
 * Turns a photograph of a garment into the ghost-mannequin cutout the home page
 * hero flies across the screen.
 *
 * The rule this class exists to hold: **a cutout may fail; a save may not.**
 *
 * An operator uploading a hero image is doing two things at once — filing a
 * photograph, and asking a third party to cut it out — and only the first of
 * those is under this server's control. remove.bg can be out of credits, the
 * key can lapse, the network can be down, the segmentation can come back
 * useless. If any of that took the save down with it, the operator would lose
 * their upload to somebody else's outage.
 *
 * So every failure below is CAUGHT and RECORDED on the slide instead of thrown.
 * The photograph is already stored by the time this runs, the slide keeps it,
 * and the console shows the reason beside a Retry that re-runs exactly this.
 * The one thing that never happens is a slide going live with its background
 * still in it — `HomeHeroRepository::running` only serves `Ready`.
 */
final class GhostCutoutService
{
    /** Cutouts are `cms` assets: they belong to a page, not to a product. */
    private const OWNER = 'cms';

    public function __construct(
        private readonly HomeHeroRepository $slides,
        private readonly MediaRepository $assets,
        private readonly MediaService $media,
        private readonly BackgroundRemover $remover,
        private readonly Clock $clock,
        private readonly Logger $logger,
    ) {
    }

    public function isConfigured(): bool
    {
        return $this->remover->isConfigured();
    }

    public function providerName(): string
    {
        return $this->remover->name();
    }

    /**
     * Cuts out one slide's photograph and points the slide at the result.
     *
     * @return array<string, mixed>|null the slide as it now stands, re-read so
     *                                   the caller answers with the stored
     *                                   truth rather than with what it hoped
     */
    public function run(string $slidePublicId): ?array
    {
        $slide = $this->slides->find($slidePublicId);

        if ($slide === null) {
            return null;
        }

        /**
         * Which frame to cut, and the answer depends on where the slide gets
         * its picture from.
         *
         * An `Upload` slide owns its frame, so `source_media_id` IS the answer.
         *
         * A `Product` slide follows the catalogue, so the answer is whatever
         * photo the product carries AT THIS MOMENT — re-read here rather than
         * snapshotted at create time. That is the whole difference between the
         * two: re-shoot a piece in the catalogue, press Cut again on its hero
         * card, and the home page catches up. If it were snapshotted, "follows
         * the product" would mean "followed the product once".
         */
        $sourceId = (string) $slide['source_kind'] === 'Product'
            ? ($slide['product_media_id'] === null ? 0 : (int) $slide['product_media_id'])
            : ($slide['source_media_id'] === null ? 0 : (int) $slide['source_media_id']);

        if ($sourceId === 0) {
            return $this->settle(
                $slidePublicId,
                'Failed',
                (string) $slide['source_kind'] === 'Product'
                    ? 'That product has no photograph in the catalogue. Add one on the product, then press Retry.'
                    : 'This slide has no photograph to cut out yet.',
            );
        }

        /* Not configured is its own state, not a failure: nothing went wrong,
           the store simply has not been given a key. Saying "Failed" here would
           send an operator hunting for a bad photograph. */
        if (!$this->remover->isConfigured()) {
            return $this->settle(
                $slidePublicId,
                'Skipped',
                sprintf('%s is not connected — set REMOVE_BG_API_KEY in backend/.env, then press Retry.', $this->remover->name()),
            );
        }

        $asset = $this->assets->findById($sourceId);

        if ($asset === null) {
            return $this->settle($slidePublicId, 'Failed', 'That photograph is no longer in the media store. Upload it again.');
        }

        $path = $this->media->absolutePath((string) $asset['storage_key']);
        $bytes = is_file($path) ? file_get_contents($path) : false;

        if ($bytes === false || $bytes === '') {
            return $this->settle($slidePublicId, 'Failed', 'That photograph could not be read back from storage. Upload it again.');
        }

        try {
            $cutout = $this->remover->cutout($bytes, $this->filenameFor((string) $asset['storage_key']));
        } catch (BackgroundRemovalFailed $failure) {
            return $this->settle($slidePublicId, 'Failed', $failure->getMessage());
        }

        try {
            /* Owned by the slide from the moment it exists — there is no window
               in which this asset is unclaimed, because unlike an upload it was
               requested by a record that already exists. */
            $stored = $this->media->storeBytes($cutout, self::OWNER, (int) $slide['id']);
        } catch (ValidationException $invalid) {
            $this->logger->warning('A background-removal reply could not be stored', [
                'slide' => $slidePublicId,
                'detail' => $invalid->getMessage(),
            ]);

            return $this->settle(
                $slidePublicId,
                'Failed',
                sprintf('%s answered with something this store could not read as an image. Press Retry.', $this->remover->name()),
            );
        }

        $previous = $slide['cutout_media_id'] === null ? 0 : (int) $slide['cutout_media_id'];
        $fresh = $this->assets->find($stored['media_id']);

        $this->slides->update($slidePublicId, [
            'cutout_media_id' => $fresh === null ? null : (int) $fresh['id'],
            /* The frame this cutout was actually made from, recorded even for a
               `Product` slide that resolved it a moment ago. It is what the
               console compares against the product's current photo to say "the
               catalogue has moved on since this was cut". */
            'source_media_id' => $sourceId,
            'cutout_state' => 'Ready',
            'cutout_detail' => '',
            /* Measured on the bytes the provider returned, before the store
               re-encodes and possibly downscales them — a resample can smear a
               hard edge into a few semi-transparent pixels and flatter the
               result. See `edgeClearance`. */
            'cutout_edge_clear' => $this->edgeClearance($cutout),
            'cutout_at' => $this->clock->nowString(),
        ]);

        /* The cutout this one replaces. Retired only after the new row is
           pointed at, so a crash in between leaves the slide showing the old
           cutout rather than showing nothing. */
        if ($previous !== 0) {
            $this->assets->softDelete($previous);
        }

        return $this->slides->find($slidePublicId);
    }

    /**
     * Records how the attempt ended and hands back the slide.
     *
     * @return array<string, mixed>|null
     */
    private function settle(string $slidePublicId, string $state, string $detail): ?array
    {
        $this->slides->update($slidePublicId, [
            'cutout_state' => $state,
            'cutout_detail' => $detail,
            'cutout_at' => $this->clock->nowString(),
        ]);

        return $this->slides->find($slidePublicId);
    }

    /**
     * How much of a cutout's outermost ring came back transparent, 0–100.
     *
     * The question this answers is "can this garment float?", and it is not the
     * same question as "did remove.bg work". Hand it a flat-lay — a piece
     * cropped edge to edge, which is what a great deal of catalogue photography
     * actually is — and it succeeds: it trims a little around the outside and
     * returns something that is still a rectangle. Drawn in a hero that expects
     * a garment hanging in space, that rectangle reads as a broken image.
     *
     * Overall transparency will not separate the two. Measured on three real
     * cutouts, a properly isolated shot came back 76% transparent and two
     * flat-lays came back 23% and 17% — too close to draw a line through.
     *
     * The BORDER separates them cleanly: the same three measured 100%, 49% and
     * 34%. Whatever is happening in the middle of the picture, a garment with
     * something of itself on all four edges is a garment that fills its frame.
     *
     * A number, not a verdict — the console decides what to say about it, and
     * the threshold can move without re-cutting anything.
     */
    private function edgeClearance(string $png): int
    {
        $image = @imagecreatefromstring($png);

        if ($image === false) {
            /* Unreadable here is not a finding. The store is about to re-read
               these same bytes and will report it properly if they are broken;
               guessing "suspect" from this would put a warning on a slide whose
               only problem is that GD was asked twice. */
            return 100;
        }

        $width = imagesx($image);
        $height = imagesy($image);
        $clear = 0;
        $seen = 0;

        $look = static function (int $x, int $y) use ($image, &$clear, &$seen): void {
            ++$seen;

            // The alpha channel is the top 7 bits; 127 is fully transparent.
            if (((imagecolorat($image, $x, $y) >> 24) & 0x7F) > 100) {
                ++$clear;
            }
        };

        for ($x = 0; $x < $width; ++$x) {
            $look($x, 0);
            $look($x, $height - 1);
        }

        for ($y = 0; $y < $height; ++$y) {
            $look(0, $y);
            $look($width - 1, $y);
        }

        imagedestroy($image);

        return $seen === 0 ? 100 : (int) round(100 * $clear / $seen);
    }

    /**
     * What to call the upload on its way to the provider.
     *
     * The storage key, not the operator's original filename — that was never
     * kept, and inventing one would be inventing a fact. The extension is the
     * part that matters: providers read it as a format hint.
     */
    private function filenameFor(string $storageKey): string
    {
        $name = basename($storageKey);

        return $name === '' ? 'garment.jpg' : $name;
    }
}
