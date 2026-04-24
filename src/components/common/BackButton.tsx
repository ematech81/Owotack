import React from "react";
import { TouchableOpacity, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "../../hooks/useTheme";

interface BackButtonProps {
  onPress?: () => void;
  style?: ViewStyle;
  color?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ onPress, style, color }) => {
  const colors = useTheme();
  const handlePress = onPress ?? (() => router.back());

  return (
    <TouchableOpacity style={[styles.btn, style]} onPress={handlePress} activeOpacity={0.7}>
      <Ionicons name="arrow-back-circle-outline" size={32} color={color ?? colors.textPrimary} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: { padding: 4, alignSelf: "flex-start" },
});
