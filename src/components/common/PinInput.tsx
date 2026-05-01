import React, { useRef, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard } from "react-native";
import { useTheme } from "../../hooks/useTheme";

interface PinInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export const PinInput: React.FC<PinInputProps> = ({
  length = 4,
  value,
  onChange,
  autoFocus = true,
}) => {
  const colors = useTheme();
  const inputRef = useRef<TextInput>(null);
  const keyboardVisible = useRef(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      keyboardVisible.current = true;
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardVisible.current = false;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // When keyboard was dismissed via back button the input stays internally
  // "focused", so focus() alone does nothing. Blur first to reset that state,
  // then focus again to force the keyboard to reopen.
  const handlePress = useCallback(() => {
    if (!keyboardVisible.current) {
      inputRef.current?.blur();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      inputRef.current?.focus();
    }
  }, []);

  const handleChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, length);
    onChange(cleaned);
  };

  const styles = makeStyles(colors);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handlePress}
      style={styles.row}
    >
      {Array.from({ length }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.box,
            value.length > i && styles.boxFilled,
            value.length === i && styles.boxActive,
          ]}
        >
          {value[i] ? <Text style={styles.dot}>●</Text> : null}
        </View>
      ))}

      {/* Single hidden input — no cursor/focus bugs */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        style={styles.hiddenInput}
        caretHidden
      />
    </TouchableOpacity>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 20,
      position: "relative",
    },
    box: {
      width: 60,
      height: 68,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    boxFilled: {
      borderColor: colors.primary,
      backgroundColor: "#F0FDF4",
    },
    boxActive: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    dot: {
      fontSize: 22,
      color: colors.textPrimary,
    },
    hiddenInput: {
      position: "absolute",
      width: 1,
      height: 1,
      opacity: 0,
    },
  });
