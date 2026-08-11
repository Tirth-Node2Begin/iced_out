import type { ReactNode } from "react";
import { AdminModuleNav } from "@/components/admin/admin-module-nav";
export default function FulfilmentLayout({ children }: { children: ReactNode }) { return <><AdminModuleNav label="Fulfilment" links={["allocation","pick","pack","dispatch"].map((page) => ({href:`/admin/fulfilment/${page}`,label:page}))} />{children}</>; }
