export type PlanName = "free" | "pro" | "enterprise";

export const PLAN_LIMITS: Record<PlanName, { rpm: number; rpd: number }> = {
  free:       { rpm: 60,   rpd: 5000 },
  pro:        { rpm: 300,  rpd: 20000 },
  enterprise: { rpm: 2000, rpd: 200000 },
};
