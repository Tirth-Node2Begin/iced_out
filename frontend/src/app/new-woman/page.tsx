import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/new-home/site-nav";
import { Closing } from "@/components/new-woman/closing";
import { WomanEdit } from "@/components/new-woman/edit";
import { TheLine } from "@/components/new-woman/the-line";
import { WomanHero } from "@/components/new-woman/woman-hero";

/**
 * The women's destination: hero → the line → the edit → the close.
 *
 * It used to render the home page's own hero and editorial with womenswear
 * words in them, which made it the third surface drawing the same two
 * components and left it with no catalogue at all — a department page a
 * shopper could not shop.
 *
 * It now renders its own deck, end to end, and shops the live catalogue: every
 * published product whose audience is `women` or `unisex`, filtered, sorted,
 * paged, sized through the shared quick-add and opened on its own detail page
 * under `/new-woman/piece`. Nothing it draws is reachable from /new-home or
 * /new-man, so this floor can move without disturbing either.
 *
 * Sections, in order:
 *   01  hero      asymmetric — copy left, three drifting frames right
 *   01b ribbon    a marquee the page's own scroll velocity drives
 *   02  the line  four panels that travel sideways under a vertical scroll
 *   03  the edit  filter rail, arched three-up grid, pager, notes
 *   04  the close the studio's claim, fit and care, and the closing band
 */
export default function NewWomanPage() {
  return (
    <>
      <SiteNav />
      <main id="main-content">
        <WomanHero />
        <TheLine />
        <WomanEdit />
        <Closing />
      </main>
      <SiteFooter />
    </>
  );
}
