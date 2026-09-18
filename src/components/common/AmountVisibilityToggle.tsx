import React from "react";
import { TouchableOpacity, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUIStore } from "../../store/uiStore";

interface Props {
  color: string;
  backgroundColor: string;
  style?: ViewStyle;
  size?: number;
}

/**
 * Global privacy toggle — hides/shows every naira figure in the app (formatNaira
 * / formatNairaCompact read this same store flag), so a trader can hide their
 * numbers from onlookers without navigating away from whatever screen they're on.
 */
export function AmountVisibilityToggle({ color, backgroundColor, style, size = 18 }: Props) {
  const { amountsHidden, toggleAmountsHidden } = useUIStore();

  return (
    <TouchableOpacity
      onPress={toggleAmountsHidden}
      style={[styles.btn, { backgroundColor }, style]}
      activeOpacity={0.75}
      accessibilityLabel={amountsHidden ? "Show figures" : "Hide figures"}
    >
      <Ionicons name={amountsHidden ? "eye-off-outline" : "eye-outline"} size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
});
