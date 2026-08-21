import { AboutCraft } from "@/components/about/about-craft";
import { CopyProvider } from "@/components/home-v2/copy";
import { FashionHero } from "@/components/home-v2/fashion-hero";
import { ROOT_COPY } from "@/components/home-v2/home-copy";
import { Highlights } from "@/components/home-v2/highlights";
import { Philosophy } from "@/components/home-v2/philosophy";
import { Testimonials } from "@/components/home-v2/testimonials";
import { SiteFooter } from "@/components/layout/site-footer";

/**
 * The site root — the Auren studio page, rebuilt from video-frames-2/
 * (03365516…mp4). Section order follows the capture's scroll order, minus the
 * awards and selected-clients sections:
 *   hero → philosophy → craft → collections → testimonials → footer
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
          {/* Drawn from `.nh-*` rather than `.hv2`, so it needs the scope that
              declares those tokens around it — see `.nh-root.nh-about-embed`. */}
          <div className="nh-root nh-about-embed">
            <AboutCraft />
          </div>
          <Highlights />
          <Testimonials />
        </main>
      </CopyProvider>
      <SiteFooter />
    </>
  );
}
