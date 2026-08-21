import { ABOUT_COPY } from "@/components/about/about-copy";
import { AboutNav } from "@/components/about/about-nav";
import { CopyProvider } from "@/components/home-v2/copy";
import { Founders } from "@/components/home-v2/founders";
import { Hero } from "@/components/home-v2/hero";
import { Highlights } from "@/components/home-v2/highlights";
import { Manifesto } from "@/components/home-v2/manifesto";
import { Philosophy } from "@/components/home-v2/philosophy";
import { Testimonials } from "@/components/home-v2/testimonials";
import { SiteFooter } from "@/components/layout/site-footer";

/**
 * /about runs the site root's composition in the same order it runs there:
 *   hero → manifesto → philosophy → founders → studio highlights →
 *   testimonials → footer, minus the craft chapter — that one stays on the
 *   root only.
 *
 * The sections are the site's rather than either page's, so they are the same
 * components — not a fork. What changes is the words: <CopyProvider> puts this
 * route's pack in scope and each section draws from it instead of the root's
 * default. See `about-copy.ts`.
 *
 * The page's own chapters — the Intent stage, the closing card — are gone; the
 * components are still in `components/about/` and nothing else imports them,
 * so putting one back is an import away.
 */
export default function AboutPage() {
  return (
    <>
      <AboutNav />
      <CopyProvider copy={ABOUT_COPY}>
        <main id="main-content">
          {/* These sections are `.hv2`: the tokens, ground and type live on
              that class, so the scope has to travel with them. */}
          <div className="hv2">
            <Hero />
            <Manifesto />
            <Philosophy />
            <Founders />
            <Highlights />
            <Testimonials />
          </div>
        </main>
      </CopyProvider>
      <SiteFooter />
    </>
  );
}
