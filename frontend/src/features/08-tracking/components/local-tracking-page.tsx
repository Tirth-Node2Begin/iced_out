"use client";

/* ============================================================================
   Tracking for an order placed on this device.

   The seeded shipments are served straight from the server as fixtures. An
   order placed at checkout exists only in this browser's storage, so its
   shipment has to be resolved after mount — and then rendered through exactly
   the same screen, so there is one tracking page rather than two that will
   drift apart.

   Both waiting states are built in the same vocabulary as the resolved page —
   the same flat ground, the same header rhythm, the same plate — so the screen
   does not reflow into a different design and back.
   ========================================================================= */

import { ArrowUpRight, PackageSearch } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrders } from "@/features/07-orders/orders-context";
import {
  Reveal,
  TrackingBack,
  TrackingPage,
} from "@/features/08-tracking/components/tracking-page";
import { trackingFromOrder } from "@/features/08-tracking/data/tracking-from-order";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * The ground both waiting states sit on.
 *
 * The back link is part of it rather than of the resolved page: a token that
 * never resolves is exactly when someone most needs a way out, and a screen
 * whose only exit appears once the content loads has no exit at all.
 */
function TrackingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="tk-root">
      <header className="tk-head tk-head--bare">
        <div className="tk-shell">
          <TrackingBack />
          {children}
        </div>
      </header>
    </div>
  );
}

export function LocalTrackingPage({ token }: { token: string }) {
  const hydrated = useHydrated();
  const { orders, restored } = useOrders();

  /* Resolving. Skeletons in the shape of the real thing, so the layout does
     not jump when the record arrives. */
  if (!hydrated || !restored) {
    return (
      <TrackingShell>
        <div role="status" aria-live="polite">
          <span className="tk-eyebrow">Resolving this shipment…</span>
          <div className="tk-skel" style={{ marginTop: 24 }}>
            <Skeleton style={{ height: 42, maxWidth: 420 }} />
            <Skeleton style={{ height: 16, maxWidth: 520 }} />
          </div>
          <div className="tk-skel tk-skel--row">
            {[0, 1].map((i) => (
              <div className="tk-skel" key={i}>
                <Skeleton style={{ height: 10, maxWidth: 74 }} />
                <Skeleton style={{ height: 16, maxWidth: 130 }} />
              </div>
            ))}
          </div>
        </div>
      </TrackingShell>
    );
  }

  const order = orders.find((entry) => entry.shipment.token === token);

  /* A public token that resolves to nothing says only that — never whose it
     might be, and never how many orders exist to guess at. */
  if (!order) {
    return (
      <TrackingShell>
        <Reveal>
          <Empty className="tk-empty">
            <EmptyHeader>
              <EmptyMedia variant="default">
                <PackageSearch aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No shipment for this link</EmptyTitle>
              <EmptyDescription>
                The token may have expired, or the order it belongs to was placed
                in a different browser. Open it from your account instead.
              </EmptyDescription>
            </EmptyHeader>
            <Button className="tk-cta" asChild>
              <Link href="/account/orders">
                Go to your orders
                <span className="tk-cta__go" aria-hidden>
                  <ArrowUpRight />
                </span>
              </Link>
            </Button>
          </Empty>
        </Reveal>
      </TrackingShell>
    );
  }

  return <TrackingPage tracking={trackingFromOrder(order)} />;
}
