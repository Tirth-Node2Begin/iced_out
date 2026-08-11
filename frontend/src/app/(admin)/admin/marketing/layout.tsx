import type { ReactNode } from "react";
import { AdminModuleNav } from "@/components/admin/admin-module-nav";
export default function MarketingLayout({ children }: { children: ReactNode }) { return <><AdminModuleNav label="Marketing" links={["coupons","campaigns","abandoned-carts","recommendations"].map((page) => ({href:`/admin/marketing/${page}`,label:page}))} />{children}</>; }
