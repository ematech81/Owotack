import React, { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../src/components/common/Button";
import { Input } from "../../src/components/common/Input";
import { AppStatusBar } from "../../src/components/common/AppStatusBar";
import { authService } from "../../src/services/authService";
import { colors } from "../../src/constants/colors";

const schema = z.object({
  phone: z
    .string()
    .min(1, "Enter your phone number")
    .regex(/^(\+234|0)[789][01]\d{8}$/, "Enter a valid Nigerian phone number"),
});

type FormData = z.infer<typeof schema>;

export default function PhoneScreen() {
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ phone }: FormData) => {
    const normalized = phone.startsWith("0") ? `+234${phone.slice(1)}` : phone;
    setLoading(true);
    try {
      const result = await authService.sendOtp(normalized);
      if (result.devOtp) console.log(`[DEV OTP for ${normalized}]: ${result.devOtp}`);
      router.push({
        pathname: "/(auth)/otp",
        params: { phone: normalized, isNewUser: result.isNewUser ? "1" : "0", devOtp: result.devOtp ?? "" },
      });
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
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Enter Your Phone</Text>
            <Text style={styles.subtitle}>We go send OTP to verify your number</Text>
          </View>

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Phone Number"
                placeholder="0801 234 5678"
                value={value}
                onChangeText={onChange}
                keyboardType="phone-pad"
                leftIcon="call-outline"
                error={errors.phone?.message}
                maxLength={14}
              />
            )}
          />

          <Text style={styles.note}>
            We only dey send OTP — no wahala, no spam calls.
          </Text>

          <Button title="Send OTP" onPress={handleSubmit(onSubmit)} loading={loading} style={styles.btn} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 24, paddingTop: 40 },
  header: { marginBottom: 40 },
  title: { fontSize: 28, fontWeight: "700", color: colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
  note: { fontSize: 13, color: colors.textMuted, marginBottom: 32, lineHeight: 20 },
  btn: { marginTop: 8 },
});
