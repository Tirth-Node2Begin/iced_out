import type { Metadata } from "next";

import { WOMEN } from "@/components/gender/data";
import { GenderPage } from "@/components/gender/gender-page";

export const metadata: Metadata = {
  title: "Women",
  description:
    "Structured volume, deliberate proportion and uncompromising monochrome. Twenty numbered pieces from Drop 001 by Iced_out.",
};

export default function WomenPage() {
  return <GenderPage content={WOMEN} />;
}
