import type { ReactNode } from "react";

import { AdminModuleNav } from "@/components/admin/admin-module-nav";

/**
 * Two screens, and the split between them is what the customer asked for: money
 * back as store credit, or a different garment. Nothing appears on both.
 *
 * The vouchers a settled return issues are read in their own area — see the
 * rail — because a ledger of what the store owes is looked up for reasons that
 * have nothing to do with any one return.
 */
const LINKS = [
  { href: "/admin/returns/requests", label: "Returns" },
  { href: "/admin/returns/exchanges", label: "Exchanges" },
];

export default function ReturnsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminModuleNav label="Returns & Exchanges" links={LINKS} />
      {children}
    </>
  );
}
