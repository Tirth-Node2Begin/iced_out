import type { ReactNode } from "react";

/**
 * No nav band of its own, and no tab strip either.
 *
 * The area's seven screens used to be named inside each register's toolbar
 * (`InventoryTabs`, now deleted). Seven is more than a strip can hold: it ran
 * the width of the toolbar in every register, ahead of that register's own
 * search and filters, so the first row of every inventory screen was mostly
 * navigation. They are listed in the rail under Inventory instead — see
 * `crm-shell.tsx`, note 3.
 *
 * The segment keeps a layout so its `loading.tsx` still has one to suspend in.
 */
export default function InventoryLayout({ children }: { children: ReactNode }) {
  return children;
}
