"use client";

import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { AddressesProvider } from "@/features/01-users/addresses-context";
import { ProfileProvider } from "@/features/01-users/profile-context";
import { CartProvider } from "@/features/04-cart/cart-context";
import { CheckoutProvider } from "@/features/04-cart/checkout-context";
import { CheckoutModalProvider } from "@/features/04-cart/checkout-modal-context";
import { WishlistProvider } from "@/features/05-wishlist/wishlist-context";
import { ReviewsProvider } from "@/features/11-reviews/reviews-context";
import { VouchersProvider } from "@/features/10-coupons/vouchers-context";
import { WalletProvider } from "@/features/21-wallet/wallet-context";
import { OrdersProvider } from "@/features/07-orders/orders-context";
import { AuthProvider } from "@/features/20-auth-security/auth-context";
import { RouteGuard } from "@/features/20-auth-security/components/route-guard";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {/* Above everything that shows a name or a face: the account rail and the
          profile screen read one record, so a save lands on both. */}
      <ProfileProvider>
        {/* Beside the profile for the same reason: the Addresses tab picks the
            default and the Profile tab shows it. */}
        <AddressesProvider>
          {/* Wraps both ends of the review loop: the account writes one, the
              console decides on it, and the home page quotes what was approved
              — three screens, one register, no second copy to drift. */}
          <ReviewsProvider>
            <WishlistProvider>
              {/* Above the bag, because the bag has to turn a stored voucher code
                  back into a live balance on the way in — and because the console
                  issues credit into the same store the storefront spends from. */}
              <VouchersProvider>
                {/* Above the bag as well, and for a sharper reason than the
                    vouchers below it: the wallet is spent DURING checkout — the
                    summary quotes what the balance will cover and the order
                    carries the figure — so the store has to be readable from
                    inside the cart, not beside it. */}
                <WalletProvider>
                <CartProvider>
                  <CheckoutProvider>
                    {/* Above the guard, because the archive outlives a single screen:
                        checkout writes an order and the profile, the rail count and the
                        order page all read that same list back. */}
                    <OrdersProvider>
                      {/* Innermost, because checkout reads every one of the stores
                          above it — and OUTSIDE the guard's own render, because the
                          modal is not a route: it opens over whatever is showing,
                          and its own wall is `openCheckout`. */}
                      <CheckoutModalProvider>
                        <RouteGuard>{children}</RouteGuard>
                        {/* One mount for the whole app, and outside the guard:
                            `toast()` is called from anywhere, the toasts portal to
                            `document.body` regardless of where this sits in the
                            tree, and a second mount would show every toast twice. */}
                        <Toaster />
                      </CheckoutModalProvider>
                    </OrdersProvider>
                  </CheckoutProvider>
                </CartProvider>
                </WalletProvider>
              </VouchersProvider>
            </WishlistProvider>
          </ReviewsProvider>
        </AddressesProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
