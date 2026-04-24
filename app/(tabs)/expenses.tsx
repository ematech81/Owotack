import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/store/authStore";
import { useExpenseStore } from "../../src/store/expenseStore";
import { OfflineBanner } from "../../src/components/common/OfflineBanner";
import { AppStatusBar } from "../../src/components/common/AppStatusBar";
import { Button } from "../../src/components/common/Button";
import { VoiceInput } from "../../src/components/common/VoiceInput";
import { colors } from "../../src/constants/colors";
import { parseErrorMessage, saveErrorMessage } from "../../src/utils/errorMessages";
import { formatNaira } from "../../src/utils/formatters";
import { EXPENSE_CATEGORIES } from "../../src/constants/categories";
import { DraftBanner } from "../../src/components/common/DraftBanner";
import { draftStorage } from "../../src/utils/draft";
import { checkExpensesLimit, recordExpenseUsage } from "../../src/utils/usageLimits";
import { UpgradePromptModal, UpgradeFeature } from "../../src/components/common/UpgradePromptModal";

interface ParsedExpense {
  description: string;
  amount: number;
  category: string;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion: string;
}

interface ExpenseItem {
  description: string;
  amount: string;
  category: string;
}

const emptyItem = (): ExpenseItem => ({ description: "", amount: "", category: "other" });

interface ExpenseDraft { items: ExpenseItem[] }

export default function AddExpenseScreen() {
  const { user } = useAuthStore();
  const { addExpense, parseText } = useExpenseStore();

  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedExpense | null>(null);
  const [transcript, setTranscript] = useState("");
  const [mode, setMode] = useState<"voice" | "manual">("voice");
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([emptyItem()]);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [upgradeUsed, setUpgradeUsed] = useState(0);
  const [upgradeLimit, setUpgradeLimit] = useState(0);

  const planId = user?.subscription?.plan ?? "free";
  const draftKey = user ? `draft:expenses:${user._id}` : null;

  useEffect(() => {
    if (!draftKey) return;
    draftStorage.load<ExpenseDraft>(draftKey).then((stored) => {
      if (!stored) return;
      setExpenseItems(stored.data.items.length ? stored.data.items : [emptyItem()]);
      setMode("manual");
      setDraftSavedAt(stored.savedAt);
    });
  }, [draftKey]);

  const updateItem = (index: number, field: keyof ExpenseItem, value: string) => {
    setExpenseItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => setExpenseItems((prev) => [...prev, emptyItem()]);

  const removeItem = (index: number) => {
    setExpenseItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = expenseItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const handleTranscript = async (text: string) => {
    setTranscript(text);
    setIsParsing(true);
    try {
      const result = await parseText(text) as ParsedExpense;
      setParsedResult(result);
      setExpenseItems([{
        description: result.description,
        amount: result.amount.toString(),
        category: result.category,
      }]);
    } catch (err) {
      Alert.alert("Couldn't Parse", parseErrorMessage(err));
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!draftKey) return;
    const at = await draftStorage.save<ExpenseDraft>(draftKey, { items: expenseItems });
    setDraftSavedAt(at);
  };

  const handleDiscard = async () => {
    if (draftKey) await draftStorage.clear(draftKey);
    setDraftSavedAt(null);
    setExpenseItems([emptyItem()]);
    setTranscript("");
    setParsedResult(null);
  };

  const handleSubmit = async () => {
    if (!user) return;
    const valid = expenseItems.filter((i) => i.description.trim() && Number(i.amount) > 0);
    if (!valid.length) {
      Alert.alert("", "Add at least one expense with description and amount.");
      return;
    }
    const limitCheck = await checkExpensesLimit(user._id, planId);
    if (!limitCheck.allowed) {
      setUpgradeUsed(limitCheck.used); setUpgradeLimit(limitCheck.limit);
      setUpgradeVisible(true); return;
    }
    setIsSaving(true);
    try {
      for (const item of valid) {
        await addExpense({
          date: new Date().toISOString(),
          description: item.description.trim(),
          amount: Number(item.amount),
          category: item.category,
          rawInput: transcript || undefined,
          userId: user._id,
        });
        await recordExpenseUsage(user._id);
      }
      if (draftKey) await draftStorage.clear(draftKey);
      setDraftSavedAt(null);
      setExpenseItems([emptyItem()]);
      setTranscript("");
      setParsedResult(null);
      const count = valid.length;
      Alert.alert("✅ Recorded!", `${count} expense${count > 1 ? "s" : ""} recorded.`);
    } catch (err) {
      Alert.alert("Save Failed", saveErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const resetVoice = () => {
    setParsedResult(null);
    setTranscript("");
    setExpenseItems([emptyItem()]);
    setDraftSavedAt(null);
  };

  const showForm = parsedResult || mode === "manual";

  return (
    <SafeAreaView style={styles.safe}>
      <AppStatusBar />
      <OfflineBanner />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>Record Expense</Text>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === "voice" && styles.tabActive]}
              onPress={() => { setMode("voice"); resetVoice(); }}
            >
              <Text style={[styles.tabText, mode === "voice" && styles.tabTextActive]}>🎙 Voice</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === "manual" && styles.tabActive]}
              onPress={() => setMode("manual")}
            >
              <Text style={[styles.tabText, mode === "manual" && styles.tabTextActive]}>Manual</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {mode === "voice" && !parsedResult && !isParsing && (
            <VoiceInput
              onTranscript={handleTranscript}
              hint={"Speak your expense\ne.g. \"Transport cost me 2000\" or \"I buy stock for 45k\""}
            />
          )}

          {isParsing && (
            <View style={styles.parsingBox}>
              <Text style={styles.parsingText}>Parsing your expense...</Text>
            </View>
          )}

          {showForm && (
            <View>
              {draftSavedAt && (
                <DraftBanner savedAt={draftSavedAt} onDiscard={handleDiscard} />
              )}
              {parsedResult && (
                <Text style={styles.parsedBadge}>
                  ✅ Parsed — {Math.round(parsedResult.confidence * 100)}% sure
                  {transcript ? `\n"${transcript}"` : ""}
                </Text>
              )}

              {expenseItems.map((item, index) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemCardHeader}>
                    <Text style={styles.itemCardLabel}>
                      {expenseItems.length > 1 ? `Expense ${index + 1}` : "Expense"}
                    </Text>
                    {expenseItems.length > 1 && (
                      <TouchableOpacity onPress={() => removeItem(index)}>
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.fieldLabel}>Description *</Text>
                  <TextInput
                    style={styles.field}
                    value={item.description}
                    onChangeText={(v) => updateItem(index, "description", v)}
                    placeholder="e.g. Transport to market"
                    placeholderTextColor={colors.textMuted}
                  />

                  <Text style={styles.fieldLabel}>Amount (₦) *</Text>
                  <TextInput
                    style={[styles.field, { marginBottom: 10 }]}
                    value={item.amount}
                    onChangeText={(v) => updateItem(index, "amount", v)}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />

                  <Text style={styles.fieldLabel}>Category</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.catScroll}
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat.value}
                        style={[styles.catChip, item.category === cat.value && styles.catChipActive]}
                        onPress={() => updateItem(index, "category", cat.value)}
                      >
                        <Text style={[styles.catChipText, item.category === cat.value && styles.catChipTextActive]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {Number(item.amount) > 0 && (
                    <Text style={styles.itemSubtotal}>{formatNaira(Number(item.amount))}</Text>
                  )}
                </View>
              ))}

              <TouchableOpacity style={styles.addMoreBtn} onPress={addItem}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.addMoreText}>Add Another Expense</Text>
              </TouchableOpacity>

              {expenseItems.length > 1 && total > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalAmount}>{formatNaira(total)}</Text>
                </View>
              )}

              {draftSavedAt ? (
                <Button title="Submit" onPress={handleSubmit} loading={isSaving} style={styles.saveBtn} />
              ) : (
                <Button title="Save Draft" onPress={handleSaveDraft} style={styles.saveBtn} />
              )}

              {mode === "voice" && (
                <Button title="Try Again" variant="ghost" onPress={resetVoice} style={{ marginTop: 4 }} />
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <UpgradePromptModal
        visible={upgradeVisible}
        onClose={() => setUpgradeVisible(false)}
        feature="expenses"
        used={upgradeUsed}
        limit={upgradeLimit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, paddingBottom: 0 },
  title: { fontSize: 22, fontWeight: "700", color: colors.textPrimary, marginBottom: 16 },
  tabs: { flexDirection: "row", backgroundColor: colors.border, borderRadius: 10, padding: 3, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: colors.white },
  tabText: { fontSize: 14, fontWeight: "500", color: colors.textMuted },
  tabTextActive: { color: colors.primary, fontWeight: "700" },
  body: { padding: 20, paddingTop: 16 },
  parsingBox: { alignItems: "center", padding: 40 },
  parsingText: { fontSize: 15, color: colors.textSecondary },
  parsedBadge: { fontSize: 13, fontWeight: "600", color: colors.success, marginBottom: 16, lineHeight: 20 },

  itemCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: colors.border,
  },
  itemCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  itemCardLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },

  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 },
  field: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: colors.textPrimary, marginBottom: 8,
  },

  catScroll: { flexDirection: "row", gap: 6, paddingBottom: 4 },
  catChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontSize: 11, color: colors.textSecondary },
  catChipTextActive: { color: colors.white, fontWeight: "600" },

  itemSubtotal: { fontSize: 13, fontWeight: "700", color: colors.primary, textAlign: "right", marginTop: 8 },

  addMoreBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, justifyContent: "center", marginBottom: 12,
  },
  addMoreText: { color: colors.primary, fontWeight: "600", fontSize: 14 },

  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  totalLabel: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  totalAmount: { fontSize: 18, fontWeight: "800", color: colors.primary },

  saveBtn: { marginBottom: 16 },
});
