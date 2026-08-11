import type { ReactNode } from "react";

import { RouteExperience } from "@/components/effects/route-experience";
import { Header } from "@/components/layout/header";
import { SiteFooter } from "@/components/layout/site-footer";

/**
 * The shell every `(storefront)` and `(customer-session)` route is served in.
 *
 * The Archivo variable is declared on the outer element rather than on the bar
 * alone: the bar is not the only thing set in the display face any more — the
 * bag, wishlist and profile screens are built on `.io-scope`, which resolves
 * `--font-archivo` from an ancestor. Handing it only to the header left those
 * three falling back to the body face on half the routes that render them.
 *
 * The wrapper carries the font variable and nothing else, so pages that still
 * run the storefront theme are untouched by it.
 */
export function StorefrontShell({
  children,
  navFontClassName = "",
}: {
  children: ReactNode;
  navFontClassName?: string;
}) {
  return (
    <div className={navFontClassName}>
      <Header fontClassName={navFontClassName} />
      <main className="storefront-page" id="main-content">
        <RouteExperience>{children}</RouteExperience>
      </main>
      <SiteFooter />
    </div>
  );
}
