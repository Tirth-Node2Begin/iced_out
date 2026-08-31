/**
 * The raw-material payloads, exactly as `Iced\Presenter\MaterialPresenter`
 * renders them.
 *
 * QUANTITIES ARE STRINGS. They are DECIMAL(12,3) in the database, and a float
 * round-trip turns 2.4 into 2.3999999999999996 — which after four hundred
 * hoodies is a metre of fleece the ledger cannot account for. The presenter
 * sends them as trimmed numeric strings ("2.4", never "2.400") and the UI
 * renders them as given.
 *
 * The unit is a separate field rather than joined onto the number, because it
 * differs per material and a column of "2.4 m" cannot be aligned on the decimal
 * point the way a column of "2.4" can.
 */

export type Ref = { id: string; name: string };

export type MaterialKind = "FABRIC" | "TRIM" | "HARDWARE" | "LABEL" | "PACKAGING" | "OTHER";

export type MaterialUnit = "M" | "CM" | "PC" | "KG" | "G" | "L" | "ROLL" | "SET";

/** Derived by the server — see MaterialPresenter::material. */
export type MaterialState = "Healthy" | "At risk" | "Out";

export type Material = {
  id: string;
  code: string;
  name: string;
  kind: MaterialKind;
  unit: MaterialUnit;
  onHand: string;
  /** Committed to a run that has started but not finished. */
  reserved: string;
  /** on_hand − reserved. Never written, always derived. */
  available: string;
  reorderPoint: string;
  unitCost: string;
  unitCostRaw: number;
  stockValue: string;
  supplier: Ref | null;
  leadTimeDays: number;
  warehouse: Ref | null;
  status: "ACTIVE" | "ARCHIVED";
  notes: string;
  /** How many recipes call for it — what makes deleting one dangerous. */
  usedIn: number;
  state: MaterialState;
};

export type MaterialSummary = {
  total: number;
  atRisk: number;
  outOfStock: number;
  stockValue: string;
};

export type Movement = {
  type:
    | "RECEIPT"
    | "CONSUME"
    | "RESERVE"
    | "RELEASE"
    | "ADJUST_UP"
    | "ADJUST_DOWN"
    | "WASTAGE"
    | "RETURN_OUT";
  qty: string;
  onHandAfter: string;
  reservedAfter: string;
  reference: string;
  note: string;
  actor: string;
  at: string | null;
};

export type Supplier = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  leadTimeDays: number;
  leadTime: string;
  status: string;
  statusCode: "ACTIVE" | "ARCHIVED";
  notes: string;
  materialsCount: number;
  openPurchases: number;
};

export type PurchaseStatus = "DRAFT" | "ORDERED" | "PARTIAL" | "RECEIVED" | "CANCELLED";

export type Purchase = {
  id: string;
  supplier: Ref | null;
  status: PurchaseStatus;
  orderedOn: string | null;
  expectedOn: string | null;
  receivedOn: string | null;
  currency: string;
  notes: string;
  owner: Ref | null;
  lineCount: number;
  totalCost: string;
  qtyOrdered: string;
  qtyReceived: string;
  createdAt: string | null;
};

export type PurchaseLine = {
  materialId: string;
  material: string;
  code: string;
  unit: MaterialUnit;
  ordered: string;
  received: string;
  /** Still owed. Never negative — an over-delivery is not a debt back. */
  outstanding: string;
  unitCost: string;
  unitCostRaw: number;
  lineTotal: string;
};

export type RecipeLine = {
  materialId: string;
  material: string;
  code: string;
  unit: MaterialUnit;
  perUnit: string;
  wastagePct: number;
  /** What one piece actually draws down, cutting loss included. */
  effective: string;
  available: string;
  unitCost: string;
  lineCost: string;
  note: string;
};

export type Recipe = {
  item: Ref;
  lines: RecipeLine[];
  /** What one finished piece costs in materials. */
  materialCost: string;
};

export type RunStatus = "PLANNED" | "STARTED" | "DONE" | "CANCELLED";

export type Run = {
  id: string;
  item: Ref;
  warehouse: Ref | null;
  qtyPlanned: number;
  qtyProduced: number;
  status: RunStatus;
  startedAt: string | null;
  completedAt: string | null;
  notes: string;
  owner: Ref | null;
  lineCount: number;
  createdAt: string | null;
};

export type RunLine = {
  materialId: string;
  material: string;
  unit: MaterialUnit;
  perUnit: string;
  wastagePct: number;
  required: string;
  reserved: string;
  consumed: string;
  available: string;
  /** Cannot be met right now. What the run already holds counts towards it. */
  short: boolean;
};

export type RunDetail = {
  run: Run;
  lines: RunLine[];
  /** Whether START would succeed, answered by the server rather than guessed. */
  canStart: boolean;
};

export type RunSummary = { total: number; planned: number; started: number; unitsMade: number };

export type MaterialOption = { id: string; name: string; unit: MaterialUnit; available: string };

/* --------------------------------------------------------------- the words */

export const KIND_LABELS: Record<MaterialKind, string> = {
  FABRIC: "Fabric",
  TRIM: "Trim",
  HARDWARE: "Hardware",
  LABEL: "Label",
  PACKAGING: "Packaging",
  OTHER: "Other",
};

/** The unit as it reads beside a number — "2.4 m", "6 pcs". */
export const UNIT_LABELS: Record<MaterialUnit, string> = {
  M: "m",
  CM: "cm",
  PC: "pcs",
  KG: "kg",
  G: "g",
  L: "L",
  ROLL: "rolls",
  SET: "sets",
};

export const PURCHASE_LABELS: Record<PurchaseStatus, string> = {
  DRAFT: "Draft",
  ORDERED: "Ordered",
  PARTIAL: "Part received",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export const RUN_LABELS: Record<RunStatus, string> = {
  PLANNED: "Planned",
  STARTED: "In production",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export const MOVEMENT_LABELS: Record<Movement["type"], string> = {
  RECEIPT: "Received",
  CONSUME: "Consumed",
  RESERVE: "Held for a run",
  RELEASE: "Hold released",
  ADJUST_UP: "Adjusted up",
  ADJUST_DOWN: "Adjusted down",
  WASTAGE: "Written off",
  RETURN_OUT: "Returned to supplier",
};

/** `2.4` + `M` → `"2.4 m"`. The one place a quantity meets its unit. */
export function withUnit(qty: string, unit: MaterialUnit): string {
  return `${qty} ${UNIT_LABELS[unit] ?? unit.toLowerCase()}`;
}
