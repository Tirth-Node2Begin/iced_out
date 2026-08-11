import { AdminOrderDetail } from "@/features/07-orders/components/admin-order-detail";

const orderIds = ["IO-2026-1048", "IO-2026-1047", "IO-2026-1046"];

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) { const { orderId } = await params; return <AdminOrderDetail orderId={orderId} />; }
export function generateStaticParams() { return orderIds.map((orderId) => ({ orderId })); }
