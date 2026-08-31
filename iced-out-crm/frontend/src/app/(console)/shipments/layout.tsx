import type { ReactNode } from "react";

/**
 * No nav band of its own. The three shipment screens name themselves inside
 * each register's toolbar instead — see `ShipmentTabs` — so the area reads as
 * one row of controls rather than a strip of tabs above a strip of filters.
 *
 * The links themselves live with that component, next to the screens they point
 * at, rather than here.
 *
 * The segment keeps a layout so its `loading.tsx` still has one to suspend in.
 */
export default function ShipmentsLayout({ children }: { children: ReactNode }) {
  return children;
}
