"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, Check, ChevronDown, Sparkles, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Select as SelectPrimitive } from "radix-ui";
import { useState, type ComponentProps, type ReactNode } from "react";

/**
 * The operations console's vocabulary.
 *
 * Every `/` screen is assembled from the pieces in this file, so an
 * operator learns one page and knows the other eighty. Nothing here invents a
 * colour, a radius or a gap — they all resolve through the token block on
 * `.aui-app` (styles/components/admin.css), which is the same `nh-*` list the
 * storefront's account and wishlist screens read from.
 */

/* ============================================================ tones */

/**
 * Colour lands on the glyph and on status ink, never on a chip fill or a card
 * background — that is what keeps a near-monochrome console reading as one
 * surface while still telling good news from bad at a glance.
 */
export type Tone = "ink" | "mint" | "amber" | "rose" | "sky" | "violet";

const TONE_RGB: Record<Tone, string> = {
  ink: "241, 243, 243",
  mint: "111, 219, 164",
  amber: "232, 183, 101",
  rose: "239, 122, 128",
  sky: "121, 184, 232",
  violet: "168, 146, 232",
};

/** The custom property the stylesheet reads for glyph ink and the hover glow. */
export function toneVars(tone: Tone = "ink") {
  return { "--aui-spot": TONE_RGB[tone] } as React.CSSProperties;
}

/* ======================================================== page frame */

export type PageSpec = { label: string; value: string };
export type PageBack = { href: string; label: string };

/**
 * The frame every admin screen opens in.
 *
 * One banner card carrying the area badge, the screen's title, a line of copy,
 * whatever the screen can act on, and the numbers it can prove — ruled off
 * underneath so the whole head stays one band tall.
 *
 * It replaced a full-height centred masthead. That treatment is right for a
 * shopper landing on `/wishlist` once; it is wrong eighty times a day for an
 * operator, where it pushed the actual work below the fold on every screen.
 * Same voice, a quarter of the height.
 *
 * `title` takes markup so a screen can still set the light cut with `<em>`:
 * `<>Product <em>catalogue</em></>`.
 *
 * `icon` is optional — the head is complete without one, so adding it to a
 * screen is a decoration rather than a migration.
 */
export function AdminPage({
  back,
  eyebrow,
  icon: Icon,
  badgeIcon: BadgeIcon = Sparkles,
  title,
  lede,
  spec,
  actions,
  children,
}: {
  back?: PageBack;
  eyebrow: string;
  /** Sits beside the title, bare and tinted — never on a filled tile. */
  icon?: LucideIcon;
  /** Leads the badge pill. Defaults to the house spark. */
  badgeIcon?: LucideIcon;
  title: ReactNode;
  lede?: string;
  spec?: PageSpec[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="aui-page">
      <div className="aui-page__wrap">
        {back && (
          <Link
            aria-label={`Go back to ${back.label}`}
            className="aui-page__back"
            href={back.href}
          >
            <ArrowLeft aria-hidden size={13} strokeWidth={1.8} />
            Go back
            <span>{back.label}</span>
          </Link>
        )}

        <header className="aui-head">
          <div className="aui-head__lead">
            <p className="aui-head__badge">
              <BadgeIcon aria-hidden size={11} strokeWidth={2} />
              {eyebrow}
            </p>

            <h1 className="aui-head__title">
              {Icon && (
                <Icon aria-hidden className="aui-head__glyph" size={28} strokeWidth={2} />
              )}
              {title}
            </h1>

            {lede && <p className="aui-head__lede">{lede}</p>}
          </div>

          {actions && <div className="aui-head__actions">{actions}</div>}

          {spec && spec.length > 0 && (
            <dl className="aui-head__spec">
              {spec.map((entry) => (
                <div key={entry.label}>
                  <dt>{entry.label}</dt>
                  <dd>{entry.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </header>

        <div className="aui-page__body">{children}</div>
      </div>
    </div>
  );
}

/* =========================================================== section */

/**
 * A titled block inside a page. The head is a card of its own rather than a
 * bare heading, so a page of six sections reads as six things rather than one
 * long scroll with rules across it.
 *
 * `level` exists for the one screen that drops the page head entirely (the
 * dashboard): its first section becomes the page's `<h1>`, so the document
 * still opens on a heading rather than starting at level two.
 */
export function Section({
  eyebrow,
  title,
  copy,
  level = 2,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  /** Heading rank for the title. Only the page's lead section should pass 1. */
  level?: 1 | 2;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <section className="aui-sec">
      <div className="aui-sec__head">
        <div>
          {eyebrow && <p className="aui-sec__eyebrow">{eyebrow}</p>}
          <Heading className="aui-sec__title">{title}</Heading>
          {copy && <p className="aui-sec__copy">{copy}</p>}
        </div>
        {actions && <div className="aui-sec__actions">{actions}</div>}
      </div>
      {children && <div className="aui-sec__body">{children}</div>}
    </section>
  );
}

export function Panel({
  children,
  flush,
  className = "",
}: {
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <div className={`aui-panel${flush ? " aui-panel--flush" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}

/* ============================================================= card */

/**
 * A record that is not a table row — a warehouse, a provider, a role. The
 * glyph, the title pair and the meta list are all optional so one component
 * covers the whole console rather than five near-copies.
 */
export function Card({
  icon: Icon,
  tone = "ink",
  kicker,
  title,
  copy,
  status,
  meta,
  actions,
  children,
}: {
  icon?: LucideIcon;
  tone?: Tone;
  kicker?: string;
  title: string;
  copy?: string;
  status?: ReactNode;
  meta?: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="aui-card" style={toneVars(tone)}>
      <div className="aui-card__head">
        {Icon && (
          <span className="aui-card__glyph">
            <Icon aria-hidden size={18} strokeWidth={1.6} />
          </span>
        )}
        <div className="aui-card__title" style={{ flex: 1 }}>
          {kicker && <span>{kicker}</span>}
          <h3>{title}</h3>
        </div>
        {status}
      </div>

      {copy && <p className="aui-card__copy">{copy}</p>}
      {children}

      {meta && meta.length > 0 && (
        <dl className="aui-card__meta">
          {meta.map((entry) => (
            <div key={entry.label}>
              <dt>{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {actions && <div className="aui-card__actions">{actions}</div>}
    </article>
  );
}

/** A labelled progress read-out — completeness, capacity, sell-through. */
export function Meter({
  label,
  value,
  display,
}: {
  label: string;
  value: number;
  display?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="aui-meter">
      <p className="aui-meter__row">
        {label}
        <b>{display ?? `${clamped}%`}</b>
      </p>
      <span className="aui-meter__track">
        <span className="aui-meter__fill" style={{ width: `${clamped}%` }} />
      </span>
    </div>
  );
}

/** Key/value detail, for a record page. */
export function DetailList({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="aui-dl">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Timeline({
  steps,
}: {
  steps: Array<{ title: string; detail: string; done?: boolean }>;
}) {
  return (
    <ol className="aui-timeline">
      {steps.map((step) => (
        <li data-done={step.done ? "true" : "false"} key={step.title}>
          <strong>{step.title}</strong>
          <span>{step.detail}</span>
        </li>
      ))}
    </ol>
  );
}

/* =========================================================== status */

/** Six tones, one shape. The word decides the tone unless one is passed. */
export type StatusTone = "good" | "warn" | "bad" | "info" | "idle" | "neutral";

const STATUS_WORDS: Record<string, StatusTone> = {
  active: "good",
  approved: "good",
  confirmed: "good",
  captured: "good",
  succeeded: "good",
  paid: "good",
  live: "good",
  published: "good",
  healthy: "good",
  delivered: "good",
  received: "good",
  resolved: "good",
  validated: "good",
  online: "good",
  settled: "good",
  enabled: "good",
  done: "good",
  passed: "good",

  pending: "warn",
  placed: "warn",
  review: "warn",
  scheduled: "warn",
  processing: "warn",
  attention: "warn",
  queued: "warn",
  "on hold": "warn",
  hold: "warn",
  waiting: "warn",
  draft: "warn",
  open: "warn",
  requested: "warn",
  unpaid: "warn",
  /* Money owed but not yet in — cash on delivery, in the payments ledger. */
  due: "warn",

  failed: "bad",
  cancelled: "bad",
  canceled: "bad",
  rejected: "bad",
  blocked: "bad",
  overdue: "bad",
  breached: "bad",
  disabled: "bad",
  critical: "bad",
  mismatch: "bad",

  "in transit": "info",
  dispatched: "info",
  shipped: "info",
  new: "info",
  running: "info",
  syncing: "info",
};

export function Status({ value, tone }: { value: string; tone?: StatusTone }) {
  const resolved = tone ?? STATUS_WORDS[value.toLowerCase().trim()] ?? "neutral";
  return (
    <span className="aui-status" data-tone={resolved === "neutral" ? undefined : resolved}>
      {value}
    </span>
  );
}

/* ========================================================== controls */

type BtnProps = ComponentProps<"button"> & {
  variant?: "solid" | "ghost" | "danger";
  size?: "md" | "sm";
  wide?: boolean;
};

export function Btn({
  variant = "ghost",
  size = "md",
  wide,
  className = "",
  type = "button",
  ...rest
}: BtnProps) {
  const classes = [
    "aui-btn",
    `aui-btn--${variant}`,
    size === "sm" ? "aui-btn--sm" : "",
    wide ? "aui-btn--wide" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button className={classes} type={type} {...rest} />;
}

/** Same shape as `Btn`, but a real link — so a destination never fakes one. */
export function BtnLink({
  variant = "ghost",
  size = "md",
  wide,
  className = "",
  ...rest
}: ComponentProps<typeof Link> & {
  variant?: "solid" | "ghost" | "danger";
  size?: "md" | "sm";
  wide?: boolean;
}) {
  const classes = [
    "aui-btn",
    `aui-btn--${variant}`,
    size === "sm" ? "aui-btn--sm" : "",
    wide ? "aui-btn--wide" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <Link className={classes} {...rest} />;
}

export function IconBtn({
  label,
  icon: Icon,
  danger,
  good,
  ...rest
}: ComponentProps<"button"> & {
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  /** For the affirming verb in a row — confirming, approving, receiving. */
  good?: boolean;
}) {
  return (
    <button
      aria-label={label}
      className={`aui-iconbtn${danger ? " aui-iconbtn--danger" : ""}${good ? " aui-iconbtn--good" : ""}`}
      title={label}
      type="button"
      {...rest}
    >
      <Icon aria-hidden size={15} strokeWidth={1.7} />
    </button>
  );
}

/**
 * A policy row: what it is, what it means, and the control. Uncontrolled state
 * lives with the caller so a screen can decide what a toggle actually does.
 */
export function SwitchRow({
  icon: Icon,
  title,
  detail,
  checked,
  onChange,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  detail: string;
  checked?: boolean;
  onChange?: (next: boolean) => void;
  action?: ReactNode;
}) {
  return (
    <div className="aui-switchrow">
      {Icon && (
        <span className="aui-card__glyph">
          <Icon aria-hidden size={17} strokeWidth={1.6} />
        </span>
      )}
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      {action ??
        (onChange && (
          <button
            aria-checked={checked ? "true" : "false"}
            aria-label={title}
            className="aui-switch"
            onClick={() => onChange(!checked)}
            role="switch"
            type="button"
          />
        ))}
    </div>
  );
}

/* ============================================================ fields */

export function Field({
  label,
  hint,
  help,
  full,
  group,
  children,
}: {
  label: string;
  hint?: string;
  help?: string;
  full?: boolean;
  /**
   * For a field answered by several controls rather than one — a row of
   * toggles. A `<label>` binds itself to the first control inside it, so
   * clicking the word "Sizes" would silently press the first size; this renders
   * the caption as a group heading instead, which is what it actually is.
   */
  group?: boolean;
  children: ReactNode;
}) {
  const className = `aui-field${full ? " aui-field--full" : ""}`;
  const body = (
    <>
      <span>
        {label}
        {hint && <em>{hint}</em>}
      </span>
      {children}
      {help && <small>{help}</small>}
    </>
  );

  return group ? (
    <div aria-label={label} className={className} role="group">
      {body}
    </div>
  ) : (
    <label className={className}>{body}</label>
  );
}

/**
 * The console's dropdown.
 *
 * A native `<select>` hands the list to the operating system: light chrome on
 * a dark console, a different shape on every machine, and no room for a mark
 * against the chosen row. This is the same control drawn in the console's own
 * language — one panel, one hairline, the current value ticked — over Radix,
 * so type-ahead, arrow keys, escape and focus return all still work.
 *
 * It is uncontrolled by default and renders a hidden native select for its
 * `name`, which is what keeps every `FormData(form)` in this console working
 * exactly as it did.
 */
/**
 * A choice, and what to call it.
 *
 * Most of the console's choices are their own label — "Draft", "BLR-01" — and
 * stay plain strings. The object form is for the ones where the label carries
 * something the stored value must not: an inventory item is stored by its id
 * but read as "Afterdark Hoodie · 36 available", because the number is what
 * tells an operator whether picking it is a good idea.
 */
export type SelectOption = string | { value: string; label: string; disabled?: boolean };

export function optionValue(option: SelectOption) {
  return typeof option === "string" ? option : option.value;
}

export function optionLabel(option: SelectOption) {
  return typeof option === "string" ? option : option.label;
}

/**
 * A choice shown but not offered.
 *
 * Kept on the list rather than filtered off it: an operator looking for an item
 * that is out of stock needs to find it and read why, and a name that has
 * simply vanished from a menu reads as a bug in the menu.
 */
export function optionDisabled(option: SelectOption) {
  return typeof option === "string" ? false : option.disabled === true;
}

export function Select({
  name,
  options,
  defaultValue,
  value,
  onValueChange,
  placeholder = "Select…",
  required,
  disabled,
  id,
  ariaLabel,
}: {
  name?: string;
  options: readonly SelectOption[];
  defaultValue?: string;
  /** Pass with `onValueChange` to drive it from outside. */
  value?: string;
  onValueChange?: (next: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}) {
  /* Tracked only so the trigger can be styled while the panel is open — the
     value itself stays with Radix unless a caller asks to own it. */
  const [open, setOpen] = useState(false);

  return (
    <SelectPrimitive.Root
      defaultValue={defaultValue}
      disabled={disabled}
      name={name}
      onOpenChange={setOpen}
      onValueChange={onValueChange}
      required={required}
      value={value}
    >
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className="aui-select"
        data-open={open ? "true" : undefined}
        id={id}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown aria-hidden size={14} strokeWidth={1.9} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="aui-selectmenu" position="popper" sideOffset={6}>
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                className="aui-selectitem"
                disabled={optionDisabled(option)}
                key={optionValue(option)}
                value={optionValue(option)}
              >
                <SelectPrimitive.ItemText>{optionLabel(option)}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <Check aria-hidden size={14} strokeWidth={2} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/* ============================================================= notes */

export function Note({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon?: LucideIcon;
  tone?: "warn" | "bad";
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="aui-note" data-tone={tone}>
      {Icon && <Icon aria-hidden size={17} strokeWidth={1.6} />}
      <div>
        {title && <strong>{title}</strong>}
        <p>{children}</p>
      </div>
    </div>
  );
}

export function Empty({
  icon: Icon,
  title,
  copy,
  action,
  inline,
}: {
  icon: LucideIcon;
  title: string;
  copy?: string;
  action?: ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={`aui-empty${inline ? " aui-empty--inline" : ""}`}>
      <span className="aui-empty__glyph">
        <Icon aria-hidden size={inline ? 16 : 20} strokeWidth={1.5} />
      </span>
      <h2>{title}</h2>
      {copy && <p>{copy}</p>}
      {action}
    </div>
  );
}

/* =========================================================== dialogs */

/**
 * The console's one modal. Radix owns focus, escape and the scroll lock; this
 * only fixes the shape, so create, edit and confirm are the same object at
 * three sizes rather than three different surfaces.
 */
export function Modal({
  open,
  onOpenChange,
  icon: Icon,
  tone = "ink",
  title,
  description,
  size = "md",
  footNote,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  icon?: LucideIcon;
  tone?: Tone;
  title: string;
  description?: string;
  size?: "sm" | "md" | "wide";
  footNote?: string;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="aui-overlay" />
        <Dialog.Content
          className={`aui-modal${size === "wide" ? " aui-modal--wide" : ""}${
            size === "sm" ? " aui-modal--sm" : ""
          }`}
          style={toneVars(tone)}
        >
          <div className="aui-modal__head">
            {Icon && (
              <span className="aui-modal__glyph">
                <Icon aria-hidden size={18} strokeWidth={1.6} />
              </span>
            )}
            <div>
              <Dialog.Title asChild>
                <h2>{title}</h2>
              </Dialog.Title>
              {description ? (
                <Dialog.Description asChild>
                  <p>{description}</p>
                </Dialog.Description>
              ) : (
                /* Radix warns when a content has no description; an empty one
                   keeps the announcement honest without printing a blank line. */
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close aria-label="Close" className="aui-modal__close">
              <X aria-hidden size={16} strokeWidth={1.8} />
            </Dialog.Close>
          </div>

          {children && <div className="aui-modal__body">{children}</div>}

          {(footer || footNote) && (
            <div className="aui-modal__foot">
              {footNote && <p>{footNote}</p>}
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Deleting is the one action the console asks twice about. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <Modal
      description={description}
      footer={
        <>
          <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            variant="danger"
          >
            {confirmLabel}
          </Btn>
        </>
      }
      onOpenChange={onOpenChange}
      open={open}
      size="sm"
      title={title}
      tone="rose"
    />
  );
}

/* ============================================================== tabs */

/**
 * A segmented pill rail driven by STATE rather than by the route.
 *
 * `AdminModuleNav` is the one to reach for when each tab is its own screen —
 * it derives the current tab from the pathname, so a link, a back button and a
 * bookmark all work. This is for the other case: one screen whose list is asked
 * a different question, where making each answer a route would put five URLs in
 * the history for one glance at a queue.
 *
 * Same shape as the route version on purpose. An operator should not be able to
 * tell which kind they are looking at.
 */
export function Tabs({
  label,
  value,
  onChange,
  options,
  inline,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; label: string; count?: number }>;
  inline?: boolean;
}) {
  return (
    <nav aria-label={label} className={inline ? "aui-tabs aui-tabs--inline" : "aui-tabs"}>
      {options.map((option) => (
        <button
          aria-current={option.value === value ? "page" : undefined}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
          {/* Absent at zero rather than shown as "0": a tab is already telling
              you it is empty by having nothing under it. */}
          {option.count !== undefined && option.count > 0 && <b>{option.count}</b>}
        </button>
      ))}
    </nav>
  );
}
