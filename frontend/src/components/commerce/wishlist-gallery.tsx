"use client";

import { ArrowRight, Check, Heart, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { SavedImage } from "@/components/commerce/saved-image";
import { PageFrame } from "@/components/layout/page-frame";
import { formatPrice } from "@/features/02-products";
import { useCart } from "@/features/04-cart/cart-context";
import { resolveSavedItems, type SavedItem } from "@/features/05-wishlist/saved-items";
import { useWishlist } from "@/features/05-wishlist/wishlist-context";

/**
 * The wishlist screen, frame and all.
 *
 * The page owns the frame rather than the route file so the spec row can quote
 * the live count — the list is read out of localStorage after mount, so a
 * server component could only ever render zero.
 *
 * One view, and it is a register rather than a gallery. A grid of 1:1.45 tiles
 * is how a shop shows pieces it wants LOOKED at; a saved list is re-read, and
 * what is re-read is which sizes are still there, what each one costs, and
 * whether it has moved to the bag yet. Those are columns. The row carries the
 * whole decision — size, price, add — so the trip back to the product page that
 * used to sit between "saved" and "bought" is gone.
 */
export function WishlistGallery() {
  const { productIds } = useWishlist();
  const { itemCount, subtotal } = useCart();

  /* Resolved against BOTH catalogues — the four storefront fixtures and the
     forty listing tiles. This used to search the fixtures alone, so every piece
     hearted on /new-drop, /women, /new-man or /new-woman was silently dropped
     here and the screen said "nothing saved yet" over a full list.

     The order pieces were saved in is preserved rather than the catalogue's:
     the list reads as a history, and re-sorting it silently loses that. */
  const saved = resolveSavedItems(productIds);

  /* What the list is worth at today's prices, not what it would cost to buy —
     nothing here has a quantity, and a piece saved twice is still one row. */
  const held = saved.reduce((total, item) => total + item.price, 0);

  /* The head of the card answers a different question than the spec row above
     it: not how many are saved, but how many can still be acted on. Repeating
     the count and the value there would just be the same two numbers twice. */
  const closed = saved.filter((item) => item.soldOut).length;

  return (
    <PageFrame
      eyebrow="Saved"
      lede="Kept on this device. Pick a size on any row to move it straight to your bag — signing in is asked for only at checkout."
      spec={
        saved.length
          ? [
              { label: "Pieces", value: String(saved.length).padStart(2, "0") },
              { label: "Value", value: formatPrice(held) },
            ]
          : undefined
      }
      title={
        <>
          Your <em>wishlist</em>
        </>
      }
    >
      {saved.length === 0 ? (
        <div className="io-empty">
          <div className="io-empty__copy">
            <span className="io-empty__glyph">
              <Heart aria-hidden size={19} strokeWidth={1.5} />
            </span>
            <h2>Nothing saved yet.</h2>
            <p>
              Saving needs no account. Tap the heart on any piece and it will be waiting
              here the next time you open the shop on this device.
            </p>
          </div>
          <Link className="io-btn io-btn--solid" href="/new-drop">
            Browse the drop
            <ArrowRight aria-hidden size={15} />
          </Link>
        </div>
      ) : (
        <section className="io-reg">
          <header className="io-reg__bar">
            <p className="io-reg__label">The register</p>
            <p className="io-reg__tally">
              <strong>{String(saved.length - closed).padStart(2, "0")}</strong> ready to
              move
              {closed > 0 && (
                <>
                  <i aria-hidden>/</i>
                  <strong>{String(closed).padStart(2, "0")}</strong> sold out
                </>
              )}
            </p>
          </header>

          {/* The wrapper scrolls, not the card: a narrow screen should shift the
              columns sideways rather than crush them, and the radius has to stay
              on something that is not itself scrolling. */}
          <div className="io-reg__scroll">
            <table className="io-reg__table">
              <thead>
                <tr>
                  <th scope="col">Piece</th>
                  <th scope="col">Size</th>
                  <th data-align="right" scope="col">
                    Price
                  </th>
                  <th scope="col">
                    <span className="sr-only">Add to bag</span>
                  </th>
                  <th scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {saved.map((item) => (
                  <SavedRow item={item} key={item.id} />
                ))}
              </tbody>
            </table>
          </div>

          <SavedFoot itemCount={itemCount} subtotal={subtotal} />
        </section>
      )}
    </PageFrame>
  );
}

/**
 * One saved piece, as a row.
 *
 * The size run is the control rather than a read-out — picking a size here is
 * what makes "add to bag" possible without a trip to the product page, which is
 * the one thing a saved list is for. Sold-out sizes stay on the shelf, struck
 * through: which sizes went is part of what the shopper came back to check.
 */
function SavedRow({ item }: { item: SavedItem }) {
  const [size, setSize] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();
  const { toggle } = useWishlist();

  /* A listing tile stands for one of the four fixtures, and that fixture is
     what a bag line is cut from — the same thing the tile's own quick-add
     panel does. Without one there is nothing to add. */
  const product = item.product;

  /* Only where the piece is actually marked down, and only as a whole number:
     "12% off" beside two prices is the third way of saying the same fact, and
     it is the one that reads at a glance. */
  const off =
    item.compareAtPrice && item.compareAtPrice > item.price
      ? Math.round((1 - item.price / item.compareAtPrice) * 100)
      : 0;

  function add() {
    if (!size || !product) return;
    /* `reveal: false` — the drawer is normally the confirmation, but this row
       has one of its own and the foot below keeps the running tally. Throwing
       the drawer over the register after every add would bury the rest of the
       list the shopper is still working through. */
    addItem(product, size, { reveal: false });
    setAdded(true);
  }

  return (
    <tr data-sold-out={item.soldOut || undefined}>
      <th data-cell="piece" scope="row">
        <div className="io-reg__piece">
          <Link aria-label={`View ${item.name}`} className="io-reg__thumb" href={item.href}>
            <SavedImage image={item.image} />
          </Link>
          <div className="io-reg__id">
            <Link className="io-reg__name" href={item.href}>
              {item.name}
            </Link>
            <span className="io-reg__meta">
              {item.badge && <em className="io-reg__tag">{item.badge}</em>}
              {item.meta}
            </span>
          </div>
        </div>
      </th>

      <td data-cell="sizes">
        {item.soldOut ? (
          <span className="io-badge io-badge--plain">Sold out</span>
        ) : (
          <div aria-label={`Choose a size for ${item.name}`} className="io-sizes" role="group">
            {item.sizes.map((option) => (
              <button
                aria-label={`${option.label}${option.soldOut ? ", sold out" : ""}`}
                aria-pressed={size === option.label}
                disabled={option.soldOut}
                key={option.label}
                onClick={() => {
                  setSize(option.label);
                  setAdded(false);
                }}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </td>

      <td className="io-reg__price" data-align="right" data-cell="price">
        {formatPrice(item.price)}
        {item.compareAtPrice && (
          <span className="io-reg__was">
            {formatPrice(item.compareAtPrice)}
            {off > 0 && <em>−{off}%</em>}
          </span>
        )}
      </td>

      <td data-cell="add">
        <button
          className="io-reg__add"
          data-state={added ? "in-bag" : undefined}
          disabled={item.soldOut || !product || !size || added}
          onClick={add}
          type="button"
        >
          {added ? (
            <>
              <Check aria-hidden size={13} strokeWidth={2.2} />
              In bag
            </>
          ) : (
            <>
              <ShoppingBag aria-hidden size={13} strokeWidth={1.7} />
              {/* Which sizes went is part of what a shopper comes back to check,
                  so a closed piece says so rather than showing a dead button. */}
              {item.soldOut ? "Sold out" : size ? "Add to bag" : "Pick a size"}
            </>
          )}
        </button>
      </td>

      <td data-cell="drop">
        <button
          className="io-reg__drop"
          onClick={() => toggle(item.id)}
          title={`Remove ${item.name}`}
          type="button"
        >
          <X aria-hidden size={14} strokeWidth={2} />
          <span className="sr-only">Remove {item.name} from your saved pieces</span>
        </button>
      </td>
    </tr>
  );
}

/**
 * The foot of the register: what the rows above have put in the bag, and the
 * way out of the screen.
 *
 * It is the answer to "did that work?" for a page whose add button deliberately
 * does not open the drawer. Empty, it says what to do instead of showing two
 * dead buttons — a checkout link that cannot check anything out is worse than
 * no link at all.
 */
function SavedFoot({ itemCount, subtotal }: { itemCount: number; subtotal: number }) {
  return (
    /* The live region is the foot itself, not the tally inside it: a region
       that is inserted at the same moment its text appears is announced by
       almost nothing. This one is on screen from the first render, so the
       first add is what changes — which is the part worth hearing. */
    <footer aria-live="polite" className="io-reg__foot">
      {itemCount === 0 ? (
        <p className="io-reg__note">
          Nothing in the bag yet — pick a size on a row above and it moves straight
          across.
        </p>
      ) : (
        <>
          <p className="io-reg__note">
            <span className="io-reg__dot" aria-hidden />
            <strong>{String(itemCount).padStart(2, "0")}</strong> in your bag
            <i aria-hidden>/</i>
            <strong>{formatPrice(subtotal)}</strong> subtotal
          </p>

          <div className="io-reg__acts">
            <Link className="io-btn io-btn--ghost io-btn--sm" href="/cart">
              View bag
            </Link>
            <Link className="io-btn io-btn--solid io-btn--sm" href="/checkout">
              Checkout
              <ArrowRight aria-hidden size={15} />
            </Link>
          </div>
        </>
      )}
    </footer>
  );
}
