export type PlanId = "free" | "growth" | "pro" | "business";

export interface PlanLimits {
  salesPerMonth: number;
  expensesPerMonth: number;
  activeCredits: number;
  stockItems: number;
  aiChatsPerDay: number;
  voicePerMonth: number;
  whatsappReminders: number;
  reportsAccess: "today" | "weekly" | "full";
  canExport: boolean;
}

export interface PlanConfig {
  id: PlanId;
  name: string;
  priceNaira: number;
  limits: PlanLimits;
  badge?: string;
  color: string;
  highlight: boolean;
}

export const PLANS: PlanConfig[] = [
  {
    id: "free",
    name: "Starter",
    priceNaira: 0,
    color: "#64748B",
    highlight: false,
    limits: {
      salesPerMonth: 50,
      expensesPerMonth: 30,
      activeCredits: 5,
      stockItems: 20,
      aiChatsPerDay: 0,
      voicePerMonth: 0,
      whatsappReminders: 0,
      reportsAccess: "today",
      canExport: false,
    },
  },
  {
    id: "growth",
    name: "Growth",
    priceNaira: 2500,
    color: "#16A34A",
    highlight: true,
    badge: "Popular",
    limits: {
      salesPerMonth: 300,
      expensesPerMonth: 150,
      activeCredits: 30,
      stockItems: 100,
      aiChatsPerDay: 10,
      voicePerMonth: 20,
      whatsappReminders: 30,
      reportsAccess: "weekly",
      canExport: false,
    },
  },
  {
    id: "pro",
    name: "Pro",
    priceNaira: 5000,
    color: "#7C3AED",
    highlight: false,
    limits: {
      salesPerMonth: -1,
      expensesPerMonth: -1,
      activeCredits: -1,
      stockItems: -1,
      aiChatsPerDay: -1,
      voicePerMonth: 60,
      whatsappReminders: -1,
      reportsAccess: "full",
      canExport: false,
    },
  },
  {
    id: "business",
    name: "Business",
    priceNaira: 10000,
    color: "#B45309",
    highlight: false,
    limits: {
      salesPerMonth: -1,
      expensesPerMonth: -1,
      activeCredits: -1,
      stockItems: -1,
      aiChatsPerDay: -1,
      voicePerMonth: -1,
      whatsappReminders: -1,
      reportsAccess: "full",
      canExport: true,
    },
  },
];

export function isUnlimited(val: number): boolean {
  return val === -1;
}

export function formatLimit(val: number, unit = ""): string {
  if (val === -1) return "Unlimited";
  return `${val}${unit ? " " + unit : ""}`;
}

export function getPlanById(id: PlanId): PlanConfig {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
