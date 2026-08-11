"use client";

import { ArrowRight, Check, RotateCcw, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AccountSection } from "@/components/account/account-section";
import { SavedImage } from "@/components/commerce/saved-image";
import { formatPrice } from "@/features/02-products";
import { useCart } from "@/features/04-cart/cart-context";
import { resolveSavedItems, type SavedItem } from "@/features/05-wishlist/saved-items";
import { useWishlist } from "@/features/05-wishlist/wishlist-context";

/**
 * Saved pieces, as a register rather than a gallery.
 *
 * This tab used to render the storefront's `<WishlistGallery>`, which carries
 * its own `<PageFrame>` — so the account frame wrapped a second full page
 * header, and the tab was a shop aisle pasted inside an account screen.
 *
 * The account is where saved pieces are *managed*, not browsed: what is worth
 * reading here is which sizes are still there and what each one costs, which is
 * a table. The gallery stays exactly as it is on `/wishlist`, where browsing is
 * the point.
 */
export default function AccountWishlistPage() {
  const { productIds, toggle, restore } = useWishlist();

  /* Resolved against both catalogues — the storefront fixtures and the listing
     tiles behind /new-drop, /women, /new-man and /new-woman. Searching the
     fixtures alone dropped every piece hearted on a listing, which is most of
     the shop. See `features/05-wishlist/saved-items`.

     The order pieces were saved in is kept, not the catalogue's — the list
     reads as a history, and re-sorting it silently loses that. */
  const saved = resolveSavedItems(productIds);

  /* A removal is one press with nothing to confirm, so the safety net comes
     after it: the row goes, and the way back stays on screen until the next
     action replaces it. */
  const [undo, setUndo] = useState<{ item: SavedItem; index: number } | null>(null);

  function remove(item: SavedItem, index: number) {
    toggle(item.id);
    setUndo({ item, index });
  }

  return (
    <AccountSection
      copy="Kept on this device — no account needed. Signing in is asked for only when a piece moves to your bag."
      eyebrow="Account / Saved"
      title="Pieces you kept."
      actions={
        <Link className="io-btn io-btn--ghost" href="/new-drop">
          Browse the drop
          <ArrowRight aria-hidden size={15} strokeWidth={1.7} />
        </Link>
      }
    >
      {undo && (
        <div className="io-note io-note--action">
          <RotateCcw aria-hidden size={16} strokeWidth={1.7} />
          <p>
            <strong>Removed {undo.item.name}.</strong>
            It goes back in the same place it came from.
          </p>
          <button
            className="io-btn io-btn--ghost io-btn--sm"
            onClick={() => {
              restore(undo.item.id, undo.index);
              setUndo(null);
            }}
            type="button"
          >
            Undo
          </button>
        </div>
      )}

      <section className="io-panel io-panel--flush">
        {saved.length === 0 ? (
          <div className="io-empty">
            <strong>Nothing saved yet</strong>
            Tap the heart on any piece and it will be waiting here the next time you open
            the shop on this device.
          </div>
        ) : (
          <div className="io-tablewrap">
            <table className="io-table io-table--saved">
              <thead>
                <tr>
                  <th scope="col">Piece</th>
                  <th scope="col">Sizes</th>
                  <th data-align="right" scope="col">Price</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {saved.map((item, index) => (
                  <SavedRow
                    item={item}
                    key={item.id}
                    onRemove={() => remove(item, index)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AccountSection>
  );
}

/**
 * One saved piece.
 *
 * The size run is the control rather than a read-out — picking a size here is
 * what makes "add to bag" possible without a trip to the product page, which is
 * the one thing a saved list is for. Sold-out sizes stay on the shelf, struck
 * through: which sizes went is part of what the shopper came back to check.
 */
function SavedRow({ item, onRemove }: { item: SavedItem; onRemove: () => void }) {
  const [size, setSize] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  /* A listing tile is a display layer over one of the four fixtures, and that
     fixture is what a bag line is cut from — the same thing its own quick-add
     panel does. Without one there is nothing to add. */
  const product = item.product;

  function add() {
    if (!size || !product) return;
    addItem(product, size);
    setAdded(true);
  }

  return (
    <tr>
      <th scope="row">
        <div className="io-piece">
          <Link aria-label={`View ${item.name}`} className="io-thumb" href={item.href}>
            <SavedImage image={item.image} />
          </Link>
          <div>
            <Link className="io-table__primary" href={item.href}>
              {item.name}
            </Link>
            <span className="io-table__sub">{item.meta}</span>
          </div>
        </div>
      </th>

      <td>
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

      <td className="io-table__num" data-align="right">
        {formatPrice(item.price)}
        {item.compareAtPrice && (
          <span className="io-table__was">{formatPrice(item.compareAtPrice)}</span>
        )}
      </td>

      <td data-align="right">
        <div className="io-rowacts">
          {!item.soldOut && product && (
            <button
              className="io-btn io-btn--sm io-btn--solid"
              disabled={!size || added}
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
                  {size ? "Add to bag" : "Pick a size"}
                </>
              )}
            </button>
          )}

          {/* Revealed by the pointer, but always reachable by keyboard — see
              `.io-rowdel`, which the inbox uses for the same reason. */}
          <button
            className="io-rowdel"
            onClick={onRemove}
            title={`Remove ${item.name}`}
            type="button"
          >
            <Trash2 aria-hidden size={15} strokeWidth={1.7} />
            <span className="sr-only">Remove {item.name} from your saved pieces</span>
          </button>
        </div>
      </td>
    </tr>
  );
}
