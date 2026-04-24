export const formatNaira = (amount: number): string => {
  const abs = Math.round(Math.abs(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return amount < 0 ? `-₦${formatted}` : `₦${formatted}`;
};

export const parseCurrency = (str: string): number => {
  const clean = str.replace(/[₦,\s]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};

export const formatNairaCompact = (amount: number): string => {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(0)}k`;
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
