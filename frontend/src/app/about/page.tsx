import { AboutClosing } from "@/components/about/about-closing";
import { AboutCraft } from "@/components/about/about-craft";
import { AboutNav } from "@/components/about/about-nav";
import { AboutStory } from "@/components/about/about-story";
import { Hero } from "@/components/home-v2/hero";
import { Manifesto } from "@/components/home-v2/manifesto";
import { SiteFooter } from "@/components/layout/site-footer";

export default function AboutPage() {
  return (
    <>
      <AboutNav />
      <main id="main-content">
        {/* The site root's hero and statement panel open this page in place of
            the old about hero. They carry the home-v2 design system, which is
            scoped under `.hv2` — hence the wrapper: the tokens, ground and type
            live on that class, and the rest of the page stays on `.nh-*`. */}
        <div className="hv2">
          <Hero />
          <Manifesto />
        </div>
        <AboutStory />
        <AboutCraft />
        <AboutClosing />
      </main>
      <SiteFooter />
    </>
  );
}
