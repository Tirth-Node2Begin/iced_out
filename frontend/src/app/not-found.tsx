import { StatusActions } from "@/components/layout/status-actions";

import "@/styles/components/status.css";

/**
 * The shop's 404.
 *
 * Placed at the root of `app/` on purpose: the root `not-found` is the only one
 * Next serves for *unmatched* URLs, not just for `notFound()` calls inside a
 * segment. The build is `output: "export"`, so this renders once into
 * `404.html` — the file a host reaches for when nothing else matches.
 *
 * Deliberately almost empty. A dead end is not a place to explain anything: the
 * visitor already knows the address was wrong, and every extra line is one more
 * thing to read before they can leave. So the page is the numeral, dissolving
 * downward, and the two ways out. No panel, no copy, no diagnostics.
 *
 * The only client code is the actions island. The entrance is a CSS keyframe
 * rather than a motion component, which keeps a page nobody wants to be on
 * close to zero JavaScript.
 */
export default function NotFound() {
  return (
    <main className="st">
      {/* The numeral is scenery — it carries no information a screen reader
          needs, and "four zero four" announced before the real heading is
          noise. The heading below it is the accessible name for the page and
          is visually hidden rather than absent. */}
      <p className="st__figure" aria-hidden="true">
        404
      </p>

      <h1 className="sr-only">Page not found</h1>

      <StatusActions homeHref="/" homeLabel="Back to home" />
    </main>
  );
}
