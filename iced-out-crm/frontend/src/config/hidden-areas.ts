/**
 * Areas switched OFF in the console.
 *
 * Nothing here is deleted. The screens, the components, the API routes and the
 * database tables behind them are all untouched and still work — an area named
 * in this list is simply not offered: it loses its lane in the rail, it stops
 * appearing in the "Go to…" palette, its tiles come off the dashboard, and the
 * route guard sends anyone who types the URL back to the dashboard.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TO BRING AN AREA BACK: delete its line below. That is the whole change.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * One list rather than a flag per screen, because the failure mode of hiding a
 * feature is always the same — the lane goes but a card on some other screen
 * still links to it, and the operator lands on a page that is supposed to be
 * gone. Everything that can offer a route reads this one array, so an area
 * cannot be half-hidden.
 *
 * These are AREA prefixes, so "/contacts" covers "/contacts/detail" too.
 */
export const HIDDEN_AREAS: string[] = [
  /* Hidden 2 Sep 2026 at the shop's request: the CRM half is not in use yet.
     Leads and Tasks stay — only these three are off. */
  "/contacts",
  "/companies",
  "/deals",
];

/** True when a path belongs to an area that is currently switched off. */
export function isHiddenArea(pathname: string): boolean {
  return HIDDEN_AREAS.some((area) => pathname === area || pathname.startsWith(`${area}/`));
}
