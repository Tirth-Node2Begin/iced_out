import type { Metadata } from "next";

import { AccountVouchers } from "@/features/10-coupons/components/account-vouchers";

export const metadata: Metadata = { title: "Vouchers" };

export default function VouchersPage() { return <AccountVouchers />; }
