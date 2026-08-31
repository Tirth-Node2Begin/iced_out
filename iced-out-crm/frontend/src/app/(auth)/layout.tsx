import type { ReactNode } from "react";

/**
 * The three screens outside the wall: sign in, forgot password, reset password.
 *
 * No shell — there is nothing to navigate to yet — and no font declaration of
 * its own: the root layout puts `--font-ui` on `<body>`, which is above
 * every route group, so this one inherits it. (The storefront's copy of this
 * file loaded the font again because its root layout served a different family
 * to the shop; here there is only one.)
 *
 * `display: contents` keeps this component out of the box model entirely, so
 * the sign-in page's own 100dvh root is a direct child of `<body>`.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div style={{ display: "contents" }}>{children}</div>;
}
