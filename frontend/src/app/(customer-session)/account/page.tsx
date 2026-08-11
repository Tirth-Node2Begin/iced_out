"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * `/account` is no longer a screen — it is the door into the first tab.
 *
 * The overview it used to render was a table of contents for the menu already
 * standing beside it: every number on it belonged to a tab, and the frame above
 * still prints the three totals. Profile leads instead, and this stays behind
 * so bookmarks and the header's avatar keep landing somewhere.
 *
 * `replace`, not `push`, so "back" leaves the account rather than bouncing off
 * this redirect into it again.
 */
export default function AccountPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/account/profile");
  }, [router]);

  return (
    <div className="io-sec__body">
      <p className="io-empty" aria-live="polite">
        Opening your profile…
      </p>
    </div>
  );
}
