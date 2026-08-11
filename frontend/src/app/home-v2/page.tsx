import { Awards } from "@/components/home-v2/awards";
import { Clients } from "@/components/home-v2/clients";
import { Founders } from "@/components/home-v2/founders";
import { Hero } from "@/components/home-v2/hero";
import { Highlights } from "@/components/home-v2/highlights";
import { Manifesto } from "@/components/home-v2/manifesto";
import { Philosophy } from "@/components/home-v2/philosophy";
import { Testimonials } from "@/components/home-v2/testimonials";
import { SiteFooter } from "@/components/layout/site-footer";

/**
 * /home-v2 — the same composition the site root serves, kept as its own route.
 * Section order is the capture's scroll order end to end:
 *   hero → manifesto → philosophy → founders → studio highlights →
 *   awards → selected clients → testimonials → footer
 */
export default function HomeV2Page() {
  return (
    <>
      <main id="main-content">
        <Hero />
        <Manifesto />
        <Philosophy />
        <Founders />
        <Highlights />
        <Awards />
        <Clients />
        <Testimonials />
      </main>
      <SiteFooter />
    </>
  );
}
