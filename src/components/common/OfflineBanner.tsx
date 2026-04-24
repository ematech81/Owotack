import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUIStore } from "../../store/uiStore";

export const OfflineBanner: React.FC = () => {
  const { isOnline } = useUIStore();
  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
      <Text style={styles.text}>You dey offline — data go sync when internet come back</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#805AD5",
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  text: { color: "#fff", fontSize: 12, flex: 1 },
});
