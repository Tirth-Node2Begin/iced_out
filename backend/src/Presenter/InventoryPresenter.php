<?php

declare(strict_types=1);

namespace Iced\Presenter;

use Iced\Domain\Money;
use Iced\Service\Media\MediaService;

/**
 * StockItemRow, TransferRow, WarehouseRow (spec §7.4).
 *
 * `available` is deliberately not a field on the stock row: it is always
 * total − reserved, and a stored copy is a number that can disagree with the
 * two it comes from. The register shows the three counts; the dashboard asks
 * for the verdict separately.
 */
final class InventoryPresenter
{
    /**
     * @param list<array<string, mixed>> $rows
     * @param array<int, list<string>>   $photos secondary shots by stock item id
     *
     * @return list<array<string, string>>
     */
    public function itemRows(array $rows, array $photos = []): array
    {
        return array_map(static function (array $row) use ($photos): array {
            /* The gallery, as one comma-joined string of URLs.

               Every console row is a flat map of strings — that is what lets one
               form renderer cover eighty screens — so a list travels the same way
               `sizes` already does. The field that submits it joins with the same
               separator, and a media URL never contains a comma. */
            $gallery = array_map(
                static fn (string $publicId): string => (string) MediaService::url($publicId),
                $photos[(int) ($row['id'] ?? 0)] ?? [],
            );

            return [
                'id' => (string) $row['public_id'],
                'itemName' => (string) $row['item_name'],
                'category' => (string) $row['category'],
                /* Who the garment is cut for, in the words the console shows —
                   "Men", not "men". The column stores the storefront's own value,
                   which is what /new-drop and /women filter on. */
                'audience' => ucfirst((string) ($row['audience'] ?? 'unisex')),
                'itemType' => (string) $row['item_type'],
                'sizes' => (string) $row['sizes_csv'],
                /* Formatted the way the catalogue register shows a price, because
                   it is the same fact: the listing form is pre-filled from this,
                   and two spellings of one number is how they start to disagree. */
                'price' => Format::rupees(Money::fromDecimalString((string) ($row['price'] ?? '0.00'))),
                'warehouse' => (string) ($row['warehouse_code'] ?? ''),
                'totalUnits' => (string) (int) $row['total_units'],
                'reservedUnits' => (string) (int) $row['reserved_units'],
                // Empty string rather than null: the console renders flat string
                // maps, and an item with no photo is an item with no photo.
                'image' => MediaService::url(
                    isset($row['image_public_id']) ? (string) $row['image_public_id'] : null,
                ) ?? '',
                'images' => implode(', ', $gallery),
            ];
        }, $rows);
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function transferRows(array $rows): array
    {
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['public_id'],
            'from' => (string) $row['from_code'],
            'to' => (string) $row['to_code'],
            'units' => (string) (int) $row['units'],
            'dispatched' => (string) $row['dispatched_label'],
            'status' => (string) $row['status'],
        ], $rows);
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function warehouseRows(array $rows): array
    {
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['public_id'],
            'name' => (string) $row['name'],
            'available' => number_format((int) ($row['available_units'] ?? 0)),
            'capacity' => (string) (int) $row['capacity_pct'],
            'cutoff' => (string) $row['cutoff'],
            'status' => (string) $row['status'],
        ], $rows);
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    public function movementRows(array $rows): array
    {
        return array_map(static function (array $row): array {
            $at = Format::parse((string) $row['created_at']);

            return [
                'id' => (string) $row['id'],
                'item' => (string) ($row['item_code'] ?? ''),
                'type' => (string) $row['type'],
                'qty' => (string) (int) $row['qty'],
                'onHandAfter' => (string) (int) ($row['on_hand_after'] ?? 0),
                'reservedAfter' => (string) (int) ($row['reserved_after'] ?? 0),
                'reference' => trim(sprintf('%s %s', $row['reference_type'], $row['reference_id'])),
                'at' => $at === null ? '' : Format::ledgerStamp($at),
            ];
        }, $rows);
    }

    /**
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array{item: string, size: string, level: string}>
     */
    public function atRisk(array $rows): array
    {
        return array_map(static fn (array $row): array => [
            'item' => (string) $row['sku'],
            'size' => (string) $row['size'],
            'level' => (string) $row['stock'] === 'SOLD_OUT' ? 'Out' : 'Low',
        ], $rows);
    }
}
