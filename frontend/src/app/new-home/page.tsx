import { Editorial } from "@/components/new-home/editorial";
import { Fits } from "@/components/new-home/fits";
import { Hero } from "@/components/new-home/hero";
import { SiteFooter } from "@/components/layout/site-footer";
import { Showcase } from "@/components/new-home/showcase";
import { TopPicks } from "@/components/new-home/top-picks";
import { SiteNav } from "@/components/new-home/site-nav";

/**
 * Section order transcribed from the reference recording:
 *   hero → workout editorial → top picks → pinned showcase → arrivals grid.
 */
export default function NewHomePage() {
  return (
    <>
      <SiteNav />
      <main id="main-content">
        <Hero />
        <Editorial />
        <TopPicks />
        <Showcase />
        <Fits />
      </main>
      <SiteFooter />
    </>
  );
}
