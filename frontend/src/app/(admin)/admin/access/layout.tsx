import type { ReactNode } from "react";
import { AdminModuleNav } from "@/components/admin/admin-module-nav";
export default function AccessLayout({ children }: { children: ReactNode }) { return <><AdminModuleNav label="Access" links={["staff","roles","permissions","audit-log"].map((page) => ({href:`/admin/access/${page}`,label:page}))} />{children}</>; }