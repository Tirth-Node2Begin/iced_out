"use client";

import { ArrowUpRight, Heart, Search, ShoppingBag, UserRound } from "lucide-react";
import Link from "next/link";

import { BottomSheet } from "@/components/nav/bottom-sheet";
import { NAV_LINKS } from "@/components/new-home/data";

/**
 * The destinations the centre rail carries, restated for the widths that
 * cannot hold it.
 *
 * It is the same list and the same order — the rail is dropped below 1180px
 * rather than compressed, because six pills squeezed to fit read as a broken
 * bar, and a sheet can give each destination a full line instead.
 */
export function NavSheet({
  open,
  onClose,
  currentPath,
  isAuthenticated,
  itemCount,
  savedCount,
  signInHref,
  onSearch,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  currentPath?: string;
  isAuthenticated: boolean;
  itemCount: number;
  savedCount: number;
  signInHref: string;
  onSearch: () => void;
  onSignOut: () => void;
}) {
  return (
    <BottomSheet label="Menu" onClose={onClose} open={open}>
      {/* Scrolls itself rather than the page behind it wherever Lenis is
          running — see the note on the search dock's copy of this. */}
      <div className="io-dock__body" data-lenis-prevent>
        <div className="io-dock__wrap">
          <nav aria-label="Primary navigation" className="io-sheet__nav">
            {NAV_LINKS.map((link) => (
              <Link
                aria-current={link.href === currentPath ? "page" : undefined}
                className="io-sheet__link"
                href={link.href}
                key={link.href}
                onClick={onClose}
              >
                <span>{link.label}</span>
                <ArrowUpRight aria-hidden size={17} strokeWidth={1.5} />
              </Link>
            ))}
          </nav>

          {/* The same split the bar makes: signed out, the sheet offers only
              the bag, the account and the way in. */}
          <div className="io-sheet__utils">
            {isAuthenticated && (
              <>
                <button
                  className="io-sheet__util"
                  onClick={() => {
                    onClose();
                    onSearch();
                  }}
                  type="button"
                >
                  <Search aria-hidden size={15} strokeWidth={1.6} />
                  Search
                </button>
                <Link className="io-sheet__util" href="/wishlist" onClick={onClose}>
                  <Heart aria-hidden size={15} strokeWidth={1.6} />
                  Saved
                  {savedCount > 0 && <span className="io-sheet__count">{savedCount}</span>}
                </Link>
              </>
            )}

            <Link className="io-sheet__util" href="/cart" onClick={onClose}>
              <ShoppingBag aria-hidden size={15} strokeWidth={1.6} />
              Bag
              {itemCount > 0 && <span className="io-sheet__count">{itemCount}</span>}
            </Link>

            <Link
              className="io-sheet__util"
              href={isAuthenticated ? "/account/profile" : "/auth/login?returnTo=%2Faccount%2Fprofile"}
              onClick={onClose}
            >
              <UserRound aria-hidden size={15} strokeWidth={1.6} />
              Profile
            </Link>

            {isAuthenticated ? (
              <button
                className="io-sheet__util io-sheet__util--solid"
                onClick={() => {
                  onClose();
                  onSignOut();
                }}
                type="button"
              >
                Logout
              </button>
            ) : (
              <Link
                className="io-sheet__util io-sheet__util--solid"
                href={signInHref}
                onClick={onClose}
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
