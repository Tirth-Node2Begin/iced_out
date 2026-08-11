"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * The two ways off a status screen, shared by the 404 and the staff 403.
 *
 * "Go back" is the only thing on those pages that cannot be a Server Component:
 * it reads the session's history, which does not exist until the client. It is
 * split into this island so the pages themselves stay server-rendered and a
 * dead end ships almost no JavaScript.
 *
 * The guard on `history.length` matters more here than on a normal page. A
 * status screen is frequently the *first* entry in a tab — a stale link from
 * search, a pasted URL, a bookmark that rotted — and in that case there is
 * nothing behind us. Calling `back()` there either does nothing at all or
 * throws the visitor out of the site entirely, both of which read as a broken
 * button, so it falls through to the same place the primary action points.
 */
export function StatusActions({
  homeHref,
  homeLabel,
}: {
  homeHref: string;
  homeLabel: string;
}) {
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(homeHref);
  };

  return (
    <div className="st__actions">
      <Link className="st__btn st__btn--solid" href={homeHref}>
        {homeLabel}
      </Link>
      <button className="st__btn st__btn--ghost" onClick={goBack} type="button">
        Go back
      </button>
    </div>
  );
}
