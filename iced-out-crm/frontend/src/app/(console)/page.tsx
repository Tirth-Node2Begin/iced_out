import { AdminDashboard } from "@/features/15-dashboard";
import { CrmOverview } from "@/features/22-crm/components/crm-overview";

/**
 * The landing screen — both halves of what this CRM is.
 *
 * `AdminDashboard` is the commerce half, unchanged from the console it came
 * from: what the store traded over a period you choose, what is waiting on a
 * person right now, and what the console has just been doing.
 *
 * `CrmOverview` is the half the console never had: where the conversations
 * stand and what is late.
 *
 * They are separate components rather than one screen because they answer
 * different SHAPES of question — a period against a position — and the date
 * filter at the top of the first must not appear to govern the second.
 */
export default function DashboardPage() {
  return (
    <>
      <AdminDashboard />
      <CrmOverview />
    </>
  );
}
