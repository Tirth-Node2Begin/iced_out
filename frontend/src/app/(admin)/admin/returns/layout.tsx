import type { ReactNode } from "react";
import { AdminModuleNav } from "@/components/admin/admin-module-nav";
export default function ReturnsLayout({ children }: { children: ReactNode }) { return <><AdminModuleNav label="Return" links={["requests","qc","exchanges"].map((page) => ({href:`/admin/returns/${page}`,label:page}))} />{children}</>; }
