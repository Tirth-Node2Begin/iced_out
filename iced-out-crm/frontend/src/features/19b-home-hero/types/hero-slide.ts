/**
 * The home page hero's garments, in the two shapes the two halves of the site
 * read them in.
 *
 * They are deliberately NOT one type. The console needs the workings — both
 * images, the state of the cutout, why the last attempt failed — and the
 * storefront needs a picture and somewhere to click. A single shape would put
 * remove.bg's error messages one careless render away from the front page.
 */

/**
 * Where a slide's background removal has got to.
 *
 * `Skipped` is not a failure: it means no remove.bg key is configured, so
 * nothing was attempted. It reads differently on screen for that reason — an
 * operator who sees "Failed" goes looking for a bad photograph, and the fix
 * here is a line in `backend/.env`.
 */
export type CutoutState = "Pending" | "Ready" | "Failed" | "Skipped";

/**
 * Where a slide's frame comes from.
 *
 * `Upload` — the operator's own file, owned by this slide. For art direction.
 * `Product` — the photo the product already carries in the catalogue, FOLLOWED
 * rather than copied: re-shoot the piece on the product, press Cut again, and
 * the hero catches up.
 */
export type HeroSource = "Upload" | "Product";

/** What `GET /admin/home/hero` returns for each slide. */
export type HeroCard = {
  id: string;
  alt: string;
  position: number;
  active: boolean;
  sourceKind: HeroSource;
  /**
   * The photo the PRODUCT carries right now — a different fact from `source`,
   * which is the frame the current cutout was actually made from. They diverge
   * when a `Product` slide's piece is re-shot in the catalogue.
   */
  productImage: string;
  /** True when the catalogue has moved on since this garment was cut. */
  sourceStale: boolean;
  /** The frame this cutout was made from. Always present. */
  source: string;
  /** The background-removed PNG, or "" until there is one. */
  cutout: string;
  cutoutState: CutoutState;
  /** Why the last attempt ended the way it did. Empty when it worked. */
  cutoutDetail: string;
  /**
   * The cutout came back still touching its own frame — so the source was
   * almost certainly a flat-lay or a crop, and the hero will draw a rectangle
   * rather than a garment hanging in space.
   *
   * A warning, not a refusal: remove.bg did not fail and an edge-to-edge slide
   * may be deliberate. What must not happen is it happening unannounced.
   */
  cutoutFillsFrame: boolean;
  cutoutAt: string;
  /** On the home page right now — switched on AND cut out. */
  live: boolean;
  /** The product slug, or "" for a slide with nothing to buy behind it. */
  product: string;
  productName: string;
  /** Draft or Scheduled means the link would 404; the screen says so. */
  productStatus: string;
};

/** The whole console screen, which is what every write answers with. */
export type HeroBoard = {
  slides: HeroCard[];
  cutout: {
    /** "remove.bg". */
    provider: string;
    /** False when no API key is set — nothing will be cut out until it is. */
    configured: boolean;
  };
  maxSlides: number;
};

/** What `GET /home/hero` returns — the storefront's half. */
export type HeroSlide = {
  id: string;
  /** The cutout. Never the uploaded frame; see `HomeHeroPresenter::slide`. */
  image: string;
  alt: string;
  product: string;
  productName: string;
  /** "/product/<slug>", or "" when the slide links nowhere. */
  href: string;
  width: number;
  height: number;
};
