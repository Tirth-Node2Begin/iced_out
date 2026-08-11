"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * The tab is called Feedback now; this path is kept so an old bookmark still
 * lands somewhere. The redirect is client-side because the app is a static
 * export — there is no server to answer with a 308.
 */
export default function ReviewsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/account/feedback");
  }, [router]);

  return (
    <div className="io-empty">
      <strong>Reviews are now Feedback</strong>
      Taking you there…
    </div>
  );
}

