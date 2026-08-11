import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/styles/components/pages.css";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function StaffAuthLayout({ children }: { children: ReactNode }) { return children; }
