import type { ReactNode } from "react";
import { AdminModuleNav } from "@/components/admin/admin-module-nav";
export default function CmsLayout({ children }: { children: ReactNode }) { return <><AdminModuleNav label="CMS" links={["home","pages","navigation","redirects"].map((page) => ({href:`/admin/cms/${page}`,label:page}))} />{children}</>; }
