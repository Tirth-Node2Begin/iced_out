"use client";

import { AdminModuleNav } from "@/components/shell/admin-module-nav";

/**
 * The three shipment screens, as the first control in each one's toolbar.
 *
 * They used to sit in a floating pill rendered by the segment layout, which put
 * a band of navigation above the page head and a band of filters below it —
 * two strips of pills with a hero between them, saying the same kind of thing.
 * Down here they read as one row: where you are, then how you have narrowed it.
 * Catalog, inventory and payments already worked this way; this is the module
 * catching up.
 */
export const SHIPMENT_LINKS = [
  { href: "/shipments/active", label: "Active" },
  { href: "/shipments/failed", label: "Failed deliveries" },
  { href: "/shipments/pickups", label: "Courier pickups" },
];

export function ShipmentTabs() {
  return <AdminModuleNav inline label="Shipments" links={SHIPMENT_LINKS} />;
}
