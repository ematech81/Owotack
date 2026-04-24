import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ViewStyle,
} from "react-native";
import { useStockStore } from "../../store/stockStore";
import { IStockItem } from "../../services/stockService";
import { formatNaira } from "../../utils/formatters";
import { AppColors } from "../../constants/colors";

interface Props {
  value: string;
  onChange: (name: string, stockItem?: IStockItem) => void;
  placeholder?: string;
  inputStyle?: ViewStyle | object;
  containerStyle?: ViewStyle | object;
  colors: AppColors;
}

export function ProductPickerInput({
  value, onChange, placeholder, inputStyle, containerStyle, colors,
}: Props) {
  const { items, loadItems } = useStockStore();
  const [focused, setFocused] = useState(false);

  // Load stock items on first mount if the store is empty (e.g. user hasn't
  // visited the Stock screen yet in this session).
  useEffect(() => {
    if (items.length === 0) {
      loadItems();
    }
  }, []);

  const suggestions = focused && value.trim().length >= 1
    ? items
        .filter(
          (i) =>
            i.name.toLowerCase().includes(value.toLowerCase()) ||
            i.category.toLowerCase().includes(value.toLowerCase()),
        )
        .slice(0, 5)
    : [];

  return (
    <View style={[{ zIndex: 20 }, containerStyle]}>
      <TextInput
        style={[
          pickerStyles.input,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
          inputStyle,
        ]}
        value={value}
        onChangeText={(v) => onChange(v)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder ?? "Product name"}
        placeholderTextColor={colors.textMuted}
      />

      {suggestions.length > 0 && (
        <View
          style={[
            pickerStyles.dropdown,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {suggestions.map((item, idx) => (
            <TouchableOpacity
              key={item._id}
              style={[
                pickerStyles.row,
                { borderBottomColor: idx < suggestions.length - 1 ? colors.border : "transparent" },
              ]}
              onPress={() => {
                onChange(item.name, item);
                setFocused(false);
              }}
            >
              <Text
                style={[pickerStyles.rowName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <View style={pickerStyles.rowRight}>
                <Text style={[pickerStyles.rowCat, { color: colors.textMuted }]}>
                  {item.category}
                </Text>
                {(item.sellingPrice > 0 || item.costPrice > 0) && (
                  <Text style={[pickerStyles.rowPrice, { color: colors.primary }]}>
                    {formatNaira(item.sellingPrice || item.costPrice)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}

          {/* "Add to stock" hint when 0 matches exist */}
          {suggestions.length === 0 && value.trim().length > 1 && (
            <View style={pickerStyles.noMatch}>
              <Text style={[pickerStyles.noMatchText, { color: colors.textMuted }]}>
                Not in stock — type to use as-is
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  input: {
    borderWidth: 1, borderRadius: 10,
    height: 48, paddingHorizontal: 14, fontSize: 15,
  },
  dropdown: {
    borderWidth: 1, borderRadius: 10, marginTop: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 8,
  },
  row: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1,
  },
  rowName: { fontSize: 14, fontWeight: "600", flex: 1, marginRight: 8 },
  rowRight: { alignItems: "flex-end" },
  rowCat: { fontSize: 11, marginBottom: 2 },
  rowPrice: { fontSize: 13, fontWeight: "700" },
  noMatch: { paddingHorizontal: 14, paddingVertical: 10 },
  noMatchText: { fontSize: 13, fontStyle: "italic" },
});
