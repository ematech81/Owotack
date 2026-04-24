import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppStatusBar } from "../../src/components/common/AppStatusBar";
import { Input } from "../../src/components/common/Input";
import { Button } from "../../src/components/common/Button";
import { colors } from "../../src/constants/colors";
import { BUSINESS_TYPES, LANGUAGES } from "../../src/constants/categories";

const schema = z.object({
  name: z.string().min(2, "Enter your name"),
  businessName: z.string().optional(),
  businessType: z.string().min(1, "Select business type"),
  state: z.string().optional(),
  preferredLanguage: z.string().default("pidgin"),
  referralCode: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function ProfileSetupScreen() {
  const { phone, tempToken } = useLocalSearchParams<{ phone: string; tempToken: string }>();
  const [loading] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { preferredLanguage: "pidgin" },
  });

  const onSubmit = (data: FormData) => {
    router.push({
      pathname: "/(auth)/set-pin",
      params: {
        phone, tempToken,
        name: data.name,
        businessName: data.businessName || "",
        businessType: data.businessType,
        state: data.state || "",
        preferredLanguage: data.preferredLanguage,
        referralCode: data.referralCode || "",
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AppStatusBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Tell Us About You</Text>
          <Text style={styles.subtitle}>Help us personalize your experience</Text>

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <Input label="Your Name *" placeholder="e.g. Chioma Okafor" value={value}
                onChangeText={onChange} leftIcon="person-outline" error={errors.name?.message} />
            )}
          />

          <Controller
            control={control}
            name="businessName"
            render={({ field: { onChange, value } }) => (
              <Input label="Business Name (optional)" placeholder="e.g. Chioma Foods & Provisions"
                value={value} onChangeText={onChange} leftIcon="storefront-outline" />
            )}
          />

          <Text style={styles.fieldLabel}>Type of Business *</Text>
          <Controller
            control={control}
            name="businessType"
            render={({ field: { onChange, value } }) => (
              <View style={styles.chipGrid}>
                {BUSINESS_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[styles.chip, value === type.value && styles.chipActive]}
                    onPress={() => onChange(type.value)}
                  >
                    <Text style={[styles.chipText, value === type.value && styles.chipTextActive]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />
          {errors.businessType && <Text style={styles.error}>{errors.businessType.message}</Text>}

          <Text style={styles.fieldLabel}>Preferred Language</Text>
          <Controller
            control={control}
            name="preferredLanguage"
            render={({ field: { onChange, value } }) => (
              <View style={styles.chipRow}>
                {LANGUAGES.map((lang) => (
                  <TouchableOpacity
                    key={lang.value}
                    style={[styles.chip, value === lang.value && styles.chipActive]}
                    onPress={() => onChange(lang.value)}
                  >
                    <Text style={[styles.chipText, value === lang.value && styles.chipTextActive]}>
                      {lang.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />

          <Controller
            control={control}
            name="referralCode"
            render={({ field: { onChange, value } }) => (
              <Input label="Referral Code (optional)" placeholder="e.g. ABC12345" value={value}
                onChangeText={(v) => onChange(v.toUpperCase())} leftIcon="gift-outline" autoCapitalize="characters" />
            )}
          />

          <Button title="Continue" onPress={handleSubmit(onSubmit)} loading={loading} style={styles.btn} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 24, paddingTop: 24 },
  title: { fontSize: 26, fontWeight: "700", color: colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: 32 },
  fieldLabel: { fontSize: 14, fontWeight: "500", color: colors.textPrimary, marginBottom: 10 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: colors.white, fontWeight: "600" },
  error: { fontSize: 12, color: colors.danger, marginBottom: 12 },
  btn: { marginTop: 8, marginBottom: 40 },
});
