<?php

declare(strict_types=1);

namespace Iced\Presenter;

use DateTimeImmutable;
use Iced\Service\Media\MediaService;
use Throwable;

/**
 * A hero slide, told twice.
 *
 * The console needs to see the WORKINGS — both images, which state the cutout
 * is in, why the last attempt failed, whether the product behind it is still
 * published. The storefront needs one picture and somewhere to click. Two
 * audiences, one row, and keeping the shapes apart here is what stops the home
 * page accidentally shipping an error message from remove.bg.
 */
final class HomeHeroPresenter
{
    /**
     * The console's card.
     *
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function card(array $row): array
    {
        $state = (string) $row['cutout_state'];
        $kind = (string) $row['source_kind'];

        /* A `Product` slide follows the catalogue, so its frame can go stale
           without anybody touching the hero: re-shoot the piece on the product
           and the photo the slide was cut from is no longer the photo the
           product carries. Answered here rather than left to the console to
           work out, because it is a comparison between two media ids the
           console is never given. */
        $productMedia = $row['product_media_id'] === null ? 0 : (int) $row['product_media_id'];
        $cutFrom = $row['source_media_id'] === null ? 0 : (int) $row['source_media_id'];

        return [
            'id' => (string) $row['public_id'],
            'alt' => (string) $row['alt'],
            'position' => (int) $row['position'],
            'active' => (bool) $row['is_active'],

            /* "Upload" — the operator's own file, owned by this slide.
               "Product" — the catalogue's photo, followed rather than copied. */
            'sourceKind' => $kind,
            /* The product's photo as it stands now. Shown beside the frame that
               was cut when the two disagree, so "out of date" is something an
               operator can see rather than take on trust. */
            'productImage' => MediaService::url(
                isset($row['product_image_public_id']) ? (string) $row['product_image_public_id'] : null,
            ) ?? '',
            'sourceStale' => $kind === 'Product' && $productMedia !== 0 && $cutFrom !== 0 && $productMedia !== $cutFrom,

            /* The frame this cutout was made from — the uploaded file, or the
               product's photo as it stood when it was cut — and what came back.
               Both are shown side by side on the card: a cutout is judged by
               comparing it to the frame it came from, and a console that only
               showed the result would make a bad segmentation impossible to
               spot. */
            'source' => MediaService::url(
                isset($row['source_public_id']) ? (string) $row['source_public_id'] : null,
            ) ?? '',
            'cutout' => MediaService::url(
                isset($row['cutout_public_id']) ? (string) $row['cutout_public_id'] : null,
            ) ?? '',

            'cutoutState' => $state,
            'cutoutDetail' => (string) $row['cutout_detail'],
            /**
             * The cutout came back still touching its own frame — which means
             * the source was almost certainly a flat-lay or a crop, and the
             * hero will draw it as a rectangle rather than as a garment hanging
             * in space.
             *
             * A warning, not a refusal. remove.bg did not fail, the bytes are
             * fine, and an operator may want an edge-to-edge slide on purpose;
             * what they must not have is this happening without being told. The
             * threshold lives here rather than in the service because it is a
             * judgement about how the picture READS, and this class is the one
             * that speaks to the screen.
             */
            'cutoutFillsFrame' => $state === 'Ready' && (int) $row['cutout_edge_clear'] < 90,
            'cutoutAt' => $this->stamp($row['cutout_at'] ?? null),
            /* Whether this slide is on the home page RIGHT NOW — the same test
               `HomeHeroRepository::running` applies, answered here so the card
               can say so instead of leaving an operator to work it out from a
               toggle and a state badge. */
            'live' => (bool) $row['is_active'] && $state === 'Ready' && ($row['cutout_public_id'] ?? null) !== null,

            'product' => (string) ($row['product_slug'] ?? ''),
            'productName' => (string) ($row['product_name'] ?? ''),
            /* Draft or Scheduled matters here: the hero would link to a 404,
               because the storefront serves only Published products. The
               console says so rather than letting it be discovered by clicking. */
            'productStatus' => (string) ($row['product_status'] ?? ''),
        ];
    }

    /**
     * The storefront's slide.
     *
     * Only the cutout is offered — never the source. The uploaded frame is
     * working material: it has a backdrop, a stand and whatever was behind it in
     * the studio, and the hero's whole construction is garments floating free.
     *
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public function slide(array $row): array
    {
        $product = (string) ($row['product_slug'] ?? '');
        $name = (string) ($row['product_name'] ?? '');
        $alt = (string) $row['alt'];

        return [
            'id' => (string) $row['public_id'],
            'image' => MediaService::url((string) $row['cutout_public_id']) ?? '',
            /* An operator who wrote alt text gets exactly what they wrote. The
               fallback names the garment rather than saying "hero image",
               because a screen reader announcing "hero image" three times is
               the same as announcing nothing. */
            'alt' => $alt !== '' ? $alt : ($name !== '' ? $name . ' — ghost mannequin cutout' : 'Iced Out garment'),
            'product' => $product,
            'productName' => $name,
            /* Built here rather than in the browser: the storefront's product
               URL is a fact about this application's routing, and two halves
               composing it separately is how one of them ends up a redirect
               behind the other. Empty when the slide has no product, and the
               hero renders it as a picture rather than a link. */
            'href' => $product === '' ? '' : '/product/' . $product,
            'width' => (int) ($row['cutout_width'] ?? 0),
            'height' => (int) ($row['cutout_height'] ?? 0),
        ];
    }

    /** "04 Aug, 14:32", or empty for a slide nothing has been attempted on. */
    private function stamp(mixed $value): string
    {
        if (!is_string($value) || $value === '') {
            return '';
        }

        try {
            return Format::ledgerStamp(new DateTimeImmutable($value));
        } catch (Throwable) {
            return '';
        }
    }
}
