import { AdminOrdersWorkspace } from "@/features/07-orders/components/admin-orders-workspace";
const queues = ["confirm", "review", "dispatch"];
export default async function OrderQueuePage({ params }: { params: Promise<{ queue: string }> }) { const { queue } = await params; const label = `${queue[0]?.toUpperCase() ?? ""}${queue.slice(1)}`; return <AdminOrdersWorkspace initialQueue={label} />; }
export function generateStaticParams() { return queues.map((queue) => ({ queue })); }
