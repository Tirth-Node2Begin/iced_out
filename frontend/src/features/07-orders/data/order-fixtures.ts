/**
 * The SHAPE of an order as the customer's screens read it.
 *
 * The two hand-written orders that used to sit below these types are gone: the
 * archive, the order screen and the account rail all read `GET /me/orders`, so a
 * new account has none and two people on one machine never see each other's
 * purchases. What is left is the type the API's payload is checked against.
 */
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
