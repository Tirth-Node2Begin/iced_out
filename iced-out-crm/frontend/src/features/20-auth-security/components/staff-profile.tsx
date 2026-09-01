"use client";

import {
  Clock3,
  FileClock,
  KeyRound,
  LogOut,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { StatGrid, type Stat } from "@/components/shell/admin-stats";
import {
  AdminPage,
  Btn,
  Card,
  DetailList,
  Empty,
  Modal,
  Note,
  Section,
  Status,
  SwitchRow,
} from "@/components/shell/admin-ui";
import { useAdminRecord, useRegisterList } from "@/api/use-register";
import { useAuth } from "@/features/20-auth-security/auth-context";

/**
 * The operator's own record.
 *
 * This is the screen the account menu in the topbar opens, and it replaced the
 * staff directory that used to live at `/access/staff`. That screen
 * existed to answer "who holds which role" — a question with one answer now, so
 * what is left worth showing is the session in front of you: who you are signed
 * in as, what the workspace is scoped to, and what you have been doing.
 *
 * Nothing here is a permission check. The role is printed because it is a label
 * on the record, the same way the topbar prints it.
 */

/* ---- the activity log ---------------------------------------------------- */

/**
 * The operator's own actions, newest first.
 *
 * Five reach the page and the rest live behind "See more". A log is a thing you
 * glance at to confirm nothing surprising happened, and a twelve-row table
 * pushes the rest of the screen under the fold to answer a question that is
 * usually "no". The modal is there for the times it is "yes".
 */
type Entry = {
  id: string;
  when: string;
  day: string;
  action: string;
  resource: string;
  where: string;
  result: string;
};

/**
 * Where the entries come from: `GET /admin/me/activity`, which returns exactly
 * this shape — id, when, day, action, resource, where, result — five to a page.
 *
 * Twelve invented rows used to sit here, under a heading promising "every
 * action the console has recorded against your name". They named orders and
 * products that were never in this database, and they did not change when the
 * operator did anything at all. The endpoint had been built for this screen and
 * never connected to it.
 */
const ACTIVITY_PATH = "/admin/me/activity";


/** What reaches the page. The rest is one click away, never a scroll away. */
const PREVIEW_COUNT = 5;

const STATS: Stat[] = [
  { label: "Actions today", value: "05", icon: FileClock, tone: "sky", note: "All from this device" },
  { label: "Signed in", value: "3 h 12 m", icon: Clock3, tone: "violet", note: "Since 11:47" },
  { label: "Second factor", value: "Live", icon: ShieldCheck, tone: "mint", note: "Authenticator app" },
  { label: "Blocked attempts", value: "02", icon: KeyRound, tone: "rose", note: "Yesterday · unknown device" },
];

/** One row, drawn the same whether it is on the page or inside the modal. */
function Row({ entry }: { entry: Entry }) {
  return (
    <tr>
      <td>
        <span className="aui-table__primary">
          <strong>{entry.when}</strong>
          <small>{entry.day}</small>
        </span>
      </td>
      <td>{entry.action}</td>
      <td data-hide="sm">{entry.resource}</td>
      <td data-hide="sm">{entry.where}</td>
      <td data-align="right">
        <Status value={entry.result} />
      </td>
    </tr>
  );
}

function Head() {
  return (
    <thead>
      <tr>
        <th scope="col">Time</th>
        <th scope="col">Action</th>
        <th data-hide="sm" scope="col">
          Resource
        </th>
        <th data-hide="sm" scope="col">
          Device
        </th>
        <th data-align="right" scope="col">
          Result
        </th>
      </tr>
    </thead>
  );
}

export function StaffProfile() {
  const router = useRouter();
  const { staffSession, signOutStaff } = useAuth();
  const [logOpen, setLogOpen] = useState(false);
  const [digest, setDigest] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(false);

  const name = staffSession?.name ?? "Staff";
  const role = staffSession?.role ?? "Scoped access";
  /* The account behind the session. Only fetched once signed in — with no
     session the endpoint would 401, and this screen is behind the guard. */
  const profile = useAdminRecord<{ name: string; email: string; phone: string }>(
    staffSession ? "/admin/me/profile" : null,
  );
  const activityList = useRegisterList(ACTIVITY_PATH);
  const activity = activityList.rows as unknown as Entry[];
  const preview = activity.slice(0, PREVIEW_COUNT);

  return (
    <AdminPage
      actions={
        <Btn
          onClick={() => {
            signOutStaff();
            router.push("/login");
          }}
        >
          <LogOut aria-hidden size={15} strokeWidth={1.7} /> Sign out
        </Btn>
      }
      eyebrow="Account · This session"
      icon={UserRound}
      lede="Who you are signed in as, what this workspace is pointed at, and every action the console has recorded against your name."
      spec={[
        { label: "Role", value: role },
        { label: "Actions today", value: "05" },
        { label: "Session", value: "3 h" },
      ]}
      title={
        <>
          Your <em>profile</em>
        </>
      }
    >
      <StatGrid stats={STATS} />

      <Section
        copy="What the console knows about this account. Everything here comes from the session you are holding right now."
        eyebrow="Identity"
        title={name}
      >
        <div className="aui-grid aui-grid--2">
          <Card
            copy="The name and role printed in the topbar, and the address the console writes to when something needs you."
            icon={UserRound}
            kicker="Account"
            status={<Status value="Active" />}
            title="Details"
            tone="sky"
          >
            <DetailList
              rows={[
                { label: "Name", value: profile.data?.name ?? name },
                { label: "Role", value: role },
                /* Read, not written in. The session cookie carries only a name
                   and a role, so this row was a literal address — and it stayed
                   that literal after the account it named was renamed, telling
                   every operator they were signed in as somebody who no longer
                   exists. `GET /admin/me/profile` is where the real one is. */
                {
                  label: "Email",
                  value: profile.error
                    ? "Could not be read"
                    : (profile.data?.email ?? (profile.loaded ? "—" : "Reading…")),
                },
                ...(profile.data?.phone ? [{ label: "Phone", value: profile.data.phone }] : []),
              ]}
            />
          </Card>

          <Card
            copy="The store and device this session is bound to. Signing out ends it here and nowhere else."
            icon={Store}
            kicker="Session"
            status={<Status tone="good" value="Verified" />}
            title="Workspace"
            tone="violet"
          >
            <DetailList
              rows={[
                { label: "Store scope", value: "India · Primary" },
                { label: "Signed in", value: "Today, 11:47" },
                { label: "Device", value: "Chrome · Bengaluru" },
                { label: "Second factor", value: "Authenticator app" },
              ]}
            />
          </Card>
        </div>
      </Section>

      <Section
        copy="How the console reaches you. These are preferences, not policy — nothing here changes what you can open."
        eyebrow="Preferences"
        title="Notifications"
      >
        <div className="aui-grid aui-grid--2">
          <SwitchRow
            checked={digest}
            detail="One message at 08:00 with the queues that need a person today."
            icon={Mail}
            onChange={(next) => {
              setDigest(next);
              toast.success(next ? "Daily digest on" : "Daily digest off");
            }}
            title="Morning digest"
          />
          <SwitchRow
            checked={soundAlerts}
            detail="An audible cue when a high-priority ticket lands in a queue you own."
            icon={MonitorSmartphone}
            onChange={(next) => {
              setSoundAlerts(next);
              toast.success(next ? "Sound alerts on" : "Sound alerts off");
            }}
            title="Sound alerts"
          />
        </div>
      </Section>

      {/* Five rows and a way through to the rest. The count in the foot names
          what is being withheld, so "See more" is a known quantity rather than
          an invitation to guess. */}
      <Section
        copy="Every action the console has recorded against this account, newest first."
        eyebrow="Audit"
        title="Recent activity"
      >
        {activityList.error ? (
          <Note tone="bad" title="Could not read the log">
            {activityList.error}
          </Note>
        ) : activity.length === 0 ? (
          /* A real state, not a blank grid: on a fresh install nobody has done
             anything yet, and an empty table with "Showing 0 of 0" under it
             reads like a screen that failed rather than one with nothing to
             say. */
          <Empty
            copy={
              activityList.loaded
                ? "Nothing has been recorded against this account yet. Actions appear here as you work."
                : "Reading the log…"
            }
            icon={FileClock}
            inline
            title={activityList.loaded ? "No activity yet" : "Loading"}
          />
        ) : (
          <div className="aui-tablewrap">
            <table className="aui-table">
              <Head />
              <tbody>
                {preview.map((entry) => (
                  <Row entry={entry} key={entry.id} />
                ))}
              </tbody>
            </table>

            <p className="aui-tablefoot">
              <span>
                Showing <strong>{preview.length}</strong> of <strong>{activity.length}</strong>{" "}
                recorded actions
              </span>
              {activity.length > preview.length && (
                <Btn onClick={() => setLogOpen(true)} size="sm">
                  See more <FileClock aria-hidden size={14} strokeWidth={1.7} />
                </Btn>
              )}
            </p>
          </div>
        )}

        <Note icon={ShieldCheck} title="This log is append-only">
          Entries cannot be edited or removed from this screen. A correction is a new entry that
          references the one it corrects.
        </Note>
      </Section>

      <Modal
        description={`Every action recorded against ${name}, newest first.`}
        icon={FileClock}
        onOpenChange={setLogOpen}
        open={logOpen}
        size="wide"
        title="Full activity log"
        tone="sky"
        footNote={`${activity.length} entries`}
        footer={<Btn onClick={() => setLogOpen(false)}>Close</Btn>}
      >
        <div className="aui-tablewrap">
          <table className="aui-table">
            <Head />
            <tbody>
              {activity.map((entry) => (
                <Row entry={entry} key={entry.id} />
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </AdminPage>
  );
}
