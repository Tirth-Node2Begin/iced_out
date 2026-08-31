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
use Iced\Presenter\CatalogPresenter;
use Iced\Repository\CatalogRepository;
use Iced\Repository\MediaRepository;
use Iced\Service\Catalog\SkuMinter;
use Iced\Service\Settings\StoreSettings;

/** Spec §8.21 — console catalog (12 endpoints). */
final class CatalogController
{
    public function __construct(
        private readonly CatalogRepository $catalog,
        private readonly CatalogPresenter $presenter,
        private readonly StoreSettings $settings,
        private readonly MediaRepository $media,
        private readonly Database $db,
    ) {
    }

    /**
     * Points a product at an uploaded photo, or clears it.
     *
     * The same arrangement stock items use (`InventoryController::attachImage`):
     * the form uploads first through `POST /admin/media` and submits what came
     * back, so by the time this runs the bytes are stored, sniffed, re-encoded and
     * capped. All this does is claim the asset for the product and point at it.
     *
     * `null` means the field was not sent — leave the photo alone. An empty string
     * means it was sent empty, which is the operator removing it.
     */
    private function attachImage(string $slug, ?string $reference): void
    {
        if ($reference === null) {
            return;
        }

        $reference = trim($reference);

        if ($reference === '') {
            $this->catalog->updateProduct($slug, ['image_media_id' => null]);

            return;
        }

        /* The form submits the asset's URL, and the id is its last segment — the
           same value `POST /admin/media` returned. */
        $asset = $this->media->find(basename($reference));

        if ($asset === null) {
            throw ValidationException::field(
                'image',
                'That image is no longer available. Upload it again.',
                'ICE-MEDIA-422',
            );
        }

        $product = $this->catalog->findProduct($slug);

        $this->media->claim((int) $asset['id'], 'product', $product === null ? null : (int) $product['id']);
        $this->catalog->updateProduct($slug, ['image_media_id' => (int) $asset['id']]);
    }

    /**
     * State vocabularies come from settings, not from a constant — and they are
     * checked here rather than in the route file, which is loaded before any
     * database connection exists and could only hold a stale copy.
     *
     * @throws ValidationException
     */
    private function assertVocabulary(string $field, ?string $value, string $key, array $fallback): void
    {
        if ($value === null) {
            return;
        }

        $allowed = $this->settings->vocabulary($key, $fallback);

        if (!in_array($value, $allowed, true)) {
            throw ValidationException::field(
                $field,
                sprintf('Choose one of: %s.', implode(', ', $allowed)),
                'ICE-CAT-422',
            );
        }
    }

    /** #110 GET /admin/catalog/products */
    public function products(Request $request): Response
    {
        return Response::data($this->presenter->productRows($this->catalog->products([
            'q' => $request->queryString('q'),
            'status' => $request->queryString('status'),
        ])));
    }

    /** #111 POST /admin/catalog/products — server mints the slug and stock code. */
    public function createProduct(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        return $this->db->transaction(function () use ($input, $request): Response {
            $name = (string) $input['name'];
            $itemRef = (string) $input['item'];
            $size = (string) $input['size'];

            $this->assertVocabulary(
                'status',
                isset($input['status']) ? (string) $input['status'] : null,
                'catalog.product_states',
                ['Published', 'Scheduled', 'Draft'],
            );

            $room = $this->catalog->listingRoom($itemRef);

            if ($room === []) {
                throw ValidationException::field('item', 'That stock item does not exist.', 'ICE-CAT-422');
            }

            $sizes = array_column($room, 'room', 'size');

            if (!array_key_exists($size, $sizes)) {
                throw ValidationException::field(
                    'size',
                    sprintf('%s does not stock that size.', $itemRef),
                    'ICE-CAT-422',
                );
            }

            // A published listing claims one size and one piece (spec §9.6).
            if ((string) ($input['status'] ?? 'Draft') === 'Published' && $sizes[$size] < 1) {
                throw ValidationException::field(
                    'size',
                    sprintf('%s has no room left in size %s.', $itemRef, $size),
                    'ICE-CAT-422',
                );
            }

            $slug = SkuMinter::slug($name, $this->catalog->takenSlugs());
            $skuCode = SkuMinter::sku($name, $this->catalog->takenSkuCodes());

            $category = $this->catalog->findCategory(SkuMinter::slugify((string) ($input['category'] ?? '')));
            $collection = $this->catalog->findCollection(SkuMinter::slugify((string) ($input['collection'] ?? '')));

            $this->catalog->insertProduct([
                'public_id' => $slug,
                'name' => $name,
                'category' => (string) ($input['category'] ?? ''),
                'category_id' => $category === null ? null : (int) $category['id'],
                'item_ref' => $itemRef,
                'sku_code' => $skuCode,
                'listing_size' => $size,
                'description' => (string) ($input['description'] ?? ''),
                'price' => Money::fromRupees((int) $input['price'])->toDecimalString(),
                'collection_slug' => $collection === null ? '' : (string) $collection['public_id'],
                'status' => (string) ($input['status'] ?? 'Draft'),
                'tax_note' => $input['tax'] ?? null,
                'color' => '',
                /* From the stock item, not from the request: which gender page a
                   piece belongs on is a fact about the garment, and the garment is
                   described once — in inventory. */
                'audience' => (string) ($this->catalog->findStockItem($itemRef)['audience'] ?? 'unisex'),
            ]);

            $this->attachImage($slug, isset($input['image']) ? (string) $input['image'] : null);

            $request->setAttribute('audit_entity_type', 'product');
            $request->setAttribute('audit_entity_id', $slug);

            $row = $this->catalog->findProduct($slug);

            return Response::data($row === null ? [] : $this->presenter->productRow($row), 201);
        });
    }

    /** #112 GET /admin/catalog/products/{slug} — the row plus its variants. */
    public function showProduct(Request $request): Response
    {
        $slug = $request->routeParam('slug');
        $row = $this->find($slug);

        return Response::data([
            'row' => $this->presenter->productRow($row),
            'variants' => $this->presenter->variantRows($this->catalog->variants($slug)),
        ]);
    }

    /** #113 PATCH /admin/catalog/products/{slug} */
    public function updateProduct(Request $request): Response
    {
        $slug = $request->routeParam('slug');
        $existing = $this->find($slug);
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $fields = [];

        foreach (['name' => 'name', 'description' => 'description', 'size' => 'listing_size', 'item' => 'item_ref'] as $key => $column) {
            if (array_key_exists($key, $input)) {
                $fields[$column] = $input[$key];
            }
        }

        if (array_key_exists('price', $input)) {
            $fields['price'] = Money::fromRupees((int) $input['price'])->toDecimalString();
        }

        if (array_key_exists('status', $input)) {
            $this->assertVocabulary('status', (string) $input['status'], 'catalog.product_states', ['Published', 'Scheduled', 'Draft']);
            $fields['status'] = $input['status'];
        }

        if (array_key_exists('tax', $input)) {
            $fields['tax_note'] = $input['tax'];
        }

        if (array_key_exists('category', $input)) {
            $category = $this->catalog->findCategory(SkuMinter::slugify((string) $input['category']));
            $fields['category_id'] = $category === null ? null : (int) $category['id'];
            $fields['category'] = (string) $input['category'];
        }

        if (array_key_exists('collection', $input)) {
            $collection = $this->catalog->findCollection(SkuMinter::slugify((string) $input['collection']));
            $fields['collection_slug'] = $collection === null ? '' : (string) $collection['public_id'];
        }

        $request->setAttribute('audit_entity_type', 'product');
        $request->setAttribute('audit_entity_id', $slug);
        $request->setAttribute('audit_before', $this->presenter->productRow($existing));

        $this->catalog->updateProduct($slug, $fields);

        if (array_key_exists('image', $input)) {
            $this->attachImage($slug, (string) $input['image']);
        }

        if (isset($fields['price'])) {
            // A price change is a ledger entry, not just a new value.
            $this->catalog->priceHistory((int) $existing['id'], (string) $fields['price'], null, $this->actorId($request));
        }

        $row = $this->find($slug);
        $request->setAttribute('audit_after', $this->presenter->productRow($row));

        return Response::data($this->presenter->productRow($row));
    }

    /** #114 POST /admin/catalog/products/{slug}/publish */
    public function publishProduct(Request $request): Response
    {
        $slug = $request->routeParam('slug');
        $product = $this->find($slug);

        if ((string) $product['status'] === 'Published') {
            return Response::data($this->presenter->productRow($product));
        }

        $this->catalog->updateProduct($slug, ['status' => 'Published']);

        $request->setAttribute('audit_entity_type', 'product');
        $request->setAttribute('audit_entity_id', $slug);

        return Response::data($this->presenter->productRow($this->find($slug)));
    }

    /** #115 DELETE /admin/catalog/products/{slug} — cascades to variants. */
    public function deleteProduct(Request $request): Response
    {
        $slug = $request->routeParam('slug');
        $product = $this->find($slug);

        $this->catalog->softDeleteProduct((int) $product['id']);

        $request->setAttribute('audit_entity_type', 'product');
        $request->setAttribute('audit_entity_id', $slug);

        return Response::noContent();
    }

    /** #116 GET /admin/catalog/variants?product= */
    public function variants(Request $request): Response
    {
        return Response::data($this->presenter->variantRows($this->catalog->variants($request->queryString('product'))));
    }

    /** #117 POST /admin/catalog/variants — SKU minted `<prod>-<col>-<size>`. */
    public function createVariant(Request $request): Response
    {
        /** @var array{product: string, size: string, colour: string, stock?: int} $input */
        $input = $request->validated();

        $product = $this->find($input['product']);
        $sku = SkuMinter::uniqueVariantSku(
            (string) $product['sku_code'],
            SkuMinter::skuCode($input['colour']),
            $input['size'],
            $this->catalog->takenVariantSkus(),
        );

        $onHand = (int) ($input['stock'] ?? 0);
        $stockItem = $this->db->selectOne('SELECT id FROM stock_items WHERE public_id = ?', [$product['item_ref']]);

        $this->catalog->insertVariant(
            $sku,
            (int) $product['id'],
            $input['size'],
            $input['colour'],
            $onHand <= 0 ? 'Out' : ($onHand <= 4 ? 'Low' : 'Active'),
            $onHand,
            $stockItem === null ? null : (int) $stockItem['id'],
        );

        $request->setAttribute('audit_entity_type', 'variant');
        $request->setAttribute('audit_entity_id', $sku);

        $row = $this->catalog->findVariant($sku);

        return Response::data($row === null ? [] : $this->presenter->variantRow($row), 201);
    }

    /** #118 PATCH /admin/catalog/variants/{sku} */
    public function updateVariant(Request $request): Response
    {
        $sku = $request->routeParam('sku');

        if ($this->catalog->findVariant($sku) === null) {
            throw new NotFoundException('ICE-CAT-404', 'We could not find that variant.');
        }

        /** @var array{status?: string} $input */
        $input = $request->validated();

        if (isset($input['status'])) {
            $this->assertVocabulary('status', $input['status'], 'catalog.variant_states', ['Active', 'Low', 'Out', 'Archived']);
            $this->catalog->updateVariantStatus($sku, $input['status']);
        }

        $request->setAttribute('audit_entity_type', 'variant');
        $request->setAttribute('audit_entity_id', $sku);

        $row = $this->catalog->findVariant($sku);

        return Response::data($row === null ? [] : $this->presenter->variantRow($row));
    }

    /** #118 DELETE /admin/catalog/variants/{sku} — archived, never erased. */
    public function archiveVariant(Request $request): Response
    {
        $sku = $request->routeParam('sku');

        if ($this->catalog->findVariant($sku) === null) {
            throw new NotFoundException('ICE-CAT-404', 'We could not find that variant.');
        }

        $this->catalog->archiveVariant($sku);

        $request->setAttribute('audit_entity_type', 'variant');
        $request->setAttribute('audit_entity_id', $sku);

        return Response::noContent();
    }

    /** #119 GET/POST /admin/catalog/categories */
    public function categories(Request $request): Response
    {
        return Response::data($this->presenter->categoryRows($this->catalog->categories()));
    }

    public function createCategory(Request $request): Response
    {
        /** @var array{name: string} $input */
        $input = $request->validated();
        $slug = SkuMinter::slug($input['name'], array_column($this->catalog->categories(), 'public_id'));

        $this->catalog->insertCategory($slug, $input['name']);

        $request->setAttribute('audit_entity_type', 'category');
        $request->setAttribute('audit_entity_id', $slug);

        return Response::data(['id' => $slug, 'name' => $input['name'], 'products' => '0'], 201);
    }

    public function updateCategory(Request $request): Response
    {
        $id = $request->routeParam('id');

        if ($this->catalog->findCategory($id) === null) {
            throw new NotFoundException('ICE-CAT-404', 'We could not find that category.');
        }

        /** @var array{name: string} $input */
        $input = $request->validated();
        $this->catalog->renameCategory($id, $input['name']);

        foreach ($this->catalog->categories() as $row) {
            if ((string) $row['public_id'] === $id) {
                return Response::data($this->presenter->categoryRows([$row])[0]);
            }
        }

        return Response::noContent();
    }

    public function deleteCategory(Request $request): Response
    {
        $id = $request->routeParam('id');

        if ($this->catalog->findCategory($id) === null) {
            throw new NotFoundException('ICE-CAT-404', 'We could not find that category.');
        }

        $this->catalog->softDeleteCategory($id);

        return Response::noContent();
    }

    /** #120 GET/POST /admin/catalog/collections */
    public function collections(Request $request): Response
    {
        return Response::data($this->presenter->collectionRows($this->catalog->collections()));
    }

    public function createCollection(Request $request): Response
    {
        /** @var array{name: string, status?: string} $input */
        $input = $request->validated();

        $this->assertVocabulary(
            'status',
            isset($input['status']) ? (string) $input['status'] : null,
            'catalog.collection_states',
            ['Live', 'Scheduled', 'Draft'],
        );

        $slug = SkuMinter::slug($input['name'], array_column($this->catalog->collections(), 'public_id'));

        $this->catalog->insertCollection($slug, $input['name'], (string) ($input['status'] ?? 'Draft'));

        $request->setAttribute('audit_entity_type', 'collection');
        $request->setAttribute('audit_entity_id', $slug);

        return Response::data(['id' => $slug, 'name' => $input['name'], 'pieces' => '0', 'status' => (string) ($input['status'] ?? 'Draft')], 201);
    }

    public function updateCollection(Request $request): Response
    {
        $id = $request->routeParam('id');

        if ($this->catalog->findCollection($id) === null) {
            throw new NotFoundException('ICE-CAT-404', 'We could not find that collection.');
        }

        /** @var array{name?: string, status?: string} $input */
        $input = $request->validated();
        $fields = [];

        if (isset($input['name'])) {
            $fields['name'] = $input['name'];
        }

        if (isset($input['status'])) {
            $this->assertVocabulary('status', $input['status'], 'catalog.collection_states', ['Live', 'Scheduled', 'Draft']);
            $fields['status'] = $input['status'];
        }

        $this->catalog->updateCollection($id, $fields);

        foreach ($this->catalog->collections() as $row) {
            if ((string) $row['public_id'] === $id) {
                return Response::data($this->presenter->collectionRows([$row])[0]);
            }
        }

        return Response::noContent();
    }

    public function deleteCollection(Request $request): Response
    {
        $id = $request->routeParam('id');

        if ($this->catalog->findCollection($id) === null) {
            throw new NotFoundException('ICE-CAT-404', 'We could not find that collection.');
        }

        $this->catalog->softDeleteCollection($id);

        return Response::noContent();
    }

    /** #121 GET /admin/catalog/listing-room?item=ITM-001 — drives the editor's dropdowns. */
    public function listingRoom(Request $request): Response
    {
        $item = $request->queryString('item');

        if ($item === '') {
            throw ValidationException::field('item', 'Name the stock item to check.', 'ICE-CAT-422');
        }

        $room = $this->catalog->listingRoom($item);

        if ($room === []) {
            throw new NotFoundException('ICE-INV-404', 'We could not find that stock item.');
        }

        return Response::data(['sizes' => $room]);
    }

    /** @return array<string, mixed> */
    private function find(string $slug): array
    {
        $row = $this->catalog->findProduct($slug);

        if ($row === null) {
            throw new NotFoundException('ICE-CAT-404', 'We could not find that product.');
        }

        return $row;
    }

    private function actorId(Request $request): ?int
    {
        $principal = $request->attribute('principal');

        return $principal instanceof Principal ? $principal->userId : null;
    }
}
