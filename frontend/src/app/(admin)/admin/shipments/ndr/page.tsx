"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * The old address for this screen, kept alive.
 *
 * "NDR" is courier jargon nobody in the warehouse says out loud, so the screen
 * now lives at `/admin/shipments/failed`. A bookmark on the old path still
 * lands on it — the site is statically exported, so the hop happens in the
 * browser rather than as a server redirect.
 */
export default function LegacyNdrPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/shipments/failed");
  }, [router]);

  return null;
}
