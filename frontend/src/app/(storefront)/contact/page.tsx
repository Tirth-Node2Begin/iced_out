"use client";

/* ============================================================================
   /contact
   ----------------------------------------------------------------------------
   Three plates on one dark surface: a header, the channels beside the form, and
   the FAQ. A support page is read under pressure — someone's parcel is late —
   so the page says what it is, shows how to reach a person, and gets out of the
   way. No ray fans, no ghost cut, no avatar cluster, no stat theatre.

   The header is the shared storefront masthead — the same band, eyebrow,
   two-cut headline and spec row the bag and the wishlist open on, rather than
   a slab this one page invented. Everything below it — panel, channel row,
   note, input, pill, accordion — is rounded.

   Structure comes from the shadcn registry — Field, Item, InputGroup,
   ToggleGroup, Checkbox, Accordion, Spinner, Empty — none of them forked. The
   sheet bridges the shadcn tokens onto the nh palette inside `.ct-root`, which
   is what lets stock components read as part of this page.
   ========================================================================= */

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Check, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { scrollToHash } from "@/lib/in-page-scroll";

/** §4.3 — the house curve, the only easing on the page. */
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** §6.1 `Reveal` — the one entrance this page uses.

    `onMount` is for anything that opens the page. A scroll-triggered entrance
    on a block that is already on screen has nothing to trigger it: the two
    workspace panels sit at the top of the document, so they play once, on
    mount, and are never waiting on a gesture the visitor has no reason to
    make. Everything further down still enters on approach.

    The viewport threshold is `"some"` — any part of the block on screen — and
    not a fraction of its height. The form panel is 730px tall, which under the
    old `amount: 0.2` needed 146px of itself visible to fire; at the fold it
    had 137px, so on an ordinary laptop it stayed at opacity 0 until the
    visitor scrolled for it. A percentage threshold is a trap for any block
    taller than the space it opens in, and a support form is the last thing on
    this site that should be hiding. */
function Reveal({
  children,
  delay = 0,
  className,
  onMount = false,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  onMount?: boolean;
}) {
  const reduce = useReducedMotion();
  const shown = { opacity: 1, y: 0 };

  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
      {...(onMount
        ? { animate: shown }
        : { whileInView: shown, viewport: { once: true, amount: "some" as const } })}
      transition={{ duration: reduce ? 0.2 : 0.6, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/* The two things a visitor wants settled before they type: how long a reply
   takes, and where the people answering are. They ride in the masthead's spec
   row, which is the frame's slot for a fact the page can prove — not a stat
   board. The desk hours sat here too and left with the third slot: the phone
   channel below already carries them, next to the number they apply to. */
const SPECS = [
  { label: "Reply within", value: "2 days" },
  { label: "Studio", value: "Surat" },
];

/* Three ways to reach the desk, and nothing else. Two of them do something when
   you press them; the third is an address, so it carries no `href` and renders
   as a plain row rather than pretending to be a control. */
const CHANNELS = [
  {
    icon: Mail,
    title: "support@iced-out.example",
    description: "Orders, sizing, returns and refunds.",
    href: "mailto:support@iced-out.example",
  },
  {
    icon: Phone,
    title: "+91 80 4718 2200",
    description: "Mon–Sat · 10:00–19:00 IST.",
    href: "tel:+918047182200",
  },
  {
    icon: MapPin,
    title: "Surat, India",
    description: "Online-first — no walk-in store.",
    href: null,
  },
];

/* `mailto:` and `tel:` hand off to whatever the machine opens them with and
   leave the page exactly where it is — a new tab for them only ever leaves an
   empty one behind. */
function openAway(href: string) {
  window.location.assign(href);
}

const REASONS = [
  { value: "order", label: "Order" },
  { value: "shipping", label: "Shipping" },
  { value: "returns", label: "Returns" },
  { value: "sizing", label: "Sizing" },
  { value: "other", label: "Other" },
];

/* The nine things the desk is actually asked. Every number here matches what
   the rest of the app already enforces — the shipping rates in admin settings,
   the 14-day window the service grid advertises, the PENDING → CONFIRMED →
   PROCESSING ladder the order timeline walks. If one of those changes, this
   list is the second place to change. */
const FAQS = [
  {
    q: "How long will my order take to arrive?",
    a: "Standard delivery reaches most Indian addresses in 3–6 business days. Where the pincode supports express, it lands in 1–3. Orders confirmed before 2 PM IST leave the Bengaluru warehouse the same working day with Blue Dart or Delhivery.",
  },
  {
    q: "What does shipping cost?",
    a: "Standard shipping is ₹250, and free on every order above ₹7,500. Express is ₹450 and needs a cart of at least ₹3,000 plus a serviceable pincode — checkout tells you which options your address qualifies for before you pay.",
  },
  {
    q: "How do I track my order?",
    a: "Every confirmed order gets its own tracking link by email. It opens live courier scans with no login and no order number to type. The same timeline sits under Orders in your account if you would rather start there.",
  },
  {
    q: "Which size should I order?",
    a: "Each product page carries its own chart, measured flat per size across chest, length and sleeve — our pieces are cut to a heavy, oversized drape, so the chart matters more than your usual letter. Between two sizes: down for a closer fit, up for the intended drape.",
  },
  {
    q: "How do I return or exchange something?",
    a: "Open the order in your account within 14 days of delivery and choose Return. Unworn pieces with their original tags qualify, and a reverse pickup is booked for you — nothing to pack off to a courier counter. Exchanges depend on the replacement size still being in stock.",
  },
  {
    q: "When will my refund reach me?",
    a: "Returned pieces are inspected within 48 hours of reaching the warehouse. Once approved, UPI and wallet refunds usually land the same day, card refunds in 5–10 business days, and cash-on-delivery orders go to the bank account you add during the return.",
  },
  {
    q: "Can I cancel or change an order?",
    a: "Yes, while it still reads PENDING or CONFIRMED — cancel it yourself from the order page. Once the warehouse allocates stock the order moves to PROCESSING, and from there cancellation needs the desk to approve it. Address edits are always worth asking about early.",
  },
  {
    q: "Which payment methods do you accept?",
    a: "Cards, UPI, netbanking and wallets through Razorpay, plus cash on delivery on eligible pincodes. Payment happens on the provider's own encrypted page — we never see or store your card, and nobody here will ask for it over email or phone.",
  },
  {
    q: "Do you ship outside India?",
    a: "Not yet. Orders ship within India only. International delivery and the duties that come with it are planned for a later phase — the newsletter is where that gets announced first.",
  },
];

/* The headline, cut into letters.
   ---------------------------------------------------------------------------
   Only this page's. The masthead is shared, but the bag and the wishlist open
   on a two-cut title where the light half already carries the movement — the
   support page's is a single solid word, and a single solid word is the one
   that reads as static. So `Contact` is set letter by letter and each one
   rises out of its own cut on a stagger, which is the §6.1 entrance the rest
   of the page uses, applied at the scale of a glyph instead of a panel.

   Two things ride on the same letters:

     the rise    each glyph starts a hair over its own height below the cut and
                 travels up into it, 55ms apart, so the word assembles left to
                 right rather than fading in as a block.
     the glint   once the word has settled, a cold highlight walks across it on
                 a long loop — the house steel, one letter at a time. It is the
                 brand's one joke about its own name, and at a nine-second
                 cycle it is caught rather than watched.

   The h1 keeps an `aria-label`, because a word split into seven elements is a
   word a screen reader is entitled to read out as seven letters. Under reduced
   motion none of this is built at all: the plain heading renders instead. */
const TITLE = "Contact";

/* Shadows only interpolate cleanly between matching formats, so all three
   keyframes carry explicit px on every length. */
const GLINT = [
  "0px 0px 0px rgba(184, 205, 214, 0)",
  "0px 0px 14px rgba(184, 205, 214, 0.26)",
  "0px 0px 0px rgba(184, 205, 214, 0)",
];

function Title() {
  const reduce = useReducedMotion();

  if (reduce) return <h1 className="io-page__title">{TITLE}</h1>;

  return (
    <h1 aria-label={TITLE} className="io-page__title ct-title">
      {TITLE.split("").map((glyph, i) => (
        <span aria-hidden className="ct-title__cut" key={`${glyph}-${i}`}>
          <motion.span
            className="ct-title__glyph"
            initial={{ y: "122%" }}
            animate={{ y: "0%", textShadow: GLINT }}
            transition={{
              y: { duration: 0.85, delay: 0.08 + i * 0.055, ease: EASE_OUT },
              /* The stagger has to be large next to the duration or every
                 letter peaks at once and the word just pulses. At 0.16s
                 against a 1s rise-and-fall the highlight is only ever on two
                 or three letters, so it walks. Same cycle length on all of
                 them — duration plus repeatDelay — so the offsets hold. */
              textShadow: {
                duration: 1,
                delay: 1.5 + i * 0.16,
                repeat: Infinity,
                repeatDelay: 9,
                ease: "easeInOut",
              },
            }}
          >
            {glyph}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

export default function ContactPage() {
  const uid = useId();
  const [reason, setReason] = useState("order");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 700);
  }

  return (
    <div className="ct-root">
      {/* --------------------------------------------------- 01 · the header
          The storefront masthead, carried by chrome.css's own `io-page__*`
          classes rather than copied into this sheet — the bag and the wishlist
          open on exactly this block, and sharing it is what keeps the three
          from drifting apart again. That sheet loads on every (storefront)
          route, and `io-tokens` hands it its palette here inside `.ct-root`;
          only the band behind it is declared locally, in contact.css §01. */}
      <header className="ct-head io-band io-tokens">
        <div className="io-page__wrap">
          <div className="io-page__head">
            <div>
              {/* The eyebrow says "Support" rather than "Contact" only so the
                  masthead does not print the same word twice — the headline is
                  the page's name, and one word is the whole of it. */}
              <p className="io-page__eyebrow">Support</p>

              <Title />

              <p className="io-page__lede">
                Sizing, shipping, returns or an order already on its way — send
                the details once and a person picks it up from there.
              </p>
            </div>

            <dl className="io-page__spec">
              {SPECS.map((spec) => (
                <div key={spec.label}>
                  <dt>{spec.label}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </header>

      {/* ------------------------------------ 02 · channels + 03 · the form */}
      <section className="ct-section" id="contact-form">
        <div className="ct-shell ct-work">
          {/* ---- channels ----------------------------------------------- */}
          <Reveal className="ct-aside" onMount>
            <div className="ct-panel">
              <h2 className="ct-h">Reach us directly</h2>

              <div className="ct-channels">
                {CHANNELS.map(({ icon: Icon, title, description, href }) => {
                  /* One row, two possible elements, near-identical contents —
                     `Item asChild` paints whichever one it is given. The arrow
                     belongs only to the rows that go somewhere. */
                  const row = (
                    <>
                      <ItemMedia>
                        <Icon aria-hidden />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{title}</ItemTitle>
                        <ItemDescription>{description}</ItemDescription>
                      </ItemContent>
                      {href ? (
                        <ItemActions>
                          <span className="ct-channel__go" aria-hidden>
                            <ArrowUpRight />
                          </span>
                        </ItemActions>
                      ) : null}
                    </>
                  );

                  return href ? (
                    <Item asChild className="ct-channel" key={title}>
                      <button onClick={() => openAway(href)} type="button">
                        {row}
                      </button>
                    </Item>
                  ) : (
                    <Item className="ct-channel ct-channel--static" key={title}>
                      {row}
                    </Item>
                  );
                })}
              </div>
            </div>

            <p className="ct-note">
              <ShieldCheck aria-hidden />
              Never send card numbers, CVV, passwords or OTPs. An order number is
              all we need.
            </p>
          </Reveal>

          {/* ---- the form ----------------------------------------------- */}
          <Reveal delay={0.08} onMount>
            <div className="ct-panel">
              {sent ? (
                <Empty className="ct-sent">
                  <EmptyHeader>
                    <EmptyMedia variant="default">
                      <Check aria-hidden />
                    </EmptyMedia>
                    <EmptyTitle>Message received</EmptyTitle>
                    <EmptyDescription>
                      A confirmation is on its way to your inbox. We reply within
                      two business days, Monday to Saturday.
                    </EmptyDescription>
                    <span className="ct-sent__ref">
                      Reference · {reason.toUpperCase()}-{new Date().getFullYear()}
                    </span>
                  </EmptyHeader>
                </Empty>
              ) : (
                <form onSubmit={submit} noValidate={false}>
                  <h2 className="ct-h">Send a message</h2>
                  <p className="ct-h__sub">
                    Everything marked optional can be left blank.
                  </p>

                  <FieldGroup>
                    <div className="ct-row">
                      <Field>
                        <FieldLabel htmlFor={`${uid}-name`}>Name</FieldLabel>
                        <Input
                          id={`${uid}-name`}
                          name="name"
                          autoComplete="name"
                          placeholder="Full name"
                          required
                        />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor={`${uid}-email`}>Email</FieldLabel>
                        <Input
                          id={`${uid}-email`}
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          required
                        />
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel htmlFor={`${uid}-reason`}>Reason</FieldLabel>
                      <ToggleGroup
                        id={`${uid}-reason`}
                        type="single"
                        value={reason}
                        onValueChange={(value) => value && setReason(value)}
                        className="ct-reasons"
                      >
                        {REASONS.map((item) => (
                          <ToggleGroupItem
                            className="ct-reason"
                            key={item.value}
                            value={item.value}
                            aria-label={item.label}
                          >
                            {item.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      <input type="hidden" name="reason" value={reason} />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor={`${uid}-order`}>Order number</FieldLabel>
                      <InputGroup>
                        <InputGroupAddon>ORD</InputGroupAddon>
                        <InputGroupInput
                          id={`${uid}-order`}
                          name="order"
                          autoComplete="off"
                          placeholder="000000"
                          inputMode="numeric"
                        />
                      </InputGroup>
                      <FieldDescription>
                        Optional — but it is the fastest route to an answer.
                      </FieldDescription>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor={`${uid}-message`}>Message</FieldLabel>
                      <Textarea
                        id={`${uid}-message`}
                        name="message"
                        rows={6}
                        placeholder="What happened, and what would you like us to do?"
                        required
                      />
                    </Field>

                    <Field orientation="horizontal" className="ct-consent">
                      <Checkbox id={`${uid}-consent`} name="consent" required />
                      <FieldLabel htmlFor={`${uid}-consent`}>
                        I understand this is not a live chat, and that a reply can
                        take up to two business days.
                      </FieldLabel>
                    </Field>

                    <div className="ct-actions">
                      <Button className="ct-submit" type="submit" disabled={sending}>
                        {sending ? "Sending" : "Send message"}
                        <span className="ct-submit__go" aria-hidden>
                          {sending ? <Spinner /> : <ArrowUpRight />}
                        </span>
                      </Button>
                    </div>
                  </FieldGroup>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------- 04 · FAQ */}
      <section className="ct-section" id="contact-faq">
        <div className="ct-shell">
          <Reveal>
            <div className="ct-faq">
              <div className="ct-faq__head">
                <h2 className="ct-h">Common questions</h2>
                {/* Nothing routes here — the form is on this page, so the
                    viewport just moves. A hash anchor would ask the browser to
                    treat that as a document-level jump; a button asks the page
                    to move, which is what actually happens. */}
                <button
                  className="ct-faq__back"
                  onClick={() => scrollToHash("contact-form")}
                  type="button"
                >
                  Write to us
                </button>
              </div>

              <Accordion type="single" collapsible defaultValue="faq-0">
                {FAQS.map((item, i) => (
                  <AccordionItem key={item.q} value={`faq-${i}`}>
                    <AccordionTrigger>{item.q}</AccordionTrigger>
                    <AccordionContent>
                      <p>{item.a}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
