import type { ReactNode } from "react";

import { AdminModuleNav } from "@/components/admin/admin-module-nav";

const LINKS = [
  { href: "/admin/shipments/active", label: "Active" },
  { href: "/admin/shipments/failed", label: "Failed deliveries" },
  { href: "/admin/shipments/pickups", label: "Courier pickups" },
];

export default function ShipmentsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminModuleNav label="Shipments" links={LINKS} />
      {children}
    </>
  );
}
