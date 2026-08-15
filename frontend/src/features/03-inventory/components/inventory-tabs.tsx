"use client";

import { AdminModuleNav } from "@/components/admin/admin-module-nav";

/**
 * The inventory area's three screens, as one pill.
 *
 * It sits inside each register's toolbar rather than in a band above the page:
 * which screen you are on and what you have narrowed it to then read as a
 * single row of controls, instead of two bands with a page header between them.
 */
export const INVENTORY_LINKS = [
  { href: "/admin/inventory/overview", label: "Stock" },
  { href: "/admin/inventory/transfers", label: "Transfers" },
  { href: "/admin/inventory/warehouses", label: "Warehouses" },
];

export function InventoryTabs() {
  return <AdminModuleNav inline label="Inventory" links={INVENTORY_LINKS} />;
}
