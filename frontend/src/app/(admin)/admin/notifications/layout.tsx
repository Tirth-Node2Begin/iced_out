import type { ReactNode } from "react";
import { AdminModuleNav } from "@/components/admin/admin-module-nav";
export default function NotificationsLayout({ children }: { children: ReactNode }) { return <><AdminModuleNav label="Notification" links={["templates","delivery-logs","preferences"].map((page) => ({href:`/admin/notifications/${page}`,label:page}))} />{children}</>; }
