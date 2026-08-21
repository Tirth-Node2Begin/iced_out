"use client";

import {
  Banknote,
  Boxes,
  CircleDollarSign,
  Headphones,
  PackageCheck,
  RotateCcw,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { Section } from "@/components/admin/admin-ui";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import { formatPrice } from "@/features/02-products";
import { ActivityFeed } from "@/features/15-dashboard/components/activity-feed";
import { useQueues, useTrading } from "@/features/15-dashboard/dashboard-api";
import {
  change,
  earliestDay,
  pad,
  periodFor,
  pointChange,
  RANGE_PRESETS,
  rangeFromWindow,
  today,
  windowFromRange,
  type RangeKey,
  type Window,
} from "@/features/15-dashboard/data/dashboard-metrics";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * The landing screen.
 *
 * Three blocks: what the store traded over a period you choose, what is
 * waiting on a person right now, and what the console has just been doing. No
 * page head — the first section carries the title and the date filter, so the
 * work starts at the top of the viewport instead of below a banner.
 *
 * The split between the first two rows is deliberate. Trading is a PERIOD and
 * moves with the filter; a queue is a MOMENT and does not — "orders to
 * confirm, last 30 days" is not a thing anyone can act on. Both halves are
 * counted by the SERVER off the same tables the registers read, so no card can
 * disagree with the screen it opens.
 */

/* ================================================================= period */

function periodLabel(window: Window, key: RangeKey): string {
  if (key === "custom") return `the ${window.length} selected days`;
  return window.length === 1 ? "today" : `the last ${window.length} days`;
}

/* ================================================================= queues */

/** Icon, tone and destination per queue. The counts come from the API. */
const QUEUE_CARDS = [
  { key: "ordersToConfirm", label: "Orders to confirm", icon: ShoppingBag, tone: "amber", href: "/admin/orders" },
  { key: "paymentExceptions", label: "Payment exceptions", icon: Banknote, tone: "rose", href: "/admin/payments" },
  { key: "readyToDispatch", label: "Ready to dispatch", icon: PackageCheck, tone: "sky", href: "/admin/shipments/active" },
  { key: "returnsToReview", label: "Returns to review", icon: RotateCcw, tone: "violet", href: "/admin/returns/requests" },
  { key: "stockAtRisk", label: "Stock at risk", icon: Boxes, tone: "amber", href: "/admin/inventory/overview" },
  { key: "openTickets", label: "Open queries", icon: Headphones, tone: "sky", href: "/admin/support" },
] as const;

/* ================================================================== screen */

export function AdminDashboard() {
  const { series, loading: seriesLoading, error: seriesError } = useTrading();
  const { queues, error: queuesError } = useQueues();

  const [range, setRange] = useState<RangeKey>("today");
  /* Only set once the calendar has been used. A preset fills the picker from
     the window instead, so the control always shows the dates being counted. */
  const [picked, setPicked] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const hydrated = useHydrated();

  const selected = useMemo<Window>(() => {
    if (range === "custom") {
      const custom = windowFromRange(series, picked?.from, picked?.to);
      if (custom) return custom;
    }
    const preset = RANGE_PRESETS.find((entry) => entry.key === range) ?? RANGE_PRESETS[0];
    return { start: 0, length: preset.days };
  }, [picked, range, series]);

  const { current, previous } = useMemo(() => periodFor(series, selected), [selected, series]);
  const per = periodLabel(selected, range);
  const activeLabel = RANGE_PRESETS.find((entry) => entry.key === range)?.label ?? "Custom range";

  /* Real dates only once the browser is driving — see the picker's note. */
  const shownRange = hydrated
    ? (range === "custom" && picked ? picked : rangeFromWindow(selected))
    : undefined;

  const queueStats: Stat[] = QUEUE_CARDS.map((card) => ({
    label: card.label,
    value: pad(queues[card.key].count),
    note: queues[card.key].note,
    icon: card.icon,
    tone: card.tone,
    href: card.href,
  }));

  /* The one number for "work outstanding", summed from what the server counted. */
  const openWork = QUEUE_CARDS.reduce((run, card) => run + queues[card.key].count, 0);

  /** A completed pick becomes the range; a half-finished one only redraws. */
  function pick(next: DateRange | undefined) {
    setPicked(next);
    if (next?.from && next?.to) setRange("custom");
  }

  const trading: Stat[] = [
    {
      label: "Net revenue",
      value: formatPrice(current.revenue),
      icon: CircleDollarSign,
      tone: "mint",
      delta: change(current.revenue, previous.revenue),
      note: `${formatPrice(current.basket)} average`,
    },
    {
      label: "Orders placed",
      value: current.orders.toLocaleString("en-IN"),
      icon: ShoppingBag,
      tone: "sky",
      delta: change(current.orders, previous.orders),
      note: `${current.sessions.toLocaleString("en-IN")} sessions`,
    },
    {
      label: "Conversion",
      value: `${current.conversion.toFixed(2)}%`,
      icon: Users,
      tone: "violet",
      delta: pointChange(current.conversion, previous.conversion),
      note: "Orders per session",
    },
    {
      label: "Return rate",
      value: `${current.returnRate.toFixed(1)}%`,
      icon: RotateCcw,
      tone: "rose",
      delta: pointChange(current.returnRate, previous.returnRate),
      note: `${current.returns} of ${current.orders} orders`,
    },
  ];

  return (
    <div className="aui-page">
      <div className="aui-page__wrap">
        <div className="aui-page__body">
          <Section
            actions={
              <div className="aui-chips">
                {RANGE_PRESETS.map((preset) => (
                  <button
                    aria-pressed={range === preset.key ? "true" : "false"}
                    className="aui-chip"
                    key={preset.key}
                    onClick={() => {
                      setRange(preset.key);
                      setPicked(undefined);
                    }}
                    type="button"
                  >
                    {preset.label}
                  </button>
                ))}

                <button
                  aria-pressed={range === "custom" ? "true" : "false"}
                  className="aui-chip"
                  onClick={() => setCalendarOpen(true)}
                  type="button"
                >
                  Custom
                </button>

                <DateRangePicker
                  earliest={hydrated ? earliestDay(series) : undefined}
                  fallback={activeLabel}
                  latest={hydrated ? today() : undefined}
                  onChange={pick}
                  onOpenChange={setCalendarOpen}
                  open={calendarOpen}
                  value={shownRange}
                />
              </div>
            }
            copy={
              seriesError
                ? seriesError
                : seriesLoading && series.length === 0
                  ? "Reading the trading figures…"
                  : series.length === 0
                    ? "Nothing has been traded yet. Figures appear here as orders come in."
                    : `Trading over ${per}, each figure against the period immediately before it.`
            }
            eyebrow="Operations"
            level={1}
            title="Dashboard"
          >
            <StatGrid stats={trading} />
          </Section>

          <Section
            copy={
              queuesError
                ? queuesError
                : openWork === 0
                  ? "Nothing is waiting on a person right now."
                  : `${openWork} items are waiting on a person right now. Counts are live and do not follow the date filter — open a card to work the queue behind it.`
            }
            eyebrow="Action required"
            title="Queues"
          >
            <StatGrid stats={queueStats} />
          </Section>

          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
