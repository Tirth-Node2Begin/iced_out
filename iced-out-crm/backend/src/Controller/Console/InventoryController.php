<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Domain\Money;
use Iced\Domain\Principal;
use Iced\Kernel\Database;
use Iced\Kernel\Exception\ConflictException;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\InventoryPresenter;
use Iced\Repository\CatalogRepository;
use Iced\Repository\InventoryRepository;
use Iced\Repository\MediaRepository;
use Iced\Service\Catalog\SkuMinter;
use Iced\Service\Inventory\StockService;
use Iced\Service\Settings\StoreSettings;
use Iced\Support\Paginator;

/** Spec §8.22 — console inventory (10 endpoints). */
final class InventoryController
{
    /**
     * Only used if the settings table has been wiped. The live vocabulary is
     * `inventory.sizes_by_category`: a top is sized by letter and a bottom by
     * waist inches, and which sizes each stocks is a merchandising decision, so
     * it is data rather than a constant.
     */
    private const FALLBACK_SIZES = [
        'Top' => ['S', 'M', 'L', 'XL', 'XXL'],
        'Bottom' => ['30', '32', '34', '36', '38', '40', '42'],
    ];

    public function __construct(
        private readonly InventoryRepository $inventory,
        private readonly InventoryPresenter $presenter,
        private readonly StockService $stock,
        private readonly StoreSettings $settings,
        private readonly MediaRepository $media,
        /* Listing an item is a catalogue write, and "publish this now" makes the
           two one gesture — see `publishItem`. The repository rather than the
           catalogue controller: this needs to insert inside the transaction the
           item is being created in, not make a second request to itself. */
        private readonly CatalogRepository $catalog,
        private readonly Database $db,
    ) {
    }

    /** #122 GET /admin/inventory/items */
    public function items(Request $request): Response
    {
        return Response::data($this->presentItems($this->inventory->items($request->queryString('q'))));
    }

    /** #123 POST /admin/inventory/items */
    public function createItem(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $category = (string) $input['category'];
        $sizes = array_map('trim', explode(',', (string) $input['sizes']));
        $allowed = $this->sizesFor($category);

        if (!in_array($category, $this->settings->vocabulary('inventory.categories', ['Top', 'Bottom']), true)) {
            throw ValidationException::field('category', 'That is not a category the store stocks.', 'ICE-INV-422');
        }

        foreach ($sizes as $size) {
            if (!in_array($size, $allowed, true)) {
                throw ValidationException::field(
                    'sizes',
                    sprintf('%s is not a size a %s comes in.', $size, strtolower($category)),
                    'ICE-INV-422',
                );
            }
        }

        $warehouse = $this->inventory->findWarehouse((string) $input['warehouse']);

        if ($warehouse === null) {
            throw ValidationException::field('warehouse', 'That warehouse does not exist.', 'ICE-INV-422');
        }

        $publicId = $this->inventory->nextItemId();
        $total = (int) ($input['totalUnits'] ?? 0);
        $reserved = min((int) ($input['reservedUnits'] ?? 0), $total);

        /* One transaction around the item, its photographs and — where the
           operator asked for it — the listing that puts it in the shop. A stock
           row that exists while the product it was supposed to publish does not
           is the failure this is here to make impossible. */
        return $this->db->transaction(function () use (
            $publicId,
            $input,
            $category,
            $sizes,
            $warehouse,
            $total,
            $reserved,
            $request,
        ): Response {
            $this->inventory->insertItem(
                $publicId,
                (string) $input['itemName'],
                $category,
                (string) $input['itemType'],
                implode(', ', $sizes),
                (int) $warehouse['id'],
                $total,
                $reserved,
                $this->audienceOf($input),
                Money::fromRupees((int) ($input['price'] ?? 0))->toDecimalString(),
            );

            $this->attachImage($publicId, isset($input['image']) ? (string) $input['image'] : null);
            $this->attachGallery($publicId, isset($input['images']) ? (string) $input['images'] : null);

            $request->setAttribute('audit_entity_type', 'stock_item');
            $request->setAttribute('audit_entity_id', $publicId);

            $row = $this->inventory->findItem($publicId);

            /* "Publish now" — the whole point of asking for a price and a photo
               here. Taking stock in and putting it in front of shoppers are two
               decisions, and they stay two: the box is off unless it is ticked. */
            if ($row !== null && self::truthy($input['publish'] ?? null)) {
                $this->publishItem($row);
            }

            return Response::data($row === null ? [] : $this->presentItem($row), 201);
        });
    }

    /** #124 PATCH /admin/inventory/items/{id} — every unit change writes a ledger row. */
    public function updateItem(Request $request): Response
    {
        $id = $request->routeParam('id');
        $item = $this->findItem($id);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $request->setAttribute('audit_entity_type', 'stock_item');
        $request->setAttribute('audit_entity_id', $id);
        $request->setAttribute('audit_before', $this->presentItem($item));

        return $this->db->transaction(function () use ($id, $item, $input, $request): Response {
            $fields = [];

            foreach ([
                'itemName' => 'item_name',
                'category' => 'category',
                'itemType' => 'item_type',
                'sizes' => 'sizes_csv',
            ] as $key => $column) {
                if (array_key_exists($key, $input)) {
                    $fields[$column] = $input[$key];
                }
            }

            if (array_key_exists('audience', $input)) {
                $fields['audience'] = $this->audienceOf($input);
            }

            /* Deliberately NOT carried down to the listings by `syncListedProducts`
               below. A product's price is a decision made on the catalogue screen —
               it can legitimately differ from the warehouse price, and re-pricing a
               published listing writes a `product_price_history` row that this path
               has no business writing. The item's price is what a NEW listing starts
               from; an existing one is repriced where it was priced. */
            if (array_key_exists('price', $input)) {
                $fields['price'] = Money::fromRupees((int) $input['price'])->toDecimalString();
            }

            if (array_key_exists('warehouse', $input)) {
                $warehouse = $this->inventory->findWarehouse((string) $input['warehouse']);

                if ($warehouse === null) {
                    throw ValidationException::field('warehouse', 'That warehouse does not exist.', 'ICE-INV-422');
                }

                $fields['warehouse_id'] = (int) $warehouse['id'];
            }

            $this->inventory->updateItem($id, $fields);

            /* The item and its listing are one garment, so a corrected name or
               audience follows through to whatever is listed from it. Without
               this an operator renamed a stock item and the shop went on selling
               it under the old name — see `syncListedProducts`. */
            $this->inventory->syncListedProducts($id, $fields);

            if (array_key_exists('image', $input)) {
                $this->attachImage($id, (string) $input['image']);
            }

            if (array_key_exists('images', $input)) {
                $this->attachGallery($id, (string) $input['images']);
            }

            if (array_key_exists('totalUnits', $input) || array_key_exists('reservedUnits', $input)) {
                $this->stock->setStockItemUnits(
                    (int) $item['id'],
                    (int) ($input['totalUnits'] ?? $item['total_units']),
                    (int) ($input['reservedUnits'] ?? $item['reserved_units']),
                    $this->actorId($request),
                );
            }

            $row = $this->findItem($id);
            $presented = $this->presentItem($row);
            $request->setAttribute('audit_after', $presented);

            return Response::data($presented);
        });
    }

    /** #125 DELETE /admin/inventory/items/{id} — 409 while a published listing needs it. */
    public function deleteItem(Request $request): Response
    {
        $id = $request->routeParam('id');
        $this->findItem($id);

        $listings = $this->inventory->publishedListings($id);

        if ($listings > 0) {
            throw new ConflictException(
                'ICE-INV-409',
                sprintf('%d published listing(s) still sell from this item.', $listings),
            );
        }

        $this->inventory->softDeleteItem($id);

        $request->setAttribute('audit_entity_type', 'stock_item');
        $request->setAttribute('audit_entity_id', $id);

        return Response::noContent();
    }

    /** #126 POST /admin/inventory/items/{id}/reserve — clamped 0..totalUnits. */
    public function reserve(Request $request): Response
    {
        $id = $request->routeParam('id');
        $item = $this->findItem($id);
        /** @var array{reservedUnits: int} $input */
        $input = $request->validated();

        $this->stock->setStockItemUnits(
            (int) $item['id'],
            (int) $item['total_units'],
            max(0, min($input['reservedUnits'], (int) $item['total_units'])),
            $this->actorId($request),
        );

        $request->setAttribute('audit_entity_type', 'stock_item');
        $request->setAttribute('audit_entity_id', $id);

        $row = $this->findItem($id);

        return Response::data($this->presentItem($row));
    }

    /** #127 GET /admin/inventory/movements */
    public function movements(Request $request): Response
    {
        $page = Paginator::fromRequest($request);

        return Response::data($this->presenter->movementRows(
            $this->inventory->movements($request->queryString('item'), $page->perPage, $page->offset()),
        ));
    }

    /** #128 GET /admin/inventory/transfers */
    public function transfers(Request $request): Response
    {
        return Response::data($this->presenter->transferRows($this->inventory->transfers()));
    }

    /** #128 POST /admin/inventory/transfers */
    public function createTransfer(Request $request): Response
    {
        /** @var array{from: string, to: string, units: int, dispatched: string} $input */
        $input = $request->validated();

        $from = $this->inventory->findWarehouse($input['from']);
        $to = $this->inventory->findWarehouse($input['to']);

        if ($from === null || $to === null) {
            throw ValidationException::field('from', 'Both warehouses must exist.', 'ICE-INV-422');
        }

        if ((int) $from['id'] === (int) $to['id']) {
            throw ValidationException::field('to', 'A transfer needs two different warehouses.', 'ICE-INV-422');
        }

        $publicId = $this->inventory->nextTransferId();
        $this->inventory->insertTransfer($publicId, (int) $from['id'], (int) $to['id'], $input['units'], $input['dispatched']);

        $request->setAttribute('audit_entity_type', 'transfer');
        $request->setAttribute('audit_entity_id', $publicId);

        $row = $this->inventory->findTransfer($publicId);

        return Response::data($row === null ? [] : $this->presenter->transferRows([$row])[0], 201);
    }

    /** #129 POST /admin/inventory/transfers/{id}/transition */
    public function transitionTransfer(Request $request): Response
    {
        $id = $request->routeParam('id');
        $transfer = $this->inventory->findTransfer($id);

        if ($transfer === null) {
            throw new NotFoundException('ICE-INV-404', 'We could not find that transfer.');
        }

        /** @var array{status: string} $input */
        $input = $request->validated();

        $legal = [
            'Ready' => ['In transit', 'Cancelled'],
            'In transit' => ['Received', 'Cancelled'],
            'Received' => [],
            'Cancelled' => [],
        ];

        if (!in_array($input['status'], $legal[(string) $transfer['status']] ?? [], true)) {
            throw new ConflictException(
                'ICE-INV-409',
                sprintf('A transfer that is %s cannot become %s.', strtolower((string) $transfer['status']), strtolower($input['status'])),
            );
        }

        $this->inventory->setTransferStatus($id, $input['status']);

        $request->setAttribute('audit_entity_type', 'transfer');
        $request->setAttribute('audit_entity_id', $id);

        $row = $this->inventory->findTransfer($id);

        return Response::data($row === null ? [] : $this->presenter->transferRows([$row])[0]);
    }

    /** #130 GET /admin/inventory/warehouses */
    public function warehouses(Request $request): Response
    {
        return Response::data($this->presenter->warehouseRows($this->inventory->warehouses()));
    }

    public function createWarehouse(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();
        $code = strtoupper((string) $input['id']);

        if ($this->inventory->findWarehouse($code) !== null) {
            throw ValidationException::field('id', 'A warehouse already uses that code.', 'ICE-INV-422');
        }

        $this->inventory->insertWarehouse(
            $code,
            (string) $input['name'],
            (int) ($input['capacity'] ?? 0),
            (string) ($input['cutoff'] ?? ''),
            (string) ($input['status'] ?? 'Draft'),
        );

        $row = $this->inventory->findWarehouse($code);

        return Response::data($row === null ? [] : $this->presenter->warehouseRows([$row + ['available_units' => 0]])[0], 201);
    }

    public function updateWarehouse(Request $request): Response
    {
        $id = $request->routeParam('id');

        if ($this->inventory->findWarehouse($id) === null) {
            throw new NotFoundException('ICE-INV-404', 'We could not find that warehouse.');
        }

        /** @var array<string, mixed> $input */
        $input = $request->validated();
        $fields = [];

        foreach (['name' => 'name', 'capacity' => 'capacity_pct', 'cutoff' => 'cutoff', 'status' => 'status'] as $key => $column) {
            if (array_key_exists($key, $input)) {
                $fields[$column] = $input[$key];
            }
        }

        $this->inventory->updateWarehouse($id, $fields);

        foreach ($this->inventory->warehouses() as $row) {
            if ((string) $row['public_id'] === $id) {
                return Response::data($this->presenter->warehouseRows([$row])[0]);
            }
        }

        return Response::noContent();
    }

    /** #131 GET /admin/inventory/at-risk */
    public function atRisk(Request $request): Response
    {
        return Response::data($this->presenter->atRisk($this->inventory->atRisk()));
    }

    /**
     * Points an item at an already-uploaded asset.
     *
     * The form sends back what `POST /admin/media` gave it — an id or the URL
     * built from it — so either is accepted and resolved to the asset. An empty
     * value clears the photo, which is how the form says "remove this".
     */
    /**
     * Who the garment is cut for, narrowed to what the column accepts.
     *
     * The form sends the word an operator reads — "Men" — and the column stores
     * the one the storefront filters on. Anything unrecognised becomes `unisex`,
     * which is the widest reading and shows the piece on both pages rather than
     * hiding it on neither.
     *
     * @param array<string, mixed> $input
     */
    /* ------------------------------------------------------------ presenting */

    /**
     * A register row, with its gallery.
     *
     * The photographs live in their own table, so the presenter cannot read them
     * off the item row — they are fetched here and handed over. Every path that
     * answers with a stock item goes through this pair, which is what stops one
     * of them quietly returning rows with no `images` on them.
     *
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, string>>
     */
    private function presentItems(array $rows): array
    {
        return $this->presenter->itemRows(
            $rows,
            $this->inventory->photosFor(array_map(static fn (array $row): int => (int) $row['id'], $rows)),
        );
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, string>
     */
    private function presentItem(array $row): array
    {
        return $this->presentItems([$row])[0];
    }

    /* -------------------------------------------------------------- gallery */

    /**
     * Points an item at its secondary shots, in the order they were given.
     *
     * The field submits the WHOLE arrangement as one comma-joined list of media
     * URLs — the same values `POST /admin/media` handed back — so by the time
     * this runs every one of them is stored, sniffed, re-encoded and capped. All
     * this does is claim them for the item and record the order.
     *
     * `null` means the field was not sent: leave the gallery alone. An empty
     * string means it was sent empty, which is the operator clearing it.
     */
    private function attachGallery(string $itemPublicId, ?string $references): void
    {
        if ($references === null) {
            return;
        }

        $item = $this->inventory->findItem($itemPublicId);

        if ($item === null) {
            return;
        }

        $mediaIds = [];

        foreach (array_filter(array_map('trim', explode(',', $references))) as $reference) {
            /* The id is the URL's last segment, exactly as `attachImage` reads it. */
            $asset = $this->media->find(basename($reference));

            if ($asset === null) {
                throw ValidationException::field(
                    'images',
                    'One of those images is no longer available. Upload it again.',
                    'ICE-MEDIA-422',
                );
            }

            $this->media->claim((int) $asset['id'], 'stock_item', (int) $item['id']);
            /* Keyed, not appended: the same asset submitted twice is one photo in
               the gallery, and the unique key would refuse the second row anyway. */
            $mediaIds[(int) $asset['id']] = (int) $asset['id'];
        }

        $this->inventory->replacePhotos((int) $item['id'], array_values($mediaIds));
    }

    /* ------------------------------------------------------------ publishing */

    /**
     * Lists a freshly-created item in the shop, in one move.
     *
     * ONE product, not one per size. A product here is a garment a shopper can
     * open a page for, and the sizes are the picker on it — `storefrontProduct`
     * reads them off `variants`, so a listing per size would be five product
     * pages of the same coat, each offering a single size and each showing the
     * same photographs. The item's stock is split evenly across the sizes it is
     * stocked in, which is the only division the warehouse record supports; an
     * operator who knows better corrects it on the variants screen.
     *
     * Everything the listing needs is already on the item — its name, what it is
     * cut for, what it costs, what it looks like — which is the whole reason the
     * form now asks for a price and a photo.
     *
     * @param array<string, mixed> $item as `InventoryRepository::findItem` returns it
     */
    private function publishItem(array $item): void
    {
        $itemRef = (string) $item['public_id'];
        $name = (string) $item['item_name'];
        $sizes = array_values(array_filter(array_map('trim', explode(',', (string) $item['sizes_csv']))));

        /* Minted by the server for the same reason the catalogue form does not
           collect them: a slug is a URL somebody may keep and the stock code is
           stamped on every SKU beneath it, and uniqueness against the whole
           database is a question only the database can answer. */
        $slug = SkuMinter::slug($name, $this->catalog->takenSlugs());
        $skuCode = SkuMinter::sku($name, $this->catalog->takenSkuCodes());

        /* Filed under the catalogue category that matches the garment's type —
           "Jeans", "Hoodie" — where the operator maintains one. Without this a
           published item arrived with no `category_id`, and the storefront reads
           the taxonomy to decide which filter pill a piece belongs under: every
           item published from this screen landed in the accessories bucket. */
        $category = $this->catalog->findCategory(SkuMinter::slugify((string) $item['item_type']));

        $this->catalog->insertProduct([
            'public_id' => $slug,
            'name' => $name,
            'category' => (string) $item['item_type'],
            'category_id' => $category === null ? null : (int) $category['id'],
            'item_ref' => $itemRef,
            'sku_code' => $skuCode,
            /* The listing claims one size for the room accounting (spec §9.6);
               the variants below are what a shopper actually picks from. */
            'listing_size' => $sizes[0] ?? '',
            'description' => '',
            'price' => (string) ($item['price'] ?? '0.00'),
            'collection_slug' => '',
            'status' => 'Published',
            'tax_note' => null,
            'color' => '',
            'audience' => (string) ($item['audience'] ?? 'unisex'),
        ]);

        /* The item's own photograph becomes the listing's. The gallery is NOT
           copied: it hangs off the item and the storefront reads it through
           `item_ref`, so re-shooting the piece updates every listing at once. */
        if (($item['image_media_id'] ?? null) !== null) {
            $this->catalog->updateProduct($slug, ['image_media_id' => (int) $item['image_media_id']]);
        }

        $product = $this->catalog->findProduct($slug);

        if ($product === null || $sizes === []) {
            return;
        }

        $available = max(0, (int) $item['total_units'] - (int) $item['reserved_units']);
        $each = intdiv($available, count($sizes));

        foreach ($sizes as $size) {
            $this->catalog->insertVariant(
                /* Re-read each time: the SKUs minted a moment ago in this loop
                   are already in the table, and a list taken once outside it
                   would let the second size collide with the first. */
                SkuMinter::uniqueVariantSku($skuCode, '', $size, $this->catalog->takenVariantSkus()),
                (int) $product['id'],
                $size,
                '',
                $each <= 0 ? 'Out' : ($each <= 4 ? 'Low' : 'Active'),
                $each,
                (int) $item['id'],
            );
        }
    }

    /** A checkbox arrives as "true", "1", "on" or absent — all four mean one thing. */
    private static function truthy(mixed $value): bool
    {
        return in_array(
            strtolower(trim((string) (is_scalar($value) ? $value : ''))),
            ['1', 'true', 'on', 'yes'],
            true,
        );
    }

    private function audienceOf(array $input): string
    {
        $given = strtolower(trim((string) ($input['audience'] ?? '')));

        return match ($given) {
            'men', 'man', 'mens' => 'men',
            'women', 'woman', 'womens' => 'women',
            default => 'unisex',
        };
    }

    private function attachImage(string $itemPublicId, ?string $reference): void
    {
        if ($reference === null) {
            return;
        }

        $reference = trim($reference);

        if ($reference === '') {
            $this->inventory->updateItem($itemPublicId, ['image_media_id' => null]);

            return;
        }

        $mediaId = basename($reference);
        $asset = $this->media->find($mediaId);

        if ($asset === null) {
            throw ValidationException::field('image', 'That image is no longer available. Upload it again.', 'ICE-MEDIA-422');
        }

        $item = $this->inventory->findItem($itemPublicId);

        $this->media->claim((int) $asset['id'], 'stock_item', $item === null ? null : (int) $item['id']);
        $this->inventory->updateItem($itemPublicId, ['image_media_id' => (int) $asset['id']]);
    }

    /**
     * The sizes a category stocks, read live.
     *
     * @return list<string>
     */
    private function sizesFor(string $category): array
    {
        /** @var array<string, mixed> $byCategory */
        $byCategory = $this->settings->map('inventory.sizes_by_category', self::FALLBACK_SIZES);
        $sizes = $byCategory[$category] ?? [];

        return is_array($sizes)
            ? array_values(array_map(static fn (mixed $size): string => (string) $size, $sizes))
            : [];
    }

    /** @return array<string, mixed> */
    private function findItem(string $id): array
    {
        $row = $this->inventory->findItem($id);

        if ($row === null) {
            throw new NotFoundException('ICE-INV-404', 'We could not find that stock item.');
        }

        return $row;
    }

    private function actorId(Request $request): ?int
    {
        $principal = $request->attribute('principal');

        return $principal instanceof Principal ? $principal->userId : null;
    }
}
