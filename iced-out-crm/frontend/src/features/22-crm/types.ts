/**
 * The CRM payloads, exactly as `Iced\Presenter\CrmPresenter` renders them.
 *
 * Every date is a STRING already formatted en-IN in Asia/Kolkata, and every
 * money field is a string with its rupee sign and Indian grouping on it. The
 * browser renders what it is given and never reformats — the one exception is
 * `Deal.amountRaw`, which exists solely so a column total can be summed without
 * parsing "₹1,84,000" back into a number.
 */

export type Owner = { id: string; name: string };

export type Ref = { id: string; name: string };

export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "UNQUALIFIED" | "CONVERTED";

export type Source =
  | "WEBSITE"
  | "INSTAGRAM"
  | "REFERRAL"
  | "WALK_IN"
  | "CAMPAIGN"
  | "SUPPORT"
  | "IMPORT"
  | "OTHER";

export type Lifecycle = "SUBSCRIBER" | "LEAD" | "QUALIFIED" | "CUSTOMER" | "CHURNED";

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: Source;
  status: LeadStatus;
  score: number;
  message: string;
  owner: Owner | null;
  lostReason: string;
  convertedContactId: string | null;
  convertedDealId: string | null;
  convertedAt: string | null;
  lastActivityAt: string | null;
  createdAt: string | null;
  /** "2 d 6 h" — how long this has been sitting there. */
  age: string;
};

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  lifecycle: Lifecycle;
  source: Source;
  city: string;
  state: string;
  country: string;
  company: Ref | null;
  /** The storefront account, when this person has one. Null is a fact, not a gap. */
  customerId: string | null;
  owner: Owner | null;
  ordersCount: number;
  ordersTotal: string;
  openDeals: number;
  lastActivityAt: string | null;
  createdAt: string | null;
};

export type Company = {
  id: string;
  name: string;
  domain: string;
  industry: string;
  sizeBand: string;
  email: string;
  phone: string;
  website: string;
  city: string;
  state: string;
  country: string;
  status: "ACTIVE" | "ARCHIVED";
  owner: Owner | null;
  contactsCount: number;
  openDeals: number;
  wonValue: string;
  createdAt: string | null;
};

export type StageKind = "OPEN" | "WON" | "LOST";

export type Stage = {
  id: string;
  slug: string;
  name: string;
  kind: StageKind;
  probability: number;
  position: number;
};

export type Pipeline = { id: string; slug: string; name: string; isDefault: boolean };

export type Deal = {
  id: string;
  title: string;
  pipeline: string;
  stage: { id: string; slug: string; name: string; kind: StageKind };
  status: StageKind;
  amount: string;
  /** The same figure as a number, for summing a column. */
  amountRaw: number;
  currency: string;
  probability: number;
  source: Source;
  contact: Ref | null;
  company: Ref | null;
  orderNumber: string | null;
  owner: Owner | null;
  openTasks: number;
  expectedCloseOn: string | null;
  closedAt: string | null;
  lostReason: string;
  lastActivityAt: string | null;
  createdAt: string | null;
  position: number;
};

export type BoardColumn = {
  stage: Stage;
  deals: Deal[];
  count: number;
  value: string;
};

export type BoardSummary = {
  total: number;
  openCount: number;
  openValue: string;
  weightedValue: string;
  wonCount: number;
  wonValue: string;
  lostCount: number;
  lostValue: string;
  /** Null when nothing has settled yet — 0% and "no data" mean opposite things. */
  winRate: number | null;
};

export type Board = {
  pipeline: Pipeline;
  pipelines: Pipeline[];
  columns: BoardColumn[];
  summary: BoardSummary;
};

export type ActivityType = "TASK" | "CALL" | "MEETING" | "EMAIL" | "WHATSAPP";

export type SubjectType = "lead" | "contact" | "company" | "deal" | "order";

export type Activity = {
  id: string;
  type: ActivityType;
  subject: string;
  body: string;
  about: { type: SubjectType; id: number };
  priority: "LOW" | "NORMAL" | "HIGH";
  dueAt: string | null;
  dueDate: string | null;
  completedAt: string | null;
  done: boolean;
  /** Only an OPEN task can be overdue — see CrmPresenter::activity. */
  overdue: boolean;
  outcome: string;
  owner: Owner | null;
  author: string;
  createdAt: string | null;
};

export type Note = {
  id: string;
  body: string;
  pinned: boolean;
  author: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CrmOrder = {
  id: string;
  number: string;
  status: string;
  state: string;
  total: string;
  placedAt: string;
};

export type TaskCounts = { overdue: number; today: number; open: number };

export type CrmSummary = {
  leads: { new: number; contacted: number; qualified: number; converted: number; open: number };
  contacts: Partial<Record<Lifecycle, number>>;
  pipeline: {
    openCount: number;
    openValue: string;
    weightedValue: string;
    wonValue: string;
    winRate: number | null;
  };
  tasks: TaskCounts;
  mine: TaskCounts;
  today: Activity[];
  recentLeads: Lead[];
};

export type StaffOwner = { id: string; name: string; email: string; role: string };

/** The labels the UI shows for the wire's SCREAMING_CASE values. */
export const SOURCE_LABELS: Record<Source, string> = {
  WEBSITE: "Website",
  INSTAGRAM: "Instagram",
  REFERRAL: "Referral",
  WALK_IN: "Walk-in",
  CAMPAIGN: "Campaign",
  SUPPORT: "Support",
  IMPORT: "Import",
  OTHER: "Other",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  UNQUALIFIED: "Unqualified",
  CONVERTED: "Converted",
};

export const LIFECYCLE_LABELS: Record<Lifecycle, string> = {
  SUBSCRIBER: "Subscriber",
  LEAD: "Lead",
  QUALIFIED: "Qualified",
  CUSTOMER: "Customer",
  CHURNED: "Churned",
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  TASK: "Task",
  CALL: "Call",
  MEETING: "Meeting",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
};

/**
 * Which glyph tone a status carries. Colour lands on the GLYPH, never on a fill
 * — so this maps to the `data-tone` the console's status chip already reads.
 */
export const LEAD_TONES: Record<LeadStatus, string> = {
  NEW: "sky",
  CONTACTED: "amber",
  QUALIFIED: "violet",
  UNQUALIFIED: "muted",
  CONVERTED: "mint",
};

export const LIFECYCLE_TONES: Record<Lifecycle, string> = {
  SUBSCRIBER: "muted",
  LEAD: "sky",
  QUALIFIED: "violet",
  CUSTOMER: "mint",
  CHURNED: "rose",
};
