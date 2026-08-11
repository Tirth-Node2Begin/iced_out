import type { OrderRecord } from "@/features/07-orders/orders-context";
import type { TrackingFixture } from "@/features/08-tracking/data/tracking-fixtures";

/**
 * A shipment view, derived from the order that produced it.
 *
 * THIS IS THE SEAM. Today a tracking record for an order placed on this device
 * is computed here, from the only facts the browser actually holds: when it was
 * ordered, whether the money has moved, which service was bought, and what was
 * promised. When the carrier API arrives it replaces this function and nothing
 * that renders a shipment has to change — the screens are already written
 * against `TrackingFixture`.
 *
 * What it deliberately does NOT do is invent carrier events. A parcel that has
 * not been handed over has no scan, no AWB and no carrier, and printing
 * "collected from the fulfilment centre" over an order placed four minutes ago
 * is the one thing a tracking page must never do — every later update would be
 * read against a lie. Steps that have not happened are shown as not having
 * happened.
 */
export function trackingFromOrder(order: OrderRecord): TrackingFixture {
  const paid = order.payment.status === "Captured";
  const delivered = order.status === "Delivered";

  return {
    token: order.shipment.token,
    order: order.number,
    // Nothing here has been scanned by a carrier yet, so nothing here is in
    // transit. It says so until an API tells it otherwise.
    status: delivered ? "Delivered" : "Processing",
    // Allocation happens after the order is placed, so before dispatch the
    // honest answer is that no carrier has it yet.
    carrier: delivered ? order.shipment.service : "Allocated at dispatch",
    awb: order.shipment.awb,
    estimate: delivered
      ? `Delivered · ${order.shipment.estimate}`
      : `Expected ${order.shipment.estimate}`,
    destination: order.shipment.destination,
    events: [
      {
        label: "Order confirmed",
        detail: `${order.lines.length} item${order.lines.length === 1 ? "" : "s"} reserved against this order`,
        time: order.date,
        complete: true,
      },
      {
        label: paid ? "Payment captured" : "Payment on delivery",
        detail: order.payment.method,
        time: paid ? order.date : "Collected by the courier",
        complete: paid,
      },
      {
        label: "Packed",
        detail: "Scan-to-pack check at the fulfilment studio",
        time: "Next operational event",
        complete: delivered,
      },
      {
        label: "Courier handoff",
        detail: "The AWB and carrier appear here once the parcel is collected",
        time: "Awaiting dispatch",
        complete: delivered,
      },
      {
        label: "Delivered",
        detail: delivered ? "Delivery completed" : "Proof of delivery will appear here",
        time: order.shipment.estimate,
        complete: delivered,
      },
    ],
  };
}
