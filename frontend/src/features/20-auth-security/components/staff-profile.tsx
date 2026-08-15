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

import { StatGrid, type Stat } from "@/components/admin/admin-stats";
import {
  AdminPage,
  Btn,
  Card,
  DetailList,
  Modal,
  Note,
  Section,
  Status,
  SwitchRow,
} from "@/components/admin/admin-ui";
import { useAuth } from "@/features/20-auth-security/auth-context";

/**
 * The operator's own record.
 *
 * This is the screen the account menu in the topbar opens, and it replaced the
 * staff directory that used to live at `/admin/access/staff`. That screen
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

const ACTIVITY: Entry[] = [
  { id: "ACT-4412", when: "14:42", day: "Today", action: "Refund requested", resource: "IO-2026-1027", where: "Chrome · Bengaluru", result: "Done" },
  { id: "ACT-4411", when: "14:19", day: "Today", action: "Order confirmed", resource: "IO-2026-1031", where: "Chrome · Bengaluru", result: "Done" },
  { id: "ACT-4410", when: "13:58", day: "Today", action: "Stock adjusted", resource: "ADH-BLK-L · BLR-01", where: "Chrome · Bengaluru", result: "Done" },
  { id: "ACT-4409", when: "13:02", day: "Today", action: "Coupon paused", resource: "DROP001-EARLY", where: "Chrome · Bengaluru", result: "Done" },
  { id: "ACT-4408", when: "11:47", day: "Today", action: "Signed in", resource: "Operations console", where: "Chrome · Bengaluru", result: "Done" },
  { id: "ACT-4407", when: "18:20", day: "Yesterday", action: "Shipment dispatched", resource: "SHP-ICE-0912", where: "Chrome · Bengaluru", result: "Done" },
  { id: "ACT-4406", when: "17:54", day: "Yesterday", action: "Return approved", resource: "RMA-1039", where: "Chrome · Bengaluru", result: "Done" },
  { id: "ACT-4405", when: "17:11", day: "Yesterday", action: "Product published", resource: "Adhira Cuff · Black", where: "Chrome · Bengaluru", result: "Done" },
  { id: "ACT-4404", when: "16:32", day: "Yesterday", action: "Export requested", resource: "Settlements · Oct", where: "Chrome · Bengaluru", result: "Pending" },
  { id: "ACT-4403", when: "15:08", day: "Yesterday", action: "Password changed", resource: "Own account", where: "Chrome · Bengaluru", result: "Done" },
  { id: "ACT-4402", when: "09:41", day: "Yesterday", action: "Sign-in blocked", resource: "Operations console", where: "Safari · Unknown device", result: "Failed" },
  { id: "ACT-4401", when: "09:40", day: "Yesterday", action: "Sign-in blocked", resource: "Operations console", where: "Safari · Unknown device", result: "Failed" },
];

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
  const preview = ACTIVITY.slice(0, PREVIEW_COUNT);

  return (
    <AdminPage
      actions={
        <Btn
          onClick={() => {
            signOutStaff();
            router.push("/admin/login");
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
                { label: "Name", value: name },
                { label: "Role", value: role },
                { label: "Email", value: "aarav@iced-out.example" },
                { label: "Member since", value: "04 Feb 2026" },
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
              Showing <strong>{preview.length}</strong> of <strong>{ACTIVITY.length}</strong>{" "}
              recorded actions
            </span>
            <Btn onClick={() => setLogOpen(true)} size="sm">
              See more <FileClock aria-hidden size={14} strokeWidth={1.7} />
            </Btn>
          </p>
        </div>

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
        footNote={`${ACTIVITY.length} entries · last 48 hours`}
        footer={<Btn onClick={() => setLogOpen(false)}>Close</Btn>}
      >
        <div className="aui-tablewrap">
          <table className="aui-table">
            <Head />
            <tbody>
              {ACTIVITY.map((entry) => (
                <Row entry={entry} key={entry.id} />
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </AdminPage>
  );
}
