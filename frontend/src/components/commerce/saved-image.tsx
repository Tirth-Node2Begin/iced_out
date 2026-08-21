import { ProductImage } from "@/components/commerce/product-image";
import type { SavedImage as SavedImageValue } from "@/features/05-wishlist/saved-items";

/**
 * The photograph on a saved piece.
 *
 * The saved list is the one screen that mixes the two catalogues: a storefront
 * fixture is a quadrant of the sprite sheet, addressed in CSS by name, while a
 * listing tile is a crop of one of the five photographs and carries its framing
 * as custom properties. This picks between them so neither wishlist screen has
 * to know there are two.
 *
 * Both are decorative — every one of them sits inside a link that already names
 * the piece, so a filled `alt` would say it twice.
 */
export function SavedImage({ image }: { image: SavedImageValue }) {
  /* `kind: "sprite"` is a piece that IS a sprite quadrant, so the fallback is
     asked for outright rather than being what happens when nothing is set. */
  if (image.kind === "sprite") return <ProductImage fallback="sprite" position={image.position} />;

  const { frame } = image;

  /* A saved piece nobody has photographed. The row beside it already names the
     piece and prints its price, so an empty frame is the honest answer — the
     sprite quadrant this used to borrow was a picture of a different garment. */
  if (frame.mode === "none") {
    return <span aria-hidden="true" className="io-shot io-shot--blank" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      aria-hidden="true"
      className="io-shot"
      data-mode={frame.mode}
      decoding="async"
      loading="lazy"
      src={frame.src}
      style={
        frame.mode === "quad"
          ? ({
              "--qx": frame.qx,
              "--qy": frame.qy,
              "--zoom": frame.zoom,
            } as React.CSSProperties)
          : ({ "--op": frame.op, "--zoom": frame.zoom } as React.CSSProperties)
      }
    />
  );
}
