import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/styles/components/admin.css";

import { AdminShell } from "@/components/admin/admin-shell";
import { StockProvider } from "@/features/03-inventory/stock-context";
import { FulfilmentProvider } from "@/features/07-orders/fulfilment-context";

/* `absolute` opts the whole console out of the storefront's `Iced Out • <page>`
   template: staff tabs carry the wordmark and nothing else, so a screen share
   never announces which queue or customer record is open. */
export const metadata: Metadata = {
  title: { absolute: "Iced Out" },
  robots: { index: false, follow: false },
};

/* Orders and shipments are one story told on two screens, so the store they
   share is mounted above both of them rather than inside either. Stock is here
   for the same reason: an item and its sizes arrive in the inventory register,
   and the catalogue is where they are chosen to be sold. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <FulfilmentProvider>
      <StockProvider>
        <AdminShell>{children}</AdminShell>
      </StockProvider>
    </FulfilmentProvider>
  );
}
