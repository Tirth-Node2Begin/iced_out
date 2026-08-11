"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { formatPrice, productFixtures, type Product } from "@/features/02-products";
import {
  COUPONS,
  discountFor,
  redeemCoupon,
  type Coupon,
} from "@/features/10-coupons/coupons";
import { useAuth } from "@/features/20-auth-security/auth-context";
import type { CartLine } from "@/types/commerce";

/**
 * The bag, remembered between page loads.
 *
 * Only the identity of each line is stored — product id, size, quantity — and
 * the product itself is looked up again on the way back in. Serialising the
 * whole product would freeze its price and its name into storage, and a bag
 * quoting last week's price is worse than a bag that forgot itself.
 */
const BAG_KEY = "iced-out.bag";
/** the coupon rides in its own key — only ever a code, never a computed total */
const COUPON_KEY = "iced-out.coupon";

type StoredLine = { productId: string; size: string; quantity: number };

function readBag(): CartLine[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(BAG_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry): CartLine[] => {
      const line = entry as Partial<StoredLine>;
      if (typeof line.productId !== "string" || typeof line.size !== "string") return [];

      // A product that has left the catalogue drops out of the bag rather than
      // resurfacing as a hole the rest of the page has to defend against.
      const product = productFixtures.find((item) => item.id === line.productId);
      if (!product) return [];

      const quantity = Number(line.quantity);
      if (!Number.isFinite(quantity) || quantity < 1) return [];

      return [{ product, size: line.size, quantity: Math.floor(quantity) }];
    });
  } catch {
    // hand-edited or half-written storage: start clean rather than throw on boot
    return [];
  }
}

/**
 * The stored coupon, resolved against the table on the way back in.
 *
 * A code that has since been withdrawn comes back as `null` rather than as a
 * coupon nothing can honour — the same rule the bag applies to a product that
 * has left the catalogue.
 */
function readCoupon(): Coupon | null {
  try {
    const code = window.localStorage.getItem(COUPON_KEY);
    if (!code) return null;
    return COUPONS.find((entry) => entry.code === code) ?? null;
  } catch {
    return null;
  }
}

function writeCoupon(coupon: Coupon | null) {
  try {
    if (coupon) window.localStorage.setItem(COUPON_KEY, coupon.code);
    else window.localStorage.removeItem(COUPON_KEY);
  } catch {
    /* the coupon simply lasts as long as the tab */
  }
}

function writeBag(lines: CartLine[]) {
  try {
    const stored: StoredLine[] = lines.map((line) => ({
      productId: line.product.id,
      size: line.size,
      quantity: line.quantity,
    }));
    window.localStorage.setItem(BAG_KEY, JSON.stringify(stored));
  } catch {
    /* the bag simply lasts as long as the tab */
  }
}

/** what `addItem` should do about the bag drawer once the line is in */
type AddOptions = {
  /**
   * Open the bag drawer on top of whatever is on screen. Default true — the
   * drawer IS the confirmation. A surface with a confirmation of its own (the
   * listing's quick-add panel) passes false rather than stacking two dialogs.
   */
  reveal?: boolean;
};

type CartContextValue = {
  lines: CartLine[];
  isOpen: boolean;
  itemCount: number;
  subtotal: number;
  /** the applied coupon, or null — never a code the table did not recognise */
  coupon: Coupon | null;
  /** the last refusal, for the field to show; cleared by the next attempt */
  couponError: string | null;
  /**
   * Set when a coupon IS applied but is not discounting yet — the bag fell back
   * under its minimum. Null whenever `discount` is doing something.
   */
  couponPending: string | null;
  /** what `coupon` takes off `subtotal`, in whole rupees; 0 when there is none */
  discount: number;
  /** `subtotal - discount`, which is what every surface should quote */
  total: number;
  addItem: (product: Product, size?: string, options?: AddOptions) => void;
  removeItem: (productId: string, size: string) => void;
  /** empties the bag and its coupon — what a placed order leaves behind */
  clearCart: () => void;
  setQuantity: (productId: string, size: string, quantity: number) => void;
  /** true when the code was accepted, so the field can clear itself */
  applyCoupon: (code: string) => boolean;
  clearCoupon: () => void;
  setOpen: (open: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/**
 * The bag is open to everyone.
 *
 * It used to demand a session before it would accept a single line, which meant
 * a shopper who had not signed in was sent to the login page by the act of
 * pressing "add to bag" — and, having signed in, arrived back at a product page
 * with an empty bag. Choosing a size is not an account operation. The session
 * boundary now starts at CHECKOUT, where there is finally something to
 * authenticate: an address, a payment, an order against a name.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setDrawerOpen] = useState(false);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  /** false until the stored bag has been read — see the write effect below */
  const [restored, setRestored] = useState(false);
  const { subscribeToSignOut } = useAuth();

  /* Read after mount, never during render. The page is statically exported, so
     the markup React hydrates was written with an empty bag in it; seeding
     state from storage during the first render makes the two disagree. */
  useEffect(() => {
    setLines(readBag());
    setCoupon(readCoupon());
    setRestored(true);
  }, []);

  /* `restored` is load-bearing. Without it this effect runs on the first render
     with the empty initial state and writes that empty array straight over the
     stored bag — the read above would then always come back with nothing, and
     the bug would look exactly like no persistence at all. */
  useEffect(() => {
    if (!restored) return;
    writeBag(lines);
    writeCoupon(coupon);
  }, [coupon, lines, restored]);

  /* Signing out still empties the bag, and now clears the stored copy with it
     (the write effect above sees the change). That is a deliberate act on a
     possibly shared machine — quite different from a reload, which is the case
     this whole file exists to survive. */
  useEffect(() => {
    return subscribeToSignOut(() => {
      setLines([]);
      setCoupon(null);
      setCouponError(null);
      setDrawerOpen(false);
    });
  }, [subscribeToSignOut]);

  const addItem = useCallback(
    (product: Product, size = "M", { reveal = true }: AddOptions = {}) => {
      setLines((current) => {
        const match = current.find(
          (line) => line.product.id === product.id && line.size === size,
        );

        if (match) {
          return current.map((line) =>
            line === match ? { ...line, quantity: line.quantity + 1 } : line,
          );
        }

        return [...current, { product, quantity: 1, size }];
      });
      if (reveal) setDrawerOpen(true);
    },
    [],
  );

  const setOpen = useCallback((open: boolean) => setDrawerOpen(open), []);

  /* An order takes the bag with it. The write effect above carries the empty
     bag to storage, so a reload after paying does not resurrect the lines that
     were just bought. */
  const clearCart = useCallback(() => {
    setLines([]);
    setCoupon(null);
    setCouponError(null);
    setDrawerOpen(false);
  }, []);

  const removeItem = useCallback((productId: string, size: string) => {
    setLines((current) =>
      current.filter(
        (line) => !(line.product.id === productId && line.size === size),
      ),
    );
  }, []);

  const setQuantity = useCallback(
    (productId: string, size: string, quantity: number) => {
      if (quantity < 1) {
        removeItem(productId, size);
        return;
      }

      setLines((current) =>
        current.map((line) =>
          line.product.id === productId && line.size === size
            ? { ...line, quantity }
            : line,
        ),
      );
    },
    [removeItem],
  );

  const subtotal = useMemo(
    () =>
      lines.reduce((running, line) => running + line.product.price * line.quantity, 0),
    [lines],
  );

  const applyCoupon = useCallback(
    (code: string) => {
      const result = redeemCoupon(code, subtotal, formatPrice);

      if (!result.ok) {
        setCouponError(result.reason);
        return false;
      }

      setCoupon(result.coupon);
      setCouponError(null);
      return true;
    },
    [subtotal],
  );

  const clearCoupon = useCallback(() => {
    setCoupon(null);
    setCouponError(null);
  }, []);

  const value = useMemo(() => {
    /* A coupon that stops qualifying is HELD, not silently torn off — removing
       a line would otherwise make a discount vanish with nothing to explain it,
       and putting the line back would leave the shopper retyping a code they
       never removed. It stops discounting and says what it is waiting for. */
    const discount = lines.length === 0 ? 0 : discountFor(coupon, subtotal);
    const couponPending =
      coupon && discount === 0
        ? `${coupon.code} needs a subtotal of ${formatPrice(coupon.minSubtotal)}.`
        : null;

    return {
      lines,
      isOpen,
      itemCount: lines.reduce((count, line) => count + line.quantity, 0),
      subtotal,
      coupon,
      couponError,
      couponPending,
      discount,
      total: subtotal - discount,
      addItem,
      removeItem,
      clearCart,
      setQuantity,
      applyCoupon,
      clearCoupon,
      setOpen,
    };
  }, [
    addItem,
    applyCoupon,
    clearCart,
    clearCoupon,
    coupon,
    couponError,
    isOpen,
    lines,
    removeItem,
    setOpen,
    setQuantity,
    subtotal,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
