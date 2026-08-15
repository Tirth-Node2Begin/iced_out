import { AdminCustomerDetail } from "@/features/01-users/components/admin-customer-detail";
import { CUSTOMER_SEED, reservedCustomerSlots } from "@/features/01-users/customers-data";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  return <AdminCustomerDetail customerId={customerId} />;
}

/* The seeded register, plus the band of ids a shopper signing in on this
   device can be given — so a customer who only exists in the browser still has
   a page on the exported site. */
export function generateStaticParams() {
  return [...CUSTOMER_SEED.map((customer) => customer.id), ...reservedCustomerSlots].map(
    (customerId) => ({ customerId }),
  );
}
