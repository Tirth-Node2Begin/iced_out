"use client";

import { useMemo } from "react";

import { useGenderPieces } from "@/components/gender/use-pieces";
import { useReviews } from "@/features/11-reviews/reviews-context";

/**
 * The hero's social proof, from the review register.
 *
 * It used to be three stock avatars and the sentence "Join with 2100+ Members
 * and shop Drop 001 before the release closes" — a number nobody could check,
 * on faces belonging to nobody, written into the copy deck beside the headline.
 * It said the same thing on the day the shop opened as it would on the day it
 * had ten thousand customers, which is the tell: a figure that never moves is
 * not a measurement.
 *
 * This reads the SAME register every other review surface does — the product
 * page's panel, the home hero's corner, the moderation desk — so a review
 * approved at the desk changes this line, and one taken down changes it back.
 *
 * Scoped to the pieces on THIS listing rather than the whole shop: the sentence
 * sits under a headline about one release, and quoting menswear's verdict to
 * somebody reading the women's page is the same mistake in a smaller font.
 */

/** How many chips the stack carries before it starts counting the rest. */
const SHOWN = 4;

/**
 * Muted tints, picked to sit on the hero's bone plate rather than on white.
 * Assigned by a hash of the review id, so a chip keeps its colour between
 * renders and between visits without anything being stored against it.
 */
const TONES = ["#e6ddcd", "#cdd8dd", "#dcd0bb", "#b9c4c9"] as const;

/** The letter on a chip. */
function monogram(name: string) {
  const letter = name.trim().match(/[a-z0-9]/i);
  return letter ? letter[0].toUpperCase() : "?";
}

function toneFor(id: string) {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) sum = (sum * 31 + id.charCodeAt(index)) >>> 0;
  return TONES[sum % TONES.length];
}

export function HeroProof({ audience }: { audience: "men" | "women" }) {
  const { published, ready } = useReviews();
  const { pieces } = useGenderPieces(audience);

  /* Matched on the slug, never the name: two pieces can be called the same
     thing, and counting one garment's reviews towards another is the mistake
     that makes the number worthless. Same rule the product page follows. */
  const onThisRelease = useMemo(() => {
    const slugs = new Set(pieces.map((piece) => piece.slug));
    return published.filter((review) => slugs.has(review.productSlug));
  }, [pieces, published]);

  const score = useMemo(() => {
    const scored = onThisRelease
      .map((review) => Number(review.rating))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
    if (scored.length === 0) return 0;
    return scored.reduce((sum, value) => sum + value, 0) / scored.length;
  }, [onThisRelease]);

  const shown = onThisRelease.slice(0, SHOWN);
  const rest = onThisRelease.length - shown.length;

  return (
    <>
      <div aria-hidden className="gx-hero__faces">
        {shown.map((review) => (
          <span
            className="gx-hero__face"
            key={review.id}
            style={{ background: toneFor(review.id) }}
          >
            {monogram(review.customer)}
          </span>
        ))}

        {rest > 0 && (
          <span className="gx-hero__face gx-hero__face--rest">+{rest}</span>
        )}
      </div>

      <p className="gx-hero__proofText">
        {onThisRelease.length > 0 ? (
          <>
            Rated <b>{score.toFixed(1)}</b> out of 5 across{" "}
            <b>
              {onThisRelease.length} {onThisRelease.length === 1 ? "review" : "reviews"}
            </b>{" "}
            of this release
          </>
        ) : (
          /* Not "0.0 out of 5" — nobody has given that verdict. And nothing at
             all while the register is still being read, rather than a figure
             that would only be replaced a moment later. */
          <>{ready ? "No reviews on this release yet — yours would be the first" : "Reviews"}</>
        )}
      </p>
    </>
  );
}
