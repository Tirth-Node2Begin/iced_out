export type ReturnFixture = {
  id: string;
  order: string;
  item: string;
  variant: string;
  outcome: string;
  amount: string;
  destination: string;
  status: "Pickup scheduled" | "Refund complete";
  reference: string;
};

export const returnFixtures: ReturnFixture[] = [
  { id: "ret-072", order: "IO-2026-1027", item: "Bone Utility Overshirt", variant: "Bone / L", outcome: "Refund", amount: "₹11,400", destination: "Visa ending 1182", status: "Pickup scheduled", reference: "ref_••••072" },
  { id: "ret-061", order: "IO-2026-0994", item: "Core Heavy Tee", variant: "Ink / S", outcome: "Refund", amount: "₹4,600", destination: "UPI ending 42", status: "Refund complete", reference: "ref_••••061" },
];
