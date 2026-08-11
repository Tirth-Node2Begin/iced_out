import { PaymentWorkspace } from "@/features/09-payment/payment-workspace";
import { paymentTransactions } from "@/features/09-payment/payment-data";
export default async function TransactionPage({ params }: { params: Promise<{ paymentId: string }> }) { const { paymentId } = await params; return <PaymentWorkspace view="transaction-detail" recordId={paymentId} />; }

export function generateStaticParams() {
  return paymentTransactions.map(({ id }) => ({ paymentId: id }));
}
