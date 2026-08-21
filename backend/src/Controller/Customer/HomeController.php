<?php

declare(strict_types=1);

namespace Iced\Controller\Customer;

use Iced\Kernel\Request;
use Iced\Kernel\Response;
use Iced\Presenter\HomeHeroPresenter;
use Iced\Repository\HomeHeroRepository;

/**
 * The home page's own reads — today, the hero.
 *
 * Public, because the front page of a shop cannot require an account, and
 * `catalog` rate-limited because it is read by every first visit and is the
 * same class of traffic as a product listing.
 *
 * An empty list is a legitimate answer, not an error: a store that has not
 * chosen its hero garments yet still has a home page, and the storefront falls
 * back to the built-in run rather than rendering a hole. See `useHeroSlides`.
 */
final class HomeController
{
    public function __construct(
        private readonly HomeHeroRepository $slides,
        private readonly HomeHeroPresenter $presenter,
    ) {
    }

    /**
     * GET /home/hero
     *
     * Only slides that are switched on AND whose background has actually come
     * off — the filter lives in `HomeHeroRepository::running` so the console
     * and the storefront cannot drift into disagreeing about what is live.
     */
    public function hero(Request $request): Response
    {
        return Response::data(array_map(
            fn (array $row): array => $this->presenter->slide($row),
            $this->slides->running(),
        ));
    }
}
