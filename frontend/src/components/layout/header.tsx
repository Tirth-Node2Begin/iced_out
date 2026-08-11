"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PrimaryNav } from "@/components/nav/primary-nav";
import { useCart } from "@/features/04-cart/cart-context";

const CartDrawer = dynamic(() =>
  import("@/components/commerce/cart-drawer").then((module) => module.CartDrawer),
);

/**
 * The storefront header — the shared transparent bar, plus the commerce wiring
 * the storefront needs: the cart drawer mounts alongside it.
 *
 * `fontClassName` carries the Archivo variable down from the storefront layout;
 * the bar's type is the display face, not the storefront body face.
 */
export function Header({ fontClassName = "" }: { fontClassName?: string }) {
  const pathname = usePathname();
  const { isOpen } = useCart();

  // Send the pill to the real auth page and bring the shopper back where they
  // were. Gated actions (add to bag, checkout) route to the same page.
  const signInHref = `/auth/login?returnTo=${encodeURIComponent(pathname || "/")}`;

  return (
    <>
      <Link className="skip-link" href="#main-content">
        Skip to content
      </Link>

      <div className={`nh-nav-scope ${fontClassName}`}>
        <PrimaryNav currentPath={pathname} intentPrefetch signInHref={signInHref} />
      </div>

      {isOpen && <CartDrawer />}
    </>
  );
}
