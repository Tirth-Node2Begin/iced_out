import { DEPARTMENTS } from "@/components/new-home/data";
import { Editorial } from "@/components/new-home/editorial";
import { SiteFooter } from "@/components/layout/site-footer";
import { Hero } from "@/components/new-home/hero";
import { SiteNav } from "@/components/new-home/site-nav";

const WOMEN = DEPARTMENTS.women;

/**
 * The women's destination: hero → editorial, then the footer.
 *
 * It renders its own section deck rather than importing /new-home, so this
 * surface can diverge from the home page without disturbing it. The womenswear
 * copy it feeds those sections lives in `DEPARTMENTS.women`.
 */
export default function NewWomanPage() {
  return (
    <>
      <SiteNav />
      <main id="main-content">
        <Hero
          ctas={WOMEN.ctas}
          headline={WOMEN.headline}
          intro={WOMEN.intro}
          meta={WOMEN.meta}
        />
        <Editorial notes={WOMEN.notes} word={WOMEN.word} />
      </main>
      <SiteFooter />
    </>
  );
}
