import { AdminReturnDetail } from "@/features/18-returns/components/admin-return-detail";
import { adminReturnFixtures } from "@/features/18-returns/data/admin-return-fixtures";
export default async function AdminReturnPage({ params }: { params: Promise<{ returnId: string }> }) { const { returnId } = await params; return <AdminReturnDetail returnId={returnId} />; }
export function generateStaticParams() { return adminReturnFixtures.map(({ id }) => ({ returnId: id })); }
