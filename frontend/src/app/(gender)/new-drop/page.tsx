import type { Metadata } from "next";

import { MEN } from "@/components/gender/data";
import { DropEdit } from "@/components/gender/drop-edit";
import { DropHeader } from "@/components/gender/drop-header";
import { DropLook } from "@/components/gender/drop-look";
import { GenderHero } from "@/components/gender/hero";
import { SiteFooter } from "@/components/layout/site-footer";

export const metadata: Metadata = {
  title: "Men",
  description:
    "Heavyweight silhouettes and utility layers cut for after dark. Twenty numbered pieces from Drop 001 by Iced_out.",
};

/**
 * The men's listing, served at /new-drop.
 *
 * It used to render `GenderPage` — the hero, then an introduction, a sticky
 * filter rail beside three product shelves, a lifestyle band, a pinned lookbook
 * and the brand story. The page composes itself here now, and everything under
 * the hero is three sections separated by a hairline. The rounding belongs to
 * the components inside them, never to the sections themselves:
 *
 *   .gx-hero      unchanged — `GenderHero`, exactly as it was
 *   #gx-head      the release header, at display size
 *   #gx-edit      01 / The release  (the hero's primary CTA)
 *   #gx-lookbook  02 / The look     (the hero's secondary CTA)
 *   footer
 *
 * Read top to bottom that is: what this drop is → what is in it → how it is
 * worn. Nothing is stacked over a photograph except its own chips, and no
 * section introduces a shape the one above it did not already use.
 *
 * It stops going through `GenderPage` because /women still needs the full
 * listing: gutting the shared component would have taken those six sections
 * down with it. Both hero CTAs still resolve — `#gx-edit` and `#gx-lookbook`
 * are two of the three ids below.
 *
 * It lives in `(gender)` rather than `(storefront)` because it needs that
 * group's shell — the light-over-hero bar, `gender.css`, and the Lenis scroll
 * the hero's parallax is tuned against. The route group contributes nothing to
 * the URL, so the file path alone is what puts this at /new-drop.
 */
export default function NewDropPage() {
  return (
    <div className="gx-root">
      <main id="main-content">
        <GenderHero content={MEN} />

        <div className="gxd-body">
          <DropHeader content={MEN} />
          <DropEdit content={MEN} />
          <DropLook content={MEN} />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
