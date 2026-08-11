import type { ReactNode } from "react";
import { AdminModuleNav } from "@/components/admin/admin-module-nav";
export default function ShipmentsLayout({ children }: { children: ReactNode }) { return <><AdminModuleNav label="Shipment" links={["active","ndr","manifests"].map((page) => ({href:`/admin/shipments/${page}`,label:page}))} />{children}</>; }
