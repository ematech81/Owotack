import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppColors } from "../../constants/colors";
import { getSavedCustomers } from "../../utils/customers";

interface Props {
  value: string;
  onChange: (name: string) => void;
  userId: string;
  placeholder?: string;
  inputStyle?: ViewStyle | object;
  containerStyle?: ViewStyle | object;
  colors: AppColors;
}

export function CustomerPickerInput({
  value, onChange, userId, placeholder, inputStyle, containerStyle, colors,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [allCustomers, setAllCustomers] = useState<string[]>([]);

  useEffect(() => {
    getSavedCustomers(userId).then(setAllCustomers);
  }, [userId]);

  const suggestions = focused && value.trim().length >= 1
    ? allCustomers.filter((n) => n.toLowerCase().includes(value.toLowerCase())).slice(0, 6)
    : [];

  return (
    <View style={[{ zIndex: 30 }, containerStyle]}>
      <View style={[
        s.inputWrap,
        { backgroundColor: colors.surface, borderColor: colors.border },
        inputStyle as ViewStyle,
      ]}>
        <Ionicons name="person-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={[s.input, { color: colors.textPrimary }]}
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder ?? "Customer name (optional)"}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {suggestions.length > 0 && (
        <View style={[s.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {suggestions.map((name, idx) => (
            <TouchableOpacity
              key={name}
              style={[
                s.row,
                { borderBottomColor: idx < suggestions.length - 1 ? colors.border : "transparent" },
              ]}
              onPress={() => { onChange(name); setFocused(false); }}
            >
              <Ionicons name="person" size={13} color={colors.textMuted} style={{ marginRight: 8 }} />
              <Text style={[s.rowName, { color: colors.textPrimary }]}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: 10, height: 48, paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 15 },
  dropdown: {
    borderWidth: 1, borderRadius: 10, marginTop: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 8,
  },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1,
  },
  rowName: { fontSize: 14, fontWeight: "600" },
});
