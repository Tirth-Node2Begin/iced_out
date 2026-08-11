"use client";

import { PrimaryNav } from "@/components/nav/primary-nav";

/**
 * The bar for /new-home and the two department surfaces under it.
 *
 * Mounted in `.nh-nav-scope`, the same sticky wrapper every other header on the
 * site uses. It used to be left out on purpose — the reference let the header
 * travel away with the hero rather than pin over the scrolled page — but the
 * bar now retracts on the way down and comes back on the way up, and a header
 * that has already scrolled off the top of the *document* has nothing to come
 * back to: it was gone for the rest of the page either way. These are the two
 * surfaces the rail's own Men and Women links point at, so that was most of the
 * shop's browsing with no chrome on it.
 *
 * The wordmark points at `/`, never `/new-home`: the root serves this same
 * experience, so sending shoppers to the pretty URL keeps /new-home off the bar
 * while leaving the route itself reachable.
 */
export function SiteNav() {
  return (
    <div className="nh-nav-scope">
      <PrimaryNav currentPath="/" logoHref="/" signInHref="/auth/login?returnTo=%2F" />
    </div>
  );
}
