"use client";

import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  Download,
  PackageCheck,
  RotateCcw,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import { AdminPage, Btn, Panel, Section } from "@/components/admin/admin-ui";
import type { RecordRow } from "@/components/admin/record-manager";
import { available, useStock } from "@/features/03-inventory/stock-context";
import { stockLevel } from "@/features/03-inventory/data/stock-fixtures";
import { awaitingDispatch, useFulfilment } from "@/features/07-orders/fulfilment-context";
import { formatPrice } from "@/features/02-products";
import {
  change,
  periodFor,
  pointChange,
  RANGE_PRESETS,
  today,
  type RangePreset,
} from "@/features/15-dashboard/data/dashboard-metrics";
import { tradingSeries, type TradingDay } from "@/features/15-dashboard/data/trading-series";
import { adminReturnFixtures } from "@/features/18-returns/data/admin-return-fixtures";
import { BarRows, ColumnChart, TrendChart, type BarRow } from "@/features/16-analytics/components/analytics-charts";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * The analytics screen. One page, no tabs.
 *
 * Two kinds of number live here, and the page keeps them apart on purpose:
 *
 *   - THE REGISTERS, LIVE. Counted from the same stores the orders, shipments
 *     and stock screens write to, so a record changed anywhere in the console
 *     is counted here the moment it changes. Nothing is cached, nothing is
 *     five minutes behind.
 *   - THE PERIOD. The day-by-day trading series, summed over whatever the
 *     date filter selects and drawn against the period immediately before it.
 *
 * Each analysis — sales, demand, the order book, inventory, returns — is its
 * own titled section down one page, so moving between them is a scroll rather
 * than a navigation.
 */

/* -------------------------------------------------------------- formats */

/** ₹ in the Indian short scale, for axis ticks and card corners. */
function compactRupees(value: number) {
  const scaled = (divisor: number, suffix: string) =>
    `₹${(value / divisor).toFixed(1).replace(/\.0$/, "")}${suffix}`;
  if (value >= 1_00_00_000) return scaled(1_00_00_000, "Cr");
  if (value >= 1_00_000) return scaled(1_00_000, "L");
  if (value >= 1_000) return scaled(1_000, "k");
  return `₹${Math.round(value)}`;
}

function countOf(value: number) {
  return Math.round(value).toLocaleString("en-IN");
}

/** How many of each `key` a register holds, most common first. */
function tally(rows: RecordRow[], key: string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const bucket = (row[key] ?? "").trim() || "—";
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Oldest-first days, folded into weeks from the newest end backwards. */
function weekly(days: TradingDay[]) {
  const weeks: TradingDay[][] = [];
  let end = days.length;
  while (end > 0) {
    const start = Math.max(0, end - 7);
    weeks.unshift(days.slice(start, end));
    end = start;
  }
  return weeks;
}

/** `stockLevel` over a register row, whose cells are optional by type. */
function levelOf(item: RecordRow) {
  return stockLevel({
    totalUnits: item.totalUnits ?? "0",
    reservedUnits: item.reservedUnits ?? "0",
  });
}

const ORDER_TONES: Record<string, BarRow["tone"]> = {
  Placed: "amber",
  Confirmed: "mint",
  Cancelled: "rose",
};

/* --------------------------------------------------------------- screen */

export function AnalyticsOverview() {
  const [range, setRange] = useState<RangePreset["key"]>("30d");
  const hydrated = useHydrated();
  const { orders, shipments } = useFulfilment();
  const { items } = useStock();

  /* ------------------------------------------------ the registers, live */

  const live = useMemo(() => {
    const open = orders.filter((order) => order.status !== "Cancelled");
    const placed = orders.filter((order) => order.status === "Placed").length;
    const confirmed = orders.filter((order) => order.status === "Confirmed").length;
    const revenue = open.reduce((sum, order) => sum + (Number(order.value) || 0), 0);
    const dispatchable = awaitingDispatch(orders, shipments).length;

    const sellable = items.reduce((sum, item) => sum + available(item), 0);
    const reserved = items.reduce((sum, item) => sum + (Number(item.reservedUnits) || 0), 0);
    const low = items.filter((item) => levelOf(item) === "Low").length;
    const out = items.filter((item) => levelOf(item) === "Out").length;

    return { placed, confirmed, revenue, dispatchable, sellable, reserved, low, out };
  }, [orders, shipments, items]);

  const liveCards: Stat[] = [
    {
      label: "Revenue on the register",
      value: formatPrice(live.revenue),
      icon: CircleDollarSign,
      tone: "mint",
      note: "Orders not cancelled",
      href: "/admin/orders",
    },
    {
      label: "Orders in play",
      value: countOf(live.placed + live.confirmed),
      icon: ShoppingBag,
      tone: "sky",
      note: `${live.placed} placed · ${live.confirmed} confirmed`,
      href: "/admin/orders",
    },
    {
      label: "Ready to dispatch",
      value: countOf(live.dispatchable),
      icon: PackageCheck,
      tone: "violet",
      note: "Confirmed, nothing on a van",
      href: "/admin/shipments/active",
    },
    {
      label: "Sellable units",
      value: countOf(live.sellable),
      icon: Boxes,
      tone: "amber",
      note: `${live.reserved} reserved · ${live.low} low · ${live.out} out`,
      href: "/admin/inventory/overview",
    },
  ];

  const orderRows: BarRow[] = tally(orders, "status").map(([label, count]) => ({
    label,
    value: count,
    display: countOf(count),
    tone: ORDER_TONES[label] ?? "ink",
  }));

  const paymentRows: BarRow[] = tally(orders, "payment").map(([label, count]) => ({
    label,
    value: count,
    display: countOf(count),
  }));

  const itemRows: BarRow[] = useMemo(
    () =>
      items.map((item) => {
        const left = available(item);
        const level = levelOf(item);
        return {
          label: item.itemName ?? item.id ?? "—",
          value: left,
          display: `${left} of ${item.totalUnits ?? "0"}`,
          ...(level === "Out"
            ? { flag: "Out", flagTone: "bad" as const }
            : level === "Low"
              ? { flag: "Low", flagTone: "warn" as const }
              : {}),
        };
      }),
    [items],
  );

  const warehouseRows: BarRow[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const code = (item.warehouse ?? "").trim() || "—";
      counts.set(code, (counts.get(code) ?? 0) + available(item));
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, units]) => ({ label, value: units, display: `${units} units` }));
  }, [items]);

  const reasonRows: BarRow[] = tally(adminReturnFixtures as unknown as RecordRow[], "reason").map(
    ([label, count]) => ({ label, value: count, display: countOf(count) }),
  );

  const outcomeRows: BarRow[] = tally(adminReturnFixtures as unknown as RecordRow[], "outcome").map(
    ([label, count]) => ({ label, value: count, display: countOf(count) }),
  );

  /* -------------------------------------------------------- the period */

  const preset = RANGE_PRESETS.find((entry) => entry.key === range) ?? RANGE_PRESETS[2];
  const { current, previous } = periodFor({ start: 0, length: preset.days });
  const per = preset.days === 1 ? "today" : `the last ${preset.days} days`;

  /* A one-day line is a dot, so "Today" charts a seven-day context and the
     section copy says so. The cards above the charts still answer for today. */
  const span = Math.max(preset.days, 7);

  const { days, labels } = useMemo(() => {
    const slice = [...tradingSeries.slice(0, span)].reverse();
    const name = (offset: number) => {
      if (offset === 0) return "Today";
      if (!hydrated) return `${offset}d ago`;
      const day = today();
      day.setDate(day.getDate() - offset);
      return day.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    };
    return { days: slice, labels: slice.map((day) => name(day.offset)) };
  }, [span, hydrated]);

  const previousDays = useMemo(
    () => [...tradingSeries.slice(span, span * 2)].reverse(),
    [span],
  );

  const demand = useMemo(() => {
    if (span <= 35) {
      return { values: days.map((day) => day.orders), labels, unit: "orders", per: "day" };
    }
    const weeks = weekly(days);
    return {
      values: weeks.map((week) => week.reduce((sum, day) => sum + day.orders, 0)),
      labels: weeks.map((week, index) => `Wk to ${labels[days.indexOf(week[week.length - 1])] ?? index + 1}`),
      unit: "orders",
      per: "week",
    };
  }, [span, days, labels]);

  const trading: Stat[] = [
    {
      label: "Net revenue",
      value: formatPrice(current.revenue),
      icon: CircleDollarSign,
      tone: "mint",
      delta: change(current.revenue, previous.revenue),
      note: `${formatPrice(current.basket)} average order`,
    },
    {
      label: "Orders placed",
      value: countOf(current.orders),
      icon: ShoppingBag,
      tone: "sky",
      delta: change(current.orders, previous.orders),
      note: `${countOf(current.sessions)} sessions`,
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
    <AdminPage
      actions={
        <Btn
          onClick={() =>
            toast.success("Export ready", { description: "Permitted rows written to CSV." })
          }
          variant="solid"
        >
          <Download aria-hidden size={15} strokeWidth={1.7} /> Export permitted data
        </Btn>
      }
      eyebrow="Analytics"
      icon={BarChart3}
      lede="Every analysis on one page: live counts straight off the registers, then the trading period under one date filter. No tabs — each reading is its own section."
      spec={[
        { label: "Revenue", value: compactRupees(current.revenue) },
        { label: "Orders", value: countOf(current.orders) },
        { label: "Sellable", value: countOf(live.sellable) },
      ]}
      title={
        <>
          Read the <em>system</em>
        </>
      }
    >
      <Section
        copy="Counted from the same stores the orders, shipments and stock screens write to — a record changed anywhere in the console moves these numbers the moment it happens. They do not follow the date filter."
        eyebrow="Right now"
        title="The registers, live"
      >
        <StatGrid stats={liveCards} />
      </Section>

      <Section
        actions={
          <div className="aui-chips">
            {RANGE_PRESETS.map((entry) => (
              <button
                aria-pressed={range === entry.key ? "true" : "false"}
                className="aui-chip"
                key={entry.key}
                onClick={() => setRange(entry.key)}
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </div>
        }
        copy={`Trading over ${per}, each figure against the period immediately before it. The filter drives every chart below.`}
        eyebrow="Period"
        title="Trading"
      >
        <StatGrid stats={trading} />
      </Section>

      <Section
        copy={
          preset.days === 1
            ? "Today's revenue, in a seven-day context — a single day is a dot, not a line."
            : "Net revenue per day over the selected period, with the period before it in grey for scale."
        }
        eyebrow="Sales"
        title="Net revenue, day by day"
      >
        <Panel>
          <div className="aui-viz__head">
            <p className="aui-viz__figure">{formatPrice(current.revenue)}</p>
            <p className="aui-viz__against">
              vs {formatPrice(previous.revenue)} the previous {preset.days === 1 ? "day" : `${preset.days} days`}
            </p>
          </div>
          <TrendChart
            format={compactRupees}
            labels={labels}
            series={[
              { label: "Selected period", values: days.map((day) => day.revenue), tone: "mint" },
              { label: "Previous period", values: previousDays.map((day) => day.revenue) },
            ]}
            tableCaption="Net revenue per day, selected period against the previous one"
          />
        </Panel>
      </Section>

      <Section
        copy={
          demand.per === "week"
            ? "Orders folded into weeks — ninety daily columns read as noise."
            : "Orders placed per day over the selected period."
        }
        eyebrow="Demand"
        title={`Orders per ${demand.per}`}
      >
        <Panel>
          <ColumnChart
            format={countOf}
            labels={demand.labels}
            tableCaption={`Orders placed per ${demand.per} over the selected period`}
            tone="sky"
            unit={demand.unit}
            values={demand.values}
            rowLabel={demand.per === "week" ? "Week" : "Day"}
          />
        </Panel>
      </Section>

      <Section
        copy="The order register as it stands this second — every bar recounts the moment an order is confirmed, cancelled or paid anywhere in the console."
        eyebrow="Order book"
        title="Where orders stand"
      >
        <div className="aui-grid aui-grid--2">
          <Panel>
            <p className="aui-viz__kicker">By status</p>
            <BarRows rows={orderRows} />
          </Panel>
          <Panel>
            <p className="aui-viz__kicker">By payment state</p>
            <BarRows rows={paymentRows} tone="sky" />
          </Panel>
        </div>
      </Section>

      <Section
        copy="Sellable pieces per item and per warehouse, live from the stock register. A flagged row is at or past the replenishment line."
        eyebrow="Inventory"
        title="What is left to sell"
      >
        <div className="aui-grid aui-grid--2">
          <Panel>
            <p className="aui-viz__kicker">By item · sellable pieces</p>
            <BarRows rows={itemRows} tone="violet" />
          </Panel>
          <Panel>
            <p className="aui-viz__kicker">By warehouse · sellable pieces</p>
            <BarRows rows={warehouseRows} tone="violet" />
          </Panel>
        </div>
      </Section>

      <Section
        copy="The returns register by reason and by what the customer asked for. Fit is the number to move — it is the one a size guide can act on."
        eyebrow="Returns"
        title="Why things come back"
      >
        <div className="aui-grid aui-grid--2">
          <Panel>
            <p className="aui-viz__kicker">By reason</p>
            <BarRows rows={reasonRows} tone="amber" />
          </Panel>
          <Panel>
            <p className="aui-viz__kicker">By outcome</p>
            <BarRows rows={outcomeRows} tone="amber" />
          </Panel>
        </div>
      </Section>
    </AdminPage>
  );
}
