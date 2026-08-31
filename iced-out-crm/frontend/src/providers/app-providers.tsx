"use client";

import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { resetCrmStores } from "@/features/22-crm/crm-api";
import { AuthProvider, useAuth } from "@/features/20-auth-security/auth-context";
import { RouteGuard } from "@/features/20-auth-security/components/route-guard";

/**
 * The CRM's provider tree — four levels, against the storefront's twelve.
 *
 * That difference is the point of the split. The shop needs a bag, a wishlist, a
 * wallet, a checkout draft and an order archive alive at once because a shopper
 * moves between them in one session. An operator does not: every register here
 * is server-owned and read through `useSyncExternalStore` on a module-level
 * store, so a screen subscribes to what it needs and nothing has to be hoisted
 * into a context to be shared.
 *
 * The two that ARE contexts — stock and fulfilment — live in the console
 * layout rather than here, because they are shared by exactly two areas each and
 * mounting them app-wide would load an order register to render the login page.
 */
function StoreReset({ children }: { children: ReactNode }) {
  const { subscribeToSignOut } = useAuth();

  /* Signing out has to drop every held register, or the next person to sign in
     on this machine sees the last one's customers for as long as it takes the
     first fetch to land. */
  useEffect(() => subscribeToSignOut(resetCrmStores), [subscribeToSignOut]);

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <StoreReset>
        <RouteGuard>{children}</RouteGuard>
        {/* One mount for the whole app, and OUTSIDE the guard: `toast()` is
            called from anywhere, the toasts portal to `document.body` regardless
            of where this sits in the tree, and a second mount would show every
            toast twice. */}
        <Toaster />
      </StoreReset>
    </AuthProvider>
  );
}
