"use client";

import { Activity, ArrowRight, Clock3, Download, Filter, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type QueueItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  href?: string;
};

export function OperationsPage({
  eyebrow,
  title,
  copy,
  primaryAction,
  items,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  primaryAction?: string;
  items: QueueItem[];
}) {
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeStatus, setActiveStatus] = useState("All");
  const statuses = ["All", ...Array.from(new Set(items.map((item) => item.status)))];
  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesQuery = `${item.id} ${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (activeStatus === "All" || item.status === activeStatus);
  }), [activeStatus, items, query]);

  function exportVisibleRows() {
    const csv = ["id,title,detail,status", ...filteredItems.map((item) => [item.id, item.title, item.detail, item.status].map((value) => `"${value.replaceAll('"', '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.toLowerCase().replaceAll(" ", "-")}-preview.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="admin-workspace">
      <div className="admin-heading admin-heading--actions">
        <div><p>{eyebrow}</p><h1>{title}</h1><span>{copy}</span></div>
        <div className="admin-heading__side"><span><i className="status-dot" /> Live fixture queue</span>{primaryAction && <button className="admin-primary" type="button">{primaryAction}</button>}</div>
      </div>
      <div className="admin-ops-brief">
        <div><Activity size={17} /><span>Queue velocity</span><strong>{Math.max(72, 96 - items.length * 3)}%</strong></div>
        <div className="admin-ops-wave" aria-hidden="true">{[34, 54, 42, 76, 62, 88, 70, 94, 64, 82, 52, 74].map((height, index) => <i key={`${height}-${index}`} style={{ height: `${height}%` }} />)}</div>
        <p><SlidersHorizontal size={15} /><span>Work is ordered by risk, age, and current permission scope.</span><small>Policy / OPS-04</small></p>
      </div>
      <div className="admin-queue-metrics"><article><span>Visible work</span><strong>{items.length.toString().padStart(2, "0")}</strong><small>Current permission scope</small></article><article><span>Needs action</span><strong>{Math.max(1, items.length - 1).toString().padStart(2, "0")}</strong><small>Oldest first</small></article><article><span>Freshness</span><strong>&lt; 5m</strong><small>Preview rollup</small></article></div>
      <div className="admin-queue-toolbar"><label><Search size={15} /><input aria-label={`Search ${title}`} placeholder={`Search ${title.toLowerCase()}`} value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className={filterOpen ? "is-active" : ""} type="button" onClick={() => setFilterOpen((open) => !open)}><Filter size={15} /> Filters</button><button type="button" onClick={exportVisibleRows}><Download size={15} /> Export</button></div>
      {filterOpen && <div className="admin-filter-tray"><span>Status</span>{statuses.map((status) => <button className={activeStatus === status ? "is-active" : ""} key={status} type="button" onClick={() => setActiveStatus(status)}>{status}</button>)}<small>{filteredItems.length} matching records</small></div>}
      <div className="admin-queue-list">
        {filteredItems.map((item) => (
          <article key={item.id}>
            <span className="admin-queue-list__icon"><Clock3 size={17} /></span>
            <div><small>{item.id}</small><h2>{item.title}</h2><p>{item.detail}</p></div>
            <span className="admin-status admin-status--review">{item.status}</span>
            {item.href && <Link href={item.href} aria-label={`Open ${item.title}`}><ArrowRight size={17} /></Link>}
          </article>
        ))}
        {!filteredItems.length && <div className="admin-queue-empty"><Search size={22} /><strong>No matching work</strong><span>Change the query or clear the active status filter.</span></div>}
      </div>
      <div className="admin-queue-footer"><span>Showing {filteredItems.length} of {items.length} preview records</span><p>Production lists will be server-paginated, URL-filtered, and scoped by the API.</p></div>
    </section>
  );
}
