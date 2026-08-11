import type { ReactNode } from "react";
import { AdminModuleNav } from "@/components/admin/admin-module-nav";
export default function AnalyticsLayout({ children }: { children: ReactNode }) { return <><AdminModuleNav label="Analytics" links={["overview","sales","products","customers","inventory","returns","search","shipping","support"].map((page) => ({href:`/admin/analytics/${page}`,label:page}))} />{children}</>; }
