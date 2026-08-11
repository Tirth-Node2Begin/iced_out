import { Suspense } from "react";

import { StaffLoginPage } from "@/features/20-auth-security/components/staff-login-page";

export default function AdminLoginPage() {
  return <Suspense fallback={<main className="route-guard"><span className="skeleton" /></main>}><StaffLoginPage /></Suspense>;
}
