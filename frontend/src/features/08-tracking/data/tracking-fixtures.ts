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

export const trackingFixtures: TrackingFixture[] = [
  {
    token: "track-1048-demo", order: "IO-2026-1048", status: "In transit", carrier: "Blue Dart", awb: "AWB ••••1048", estimate: "Expected 08–09 Aug", destination: "Bengaluru, Karnataka",
    events: [
      { label: "Order confirmed", detail: "Payment and inventory reservation verified", time: "04 Aug · 14:32", complete: true },
      { label: "Packed", detail: "Package passed the scan-to-pack check", time: "05 Aug · 10:18", complete: true },
      { label: "Courier handoff", detail: "Collected from the fulfilment centre", time: "05 Aug · 18:06", complete: true },
      { label: "In transit", detail: "Moving through the destination network", time: "Latest provider update", complete: false },
      { label: "Delivered", detail: "Proof of delivery will appear here", time: "Expected 08–09 Aug", complete: false },
    ],
  },
  {
    token: "track-1027-demo", order: "IO-2026-1027", status: "Delivered", carrier: "Delhivery", awb: "AWB ••••1027", estimate: "Delivered 18 Jul · 12:44", destination: "New Delhi, Delhi",
    events: [
      { label: "Order confirmed", detail: "Payment and inventory reservation verified", time: "15 Jul · 11:06", complete: true },
      { label: "Packed", detail: "Package passed the scan-to-pack check", time: "15 Jul · 16:41", complete: true },
      { label: "Courier handoff", detail: "Collected from the fulfilment centre", time: "16 Jul · 09:25", complete: true },
      { label: "Out for delivery", detail: "Courier route started", time: "18 Jul · 08:10", complete: true },
      { label: "Delivered", detail: "Delivery completed", time: "18 Jul · 12:44", complete: true },
    ],
  },
];

export function findTrackingFixture(token: string) {
  return trackingFixtures.find((tracking) => tracking.token === token);
}
