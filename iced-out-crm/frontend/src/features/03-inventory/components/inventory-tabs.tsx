"use client";

import { AdminModuleNav } from "@/components/shell/admin-module-nav";

/**
 * The inventory area's screens, as one pill.
 *
 * It sits inside each register's toolbar rather than in a band above the page:
 * which screen you are on and what you have narrowed it to then read as a
 * single row of controls, instead of two bands with a page header between them.
 *
 * The order is the flow, not the alphabet — material comes in on the left and
 * leaves as a finished garment on the right:
 *
 *   Suppliers → Purchases → Materials → Production → Stock → Transfers
 *
 * Warehouses sits at the end because it is the place all of that happens in
 * rather than a step in it.
 */
export const INVENTORY_LINKS = [
  { href: "/inventory/suppliers", label: "Suppliers" },
  { href: "/inventory/purchases", label: "Purchases" },
  { href: "/inventory/materials", label: "Materials" },
  { href: "/inventory/production", label: "Production" },
  { href: "/inventory/overview", label: "Stock" },
  { href: "/inventory/transfers", label: "Transfers" },
  { href: "/inventory/warehouses", label: "Warehouses" },
];

export function InventoryTabs() {
  return <AdminModuleNav inline label="Inventory" links={INVENTORY_LINKS} />;
}
