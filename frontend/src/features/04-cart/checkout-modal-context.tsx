"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { CheckoutModal } from "@/features/04-cart/components/checkout-modal";
import { useAuth } from "@/features/20-auth-security/auth-context";

/**
 * The one way into checkout, from anywhere on the site.
 *
 * Checkout used to be a route, which meant every surface that could start one —
 * the bag page, both drawers, the wishlist footer — held its own `push`. They
 * now all call `openCheckout()` and get the same modal over whatever they were
 * showing, which is the point: there is one checkout, mounted once, and no
 * screen has to know how to build it.
 *
 * THE WALL STAYS. `/checkout` is a customer route in `route-rules.ts`, and
 * making the surface openable from a public page must not be a way around that
 * — an address, a payment and an order are exactly the things that boundary
 * exists for. So an unauthenticated press goes to the login screen with
 * `returnTo=/checkout`, and that route re-opens this the moment it lands.
 */
type CheckoutModalValue = {
  checkoutOpen: boolean;
  /** Opens it — or sends an unauthenticated shopper to sign in first. */
  openCheckout: () => void;
  closeCheckout: () => void;
};

const CheckoutModalContext = createContext<CheckoutModalValue | null>(null);

export function CheckoutModalProvider({ children }: { children: ReactNode }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const openCheckout = useCallback(() => {
    if (!isAuthenticated) {
      router.push(`/auth/login?returnTo=${encodeURIComponent("/checkout")}`);
      return;
    }
    setCheckoutOpen(true);
  }, [isAuthenticated, router]);

  const closeCheckout = useCallback(() => setCheckoutOpen(false), []);

  const value = useMemo(
    () => ({ checkoutOpen, closeCheckout, openCheckout }),
    [checkoutOpen, closeCheckout, openCheckout],
  );

  return (
    <CheckoutModalContext.Provider value={value}>
      {children}
      <CheckoutModal onOpenChange={setCheckoutOpen} open={checkoutOpen} />
    </CheckoutModalContext.Provider>
  );
}

export function useCheckoutModal() {
  const context = useContext(CheckoutModalContext);
  if (!context) throw new Error("useCheckoutModal must be used inside CheckoutModalProvider");
  return context;
}
