export type OrderLineFixture = {
  id: string;
  name: string;
  variant: string;
  quantity: number;
  price: string;
  returnEligible: boolean;
};

/**
 * What has happened to the money.
 *
 * "Failed" is a state an order can be IN, not a reason to refuse to write one:
 * a gateway that declines or a shopper who closes the frame still leaves an
 * order that was attempted, and the alternative — throwing the whole basket
 * away on a bounced card — is how a shopper loses a bag they spent an evening
 * filling. The order is recorded, the payment is marked for what it is, and
 * the order screen offers the attempt again.
 */
export type OrderPaymentStatus = "Captured" | "Due on delivery" | "Failed";

/** `Payment failed` is a placed order awaiting money, never a dispatched one. */
export type OrderStatus = "Processing" | "Delivered" | "Payment failed";

export type OrderFixture = {
  id: string;
  number: string;
  date: string;
  total: string;
  status: OrderStatus;
  items: string;
  lines: OrderLineFixture[];
  payment: {
    method: string;
    status: OrderPaymentStatus;
    reference: string;
    /** What the gateway said, when it said anything. Shown, never parsed. */
    note?: string;
  };
  shipment: { token: string; service: string; awb: string; destination: string; estimate: string };
  cancellationEligible: boolean;
};

export const orderFixtures: OrderFixture[] = [
  {
    id: "ord-1048",
    number: "IO-2026-1048",
    date: "04 Aug 2026",
    total: "₹17,800",
    status: "Processing",
    items: "Afterdark Hoodie · Core Heavy Tee",
    lines: [
      { id: "line-1048-1", name: "Afterdark Hoodie", variant: "Washed black / M", quantity: 1, price: "₹8,900", returnEligible: false },
      { id: "line-1048-2", name: "Core Heavy Tee", variant: "Ink / M", quantity: 1, price: "₹4,600", returnEligible: false },
    ],
    payment: { method: "UPI ending 42", status: "Captured", reference: "pay_••••1048" },
    shipment: { token: "track-1048-demo", service: "Standard delivery", awb: "AWB ••••1048", destination: "Bengaluru, Karnataka", estimate: "08–09 Aug" },
    cancellationEligible: true,
  },
  {
    id: "ord-1027",
    number: "IO-2026-1027",
    date: "18 Jul 2026",
    total: "₹11,400",
    status: "Delivered",
    items: "Bone Utility Overshirt",
    lines: [{ id: "line-1027-1", name: "Bone Utility Overshirt", variant: "Bone / L", quantity: 1, price: "₹11,400", returnEligible: true }],
    payment: { method: "Visa ending 1182", status: "Captured", reference: "pay_••••1027" },
    shipment: { token: "track-1027-demo", service: "Express delivery", awb: "AWB ••••1027", destination: "New Delhi, Delhi", estimate: "Delivered 18 Jul" },
    cancellationEligible: false,
  },
];

export function findOrder(orderId: string) {
  return orderFixtures.find((order) => order.id === orderId || order.number === orderId);
}
