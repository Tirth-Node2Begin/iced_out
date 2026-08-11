import { Suspense } from "react";

import { CustomerAuthPage } from "@/features/20-auth-security/components/customer-auth-page";

export default function RegisterPage() {
  return <Suspense fallback={<main className="route-guard"><span className="skeleton" /></main>}><CustomerAuthPage mode="register" /></Suspense>;
}
