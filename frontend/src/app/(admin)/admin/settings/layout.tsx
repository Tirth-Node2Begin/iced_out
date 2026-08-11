import type { ReactNode } from "react";
import { AdminModuleNav } from "@/components/admin/admin-module-nav";
export default function SettingsLayout({ children }: { children: ReactNode }) { return <><AdminModuleNav label="Settings" links={["store","tax","localization","payments","shipping","integrations","security"].map((page) => ({href:`/admin/settings/${page}`,label:page}))} />{children}</>; }
