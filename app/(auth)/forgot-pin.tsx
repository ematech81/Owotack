import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { authService } from "../../src/services/authService";
import { Input } from "../../src/components/common/Input";
import { Button } from "../../src/components/common/Button";
import { BackButton } from "../../src/components/common/BackButton";
import { AppStatusBar } from "../../src/components/common/AppStatusBar";
import { colors } from "../../src/constants/colors";

export default function ForgotPinScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const normalized = phone.startsWith("0") ? `+234${phone.slice(1)}` : phone;
    if (!normalized.match(/^\+234[789][01]\d{8}$/)) {
      Alert.alert("", "Enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      await authService.forgotPin(normalized);
      Alert.alert("OTP Sent", "Check your phone for the reset OTP", [
        {
          text: "OK",
          onPress: () => router.push({
            pathname: "/(auth)/otp",
            params: { phone: normalized, isNewUser: "0", mode: "reset" },
          }),
        },
      ]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to send OTP";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AppStatusBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <BackButton style={{ marginBottom: 16 }} />
          <Text style={styles.title}>Reset Your PIN</Text>
          <Text style={styles.subtitle}>
            Enter your phone number — we go send OTP to reset your PIN
          </Text>
          <Input
            label="Phone Number"
            placeholder="0801 234 5678"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon="call-outline"
            maxLength={14}
          />
          <Button title="Send OTP" onPress={handleSend} loading={loading} style={styles.btn} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 24, paddingTop: 16 },
  title: { fontSize: 26, fontWeight: "700", color: colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: 40, lineHeight: 22 },
  btn: { marginTop: 8 },
});
