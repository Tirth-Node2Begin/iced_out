import { Founders } from "@/components/home-v2/founders";
import { Hero } from "@/components/home-v2/hero";
import { Highlights } from "@/components/home-v2/highlights";
import { Manifesto } from "@/components/home-v2/manifesto";
import { Philosophy } from "@/components/home-v2/philosophy";
import { Testimonials } from "@/components/home-v2/testimonials";
import { SiteFooter } from "@/components/layout/site-footer";

/**
 * The site root — the Auren studio page, rebuilt from video-frames-2/
 * (03365516…mp4). Section order follows the capture's scroll order, minus the
 * awards and selected-clients sections:
 *   hero → manifesto → philosophy → founders → studio highlights →
 *   testimonials → footer
 *
 * The previous root composition is not deleted: /new-home carries exactly the
 * same components, layout and stylesheet, so it stays live and unchanged.
 * This page is also mirrored at /home-v2.
 *
 * It lives in the `(home)` group so it can bring its own shell with it; the
 * `(storefront)` layout next door would wrap it in a second header.
 */
export default function HomePage() {
  return (
    <>
      <main id="main-content">
        <Hero />
        <Manifesto />
        <Philosophy />
        <Founders />
        <Highlights />
        <Testimonials />
      </main>
      <SiteFooter />
    </>
  );
}
