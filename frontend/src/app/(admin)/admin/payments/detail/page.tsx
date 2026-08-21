import { Suspense } from "react";

import { AdminRouteLoading } from "@/components/admin/admin-route-loading";
import { PaymentDetailRoute } from "@/features/09-payment/payment-detail-route";

/**
 * One record, addressed by `?id=`.
 *
 * This replaced a `[paymentId]` segment whose `generateStaticParams` listed the
 * FIXTURE ids. The console is a static export, so every dynamic segment has to be
 * named at build time — and the records this screen is for are created afterwards:
 * an order placed a minute ago, a customer who registered today. One static route
 * serves every record there will ever be.
 *
 * The Suspense boundary is required: `useSearchParams` suspends on the prerender
 * pass, and without it the whole route opts out of prerendering.
 */
export default function PaymentDetailRoutePage() {
  return (
    <Suspense fallback={<AdminRouteLoading />}>
      <PaymentDetailRoute />
    </Suspense>
  );
}
