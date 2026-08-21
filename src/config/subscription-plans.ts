export const SUBSCRIPTION_PLANS = {
  BASIC: { label: "Basic", prices: { 6: 3500, 12: 4999 } },
  PRO: { label: "Pro", prices: { 6: 5999, 12: 7999 } },
  CUSTOM: { label: "Custom", prices: {} },
} as const;

export const PLAN_PRICE_LABELS = {
  BASIC: "₹3,500 / 6 months · ₹4,999 / 12 months",
  PRO: "₹5,999 / 6 months · ₹7,999 / 12 months",
  CUSTOM: "Custom pricing",
} as const;
