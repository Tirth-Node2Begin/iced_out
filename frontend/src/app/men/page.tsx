import { Catalogue } from "@/components/new-man/catalogue";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/new-home/site-nav";
import { MenHero } from "@/components/men/men-hero";

/**
 * The men's floor: a diptych hero over the live men's catalogue.
 *
 * THE HERO IS THE NEW WORK. It is a deliberate break from the composition the
 * other three heroes share — a hard vertical seam with copy on one side and one
 * photograph on the other, rather than a subject centred on a lit stage. See
 * `men.css` for what it does differently and why.
 *
 * THE CATALOGUE IS NOT REBUILT. `Catalogue` is /new-man's own section — the
 * section head, the filter bar, the grid, the pager and the quick-add — reading
 * the published catalogue for the `men` audience. Rendering it here rather than
 * writing a second one means a price, a photograph or a sold-out flag stays
 * true on both routes, and there is one place to correct when it is wrong.
 *
 * /new-man is untouched and still live. This route does not replace it; it is
 * the same shop entered through a different front.
 */
export default function MenPage() {
  return (
    <>
      <SiteNav />
      <main id="main-content">
        <MenHero />
        <Catalogue />
      </main>
      <SiteFooter />
    </>
  );
}
