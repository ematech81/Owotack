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
  tagline: string;
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
    tagline: "Try OwoTrack free — no card needed.",
    color: "#64748B",
    highlight: false,
    limits: {
      salesPerMonth: 10,
      expensesPerMonth: 10,
      activeCredits: 5,
      stockItems: 15,
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
    priceNaira: 3000,
    tagline: "AI chat, voice entry, and room to grow — perfect for active traders.",
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
    tagline: "Unlimited sales, expenses, and credits for serious business owners.",
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
    tagline: "Full power — unlimited everything, data export, and priority support.",
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
