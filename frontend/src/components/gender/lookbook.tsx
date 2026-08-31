"use client";

import { ArrowUpRight, Plus } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import {
  CROPS,
  formatPrice,
  type AudienceContent,
  type LookPin,
} from "@/components/gender/data";
import { EASE_OUT, Reveal, SplitHeading, WordRamp } from "@/components/gender/motion";
import { pieceForPin, useGenderPieces } from "@/components/gender/use-pieces";
import { DEPTS, pieceHref } from "@/components/new-man/product-deck";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Lookbook — "Shop the Look".
 *
 * A pinned campaign frame on the left, the shopping rail on the right. Every
 * pin is a shadcn `Popover` trigger, so the pin and its card share one
 * controlled open state, get focus management and Escape for free, and the
 * card is portalled out of the frame's `overflow: hidden`.
 *
 * Hovering a rail row lights its pin and vice versa — one `active` id drives
 * both, which is what makes the two halves read as one component.
 *
 * Both the pin's card and the rail row open the piece the pin NAMES, found in
 * the catalogue by that name. They used to open `pin.slug`, which was one of
 * four storefront fixtures written into the copy deck — so the row reading
 * "Underpass Shell · ₹16,200" opened the Bone Utility Overshirt at ₹11,400,
 * and three rows out of every four were pointing at a garment they did not
 * name. See `pieceForPin`.
 */
export function Lookbook({ content }: { content: AudienceContent }) {
  const reduce = useReducedMotion();
  const [lookIndex, setLookIndex] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [openPin, setOpenPin] = useState<string | null>(null);

  const { look } = content;
  const current = look.looks[lookIndex];
  const stage = CROPS[current.crop];

  const { pieces } = useGenderPieces(content.audience);

  /* Resolved here rather than inside `Pin`, so the pin and the rail row that
     light each other also agree on where they go. A pin whose piece is not in
     the catalogue — still loading, renamed, retired — falls back to the
     listing rather than to a product page that is not there. */
  const dept = DEPTS[content.audience];
  const hrefFor = (pin: LookPin) => {
    const piece = pieceForPin(pieces, pin);
    return piece ? pieceHref(dept, piece) : dept.base;
  };

  return (
    <section className="gx-section gx-look" id="gx-lookbook">
      <div className="gx-wrap">
        <div className="gx-look__head">
          <div>
            <Reveal>
              <p className="gx-eyebrow">{look.eyebrow}</p>
            </Reveal>
            <SplitHeading
              className="gx-look__title"
              segments={[{ text: look.heavy }, { text: look.light, light: true }]}
            />
          </div>
          <Reveal className="gx-look__body" delay={0.15}>
            <p className="gx-body">{look.body}</p>
          </Reveal>
        </div>

        <div className="gx-look__layout">
          {/* ------------------------------------------------------- stage */}
          <Reveal amount={0.15} y={40}>
            <div className="gx-look__stage">
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0"
                  exit={{ opacity: 0, scale: 1.02 }}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.06 }}
                  key={current.id}
                  transition={reduce ? { duration: 0.2 } : { duration: 0.75, ease: EASE_OUT }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={`${current.title} — ${content.label} lookbook`}
                    decoding="async"
                    loading="lazy"
                    src={stage.src}
                    style={{ "--op": stage.op } as React.CSSProperties}
                  />
                </motion.div>
              </AnimatePresence>

              <span className="gx-look__stageScrim" />

              <span className="gx-look__badge">
                <span className="gx-tag">{current.label} / {current.title}</span>
              </span>

              {current.pins.map((pin, index) => (
                <Pin
                  href={hrefFor(pin)}
                  index={index}
                  isActive={active === pin.id}
                  isOpen={openPin === pin.id}
                  key={`${current.id}-${pin.id}`}
                  onHover={setActive}
                  onOpenChange={(open) => setOpenPin(open ? pin.id : null)}
                  pin={pin}
                  reduce={Boolean(reduce)}
                />
              ))}
            </div>
          </Reveal>

          {/* -------------------------------------------------------- rail */}
          <div className="gx-look__rail">
            <div className="gx-look__lead">
              <p className="gx-eyebrow">{current.label}</p>
              <WordRamp
                as="h3"
                className="gx-display gx-look__leadTitle"
                key={current.id}
                text={current.title}
              />
              <p className="gx-body">{current.copy}</p>
            </div>

            <div className="gx-look__items">
              {current.pins.map((pin, index) => {
                const thumb = CROPS[pin.crop];
                return (
                  <Link
                    className="gx-look__item"
                    data-active={active === pin.id}
                    href={hrefFor(pin)}
                    key={`${current.id}-row-${pin.id}`}
                    onBlur={() => setActive(null)}
                    onFocus={() => setActive(pin.id)}
                    onMouseEnter={() => setActive(pin.id)}
                    onMouseLeave={() => setActive(null)}
                  >
                    <span className="gx-look__thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt=""
                        decoding="async"
                        loading="lazy"
                        src={thumb.src}
                        style={
                          { "--op": thumb.op, "--z": thumb.z ?? 1 } as React.CSSProperties
                        }
                      />
                    </span>
                    <span>
                      <span className="gx-look__itemName">{pin.name}</span>
                      <span className="gx-look__itemMeta">
                        {pin.meta} · {formatPrice(pin.price)}
                      </span>
                    </span>
                    <span className="gx-look__index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </Link>
                );
              })}
            </div>

            <Link
              className="gx-pill gx-pill--solid gx-pill--foot"
              href="/collections/view?slug=drop-001"
              style={{ alignSelf: "flex-start" }}
            >
              Shop the whole look
              <span className="gx-pill__dot">
                <ArrowUpRight aria-hidden size={14} />
              </span>
            </Link>
          </div>
        </div>

        {/* ----------------------------------------------------- switcher */}
        <div aria-label="Choose a look" className="gx-look__tabs" role="group">
          {look.looks.map((entry, index) => (
            <button
              aria-pressed={index === lookIndex}
              className="gx-look__tab"
              data-state={index === lookIndex ? "on" : "off"}
              key={entry.id}
              onClick={() => {
                setLookIndex(index);
                setActive(null);
                setOpenPin(null);
              }}
              type="button"
            >
              {index === lookIndex && (
                <motion.span
                  aria-hidden
                  className="gx-look__tabBg"
                  layoutId="gx-look-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
                />
              )}
              <span className="relative">
                {entry.label} — {entry.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Pin({
  pin,
  href,
  index,
  isActive,
  isOpen,
  onHover,
  onOpenChange,
  reduce,
}: {
  pin: LookPin;
  href: string;
  index: number;
  isActive: boolean;
  isOpen: boolean;
  onHover: (id: string | null) => void;
  onOpenChange: (open: boolean) => void;
  reduce: boolean;
}) {
  const crop = CROPS[pin.crop];

  return (
    <Popover onOpenChange={onOpenChange} open={isOpen}>
      <PopoverTrigger asChild>
        {/* the centring offset travels with the animated transform, not in CSS */}
        <motion.button
          animate={{ opacity: 1, scale: isActive || isOpen ? 1.12 : 1, x: "-50%", y: "-50%" }}
          aria-label={`${pin.name} — ${formatPrice(pin.price)}`}
          className="gx-look__spot"
          data-active={isActive || isOpen}
          initial={
            reduce
              ? { opacity: 0, x: "-50%", y: "-50%" }
              : { opacity: 0, scale: 0.4, x: "-50%", y: "-50%" }
          }
          onMouseEnter={() => onHover(pin.id)}
          onMouseLeave={() => onHover(null)}
          style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
          transition={
            reduce
              ? { duration: 0.2 }
              : {
                  duration: 0.5,
                  delay: isActive || isOpen ? 0 : 0.35 + index * 0.09,
                  ease: EASE_OUT,
                }
          }
          type="button"
        >
          <Plus aria-hidden size={14} />
        </motion.button>
      </PopoverTrigger>

      <PopoverContent align="center" className="gx-look__pop" side="right" sideOffset={12}>
        <Link className="flex items-center gap-3" href={href}>
          <span className="gx-look__thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              decoding="async"
              src={crop.src}
              style={{ "--op": crop.op, "--z": crop.z ?? 1 } as React.CSSProperties}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="gx-look__itemName">{pin.name}</span>
            <span className="gx-look__itemMeta">
              {pin.meta} · {formatPrice(pin.price)}
            </span>
          </span>
          <span className="gx-card__go">
            <ArrowUpRight aria-hidden size={14} />
          </span>
        </Link>
      </PopoverContent>
    </Popover>
  );
}
