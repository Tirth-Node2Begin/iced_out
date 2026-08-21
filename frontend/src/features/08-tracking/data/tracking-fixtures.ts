export type TrackingFixture = {
  token: string;
  order: string;
  /**
   * `Processing` is the state a parcel is in before anyone has scanned it.
   * Without it every freshly placed order claimed to be "In transit" while it
   * was still on a bench in the studio — and a tracking page that overstates
   * where a parcel is poisons every honest update that follows it.
   */
  status: "Processing" | "In transit" | "Delivered";
  carrier: string;
  awb: string;
  estimate: string;
  destination: string;
  events: Array<{ label: string; detail: string; time: string; complete: boolean }>;
};

/* The seeded parcels are gone with the reserved-token pool that addressed them.
   Tracking is client-rendered from `?token=` now, and a token resolves against the
   order the shopper actually placed — see `tracking-from-order`. What stays is the
   SHAPE the tracking page renders. */
/* `findTrackingFixture` went with them. Nothing looks a parcel up in a table of
   seeded ones any more: the token belongs to the shopper's own order, and
   `tracking-from-order` builds the timeline from that. */
