import type { ReactNode } from "react";
import { AdminModuleNav } from "@/components/admin/admin-module-nav";
export default function OrdersLayout({ children }: { children: ReactNode }) { return <><AdminModuleNav label="Order" links={[{href:"/admin/orders",label:"All orders"},{href:"/admin/orders/queues/confirm",label:"Confirm"},{href:"/admin/orders/queues/review",label:"Review"},{href:"/admin/orders/queues/dispatch",label:"Dispatch"}]} />{children}</>; }
