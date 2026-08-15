import type { Metadata } from "next";

import { ReturnDetail } from "@/features/18-returns/components/return-detail";
import { returnFixtures } from "@/features/18-returns/data/return-fixtures";

export const metadata: Metadata = { title: "Return" };

export default async function ReturnDetailPage({ params }: { params: Promise<{ returnId: string }> }) {
  const { returnId } = await params;
  return <ReturnDetail item={returnFixtures.find((entry) => entry.id === returnId) ?? returnFixtures[0]} />;
}

export function generateStaticParams() { return returnFixtures.map(({ id }) => ({ returnId: id })); }
