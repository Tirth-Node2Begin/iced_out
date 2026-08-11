import { AboutClosing } from "@/components/about/about-closing";
import { AboutCraft } from "@/components/about/about-craft";
import { AboutHero } from "@/components/about/about-hero";
import { AboutNav } from "@/components/about/about-nav";
import { AboutStory } from "@/components/about/about-story";
import { SiteFooter } from "@/components/layout/site-footer";

export default function AboutPage() {
  return (
    <>
      <AboutNav />
      <main id="main-content">
        <AboutHero />
        <AboutStory />
        <AboutCraft />
        <AboutClosing />
      </main>
      <SiteFooter />
    </>
  );
}
