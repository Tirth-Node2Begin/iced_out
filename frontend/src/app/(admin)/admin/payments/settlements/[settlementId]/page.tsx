import { PaymentWorkspace } from "@/features/09-payment/payment-workspace";
import { settlements } from "@/features/09-payment/payment-data";
export default async function SettlementPage({ params }: { params: Promise<{ settlementId: string }> }) { const { settlementId } = await params; return <PaymentWorkspace view="settlement-detail" recordId={settlementId} />; }

export function generateStaticParams() {
  return settlements.map(({ id }) => ({ settlementId: id }));
}
