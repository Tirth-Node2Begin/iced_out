"use client";

import { useEffect, useRef, useState } from "react";

import { Section, Status } from "@/components/admin/admin-ui";
import {
  ageLabel,
  backlog,
  eventAt,
  FEED_LIMIT,
  type LogEntry,
} from "@/features/15-dashboard/data/activity-log";

/**
 * The activity log, live.
 *
 * It replaced two hand-written notice banners. A banner tells you what was
 * true when the page loaded; this tells you the console is still running, and
 * that is the thing an operator glances down here to find out.
 *
 * There is no pause control and there should not be one. This is the one block
 * on the screen whose whole job is to keep moving — a button that stops it is
 * a button that makes it lie, and an operator who wants a still picture has
 * the register the line came from.
 *
 * Three decisions worth keeping:
 *
 *   1. ONE interval. The clock and the new line are minted in the same
 *      callback off two refs, rather than a timer effect plus a second effect
 *      watching it — that second effect is a synchronous setState in an effect
 *      body, which is both a cascading render and a lint error in this repo.
 *   2. It idles when the tab is hidden. Not a pause an operator can reach:
 *      nobody is reading it, and a background tab would otherwise mint a line
 *      every fifteen seconds forever, all but eight of which are thrown away
 *      on the next render. It picks straight back up on return.
 *   3. Age is counted from the feed's own clock, never from `Date`. See the
 *      note on the data module.
 */

/** How often the clock moves, and how many of those before a new line lands. */
const TICK_SECONDS = 5;
const TICKS_PER_EVENT = 3;

const BACKLOG = backlog();

export function ActivityFeed() {
  const [entries, setEntries] = useState<LogEntry[]>(BACKLOG);
  const [clock, setClock] = useState(0);
  const [watching, setWatching] = useState(true);

  /* Counters, not state: nothing renders them, and holding them in refs is
     what keeps the interval free of a stale closure over its own tick. */
  const ticks = useRef(0);
  const minted = useRef(BACKLOG.length);

  useEffect(() => {
    const onVisibility = () => setWatching(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!watching) return;

    const timer = setInterval(() => {
      ticks.current += 1;
      const seconds = ticks.current * TICK_SECONDS;
      setClock(seconds);

      if (ticks.current % TICKS_PER_EVENT === 0) {
        const entry = eventAt(minted.current, seconds, 0);
        minted.current += 1;
        setEntries((prev) => [entry, ...prev].slice(0, FEED_LIMIT));
      }
    }, TICK_SECONDS * 1_000);

    return () => clearInterval(timer);
  }, [watching]);

  return (
    <Section
      copy="Everything the console has done, newest first. New lines arrive as the work happens — the eight most recent stay on the wall."
      eyebrow="Activity"
      title="Live log"
    >
      <div className="aui-tablewrap">
        <table className="aui-log aui-table">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Event</th>
              <th data-hide="sm" scope="col">
                Actor
              </th>
              <th scope="col">State</th>
              <th data-align="right" scope="col">
                When
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr data-fresh={entry.born === clock && clock > 0 ? "true" : undefined} key={entry.id}>
                <td>{entry.source}</td>
                <td>
                  <span className="aui-table__primary">
                    <strong>{entry.title}</strong>
                    <small>
                      <code>{entry.action}</code> · {entry.detail}
                    </small>
                  </span>
                </td>
                <td data-hide="sm">{entry.actor}</td>
                <td>
                  <Status tone={entry.tone} value={entry.state} />
                </td>
                <td className="aui-table__num" data-align="right">
                  {ageLabel(entry.offset + clock - entry.born)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
