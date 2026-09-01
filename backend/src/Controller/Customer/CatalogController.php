<?php

declare(strict_types=1);

namespace Iced\Controller\Customer;

use Iced\Kernel\Exception\NotFoundException;
use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\CatalogPresenter;
use Iced\Repository\CatalogRepository;

/**
 * The public catalogue — what the storefront reads.
 *
 * This is the other half of the console's catalog endpoints, and without it the
 * two halves were disconnected: an operator could create a product in `/admin`,
 * see it in the register, and it would never appear in the shop, because the
 * storefront was reading a fixture array compiled into the JavaScript bundle.
 * Everything a shopper sees now comes from the same `products` table the console
 * writes to.
 *
 * Only `Published` products are visible, and that rule lives in the repository
 * rather than here — see `CatalogRepository::storefrontProducts`.
 */
final class CatalogController
{
    public function __construct(
        private readonly CatalogRepository $catalog,
        private readonly CatalogPresenter $presenter,
    ) {
    }

    /**
     * GET /catalog/products
     *
     * Filters mirror the storefront's own destinations, so a gender page or a
     * collection page asks for what it needs instead of fetching everything and
     * narrowing it in the browser:
     *
     *   ?audience=men|women      includes unisex, as the storefront always has
     *   ?collection=drop-001     by collection slug
     *   ?new=1                   the new drop
     *   ?q=hoodie                free text over name, descriptor and colour
     *
     * `sale` is deliberately absent: it means "has a compare-at price", which is
     * a property of the rows rather than a query, and the storefront already
     * filters on it.
     */
    public function products(Request $request): Response
    {
        $rows = $this->catalog->storefrontProducts([
            'audience' => $request->queryString('audience'),
            'collection' => $request->queryString('collection'),
            'new' => $request->queryString('new') === '1',
            'q' => $request->queryString('q'),
        ]);

        return Response::data($this->hydrate($rows));
    }

    /**
     * GET /catalog/trending
     *
     * The same product shape as `/catalog/products`, in a different ORDER: the
     * rows come back ranked by what has actually been selling, so a rail that
     * calls itself trending is answering the register rather than a hand-picked
     * list. The ranking — and what it falls back to while the window is quiet —
     * lives in `CatalogRepository::trendingProducts`.
     *
     *   ?audience=men|women   includes unisex, as everywhere else
     *   ?limit=8              clamped to 1..48 in the repository
     *
     * Deliberately NOT a flag on the product row: nothing here changes the
     * payload the storefront already parses, so this endpoint can be ignored by
     * every caller that does not want it.
     */
    public function trending(Request $request): Response
    {
        $rows = $this->catalog->trendingProducts([
            'audience' => $request->queryString('audience'),
            'limit' => $request->queryInt('limit', CatalogRepository::TRENDING_LIMIT),
        ]);

        return Response::data($this->hydrate($rows));
    }

    /**
     * Product rows plus their variants and photographs, in the storefront's shape.
     *
     * Both list endpoints go through here so they cannot drift into presenting
     * the same product two different ways — and so neither of them ever runs a
     * query per card: the variants and the gallery are each ONE query for the
     * whole page.
     *
     * @param list<array<string, mixed>> $rows
     *
     * @return list<array<string, mixed>>
     */
    private function hydrate(array $rows): array
    {
        $ids = array_map(static fn (array $row): int => (int) $row['id'], $rows);
        $variants = $this->catalog->variantsForProducts($ids);
        /* The gallery hangs off the stock item behind each listing — see
           `CatalogRepository::photosForProducts`. Fetched for the whole page in
           one query, the same way the variants are. */
        $photos = $this->catalog->photosForProducts($ids);

        return array_map(
            fn (array $row): array => $this->presenter->storefrontProduct(
                $row,
                $variants[(int) $row['id']] ?? [],
                $photos[(int) $row['id']] ?? [],
            ),
            $rows,
        );
    }

    /**
     * GET /catalog/products/{slug}
     *
     * A 404 covers both "no such product" and "not published yet" — an
     * unreleased listing must not be distinguishable from a missing one, or the
     * URL becomes a way to enumerate what is coming.
     */
    public function show(Request $request): Response
    {
        $slug = $request->routeParam('slug');
        $row = $this->catalog->findStorefrontProduct($slug);

        if ($row === null) {
            throw new NotFoundException('ICE-CAT-404', 'We could not find that product.');
        }

        $variants = $this->catalog->variantsForProducts([(int) $row['id']]);
        $photos = $this->catalog->photosForProducts([(int) $row['id']]);

        return Response::data($this->presenter->storefrontProduct(
            $row,
            $variants[(int) $row['id']] ?? [],
            $photos[(int) $row['id']] ?? [],
        ));
    }

    /**
     * GET /catalog/collections — the live collections, for the storefront's own
     * navigation. Only `Live` ones: a Scheduled collection is one the operator
     * has not announced.
     */
    public function collections(Request $request): Response
    {
        $rows = array_values(array_filter(
            $this->catalog->collections(),
            static fn (array $row): bool => (string) $row['status'] === 'Live',
        ));

        return Response::data(array_map(static fn (array $row): array => [
            'slug' => (string) $row['public_id'],
            'name' => (string) $row['name'],
            'pieces' => (int) ($row['piece_count'] ?? 0),
        ], $rows));
    }
}
