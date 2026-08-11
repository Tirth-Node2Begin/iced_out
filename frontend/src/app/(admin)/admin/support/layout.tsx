import type { ReactNode } from "react";
import { AdminModuleNav } from "@/components/admin/admin-module-nav";
export default function SupportLayout({ children }: { children: ReactNode }) { return <><AdminModuleNav label="Support" links={["tickets","faq","chat"].map((page) => ({href:`/admin/support/${page}`,label:page}))} />{children}</>; }
