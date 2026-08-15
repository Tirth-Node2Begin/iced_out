import type { ReactNode } from "react";

import { AdminModuleNav } from "@/components/admin/admin-module-nav";

/* Support is one screen. The tab stays so the area still names itself above
   the page the way every other module does. */
const LINKS = [{ href: "/admin/support", label: "Customer queries" }];

export default function SupportLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminModuleNav label="Support" links={LINKS} />
      {children}
    </>
  );
}
