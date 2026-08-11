import type { ReactNode } from "react";

import { PaymentModuleNav } from "@/features/09-payment/admin-payments-shell";

export default function PaymentsLayout({ children }: { children: ReactNode }) {
  return <><PaymentModuleNav />{children}</>;
}
