/**
 * Shipment fixtures.
 *
 * Kept in a plain module rather than beside the workspace component: the
 * `[shipmentId]` route's `generateStaticParams` runs on the server, and a
 * value exported from a `"use client"` file arrives there as a client
 * reference rather than as the array itself.
 *
 * A shipment only exists once an order has been dispatched, which is why every
 * one of these names the order it carries and the day it left. A confirmed
 * order with no row here is work: it is what the shipments screen offers to
 * dispatch.
 */

/**
 * The states a parcel can be in. There is no "ready" — an order waiting to go
 * out is an ORDER, and it becomes a shipment at the moment it is dispatched.
 */
export const SHIPMENT_STATES = ["Dispatched", "In transit", "Delivered", "Failed", "Cancelled"] as const;
export type ShipmentState = (typeof SHIPMENT_STATES)[number];

export const COURIERS = ["Blue Dart", "Delhivery", "Ecom Express"] as const;

export type ShipmentFixture = {
  id: string;
  order: string;
  provider: string;
  awb: string;
  destination: string;
  /** The day it left the warehouse — chosen when the order was dispatched. */
  dispatched: string;
  promise: string;
  status: ShipmentState;
};

export const shipmentFixtures: ShipmentFixture[] = [
  { id: "shp-1045", order: "IO-2026-1045", provider: "Blue Dart", awb: "••••1045", destination: "Bengaluru", dispatched: "05 Aug", promise: "08–09 Aug", status: "In transit" },
  { id: "shp-1044", order: "IO-2026-1044", provider: "Delhivery", awb: "••••7714", destination: "Pune", dispatched: "04 Aug", promise: "05 Aug", status: "Delivered" },
  { id: "shp-1039", order: "IO-2026-1039", provider: "Ecom Express", awb: "••••2280", destination: "Kolkata", dispatched: "03 Aug", promise: "06 Aug", status: "Failed" },
];

/** Every id the register can link to, for the detail route's static params. */
export const shipmentIds = shipmentFixtures.map((shipment) => shipment.id);
