"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useCheckoutModal } from "@/features/04-cart/checkout-modal-context";

/**
 * The client half of `/checkout`: open the surface, then stand aside.
 *
 * It replaces itself with the bag rather than staying on a route with nothing
 * on it. `replace`, not `push`, so Back from here is wherever the shopper came
 * from and not a checkout route that immediately bounces them forward again —
 * and the bag is the honest thing to be left looking at when the modal closes.
 *
 * The guard in `route-rules.ts` has already run by the time this mounts: an
 * unauthenticated visitor never gets here, they get the login screen with a
 * `returnTo` that comes straight back.
 */
export function CheckoutRoute() {
  const { openCheckout } = useCheckoutModal();
  const router = useRouter();
  /* Once. In development the effect is mounted twice, and a second `replace`
     into a route this one has already left is a navigation nobody asked for. */
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    openCheckout();
    router.replace("/cart");
  }, [openCheckout, router]);

  return (
    <main className="co-route" aria-live="polite">
      <p className="st__label">Opening checkout</p>
    </main>
  );
}
