import React from "react";
import { Text, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";

interface Props {
  used: number;
  limit: number; // -1 = unlimited — renders nothing
  label: string; // e.g. "sales entries"
  period?: "month" | "day" | "none";
}

export function RemainingUsageNote({ used, limit, label, period = "month" }: Props) {
  const colors = useTheme();
  if (limit === -1) return null;

  const remaining = Math.max(0, limit - used);
  const periodSuffix = period === "day" ? " today" : period === "month" ? " this month" : "";

  return (
    <Text style={[styles.text, { color: colors.danger }]}>
      {remaining > 0
        ? `You have ${remaining} ${label} left${periodSuffix}`
        : `You've used all your ${label}${periodSuffix}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    marginBottom: 4,
  },
});
