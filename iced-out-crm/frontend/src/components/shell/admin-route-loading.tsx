/**
 * What an admin route shows while its own chunk is still in flight.
 *
 * The root `loading.tsx` cannot serve this. `.route-loading` is a fixed,
 * full-viewport surface — correct for the storefront, where the chrome is part
 * of the page being replaced, and wrong here, where it blanks the rail and the
 * topbar on every hop between two screens of the same console. The operator
 * loses the menu they are navigating with, then gets it back a moment later,
 * fifty times a shift.
 *
 * Placing a boundary inside the admin subtree keeps the shell mounted: only
 * `.aui-stage` swaps, so the rail, the topbar and the area tabs never move.
 * The fallback is the shape of a page rather than a spinner — the head card
 * and the first blocks of the body — so the layout does not jump when the real
 * screen lands on top of it.
 *
 * Everything is held back 140ms in CSS, the same threshold the storefront
 * uses: a navigation that resolves under it shows an unbroken stage and reads
 * as instant, and only a genuine stall gets announced.
 *
 * A Server Component — it holds no state and nothing here needs the client.
 */
export function AdminRouteLoading() {
  return (
    <div className="aui-page aui-loading" role="status" aria-label="Loading">
      <div className="aui-page__wrap">
        <div className="aui-loading__head" />
        <div className="aui-page__body">
          <div className="aui-loading__block aui-loading__block--short" />
          <div className="aui-loading__block" />
        </div>
      </div>
    </div>
  );
}
