import { AboutCraft } from "@/components/about/about-craft";
import { CopyProvider } from "@/components/home-v2/copy";
import { FashionHero } from "@/components/home-v2/fashion-hero";
import { ROOT_COPY } from "@/components/home-v2/home-copy";
import { Philosophy } from "@/components/home-v2/philosophy";
import { Seasonal } from "@/components/home-v2/seasonal";
import { Testimonials } from "@/components/home-v2/testimonials";
import { Trending } from "@/components/home-v2/trending";
import { SiteFooter } from "@/components/layout/site-footer";

/**
 * The site root — the Auren studio page, rebuilt from video-frames-2/
 * (03365516…mp4). Section order follows the capture's scroll order, minus the
 * awards and selected-clients sections, plus one section the capture has no
 * equivalent for:
 *   hero → philosophy → TRENDING → craft → THIS SEASON → testimonials → footer
 *
 * The collections slot is the second exception. It ran three authored chapter
 * cards — Drop 001, After Hours, Core Uniform — whose names, paragraphs and
 * photographs were all written into `home-copy.ts`, pinned inside a 300svh
 * runway, with no path from any of them to a piece a shopper could buy. It is
 * a plain grid of published products now, so what stands on the front door is
 * the catalogue rather than copy about it.
 *
 * The trending rail is the exception to "follows the capture": the capture is a
 * design studio's site and has nothing to sell. This one does, and the root
 * route had no path to a product on it at all — the argument for the cloth ran
 * straight into the account of how it is made. It reads the register rather
 * than a curated list; see `trending.tsx`.
 *
 * The capture's manifesto panel is no longer drawn here. Its statement was the
 * one line on the page that had to be read before anything else, and a
 * full-height panel three sections in is the wrong place for that — so it was
 * cut to its claim and became the hero headline instead. /about and /home-v2
 * still run the panel.
 *
 * The founder roster the capture runs between philosophy and the highlights is
 * not drawn here; /about and /home-v2 still carry it.
 *
 * The craft chapter is the exception to that order: it is the About page's
 * section, rendered from the same component rather than copied, so the four
 * steps stay one list edited in one place.
 *
 * The previous root composition is not deleted: /new-home carries exactly the
 * same components, layout and stylesheet, so it stays live and unchanged.
 * /home-v2 keeps the capture's full running order — founders, awards and
 * selected clients included — so this route is free to be the shorter edit
 * without losing the reference build.
 *
 * It lives in the `(home)` group so it can bring its own shell with it; the
 * `(storefront)` layout next door would wrap it in a second header.
 *
 * The words are this route's own: <CopyProvider> puts ROOT_COPY in scope so
 * the shared sections speak as the storefront rather than as the capture's
 * design studio. See `home-copy.ts`. /home-v2 keeps the transcription.
 */
export default function HomePage() {
  return (
    <>
      <CopyProvider copy={ROOT_COPY}>
        <main id="main-content">
          <FashionHero />
          <Philosophy />
          {/* What is actually selling, between the argument for the cloth and
              the account of how it is made. Reads `GET /catalog/trending`, so
              the four pieces are whatever the register says they are — there is
              no list in this file to keep up to date. See `trending.tsx`. */}
          <Trending />
          {/* Drawn from `.nh-*` rather than `.hv2`, so it needs the scope that
              declares those tokens around it — see `.nh-root.nh-about-embed`. */}
          <div className="nh-root nh-about-embed">
            <AboutCraft />
          </div>
          {/* This season's pieces, where the three authored collection cards
              used to be pinned. Those named three chapters and linked to none
              of them; this is a plain grid of published products, and which of
              them counts as the season is answered by the backend rather than
              by a list in this repo. See `seasonal.tsx`. /about and /home-v2
              keep <Highlights> and its authored chapters. */}
          <Seasonal />
          <Testimonials />
        </main>
      </CopyProvider>
      <SiteFooter />
    </>
  );
}
