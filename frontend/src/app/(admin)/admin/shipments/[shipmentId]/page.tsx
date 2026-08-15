import { ShipmentDetail } from "@/features/17-shipping/components/shipment-detail";
import { shipmentFixtures } from "@/features/17-shipping/data/shipment-fixtures";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
  const { shipmentId } = await params;
  return <ShipmentDetail shipmentId={shipmentId} />;
}

export function generateStaticParams() {
  return shipmentFixtures.map(({ id }) => ({ shipmentId: id }));
}
