import { PaymentDetail } from "@/features/09-payment/payment-detail";
import { payments } from "@/features/09-payment/payment-data";
import { reservedPaymentSlots } from "@/features/09-payment/payment-slots";

export default async function PaymentPage({ params }: { params: Promise<{ paymentId: string }> }) { const { paymentId } = await params; return <PaymentDetail paymentId={paymentId} />; }
/* The seeded ids, plus every id a payment taken in this browser can claim.
   This is a static export: a page not written here is a 404 rather than a
   record, which is the whole reason checkout mints from a pool. */
export function generateStaticParams() {
  return [...payments.map(({ id }) => id), ...reservedPaymentSlots].map((paymentId) => ({ paymentId }));
}
