import type { Metadata } from "next";

import { ReturnWizard } from "@/features/18-returns/components/return-wizard";

export const metadata: Metadata = { title: "Start a return" };

export default function NewReturnPage() { return <ReturnWizard />; }
