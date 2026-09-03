import { Suspense } from "react";

import { StaffRecoveryPage } from "@/features/20-auth-security/components/staff-recovery-page";

/* Suspense because the component reads `useSearchParams`, and this app is
   statically exported: the query string only exists in the browser. */
export default function StaffResetPasswordPage() {
  return (
    <Suspense fallback={<main className="route-guard"><span className="skeleton" /></main>}>
      <StaffRecoveryPage mode="reset" />
    </Suspense>
  );
}
