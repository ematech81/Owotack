import React from "react";
import { useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";

interface AppStatusBarProps {
  /** Override the auto-detected style */
  style?: "light" | "dark" | "auto";
}

export const AppStatusBar: React.FC<AppStatusBarProps> = ({ style }) => {
  const scheme = useColorScheme();
  const resolvedStyle = style ?? (scheme === "dark" ? "light" : "dark");
  return <StatusBar style={resolvedStyle} />;
};
