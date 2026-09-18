import { useUIStore } from "../store/uiStore";

// Masked placeholder shown everywhere a naira figure would normally render,
// when the user has privacy mode (the "hide amounts" toggle) turned on.
const MASKED = "₦*******";

export const formatNaira = (amount: number): string => {
  if (useUIStore.getState().amountsHidden) return MASKED;
  const abs = Math.round(Math.abs(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return amount < 0 ? `-₦${formatted}` : `₦${formatted}`;
};

export const parseCurrency = (str: string): number => {
  const clean = str.replace(/[₦,\s]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};

// Trims a decimal to at most 1 place, dropping a trailing ".0" (1.0 -> "1", 1.8 -> "1.8").
const trimDecimal = (n: number): string => {
  const rounded = Math.round(n * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
};

// Full comma-separated figures under 1 million (500,000 / 999,000), compact
// "1m"/"1.8m"/"1.3b" notation at 1 million and above.
export const formatNairaCompact = (amount: number): string => {
  if (useUIStore.getState().amountsHidden) return MASKED;
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${sign}₦${trimDecimal(abs / 1_000_000_000)}b`;
  if (abs >= 1_000_000) return `${sign}₦${trimDecimal(abs / 1_000_000)}m`;
  return formatNaira(amount);
};

export const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
};

export const formatTime = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
};

export const formatPhoneDisplay = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};

export const getProfitColor = (margin: number): string => {
  if (margin >= 30) return "#38A169";
  if (margin >= 15) return "#D69E2E";
  return "#E53E3E";
};
