import type { Metadata } from "next";

import { CustomerSupport } from "@/features/14-support/components/customer-support";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() { return <CustomerSupport />; }
