"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { PrimaryNav } from "@/components/nav/primary-nav";
import { useCart } from "@/features/04-cart/cart-context";

const CartDrawer = dynamic(() =>
  import("@/components/commerce/cart-drawer").then((module) => module.CartDrawer),
);

/**
 * The shared bar, re-inked for a page that starts light and turns dark.
 *
 * `PrimaryNav` draws all of its colour from tokens, so flipping the whole bar
 * is a matter of swapping one token block — no rules are restated and no nav
 * markup is duplicated. `data-plate` is the switch; `gender.css` §2 holds both
 * sides of it.
 *
 * The trigger is an IntersectionObserver on the hero rather than a scroll
 * threshold: the hero is `100svh` on desktop and `auto` on mobile, so any
 * hard-coded pixel value would flip at the wrong moment on one of them.
 */
export function GenderHeader({ fontClassName = "" }: { fontClassName?: string }) {
  const pathname = usePathname();
  const { isOpen } = useCart();
  const [plate, setPlate] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Every route in this group opens on the light hero, so "light" is the
    // correct first paint and there is nothing to correct synchronously here.
    const hero = document.querySelector(".gx-hero");
    if (!hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => setPlate(entry.isIntersecting ? "light" : "dark"),
      // discount the bar's own height, so the flip lands as the hero's last
      // pixel passes under it rather than as it leaves the viewport entirely
      { rootMargin: "-76px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [pathname]);

  const signInHref = `/auth/login?returnTo=${encodeURIComponent(pathname || "/")}`;

  return (
    <>
      <Link className="skip-link" href="#main-content">
        Skip to content
      </Link>

      <div className={`nh-nav-scope gx-nav-scope ${fontClassName}`} data-plate={plate}>
        {/* This group paints its own plate on the scope from the hero observer
            above, so the bar's automatic one stands down rather than stacking. */}
        <PrimaryNav currentPath={pathname} intentPrefetch plate="none" signInHref={signInHref} />
      </div>

      {isOpen && <CartDrawer />}
    </>
  );
}
