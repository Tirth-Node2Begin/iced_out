<?php

declare(strict_types=1);

namespace Iced\Controller\Console;

use Iced\Kernel\Database;
use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Exception\ValidationException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\HomeHeroPresenter;
use Iced\Repository\CatalogRepository;
use Iced\Repository\HomeHeroRepository;
use Iced\Repository\MediaRepository;
use Iced\Service\Media\GhostCutoutService;

/**
 * The home page hero, as a console screen.
 *
 * What an operator does here is pick the garments that lead the site. What
 * happens as a result is two writes, in this order, every time:
 *
 *   1. the slide is SAVED with the frame it is to be cut from;
 *   2. that frame is sent to remove.bg, and the cutout is saved beside it.
 *
 * Step 2 runs inside the same request rather than on a queue, because that is
 * the behaviour the screen promises: press Save, watch the garment appear cut
 * out. It is also why step 1 commits first and step 2 can never roll it back —
 * see `GhostCutoutService`, which records failures on the slide rather than
 * throwing them at this controller. A hero slide whose cutout failed is a slide
 * with a Retry on it, not a lost upload.
 *
 * A slide gets its frame one of two ways, and the difference matters:
 *
 *   Upload   the operator's own file, uploaded through POST /admin/media and
 *            claimed by the slide. For art direction — a shot taken for the
 *            hero and used nowhere else.
 *   Product  the photo the product already carries in the catalogue, FOLLOWED
 *            rather than copied. The piece leading the home page is usually one
 *            you have already photographed, and making somebody find that file
 *            and upload it a second time is asking for work the store has done.
 *
 * Only `Ready` slides reach the storefront, so a half-finished slide is
 * invisible to shoppers the entire time it is being worked on.
 */
final class HomeHeroController
{
    /**
     * A ceiling, not a design limit.
     *
     * The hero swaps garments on a timer, so the run has to be short enough
     * that a shopper sees the whole thing before they scroll — twelve is well
     * past that and exists to stop an accidental bulk upload turning the home
     * page into a slideshow nobody watches to the end.
     */
    private const MAX_SLIDES = 12;

    public function __construct(
        private readonly HomeHeroRepository $slides,
        private readonly HomeHeroPresenter $presenter,
        private readonly CatalogRepository $catalog,
        private readonly MediaRepository $media,
        private readonly GhostCutoutService $cutouts,
        private readonly Database $db,
    ) {
    }

    /** GET /admin/home/hero — the board. */
    public function index(Request $request): Response
    {
        return Response::data($this->board());
    }

    /**
     * POST /admin/home/hero
     *
     * `source: "product"` takes the frame off the product. `source: "upload"`
     * (the default, and what an `image` on its own means) takes the frame the
     * form uploaded — which is already in the media store by the time this runs,
     * because the field uploads the moment a file is chosen. Either way the
     * bytes have been sniffed, re-encoded and capped before this sees them.
     */
    public function create(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        if ($this->slides->count() >= self::MAX_SLIDES) {
            throw ValidationException::field(
                'image',
                sprintf('The hero holds %d garments. Remove one before adding another.', self::MAX_SLIDES),
                'ICE-CMS-422',
            );
        }

        $fromProduct = $this->wantsProductPhoto($input);

        $slideId = $this->db->transaction(function () use ($input, $fromProduct): string {
            $publicId = 'hero-' . bin2hex(random_bytes(6));
            $product = $this->productFor($input['product'] ?? null, $fromProduct);

            [$sourceId, $claim] = $fromProduct
                ? [$this->productPhotoId($product), false]
                : [(int) $this->uploadedAsset($input)['id'], true];

            $id = $this->slides->insert([
                'public_id' => $publicId,
                'product_id' => $product === null ? null : (int) $product['id'],
                'source_kind' => $fromProduct ? 'Product' : 'Upload',
                'alt' => isset($input['alt']) ? (string) $input['alt'] : '',
                'source_media_id' => $sourceId,
                'cutout_state' => 'Pending',
                'position' => $this->slides->nextPosition(),
                'is_active' => ($input['active'] ?? true) === false ? 0 : 1,
            ]);

            /* An uploaded frame belongs to the slide that asked for it. A
               product's photo does NOT: it belongs to the product, and claiming
               it here would quietly rewrite the catalogue's own bookkeeping to
               say the hero owns a picture the product page is still showing. */
            if ($claim) {
                $this->media->claim($sourceId, 'cms', $id);
            }

            return $publicId;
        });

        $request->setAttribute('audit_entity_type', 'home_hero_slide');
        $request->setAttribute('audit_entity_id', $slideId);

        /* Outside the transaction on purpose. The cutout is a call to another
           company's server and can take seconds; holding a database transaction
           open across it would pin a connection to somebody else's latency. */
        $this->cutouts->run($slideId);

        return Response::data($this->board(), 201);
    }

    /**
     * PATCH /admin/home/hero/{slide}
     *
     * Anything that changes WHICH FRAME gets cut re-runs the cutout: a new
     * upload, a switch between the two sources, or — for a slide that follows
     * the catalogue — a different product. Changing the alt text does not. That
     * distinction is the whole reason this is a PATCH rather than a PUT: a
     * screen that re-cut the garment every time somebody fixed a typo would
     * spend the store's remove.bg credits on typos.
     */
    public function update(Request $request): Response
    {
        $slide = $this->mustFind($request->routeParam('slide'));
        /** @var array<string, mixed> $input */
        $input = $request->validated();

        $slideId = (string) $slide['public_id'];
        $recut = false;

        $this->db->transaction(function () use ($input, $slide, $slideId, &$recut): void {
            $was = (string) $slide['source_kind'];
            /* Unstated means unchanged — a PATCH that only carries `alt` must
               not silently convert an uploaded slide into a product one. */
            $kind = array_key_exists('source', $input)
                ? ($this->wantsProductPhoto($input) ? 'Product' : 'Upload')
                : $was;

            $fields = [];

            if (array_key_exists('alt', $input)) {
                $fields['alt'] = (string) $input['alt'];
            }

            if (array_key_exists('active', $input)) {
                $fields['is_active'] = $input['active'] === false ? 0 : 1;
            }

            $product = array_key_exists('product', $input)
                ? $this->productFor($input['product'], $kind === 'Product')
                : ($slide['product_id'] === null ? null : $this->catalog->findProduct((string) $slide['product_slug']));

            if (array_key_exists('product', $input)) {
                $fields['product_id'] = $product === null ? null : (int) $product['id'];
            }

            if ($kind !== $was) {
                $fields['source_kind'] = $kind;
            }

            if ($kind === 'Product') {
                $photoId = $this->productPhotoId($product);

                /* A product slide re-cuts when the frame behind it moves —
                   another product, or the same product re-shot. Both are
                   "this slide should now show something else". */
                if ($photoId !== (int) ($slide['source_media_id'] ?? 0) || $kind !== $was) {
                    $fields['source_media_id'] = $photoId;
                    $fields['cutout_state'] = 'Pending';
                    $fields['cutout_detail'] = '';
                    $recut = true;
                }
            } elseif (array_key_exists('image', $input) || $kind !== $was) {
                $reference = trim((string) ($input['image'] ?? ''));

                if ($reference === '') {
                    throw ValidationException::field(
                        'image',
                        'A hero slide needs a photograph. Delete the slide instead.',
                        'ICE-CMS-422',
                    );
                }

                $asset = $this->assetFor($reference);

                /* Only a DIFFERENT asset is a new photograph. Re-submitting the
                   form without touching the picture sends the same media id
                   back, and that must not spend a credit. */
                if ((int) $asset['id'] !== (int) ($slide['source_media_id'] ?? 0) || $kind !== $was) {
                    $this->media->claim((int) $asset['id'], 'cms', (int) $slide['id']);
                    $fields['source_media_id'] = (int) $asset['id'];
                    $fields['cutout_state'] = 'Pending';
                    $fields['cutout_detail'] = '';
                    $recut = true;
                }
            }

            $this->slides->update($slideId, $fields);
        });

        $request->setAttribute('audit_entity_type', 'home_hero_slide');
        $request->setAttribute('audit_entity_id', $slideId);

        if ($recut) {
            $this->cutouts->run($slideId);
        }

        return Response::data($this->board());
    }

    /** DELETE /admin/home/hero/{slide} */
    public function destroy(Request $request): Response
    {
        $slide = $this->mustFind($request->routeParam('slide'));

        $this->slides->delete((string) $slide['public_id']);

        $request->setAttribute('audit_entity_type', 'home_hero_slide');
        $request->setAttribute('audit_entity_id', (string) $slide['public_id']);

        return Response::data($this->board());
    }

    /**
     * POST /admin/home/hero/{slide}/cutout — run it again.
     *
     * The one verb that makes a failed cutout survivable. Everything that can
     * go wrong with remove.bg is transient from the store's point of view — a
     * lapsed key, an empty balance, a dropped connection — and all of them are
     * fixed elsewhere and then retried here.
     *
     * It is also how a slide that follows the catalogue catches up: the service
     * re-reads the product's photo each run, so re-shooting a piece and pressing
     * this is the whole update path.
     */
    public function cutout(Request $request): Response
    {
        $slide = $this->mustFind($request->routeParam('slide'));

        $this->cutouts->run((string) $slide['public_id']);

        $request->setAttribute('audit_entity_type', 'home_hero_slide');
        $request->setAttribute('audit_entity_id', (string) $slide['public_id']);

        return Response::data($this->board());
    }

    /**
     * POST /admin/home/hero/order — the running order.
     *
     * The whole list arrives at once rather than one "move up" per press: the
     * hero is a sequence, and a screen that reordered it one swap at a time
     * would leave it half-sorted whenever a request failed in the middle.
     */
    public function reorder(Request $request): Response
    {
        /** @var array<string, mixed> $input */
        $input = $request->validated();
        /** @var list<mixed> $order */
        $order = is_array($input['order'] ?? null) ? $input['order'] : [];

        $known = [];

        foreach ($this->slides->all() as $row) {
            $known[(string) $row['public_id']] = true;
        }

        $clean = [];

        foreach ($order as $entry) {
            $id = is_string($entry) ? $entry : '';

            if ($id !== '' && isset($known[$id]) && !in_array($id, $clean, true)) {
                $clean[] = $id;
            }
        }

        if ($clean === []) {
            throw ValidationException::field('order', 'That running order named no slides.', 'ICE-CMS-422');
        }

        $this->slides->reorder($clean);

        $request->setAttribute('audit_entity_type', 'home_hero_slide');
        $request->setAttribute('audit_entity_id', implode(',', $clean));

        return Response::data($this->board());
    }

    /**
     * Every write answers with the WHOLE board, not with the row it changed.
     *
     * A reorder moves every slide's position, a delete closes the gap behind
     * it, and a create appends — so a console that patched one row into its
     * held list would be showing a running order the server does not agree
     * with. One shape, one refresh, no reconciliation.
     *
     * @return array<string, mixed>
     */
    private function board(): array
    {
        return [
            'slides' => array_map(
                fn (array $row): array => $this->presenter->card($row),
                $this->slides->all(),
            ),
            /* The console says out loud whether background removal is
               connected. Without this the screen could only report the symptom
               — every cutout "Skipped" — and leave an operator guessing that
               the cause was an unset environment variable. */
            'cutout' => [
                'provider' => $this->cutouts->providerName(),
                'configured' => $this->cutouts->isConfigured(),
            ],
            'maxSlides' => self::MAX_SLIDES,
        ];
    }

    /**
     * Which of the two sources the request is asking for.
     *
     * `source` is the explicit answer. Its absence means the old shape — an
     * `image` and nothing else — which is an upload, so that stays the default
     * and callers written before this existed keep working unchanged.
     *
     * @param array<string, mixed> $input
     */
    private function wantsProductPhoto(array $input): bool
    {
        return strtolower(trim((string) ($input['source'] ?? ''))) === 'product';
    }

    /**
     * The product row a slide points at, or null.
     *
     * @param mixed $slug the slug from the form; "" or absent clears the link
     *
     * @return array<string, mixed>|null
     */
    private function productFor(mixed $slug, bool $required): ?array
    {
        $slug = is_string($slug) ? trim($slug) : '';

        if ($slug === '') {
            if ($required) {
                throw ValidationException::field(
                    'product',
                    'Choose the product whose photograph should lead the hero.',
                    'ICE-CMS-422',
                );
            }

            return null;
        }

        $product = $this->catalog->findProduct($slug);

        if ($product === null) {
            throw ValidationException::field('product', 'That product does not exist.', 'ICE-CMS-422');
        }

        return $product;
    }

    /**
     * A product's photo, as the media row id — refusing a product that has none.
     *
     * The refusal is the useful part. Without it a slide could be created
     * against a piece nobody has photographed and would sit in the hero board
     * saying "Failed" with nothing an operator could do about it from this
     * screen; said here, it names the fix and where to make it.
     *
     * @param array<string, mixed>|null $product
     */
    private function productPhotoId(?array $product): int
    {
        if ($product === null) {
            throw ValidationException::field(
                'product',
                'Choose the product whose photograph should lead the hero.',
                'ICE-CMS-422',
            );
        }

        $mediaId = (int) ($product['image_media_id'] ?? 0);

        if ($mediaId === 0) {
            throw ValidationException::field(
                'product',
                sprintf(
                    '%s has no photograph in the catalogue yet. Add one on the product, or upload a frame here instead.',
                    (string) $product['name'],
                ),
                'ICE-CMS-422',
            );
        }

        return $mediaId;
    }

    /**
     * The uploaded asset a create is pointing at.
     *
     * @param array<string, mixed> $input
     *
     * @return array<string, mixed>
     */
    private function uploadedAsset(array $input): array
    {
        $reference = trim((string) ($input['image'] ?? ''));

        if ($reference === '') {
            throw ValidationException::field('image', 'Upload a photograph of the garment.', 'ICE-CMS-422');
        }

        return $this->assetFor($reference);
    }

    /**
     * The media row behind what the form submitted.
     *
     * The form submits the asset's URL and the id is its last segment — the
     * same value `POST /admin/media` returned. Bare ids are accepted too, so a
     * caller that kept the id rather than the URL is not wrong.
     *
     * @return array<string, mixed>
     */
    private function assetFor(string $reference): array
    {
        $asset = $this->media->find(basename($reference));

        if ($asset === null) {
            throw ValidationException::field(
                'image',
                'That photograph is no longer available. Upload it again.',
                'ICE-MEDIA-422',
            );
        }

        return $asset;
    }

    /** @return array<string, mixed> */
    private function mustFind(string $publicId): array
    {
        $slide = $this->slides->find($publicId);

        if ($slide === null) {
            throw new NotFoundException('ICE-CMS-404', 'We could not find that hero slide.');
        }

        return $slide;
    }
}
