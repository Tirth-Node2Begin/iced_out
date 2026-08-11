import type { ReactNode } from "react";
import { AdminModuleNav } from "@/components/admin/admin-module-nav";
export default function InventoryLayout({ children }: { children: ReactNode }) { return <><AdminModuleNav label="Inventory" links={["overview","movements","counts","transfers","warehouses"].map((page) => ({href:`/admin/inventory/${page}`,label:page}))} />{children}</>; }
