/**
 * What a route shows while its own chunk is still in flight.
 *
 * Every route here is statically exported, so a destination the shopper hovered
 * — or one that simply sat in the viewport long enough to be prefetched — is
 * served from cache, never suspends, and never renders this at all. It exists
 * for the other case: the link clicked before its prefetch landed, or clicked
 * on a connection where it never got the chance. Without a boundary that
 * navigation shows nothing, the old page just sits there, and a dead click gets
 * clicked again.
 *
 * The shape of it is dictated by one constraint: a Suspense fallback *replaces*
 * the page rather than sitting over it. So this has to be a surface, not a
 * spinner floating in a void — it paints the same near-black the document does,
 * which is why a transition that resolves quickly looks like nothing happened
 * rather than like a flash of empty screen.
 *
 * Everything visible is held back 140ms (`route-loading.css`). Under that, the
 * shopper sees an unbroken background and reads the navigation as instant; over
 * it, the mark and the sweep fade up to say the wait is real. The threshold is
 * roughly where a delay stops being imperceptible and starts needing an answer.
 *
 * A Server Component — it holds no state and nothing here needs the client.
 */
export function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-label="Loading">
      <span aria-hidden className="route-loading__sweep" />

      <div className="route-loading__center">
        {/* The same cut stone the nav bar draws, so the thing that persists
            across the gap is the brand rather than a generic spinner. */}
        <svg aria-hidden className="route-loading__mark" fill="none" viewBox="0 0 24 24">
          <path
            d="M12 2 3 9l9 13 9-13-9-7Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.4"
          />
          <path d="M3 9h18M12 2v20" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.1" />
        </svg>
        <span className="route-loading__label">Loading</span>
      </div>
    </div>
  );
}
