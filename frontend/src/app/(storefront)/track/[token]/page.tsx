/* The shipment view's own sheet. Everything in it is scoped under `.tk-root`,
   including the block that re-points the shadcn tokens at the nh palette. */
import "@/styles/tracking.css";

import type { Metadata } from "next";
import { LocalTrackingPage } from "@/features/08-tracking/components/local-tracking-page";
import { TrackingPage } from "@/features/08-tracking/components/tracking-page";
import { reservedTrackingTokens } from "@/features/07-orders/data/order-slots";
import { findTrackingFixture, trackingFixtures } from "@/features/08-tracking/data/tracking-fixtures";

export const metadata: Metadata = { title: "Shipment tracking", robots: { index: false, follow: false } };

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  /* A seeded shipment renders on the server. Anything else is an order placed
     in a browser, and only that browser can resolve it — falling back to the
     first fixture, as this route used to, showed one shopper another
     shopper's parcel the moment a token missed. */
  const tracking = findTrackingFixture(token);
  if (tracking) return <TrackingPage tracking={tracking} />;
  return <LocalTrackingPage token={token} />;
}

export function generateStaticParams() {
  return [...trackingFixtures.map(({ token }) => token), ...reservedTrackingTokens].map((token) => ({
    token,
  }));
}
