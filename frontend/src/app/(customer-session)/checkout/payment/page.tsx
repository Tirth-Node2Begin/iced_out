"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * The old second screen, kept only as a door back to the first.
 *
 * Payment used to be its own route. It is step 04 of `/checkout` now, and this
 * file exists because a shopper can have this URL in a tab from before the
 * change, or in their history. Deleting it outright would answer that with a
 * 404 on a page they were about to pay on.
 *
 * `replace`, not `push`: this route is a forwarding address, and leaving it in
 * the history means pressing Back off the checkout lands on it and bounces
 * forward again.
 *
 * A client redirect rather than `redirect()` from `next/navigation` — the app
 * is exported as static HTML (`output: "export"`), so there is no server to
 * issue a 308 and the navigation has to happen in the browser.
 */
export default function CheckoutPaymentRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/checkout");
  }, [router]);

  return (
    <div className="io-scope">
      <div className="io-page">
        <div className="io-page__wrap">
          <div className="co-load" role="status">
            Payment is part of checkout now — taking you there…
          </div>
        </div>
      </div>
    </div>
  );
}
