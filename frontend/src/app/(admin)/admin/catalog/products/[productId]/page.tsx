import { AdminProductEditor } from "@/features/02-products/components/admin-product-editor";

const productIds = ["afterdark-hoodie", "signal-puffer", "nocturne-cap"];
export default async function ProductEditorPage({ params }: { params: Promise<{ productId: string }> }) { const { productId } = await params; return <AdminProductEditor productId={productId} />; }
export function generateStaticParams() { return productIds.map((productId) => ({ productId })); }
