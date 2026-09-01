"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ProductImage } from "@/components/commerce/product-image";
import {
  formatPrice,
  productPieceHref,
  useCatalogQuery,
  useCollections,
  type Product,
} from "@/features/02-products";

import { ScrollWords } from "./motion";

/**
 * This season's pieces — a grid of what the shop is actually selling.
 *
 * The slot used to hold three authored collection cards — "Drop 001", "After
 * Hours", "Core Uniform" — each with a paragraph about the chapter and a
 * photograph from the brand's own set, pinned inside a 300svh scroll runway
 * that shuffled a copy panel between them. Nothing under any of it was for
 * sale: the names, the words and the pictures were all written into
 * `home-copy.ts`, so a visitor read three chapters of copy on the front door
 * and could not reach a single piece from it. Publishing a product in the
 * console changed nothing here, and archiving one changed nothing either.
 *
 * It is a plain row of four product cards now, laid out on the trending rail's
 * geometry — same frame height, same measure, same centred header over it — so
 * the page's two product rows read as one shop rather than two. The pin, the
 * dwells and the copy panel are gone: a lot of scroll and a lot of machinery to
 * show three things, and a shopper on a front page wants the pieces, not a
 * mechanism. Every card is a link to the piece.
 *
 * Which pieces count as "this season" is answered by the backend, narrowest
 * answer first:
 *
 *   1. the new drop     — `products.is_new`, set by badging a piece "New"
 *   2. the live chapter — the first row of `GET /catalog/collections`, which
 *                         serves Live collections in the operator's own order
 *   3. the catalogue    — everything published, in `products.position` order
 *
 * Nothing on a card is written here: the name, descriptor, colour, badge, price
 * and photograph are the product's own columns, and the heading names whichever
 * of the three seasons resolved. Publish a piece and it can appear; unpublish it
 * and it leaves.
 *
 * It is deliberately NOT the trending rail higher up the page. That one reads
 * `GET /catalog/trending` and answers "what is selling"; this answers "what is
 * current", which is the operator's decision rather than the register's — two
 * different questions, and neither derivable from the other in the browser.
 */

/**
 * How many pieces the row draws.
 *
 * Four, in one row. Four across rather than three is a proportion decision, not
 * a capacity one: a card is mostly its photograph, and at three across on a
 * wide screen each frame is half the height of the viewport — one row fills the
 * screen and the section turns back into the scroll runway this replaced. Four
 * brings the card down to a size a shopper can take in at a glance, and one row
 * of them is the whole section, with "see everything" carrying the rest of the
 * season to the page that exists to list it.
 */
const SLOTS = 4;

function SeasonCard({ product, index }: { product: Product; index: number }) {
  return (
    <article className="hv2-season__card" data-aos="hv2-rise" data-aos-delay={(index % 4) * 80}>
      <Link className="hv2-season__link" href={productPieceHref(product)}>
        {/* `<ProductImage>` draws an empty frame for a piece nobody has
            photographed rather than standing a different garment in for it —
            the same contract every other card on the site keeps. */}
        <span className="hv2-season__frame">
          <ProductImage alt={product.name} position={product.imagePosition} src={product.image} />
          {product.badge && <span className="hv2-season__badge">{product.badge}</span>}
        </span>

        {/* Three lines and no more: what it is, what it is called, what it
            costs. The colour, the cloth, the chapter and the audience are all
            on the product row and all of them were on the card at one point —
            a row of that is a spec sheet, not a shop front. They are one click
            away on the product page, which is where a shopper who wants them is
            going anyway. */}
        <span className="hv2-season__meta">
          {/* The descriptor the console maintains — "Heavyweight fleece". Not
              the taxonomy; that is the operator's filing, not a shopper's. */}
          <span className="hv2-season__descriptor">{product.category}</span>
          <span className="hv2-season__name">{product.name}</span>
          <span className="hv2-season__price">
            <strong>{formatPrice(product.price)}</strong>
            {product.compareAtPrice !== undefined && <s>{formatPrice(product.compareAtPrice)}</s>}
          </span>
        </span>
      </Link>
    </article>
  );
}

export function Seasonal() {
  /**
   * The chapters the shop is running, so the section knows which is current.
   *
   * `GET /catalog/collections` serves only Live ones and returns them in
   * `collections.position` order, so the first row is the chapter the operator
   * has put at the front. That is a decision somebody makes in the console; it
   * is not a date this component works out for itself.
   */
  const { data: chapters, loaded: chaptersLoaded } = useCollections();
  const chapter = chapters.at(0);

  /**
   * Three candidate seasons, narrowest first, all off the ONE catalogue store.
   *
   * `useCatalogQuery` filters rows already in memory rather than firing a
   * request each, so this section costs the page nothing beyond the read the
   * storefront was making anyway.
   */
  const { data: newDrop, loaded, error } = useCatalogQuery({ destination: "new-drop" });
  const { data: current } = useCatalogQuery({
    destination: chapter ? `collection:${chapter.slug}` : "all",
  });
  const { data: catalogue } = useCatalogQuery();

  /**
   * What "this season" resolves to, and what the heading may then say.
   *
   * Each fallback exists because the one above it can legitimately be empty: a
   * shop between releases has nothing badged new, and a shop that has not set
   * its collections up has no Live chapter. The front door is not allowed to go
   * blank for either.
   */
  const source = useMemo(() => {
    if (newDrop.length > 0) return { rows: newDrop, label: "the new drop" };
    if (chapter && current.length > 0) return { rows: current, label: chapter.name };
    return { rows: catalogue, label: "the catalogue" };
  }, [newDrop, chapter, current, catalogue]);

  /**
   * The four that go on the row: photographed pieces first.
   *
   * A LAYOUT rule, the way the trending rail's alternation is, and it lives
   * here for the same reason — the server's job is to say what the season is,
   * and this row's job is to fill four frames with it. It is a preference, not
   * a filter: a shop with fewer photographs than that still fills the row, and
   * `<ProductImage>` draws its honest empty frame when it comes to that.
   */
  const pieces = useMemo(() => {
    const shot = source.rows.filter((product) => product.image !== "");
    const rest = source.rows.filter((product) => product.image === "");
    return [...shot, ...rest].slice(0, SLOTS);
  }, [source]);

  /**
   * Nothing to stand behind, so nothing drawn.
   *
   * A heading about the season over an empty grid is a claim this page cannot
   * make. Held until both reads have answered, so the section does not flash in
   * on arrival — and so the heading does not name one season and then another
   * when the collections land a moment after the catalogue.
   */
  if (!loaded || !chaptersLoaded || error !== null || pieces.length === 0) return null;

  return (
    <section className="hv2-season hv2-shell" id="season">
      {/* The trending rail's header, deliberately: an eyebrow over one line of
          heading, both centred on the same measure the row below is centred on.
          It carried a rule and a right-hand link for a while, which pulled it
          off the pictures and made it read as a different block of the page. */}
      <div className="hv2-season__head">
        <p className="hv2-eyebrow" data-aos="hv2-rise">
          This season
        </p>
        <ScrollWords
          as="h2"
          className="hv2-h2 hv2-season__title"
          offset={["start 0.92", "start 0.55"]}
          spread={2.2}
          /* The heading names whichever season actually resolved, so the page
             can never announce a new drop over a chapter's pieces. One line,
             like the rail's — the section has to hold a heading and a full row
             of photographs inside a single screen. */
          text={`Straight from ${source.label}.`}
        />
      </div>

      <div className="hv2-season__row">
        {pieces.map((product, index) => (
          <SeasonCard index={index} key={product.id} product={product} />
        ))}
      </div>

      {/* Where the rest of the season lives. `/new-drop` rather than a
          collection page for the same reason the cards use the gender floors:
          it is a live route the header already points at, and the storefront
          group's listing pages are on their way out. */}
      <Link className="hv2-season__all" data-aos="hv2-rise" href="/new-drop">
        See everything
      </Link>
    </section>
  );
}
