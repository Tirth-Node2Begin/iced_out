<?php

declare(strict_types=1);

namespace Iced\Presenter;

use Iced\Domain\Money;
use Iced\Service\Media\MediaService;

/**
 * CatalogProductRow, VariantRow, CategoryRow, CollectionRow (spec §7.4).
 * Console rows are flat string maps, so the register renders them with no
 * adapter — and an adapter is exactly where a row starts disagreeing with the
 * record behind it.
 *
 * The storefront `Product` shape (§7.2) is the other half of this class: same
 * table, a different, typed audience.
 */
final class CatalogPresenter
{
    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, string>
     */
    public function productRow(array $row): array
    {
        $presented = [
            'id' => (string) $row['public_id'],
            'name' => (string) $row['name'],
            'item' => (string) ($row['item_ref'] ?? ''),
            'size' => (string) ($row['listing_size'] ?? ''),
            'sku' => (string) ($row['sku_code'] ?? ''),
            'price' => Format::rupees(Money::fromDecimalString((string) $row['price'])),
            'status' => (string) $row['status'],
            'category' => (string) ($row['taxonomy_name'] ?? $row['category'] ?? ''),
            'collection' => (string) ($row['collection_name'] ?? $row['collection_slug'] ?? ''),
            // Empty string rather than null: the console renders flat string maps,
            // and a product with no photo is a product with no photo.
            'image' => MediaService::url(
                isset($row['image_public_id']) ? (string) $row['image_public_id'] : null,
            ) ?? '',
        ];

        if (($row['tax_note'] ?? null) !== null && (string) $row['tax_note'] !== '') {
            $presented['tax'] = (string) $row['tax_note'];
        }

        if (($row['description'] ?? null) !== null && (string) $row['description'] !== '') {
            $presented['description'] = (string) $row['description'];
        }

        return $presented;
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function productRows(array $rows): array
    {
        return array_map(fn (array $row): array => $this->productRow($row), $rows);
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, string>
     */
    public function variantRow(array $row): array
    {
        return [
            'id' => (string) $row['public_id'],
            'product' => (string) $row['product_slug'],
            'size' => (string) $row['size'],
            'colour' => (string) $row['color'],
            'stock' => (string) (int) ($row['available'] ?? 0),
            'status' => (string) $row['status'],
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function variantRows(array $rows): array
    {
        return array_map(fn (array $row): array => $this->variantRow($row), $rows);
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function categoryRows(array $rows): array
    {
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['public_id'],
            'name' => (string) $row['name'],
            'products' => (string) (int) ($row['product_count'] ?? 0),
        ], $rows);
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function collectionRows(array $rows): array
    {
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['public_id'],
            'name' => (string) $row['name'],
            'pieces' => (string) (int) ($row['piece_count'] ?? 0),
            'status' => (string) $row['status'],
        ], $rows);
    }

    /**
     * The storefront's typed Product (spec §7.2) — numbers stay numbers here,
     * because the PDP does arithmetic with them.
     *
     * @param array<string, mixed>       $row
     * @param list<array<string, mixed>> $variants
     * @param list<string>               $photos secondary shots, as media public ids
     *
     * @return array<string, mixed>
     */
    public function storefrontProduct(array $row, array $variants, array $photos = []): array
    {
        /* The whole run a shopper can look through: the primary first, then the
           item's secondary shots in the order the operator arranged them.

           The primary leads because it is the frame that stands for the piece
           everywhere else — on the card, in the bag, in search — and a product
           page that opens on a detail crop of a cuff is a page that opens on a
           picture of nothing. Empty for a piece nobody has photographed yet, and
           the frontend falls back to the sprite deck exactly as it always has. */
        $gallery = array_values(array_filter(array_map(
            static fn (?string $publicId): string => (string) MediaService::url($publicId),
            array_merge(
                [isset($row['image_public_id']) ? (string) $row['image_public_id'] : null],
                $photos,
            ),
        )));

        $product = [
            'id' => (string) $row['public_id'],
            'slug' => (string) $row['public_id'],
            'name' => (string) $row['name'],
            /* The descriptor line under the name — "Heavyweight fleece". Not the
               taxonomy; that is `taxonomy` below, and the two are genuinely
               different fields that both used to be called "category". */
            'category' => (string) $row['category'],
            /* What the console files this under, so the storefront can group by
               something an operator actually maintains instead of a hardcoded
               list of product ids. Empty when the product has no category. */
            'taxonomy' => (string) ($row['taxonomy_name'] ?? ''),
            'description' => (string) ($row['description'] ?? ''),
            'story' => (string) ($row['story'] ?? ''),
            'fabric' => (string) ($row['fabric'] ?? ''),
            'care' => (string) ($row['care'] ?? ''),
            'price' => Money::fromDecimalString((string) $row['price'])->rupees(),
            'color' => (string) $row['color'],
            'imagePosition' => (string) $row['image_position'],
            'audience' => (string) $row['audience'],
            'collection' => (string) ($row['collection_name'] ?? $row['collection_slug'] ?? ''),
            'isNew' => (bool) $row['is_new'],
            /**
             * The uploaded photo, or an empty string.
             *
             * `imagePosition` above is the FALLBACK, not a duplicate: it names a
             * quadrant of the sprite sheet that ships with the frontend, which is
             * what a product renders as until somebody photographs it. A card
             * prefers `image` and falls back to the sprite, so a catalogue nobody
             * has shot yet still looks like a catalogue.
             */
            'image' => MediaService::url(
                isset($row['image_public_id']) ? (string) $row['image_public_id'] : null,
            ) ?? '',
            /**
             * Every photograph of this piece, primary first.
             *
             * `image` above stays the single frame every compact surface wants —
             * a card has room for one picture and asking it to choose from a list
             * is how two cards of the same product end up showing different
             * things. This is the gallery the product page pages through.
             */
            'images' => $gallery,
            /**
             * What shoppers actually said, from `product_rating_summaries` —
             * the table moderation already keeps up to date.
             *
             * `reviewCount` is the honest half of this pair, and the frontend
             * shows the stars only when it is above zero. The page used to
             * carry a rating chosen by hashing the product's slug against
             * `[3.5, 4, 4.5, 5]`, and a summary of "4.6 from 50 reviews" that
             * was the same for every piece in the shop.
             */
            'rating' => round((float) ($row['rating_avg'] ?? 0), 2),
            'reviewCount' => (int) ($row['review_count'] ?? 0),
            'variants' => $this->storefrontVariants($variants),
        ];

        if (($row['compare_at_price'] ?? null) !== null) {
            $product['compareAtPrice'] = Money::fromDecimalString((string) $row['compare_at_price'])->rupees();
        }

        if (($row['badge'] ?? null) !== null && (string) $row['badge'] !== '') {
            $product['badge'] = (string) $row['badge'];
        }

        return $product;
    }

    /**
     * @param list<array<string, mixed>> $variants
     *
     * @return list<array<string, mixed>>
     */
    public function storefrontVariants(array $variants): array
    {
        return array_map(static function (array $variant): array {
            $available = (int) ($variant['available'] ?? 0);
            $lowAt = (int) ($variant['low_at'] ?? 4);

            return [
                'id' => (string) $variant['public_id'],
                'size' => (string) $variant['size'],
                'color' => (string) $variant['color'],
                'colorHex' => (string) $variant['color_hex'],
                'material' => (string) $variant['material'],
                // The frontend's own rule: at or under LOW_STOCK_AT is Low.
                'stock' => $available <= 0 ? 'SOLD_OUT' : ($available <= $lowAt ? 'LOW_STOCK' : 'IN_STOCK'),
                'available' => $available,
            ];
        }, $variants);
    }
}
