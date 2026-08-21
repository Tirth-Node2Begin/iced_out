import type { Metadata } from "next";
import { Suspense } from "react";

/* the detail page's own sheet — additive over new-home.css and new-man.css,
   both of which the /new-man layout above this route already loads */
import "@/styles/new-man-product.css";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/new-home/site-nav";
import { PieceRoute } from "@/components/new-man/piece-route";

/**
 * The men's product detail page: hero → description and shipping → reviews →
 * related, then the footer.
 *
 * Addressed by `?slug=` and rendered in the BROWSER. It replaced a `[slug]`
 * segment whose `generateStaticParams` listed twenty pieces written into the
 * source — the catalogue is the database now, and a static export can only
 * pre-render what existed at build time, so a product added through the console
 * had no page and one taken down still had one.
 *
 * The title cannot name the piece any more, for the same reason: it is set at
 * build time and the piece is only known in the browser.
 */
export const metadata: Metadata = { title: "Drop 001" };

export default function ManProductPage() {
  return (
    <>
      <SiteNav />
      <Suspense
        fallback={
          <main className="nmp" id="main-content">
            <div className="nh-wrap" style={{ padding: "10rem 0", textAlign: "center" }}>
              <p className="nh-eyebrow">Reading the release…</p>
            </div>
          </main>
        }
      >
        <PieceRoute />
      </Suspense>
      <SiteFooter />
    </>
  );
}
