import type { Metadata } from "next";
import { Suspense } from "react";

import { CustomerAuthPage } from "@/features/20-auth-security/components/customer-auth-page";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <Suspense fallback={<main className="route-guard"><span className="skeleton" /></main>}><CustomerAuthPage mode="forgot" /></Suspense>;
}
