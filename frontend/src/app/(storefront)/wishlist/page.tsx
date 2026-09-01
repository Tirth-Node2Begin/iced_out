import type { Metadata } from "next";

import { WishlistGallery } from "@/components/commerce/wishlist-gallery";
import { SmoothScroll } from "@/components/new-home/smooth-scroll";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false, follow: false } };

/* The gallery carries its own <PageFrame>: the saved list is read out of
   localStorage after mount, so the head's count can only be rendered client
   side — splitting the frame off here would print "00" on every load. */
export default function WishlistPage() {
  /* Lenis, as on the bag and About: a saved list is scrolled through, and the
     grid's hover cards read better against an eased position than a stepped
     one. Off under prefers-reduced-motion. */
  return (
    <SmoothScroll>
      <WishlistGallery />
    </SmoothScroll>
  );
}
