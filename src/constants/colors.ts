export const lightColors = {
  primary: "#1A6B3C",
  primaryLight: "#2A8B50",
  primaryDark: "#0F4A28",
  secondary: "#F5A623",
  secondaryLight: "#FFB84D",
  danger: "#E53E3E",
  dangerLight: "#FED7D7",
  success: "#38A169",
  successLight: "#C6F6D5",
  warning: "#D69E2E",
  warningLight: "#FEFCBF",
  background: "#F7F8FA",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  textPrimary: "#1A202C",
  textSecondary: "#718096",
  textMuted: "#A0AEC0",
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(0,0,0,0.5)",
  cardBg: "#FFFFFF",
  inputBg: "#FFFFFF",
} as const;

export const darkColors = {
  primary: "#2A8B50",
  primaryLight: "#38A169",
  primaryDark: "#1A6B3C",
  secondary: "#F5A623",
  secondaryLight: "#FFB84D",
  danger: "#FC5C5C",
  dangerLight: "#4A1515",
  success: "#48BB78",
  successLight: "#1A3A2A",
  warning: "#ECC94B",
  warningLight: "#3D3000",
  background: "#0F1117",
  surface: "#1A1D27",
  border: "#2D3148",
  textPrimary: "#F0F2F5",
  textSecondary: "#A0AEC0",
  textMuted: "#718096",
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(0,0,0,0.7)",
  cardBg: "#1A1D27",
  inputBg: "#12151E",
} as const;

// Legacy export so existing screens importing `colors` still work (light theme)
export const colors = lightColors;

export type AppColors = typeof lightColors;
