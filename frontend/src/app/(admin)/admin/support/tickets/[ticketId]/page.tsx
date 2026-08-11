import { AdminTicketDetail } from "@/features/14-support/components/admin-support-pages";
const ticketIds = ["TKT-2041", "TKT-2039", "TKT-2032"];
export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) { const { ticketId } = await params; return <AdminTicketDetail ticketId={ticketId} />; }
export function generateStaticParams() { return ticketIds.map((ticketId) => ({ ticketId })); }
