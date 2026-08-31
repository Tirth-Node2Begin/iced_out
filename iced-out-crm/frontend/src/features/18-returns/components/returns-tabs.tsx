"use client";

import { AdminModuleNav } from "@/components/shell/admin-module-nav";

/**
 * The two return screens, in the toolbar rather than floating above the page —
 * see the note on `ShipmentTabs` for why.
 *
 * The split between them is what the customer asked for: money back as store
 * credit, or a different garment. Nothing appears on both. The vouchers a
 * settled return issues are read in their own area (see the rail), because a
 * ledger of what the store owes is looked up for reasons that have nothing to
 * do with any one return.
 */
export const RETURN_LINKS = [
  { href: "/returns/requests", label: "Returns" },
  { href: "/returns/exchanges", label: "Exchanges" },
];

export function ReturnsTabs() {
  return <AdminModuleNav inline label="Returns & Exchanges" links={RETURN_LINKS} />;
}
