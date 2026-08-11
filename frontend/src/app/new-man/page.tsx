import { DEPARTMENTS } from "@/components/new-home/data";
import { Editorial } from "@/components/new-home/editorial";
import { SiteFooter } from "@/components/layout/site-footer";
import { Hero } from "@/components/new-home/hero";
import { SiteNav } from "@/components/new-home/site-nav";
import { Catalogue } from "@/components/new-man/catalogue";

const MEN = DEPARTMENTS.men;

/**
 * The men's destination: hero → editorial → catalogue, then the footer.
 *
 * It renders its own section deck rather than importing /new-home, so this
 * surface can diverge from the home page without disturbing it. The menswear
 * copy it feeds the first two sections lives in `DEPARTMENTS.men`; the
 * catalogue carries its own deck in `@/components/new-man/data`.
 */
export default function NewManPage() {
  return (
    <>
      <SiteNav />
      <main id="main-content">
        <Hero
          ctas={MEN.ctas}
          headline={MEN.headline}
          intro={MEN.intro}
          meta={MEN.meta}
        />
        <Editorial notes={MEN.notes} word={MEN.word} />
        <Catalogue />
      </main>
      <SiteFooter />
    </>
  );
}
