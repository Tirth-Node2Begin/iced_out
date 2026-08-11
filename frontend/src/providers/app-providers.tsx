"use client";

import type { ReactNode } from "react";

import { AddressesProvider } from "@/features/01-users/addresses-context";
import { ProfileProvider } from "@/features/01-users/profile-context";
import { CartProvider } from "@/features/04-cart/cart-context";
import { CheckoutProvider } from "@/features/04-cart/checkout-context";
import { WishlistProvider } from "@/features/05-wishlist/wishlist-context";
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
          <WishlistProvider>
            <CartProvider>
              <CheckoutProvider>
                {/* Above the guard, because the archive outlives a single screen:
                    checkout writes an order and the profile, the rail count and the
                    order page all read that same list back. */}
                <OrdersProvider>
                  <RouteGuard>{children}</RouteGuard>
                </OrdersProvider>
              </CheckoutProvider>
            </CartProvider>
          </WishlistProvider>
        </AddressesProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
