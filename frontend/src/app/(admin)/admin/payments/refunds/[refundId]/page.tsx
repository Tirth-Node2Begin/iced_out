import { PaymentWorkspace } from "@/features/09-payment/payment-workspace";
import { paymentRefunds } from "@/features/09-payment/payment-data";
export default async function RefundPage({ params }: { params: Promise<{ refundId: string }> }) { const { refundId } = await params; return <PaymentWorkspace view="refund-detail" recordId={refundId} />; }

export function generateStaticParams() {
  return paymentRefunds.map(({ id }) => ({ refundId: id }));
}
