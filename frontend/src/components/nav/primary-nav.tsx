"use client";

import { ChevronDown, Heart, Search, ShoppingBag, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { useBrandMorph } from "@/components/home-v2/brand-morph";
import { MEGA_MENU, NAV_LINKS, type NavLink } from "@/components/new-home/data";
import { EASE_OUT } from "@/components/new-home/motion-primitives";
import { useCart } from "@/features/04-cart/cart-context";
import { useWishlist } from "@/features/05-wishlist/wishlist-context";
import { useAuth } from "@/features/20-auth-security/auth-context";

/** Hover opens instantly; a grace period on close survives the diagonal mouse
 * move from a rail item down into the panel hanging below it. */
const CLOSE_DELAY = 170;

/** Past this the bar swaps its scrim for the frosted plate. Deliberately tiny:
 *  the point is that the bar stops being transparent the instant anything is
 *  scrolling underneath it, not that it waits for a hero to clear. */
const ELEVATE_AT = 6;

/** The bar's home. Anywhere above this line it is simply on screen, whichever
 *  way the last few pixels went — the top of a page is not somewhere a shopper
 *  should have to scroll *up* to get the chrome handed back. */
const REVEAL_AT = 96;

/** Under this a scroll is noise, not intent: a trackpad settling, a rubber-band
 *  bounce, the browser correcting an anchor. Reading those as a direction is
 *  what makes a retracting bar flicker. */
const INTENT = 8;

/**
 * Whether the bar has already played its entrance in this browsing session.
 *
 * Each route group mounts its own header — `(home)` through `<Header>`, the
 * listings through `<GenderHeader>`, `/about` through `<AboutNav>` — so moving
 * between two groups unmounts one bar and mounts another. React has no idea
 * they are the same object, and the fresh mount replayed the 0.8s drop-in with
 * its 0.1s delay: nearly a second of the chrome re-assembling itself on top of
 * a navigation that had already finished. That is most of what "slow" meant
 * here — the page was ready, the furniture was still arriving.
 *
 * Module scope is exactly the right lifetime for this. It survives every
 * client-side navigation (the module is evaluated once) and resets on a real
 * page load, which is the one time the entrance is worth watching.
 */
let hasPlayedEntrance = false;

/**
 * The two overlays, split out of the bar's own chunk.
 *
 * Both were static imports, so every page in the shop paid to download and
 * parse the search dock (with the product repository behind it) and the mobile
 * sheet — on the overwhelming majority of visits where neither is ever opened.
 * They are pure overlay UI: nothing about them needs to exist until something
 * asks for them.
 *
 * Paired with the `*Used` gates below, the chunk is fetched on the first open
 * and the component then stays mounted, which is what the dock's own comment
 * about clearing its query on the way *in* depends on — closing has to be able
 * to animate out.
 */
const SearchDock = dynamic(() =>
  import("@/components/nav/search-dock").then((module) => module.SearchDock),
);

const NavSheet = dynamic(() =>
  import("@/components/nav/nav-sheet").then((module) => module.NavSheet),
);

/**
 * The panel's contents read in from the top down: the parent only sequences,
 * each child does the moving. Swapping between two menus runs the same
 * cascade, so Men → Women reads as the panel re-writing itself rather than
 * two blocks trading places.
 */
const CONTENT = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
  exit: { opacity: 0, y: 12, transition: { duration: 0.18, ease: EASE_OUT } },
};

const ITEM = {
  hidden: { opacity: 0, y: -18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.46, ease: EASE_OUT } },
};

/** One glyph on the right-hand rail. `count`/`unit` only apply where there is
 *  something to tally; the badge itself is decorative, the label carries it. */
type NavAction = {
  key: string;
  href?: string;
  onClick?: () => void;
  icon: ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;
  label: string;
  count?: number;
  unit?: string;
};

type PrimaryNavProps = {
  /** Marks the rail item for the page the shopper is on. */
  currentPath?: string;
  /** Where the auth pill sends a signed-out shopper, and back to once they sign in. */
  signInHref: string;
  /** Where the wordmark points — "/" everywhere, which is the home experience. */
  logoHref?: string;
  /**
   * Warms routes on hover/focus. On by default: a pointer landing on a rail
   * item is the strongest signal we get that the shopper is about to go there,
   * and the gap between hover and click is free time we were throwing away on
   * `/` and `/about`, the two surfaces most people start from.
   */
  intentPrefetch?: boolean;
  /**
   * `auto` fades the frosted plate in once the page scrolls. The gender
   * surfaces paint their own plate on the scope from an IntersectionObserver
   * on the hero, so they pass `none` rather than stack two.
   */
  plate?: "auto" | "none";
};

export function PrimaryNav({
  currentPath,
  signInHref,
  logoHref = "/",
  intentPrefetch = true,
  plate = "auto",
}: PrimaryNavProps) {
  const router = useRouter();
  const { isAuthenticated, signOut } = useAuth();
  const { itemCount } = useCart();
  const { productIds: saved } = useWishlist();
  const [openHref, setOpenHref] = useState<string | null>(null);
  const [elevated, setElevated] = useState(false);
  /* Whether the last read of the page said "going down". Not the same thing as
     the bar being off screen — see `hidden` below, which is this answer after
     everything hanging off the bar has had its say. */
  const [retracted, setRetracted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /* Latches on the first open and never goes back — the overlay has to outlive
     `open` turning false so it can animate out. Adjusted during render rather
     than in an effect, which is the pattern React documents for "derive from a
     prop change" and the one search-dock.tsx already uses for its own session
     reset: an effect would cost a second paint before the chunk was requested. */
  const [searchUsed, setSearchUsed] = useState(false);
  const [menuUsed, setMenuUsed] = useState(false);
  if (searchOpen && !searchUsed) setSearchUsed(true);
  if (menuOpen && !menuUsed) setMenuUsed(true);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Read once, on the mount that claims the entrance — see `hasPlayedEntrance`.
     A lazy initialiser rather than an effect: the decision has to be made
     before the first paint, or the bar flashes in from -22px and *then* gets
     told not to. Under StrictMode's double-invoke the second call already sees
     the flag set and returns false, which is the same answer. */
  const [playEntrance] = useState(() => {
    if (hasPlayedEntrance) return false;
    hasPlayedEntrance = true;
    return true;
  });

  /* The entrance and the retraction move the same axis on the same element, so
     they cannot share a transition: one is a 0.8s drop-in that plays once, the
     other answers the wheel and has to be quick. This flips to the second the
     moment the first has finished — and starts there on every mount that never
     had an entrance to play. */
  const [entered, setEntered] = useState(!playEntrance);

  /* Inert on every route except the site root, where <BrandMorph> is mounted
     and the wordmark slot becomes the landing spot for the hero headline. */
  const { active: morphed, aloft, words, registerNav } = useBrandMorph();

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const open = useCallback(
    (href: string) => {
      clearCloseTimer();
      setOpenHref(href);
    },
    [clearCloseTimer],
  );

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpenHref(null), CLOSE_DELAY);
  }, [clearCloseTimer]);

  const closeNow = useCallback(() => {
    clearCloseTimer();
    setOpenHref(null);
  }, [clearCloseTimer]);

  const warmRoute = useCallback(
    (href: string) => {
      if (intentPrefetch) router.prefetch(href);
    },
    [intentPrefetch, router],
  );

  useEffect(() => {
    if (!openHref) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openHref, closeNow]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  /* Splitting the overlays out of the bar's chunk would otherwise move the cost
     rather than remove it: the first click on the search glyph would sit there
     waiting on a network round trip before anything docked up.

     So they are fetched during the browser's idle time instead — off the
     critical path that hydration and the page's own images are competing for,
     but long resolved by the time a pointer reaches the bar. The `import()`
     calls are the same specifiers the `dynamic()` wrappers use, so this warms
     exactly the modules they will ask for; webpack answers the second request
     from its module cache. */
  useEffect(() => {
    const warm = () => {
      void import("@/components/nav/search-dock");
      void import("@/components/nav/nav-sheet");
    };

    if (typeof window.requestIdleCallback !== "function") {
      const timer = setTimeout(warm, 1200);
      return () => clearTimeout(timer);
    }

    const handle = window.requestIdleCallback(warm, { timeout: 2500 });
    return () => window.cancelIdleCallback(handle);
  }, []);

  /* What makes the bar legible over page content, and whether the bar is on
     screen at all. Both are answers to the same scroll event and the second
     needs the previous position to compare against, so they share one listener
     — two would each keep their own idea of where the page last was.

     Read once on mount too, so a route restored mid-page paints elevated
     rather than flashing clear. That first read only takes a bearing: with no
     previous position to measure against there is no direction yet, so the bar
     starts where it belongs, on screen. */
  useEffect(() => {
    let previous = window.scrollY;
    let frame = 0;

    const sync = () => {
      frame = 0;
      const y = window.scrollY;
      setElevated(y > ELEVATE_AT);

      /* The top of the page is the bar's home — including the negative offsets
         iOS reports while the page is rubber-banding above it. */
      if (y <= REVEAL_AT) {
        previous = y;
        setRetracted(false);
        return;
      }

      /* Leaving `previous` where it was under the threshold is what lets a slow
         drag accumulate into an intent instead of being read as stillness. */
      const delta = y - previous;
      if (Math.abs(delta) < INTENT) return;

      previous = y;
      setRetracted(delta > 0);
    };

    /* One read per frame. Scroll fires far faster than the bar can move, and
       every extra read is a synchronous layout on the main thread. */
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };

    sync();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /* ⌘K / Ctrl-K opens the dock from anywhere — but only where searching is
     offered at all, which is behind the session. */
  useEffect(() => {
    if (!isAuthenticated) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAuthenticated]);

  const menu = openHref ? MEGA_MENU[openHref] : undefined;

  /**
   * Anything hanging off the bar pins it on screen, whatever the page is doing.
   *
   * A mega panel hangs from the bar's bottom edge and would be left floating
   * off nothing; both overlays are opened *from* the bar and one of them (⌘K)
   * can be opened while it is away; and on the site root the hero's wordmark is
   * mid-flight towards the bar's brand slot, which has to be there to land on.
   */
  const pinned = Boolean(menu) || searchOpen || menuOpen || aloft;

  /* Being pinned also *clears* the direction, rather than only outvoting it:
     whatever pinned the bar has the shopper's attention, and a reading taken
     before they opened it should not snatch the bar away the moment they close
     it again. Adjusted during render, same as the `*Used` latches above. */
  if (pinned && retracted) setRetracted(false);

  const hidden = retracted && !pinned;

  /* Signed out, the bar offers exactly three things: the bag, the account, and
     the way in. Search and the wishlist are session surfaces here, so showing
     their glyphs to a shopper who cannot reach them would be decoration. */
  const bag: NavAction = {
    key: "bag",
    href: "/cart",
    icon: ShoppingBag,
    label: "Bag",
    count: itemCount,
    unit: "item",
  };

  const account: NavAction = {
    // /account and /cart are both customer-guarded, but the bag is where a
    // shopper expects to be stopped. Sending the avatar through login itself
    // spares it the guard's "verifying…" interstitial.
    key: "account",
    href: isAuthenticated ? "/account/profile" : "/auth/login?returnTo=%2Faccount%2Fprofile",
    icon: UserRound,
    label: "Profile",
  };

  const actions: NavAction[] = isAuthenticated
    ? [
        { key: "search", onClick: () => setSearchOpen(true), icon: Search, label: "Search" },
        // The device-local wishlist, not /account/wishlist: saving needs no
        // session, and only moving a piece to the bag asks for one.
        {
          key: "wishlist",
          href: "/wishlist",
          icon: Heart,
          label: "Wishlist",
          count: saved.length,
          unit: "save",
        },
        bag,
        account,
      ]
    : [bag, account];

  return (
    <>
      <motion.header
        /* `-100%` rather than a pixel count: the bar is 92px, 74px or 62px
           depending on which sheet a route loads and how wide the viewport is,
           and its own height is the one number that is right in all three. It
           clears the viewport exactly, so nothing of it is left peeking. */
        animate={{ y: hidden ? "-100%" : 0, opacity: 1 }}
        className="nh-nav"
        data-elevated={elevated}
        data-hidden={hidden || undefined}
        data-menu-open={Boolean(menu)}
        data-plate={plate}
        /* `false` means "start where you were told to end" — the bar is simply
           already there. Only the session's first bar drops in. */
        initial={playEntrance ? { y: -22, opacity: 0 } : false}
        onAnimationComplete={() => setEntered(true)}
        /* Tabbing into a bar that has scrolled away would move the focus ring
           somewhere the shopper cannot see it, so reaching it brings it back. */
        onFocusCapture={() => setRetracted(false)}
        onMouseLeave={scheduleClose}
        transition={
          entered
            ? { duration: 0.42, ease: EASE_OUT }
            : { duration: 0.8, ease: EASE_OUT, delay: 0.1 }
        }
      >
        {/* Two backdrops that cross-fade: a short scrim so the glyphs read over
            a hero, and the frosted plate once anything scrolls beneath. */}
        <span aria-hidden className="nh-nav__scrim" />
        <span aria-hidden className="nh-nav__plate" />

        <div className="nh-nav__inner">
          <div className="nh-nav__lead">
            <Link
              aria-label="Iced_out — home"
              className="nh-nav__brand"
              href={logoHref}
              onFocus={() => warmRoute(logoHref)}
              onMouseEnter={() => warmRoute(logoHref)}
            >
              <BrandMark className="nh-nav__mark" />
              {/* On the site root the hero's headline flies up and lands on this
                  slot, so the bar hands its geometry over. It keeps *drawing*
                  the wordmark until the flight actually lifts, though — at rest
                  the letters are still down in the hero and a bar with nothing
                  beside the mark reads as a logo that failed to load.
                  Everywhere else the context default is inert and this is just
                  the wordmark. */}
              <span
                className="nh-nav__wordmark"
                data-morphed={aloft || undefined}
                ref={registerNav}
              >
                {morphed
                  ? words.map((word, i) => (
                      <Fragment key={word}>
                        {/* One slot per glyph: they fly in one at a time and each
                            needs its own landing spot, so the letterfit they
                            settle into is the bar's own rather than a guess. */}
                        {Array.from(word, (letter, j) => (
                          <span className="nh-nav__letter" data-morph-letter={i} key={`${word}-${j}`}>
                            {letter}
                          </span>
                        ))}
                        {i < words.length - 1 ? " " : null}
                      </Fragment>
                    ))
                  : "ICED_OUT"}
              </span>
            </Link>
          </div>

          <nav aria-label="Primary navigation" className="nh-nav__rail">
            {NAV_LINKS.map((link) => (
              <NavItem
                currentPath={currentPath}
                isOpen={openHref === link.href}
                key={link.href}
                link={link}
                onClose={scheduleClose}
                onNavigate={closeNow}
                onOpen={open}
                onWarm={warmRoute}
              />
            ))}
          </nav>

          {/* The shopper utilities, then the session pill. Bare glyphs rather
              than a second capsule — the centre rail is the only enclosed group
              in the bar, and enclosing these too would give it two. */}
          <div className="nh-nav__actions">
            <div className="nh-nav__icons">
              {actions.map((action) => (
                <NavGlyph
                  action={action}
                  currentPath={currentPath}
                  key={action.key}
                  onWarm={(href) => {
                    warmRoute(href);
                    // Sliding out of the rail into these has to dismiss whatever
                    // panel was hanging below it, same as a plain destination.
                    scheduleClose();
                  }}
                />
              ))}
            </div>

            {isAuthenticated ? (
              <button className="nh-nav__pill nh-nav__pill--solid" onClick={signOut} type="button">
                Logout
              </button>
            ) : (
              <Link
                className="nh-nav__pill nh-nav__pill--solid"
                href={signInHref}
                onFocus={() => warmRoute(signInHref)}
                onMouseEnter={() => warmRoute(signInHref)}
              >
                Login
              </Link>
            )}

            <button
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="io-nav__menu"
              onClick={() => setMenuOpen((current) => !current)}
              type="button"
            >
              <i />
              <i />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menu && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="nh-mega"
              exit={{ opacity: 0, y: -10, transition: { duration: 0.22, ease: EASE_OUT } }}
              initial={{ opacity: 0, y: -14 }}
              onMouseEnter={() => openHref && open(openHref)}
              onMouseLeave={scheduleClose}
              transition={{ duration: 0.42, ease: EASE_OUT }}
            >
              {/* The black surface stays mounted while the menu is open; only
                  its contents swap. `wait` lets the outgoing set clear before
                  the new one reads in, so the two cascades never overlap. */}
              <div className="nh-mega__panel">
                <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    animate="show"
                    className="nh-mega__content"
                    exit="exit"
                    initial="hidden"
                    key={openHref}
                    variants={CONTENT}
                  >
                    {menu.columns.map((column) => (
                      <div className="nh-mega__col" key={column.heading}>
                        <motion.span className="nh-mega__heading" variants={ITEM}>
                          {column.heading}
                        </motion.span>
                        <ul className="nh-mega__list">
                          {column.links.map((link) => (
                            <motion.li key={link.href} variants={ITEM}>
                              <Link className="nh-mega__link" href={link.href} onClick={closeNow}>
                                <span className="nh-mega__linkLabel">{link.label}</span>
                                {link.tag && <span className="nh-mega__tag">{link.tag}</span>}
                              </Link>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    <motion.div className="nh-mega__featureWrap" variants={ITEM}>
                      <Link className="nh-mega__feature" href={menu.feature.href} onClick={closeNow}>
                        <span className="nh-mega__featureMedia">
                          <Image
                            alt={menu.feature.label}
                            className="nh-mega__featureImg"
                            fill
                            sizes="300px"
                            src={menu.feature.image}
                          />
                        </span>
                        <span className="nh-mega__featureMeta">
                          <span className="nh-mega__featureTag">{menu.feature.tag}</span>
                          <span className="nh-mega__featureLabel">{menu.feature.label}</span>
                        </span>
                      </Link>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Both overlays dock to the bottom edge and portal out of the sticky
          bar — see components/nav/bottom-sheet.tsx. Neither exists until the
          shopper first reaches for it; after that both stay. */}
      {searchUsed && <SearchDock onClose={() => setSearchOpen(false)} open={searchOpen} />}
      {menuUsed && (
        <NavSheet
          currentPath={currentPath}
          isAuthenticated={isAuthenticated}
          itemCount={itemCount}
          onClose={() => setMenuOpen(false)}
          onSearch={() => setSearchOpen(true)}
          onSignOut={signOut}
          open={menuOpen}
          savedCount={saved.length}
          signInHref={signInHref}
        />
      )}
    </>
  );
}

/**
 * One utility glyph. Search is a control rather than a destination now, so the
 * group has to render both a `<Link>` and a `<button>` and keep them identical
 * — everything but the tag lives here.
 */
function NavGlyph({
  action,
  currentPath,
  onWarm,
}: {
  action: NavAction;
  currentPath?: string;
  onWarm: (href: string) => void;
}) {
  const { href, onClick, icon: Icon, label, count, unit } = action;

  /* The tally only pops when it *changes* — mounting with three pieces already
     in the bag is not an event, adding a fourth is. */
  const [pop, setPop] = useState(false);
  const previous = useRef(count);

  useEffect(() => {
    if (previous.current === count) return;
    const grew = (count ?? 0) > (previous.current ?? 0);
    previous.current = count;
    if (!grew) return;
    setPop(true);
    const timer = setTimeout(() => setPop(false), 460);
    return () => clearTimeout(timer);
  }, [count]);

  const inner: ReactNode = (
    <>
      <Icon aria-hidden size={17} strokeWidth={1.6} />
      {/* Both counts start empty and fill in after mount — the bag lives in
          memory, the wishlist reads localStorage — so the badge is simply
          absent until there is something to count. */}
      {count ? (
        <span aria-hidden className="nh-nav__badge" data-pop={pop || undefined}>
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </>
  );

  const describedLabel = count
    ? `${label} — ${count} ${count === 1 ? unit : `${unit}s`}`
    : label;

  if (!href) {
    return (
      <button
        aria-label={describedLabel}
        className="nh-nav__icon"
        onClick={onClick}
        title={label}
        type="button"
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      aria-current={href === currentPath ? "page" : undefined}
      aria-label={describedLabel}
      className="nh-nav__icon"
      href={href}
      onFocus={() => onWarm(href)}
      onMouseEnter={() => onWarm(href)}
      title={label}
    >
      {inner}
    </Link>
  );
}

function NavItem({
  link,
  currentPath,
  isOpen,
  onOpen,
  onClose,
  onNavigate,
  onWarm,
}: {
  link: NavLink;
  currentPath?: string;
  isOpen: boolean;
  onOpen: (href: string) => void;
  onClose: () => void;
  onNavigate: () => void;
  onWarm: (href: string) => void;
}) {
  const hasMenu = Boolean(MEGA_MENU[link.href]);

  // Arriving on a plain destination has to dismiss whatever was open, or
  // sliding Men → About leaves the Men panel hanging under an unrelated item.
  const enter = () => {
    onWarm(link.href);
    if (hasMenu) onOpen(link.href);
    else onClose();
  };

  return (
    <Link
      aria-current={link.href === currentPath ? "page" : undefined}
      aria-expanded={hasMenu ? isOpen : undefined}
      aria-haspopup={hasMenu ? "true" : undefined}
      className="nh-nav__pill nh-nav__pill--ghost"
      data-active={isOpen}
      href={link.href}
      onClick={onNavigate}
      onFocus={enter}
      onMouseEnter={enter}
    >
      {link.label}
      {hasMenu && <ChevronDown aria-hidden className="nh-nav__chevron" data-open={isOpen} size={12} />}
    </Link>
  );
}

