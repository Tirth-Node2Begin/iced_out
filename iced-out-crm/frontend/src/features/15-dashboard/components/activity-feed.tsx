"use client";

import { Section, Status } from "@/components/shell/admin-ui";
import type { StatusTone } from "@/components/shell/admin-ui";
import { useActivity } from "@/features/15-dashboard/dashboard-api";

/**
 * The activity log — what the console has actually been doing.
 *
 * It used to MINT a line every fifteen seconds from a generator seeded off a
 * counter. That is worth naming precisely, because it looked like the most alive
 * thing on the screen and was the least: an idle console with nobody signed in
 * produced a steady stream of "order confirmed" and "refund approved" lines for
 * work that had never happened. It read `/dev/urandom` and called it operations.
 *
 * It now reads `/admin/dashboard/activity` and re-reads it on an interval. On a
 * quiet store the list is short and stays short, which is the correct picture of
 * a quiet store.
 *
 * Two of the original three decisions survive, for their original reasons:
 *
 *   1. It idles when the tab is hidden — nobody is reading it, and a background
 *      tab would otherwise poll forever. It picks straight back up on return.
 *      (That now lives in `useActivity`.)
 *   2. There is no pause control and there should not be one. This is the one
 *      block whose job is to keep up to date; a button that freezes it is a
 *      button that makes it lie.
 *
 * The third — a hand-rolled clock counting seconds so ages could tick without
 * reading `Date` — is gone with the generator that needed it. An age is now
 * computed from the timestamp the server sent, which is the thing it was always
 * meant to describe.
 */

/** How many lines stay on the wall. The endpoint returns at most this many. */
const FEED_LIMIT = 8;

/** A duration, in the shortest words that are true. */
function ageLabel(seconds: number): string {
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** The tone strings the presenter sends, narrowed to what `Status` accepts. */
const TONES = new Set<StatusTone>(["good", "warn", "bad", "info", "idle", "neutral"]);

function toneOf(value: string): StatusTone | undefined {
  return TONES.has(value as StatusTone) ? (value as StatusTone) : undefined;
}

export function ActivityFeed() {
  const { entries, loading, error, loaded } = useActivity();
  const shown = entries.slice(0, FEED_LIMIT);

  return (
    <Section
      copy="Everything the console has done, newest first. The list refreshes itself — the eight most recent stay on the wall."
      eyebrow="Activity"
      title="Live log"
    >
      {/* Three nothings, told apart. An empty table under "Live log" reads as a
          broken screen; on a store nobody has used yet it is just the truth. */}
      {shown.length === 0 ? (
        <p className="aui-tablefoot" role="status">
          <span>
            {error
              ? error
              : loading && !loaded
                ? "Reading the log…"
                : "Nothing has happened yet. Console activity appears here as work is done."}
          </span>
        </p>
      ) : (
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
              {shown.map((entry) => (
                <tr key={entry.id}>
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
                    <Status tone={toneOf(entry.tone)} value={entry.state} />
                  </td>
                  <td className="aui-table__num" data-align="right">
                    {ageLabel(entry.offset)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
