import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDraftAge } from "../../utils/draft";

interface Props {
  savedAt: string;
  onDiscard: () => void;
}

export function DraftBanner({ savedAt, onDiscard }: Props) {
  return (
    <View style={s.banner}>
      <Ionicons name="document-text-outline" size={15} color="#92400E" />
      <Text style={s.text}>Draft saved · {formatDraftAge(savedAt)}</Text>
      <TouchableOpacity onPress={onDiscard} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={s.discard}>Discard</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  text: { flex: 1, fontSize: 13, color: "#92400E", fontWeight: "500" },
  discard: { fontSize: 12, color: "#DC2626", fontWeight: "600" },
});
