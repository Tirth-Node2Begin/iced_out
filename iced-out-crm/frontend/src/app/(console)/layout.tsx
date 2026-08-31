import type { ReactNode } from "react";

import { CrmShell } from "@/components/shell/crm-shell";
import { StockProvider } from "@/features/03-inventory/stock-context";
import { FulfilmentProvider } from "@/features/07-orders/fulfilment-context";

/**
 * Everything behind the sign-in wall renders inside the shell.
 *
 * Two stores are mounted here rather than app-wide. Orders and shipments are one
 * story told on two screens, so the register they share sits above both of them
 * instead of inside either; stock is here for the same reason — an item and its
 * sizes arrive in the inventory register, and the catalogue is where they are
 * chosen to be sold.
 *
 * They are NOT in `AppProviders`, because that tree also wraps `/login`, and
 * loading an order register to paint a sign-in form is a request nobody asked
 * for from someone who may not be allowed to make it.
 *
 * Metadata is not re-declared: the root layout already pins the title to the
 * bare wordmark and marks every screen noindex.
 */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <FulfilmentProvider>
      <StockProvider>
        <CrmShell>{children}</CrmShell>
      </StockProvider>
    </FulfilmentProvider>
  );
}
