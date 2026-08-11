export const paymentTransactions = [
  { id: "pay_ICE1048", order: "IO-2026-1048", customer: "A•••• K••••", gateway: "Razorpay", method: "UPI ••••42", amount: "₹11,400", status: "Captured", created: "04 Aug, 14:32" },
  { id: "pay_ICE1047", order: "IO-2026-1047", customer: "R•••• S••••", gateway: "Stripe", method: "Visa •••• 1842", amount: "₹8,900", status: "Review", created: "04 Aug, 14:18" },
  { id: "pay_ICE1046", order: "IO-2026-1046", customer: "M•••• P••••", gateway: "Razorpay", method: "Netbanking", amount: "₹18,700", status: "Failed", created: "04 Aug, 13:51" },
];

export const paymentRefunds = [
  { id: "ref_ICE072", payment: "pay_ICE1034", order: "IO-2026-1034", amount: "₹4,600", reason: "Approved return", status: "Processing" },
  { id: "ref_ICE071", payment: "pay_ICE1028", order: "IO-2026-1028", amount: "₹8,900", reason: "Customer cancellation", status: "Succeeded" },
];

export const reconciliationCases = [
  { id: "rec_ICE019", payment: "pay_ICE1047", expected: "₹8,900", received: "₹8,840", issue: "Amount mismatch", age: "14 min" },
  { id: "rec_ICE018", payment: "pay_ICE1038", expected: "Captured", received: "Webhook missing", issue: "Gateway state drift", age: "42 min" },
];

export const settlements = [
  { id: "set_ICE084", gateway: "Razorpay", period: "03–04 Aug 2026", gross: "₹2,84,600", fees: "₹5,692", net: "₹2,78,908", status: "Matched" },
  { id: "set_ICE083", gateway: "Stripe", period: "02–03 Aug 2026", gross: "₹94,200", fees: "₹2,166", net: "₹92,034", status: "Review" },
];
