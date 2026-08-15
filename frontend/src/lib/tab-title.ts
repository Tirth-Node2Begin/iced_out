/**
 * The browser tab reads `Iced Out • <page>` across the storefront: the wordmark,
 * a centred dot, then wherever the shopper is. The root layout owns the wordmark
 * and the template; every segment below it supplies only its own short name.
 *
 * Operations is deliberately outside this. `(admin)/admin/layout.tsx` and the
 * staff sign-in set `title: { absolute: SITE_NAME }`, so console tabs read a bare
 * `Iced Out` — a screen share never announces which queue or record is open.
 */
export const SITE_NAME = "Iced Out";

export const TAB_TEMPLATE = `${SITE_NAME} • %s`;

/**
 * A section title for a layout that has titled routes beneath it.
 *
 * A layout whose `title` is a plain string *consumes* the parent template: the
 * segment itself resolves correctly, but its children then render bare — which
 * is how `/account/profile` came out as "Profile" rather than
 * "Iced Out • Profile". Re-declaring the template alongside the default keeps
 * the format alive all the way down. Leaf pages and childless layouts can keep
 * using a plain string.
 */
export const sectionTitle = (page: string) => ({ default: page, template: TAB_TEMPLATE });
