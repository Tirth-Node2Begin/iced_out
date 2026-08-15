"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** The old address for courier pickups, kept alive for existing bookmarks. */
export default function LegacyManifestsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/shipments/pickups");
  }, [router]);

  return null;
}
