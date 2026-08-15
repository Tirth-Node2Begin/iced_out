import { AdminOrderDetail } from "@/features/07-orders/components/admin-order-detail";
import { adminOrderIds } from "@/features/07-orders/data/admin-order-fixtures";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) { const { orderId } = await params; return <AdminOrderDetail orderId={orderId} />; }
/* Every id the register can link to — this is a static export, so an order
   missing from here is a 404 rather than a page. */
export function generateStaticParams() { return adminOrderIds.map((orderId) => ({ orderId })); }
