import type { Metadata } from "next";
import { Suspense } from "react";

/* the detail page's own sheet — additive over new-home.css, new-man.css and
   new-woman.css, all three of which the /new-woman layout above this route
   already loads */
import "@/styles/new-man-product.css";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/new-home/site-nav";
import { PieceRoute } from "@/components/new-man/piece-route";
import { DEPTS } from "@/components/new-man/product-deck";

/**
 * The women's product detail page: hero → description and shipping → reviews →
 * related, then the footer.
 *
 * The same stack /new-man/piece renders, told which floor it is on. That is one
 * object rather than a duplicated page (see `Dept`): the audience the catalogue
 * is read for, where "back" lands, what the breadcrumb calls the department and
 * where a related tile points are the only four things that differ between them,
 * and every one of them is data.
 *
 * Addressed by `?slug=` and resolved in the BROWSER, for the same reason the
 * men's route is: the catalogue is the database and this site is a static
 * export, so a product added through the console would have no pre-rendered page
 * and one taken down would still have one.
 *
 * The title cannot name the piece, for that same reason — it is fixed at build
 * time and the piece is only known once the catalogue answers. Nor is it
 * "Drop 001", as it was: this route opens ANY womenswear piece, and only five
 * of the eleven are in that collection. So it names the floor.
 */
export const metadata: Metadata = { title: "Womenswear" };

export default function WomanProductPage() {
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
        <PieceRoute dept={DEPTS.women} />
      </Suspense>
      <SiteFooter />
    </>
  );
}
