import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/store/authStore";
import { useSalesStore } from "../../src/store/salesStore";
import { useStockStore } from "../../src/store/stockStore";
import { OfflineBanner } from "../../src/components/common/OfflineBanner";
import { AppStatusBar } from "../../src/components/common/AppStatusBar";
import { Button } from "../../src/components/common/Button";
import { VoiceInput } from "../../src/components/common/VoiceInput";
import { ProductPickerInput } from "../../src/components/common/ProductPickerInput";
import { DraftBanner } from "../../src/components/common/DraftBanner";
import { CustomerPickerInput } from "../../src/components/common/CustomerPickerInput";
import { DatePickerModal } from "../../src/components/common/DatePickerModal";
import { colors, AppColors } from "../../src/constants/colors";
import { parseErrorMessage, saveErrorMessage } from "../../src/utils/errorMessages";
import { formatNaira } from "../../src/utils/formatters";
import { draftStorage } from "../../src/utils/draft";
import { saveCustomerName } from "../../src/utils/customers";
import { SaleItem } from "../../src/types";

type InputMode = "voice" | "manual";

interface ParsedResult {
  items: Array<{
    productName: string;
    category: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalAmount: number;
  }>;
  totalAmount: number;
  paymentType: string;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion: string;
}

type SalesDraft =
  | { mode: "manual"; items: Partial<SaleItem>[]; paymentType: string; customerName: string; saleDateStr: string }
  | { mode: "voice"; transcript: string; parsedResult: ParsedResult; customerName: string; saleDateStr: string };

const emptyItem = (): Partial<SaleItem> => ({
  productName: "", quantity: 1, unit: "piece", unitPrice: 0, costPrice: 0,
});

export default function AddSaleScreen() {
  const { user } = useAuthStore();
  const { addSale, parseText } = useSalesStore();
  const { items: stockItems } = useStockStore();

  const [mode, setMode] = useState<InputMode>("voice");
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [transcript, setTranscript] = useState("");
  const [manualItems, setManualItems] = useState<Partial<SaleItem>[]>([emptyItem()]);
  const [paymentType, setPaymentType] = useState("cash");
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [saleDate, setSaleDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const draftKey = user ? `draft:sales:${user._id}` : null;

  useFocusEffect(useCallback(() => {
    if (!draftKey) return;
    draftStorage.load<SalesDraft>(draftKey).then((stored) => {
      if (!stored) return;
      const { data } = stored;
      if (data.mode === "manual") {
        setMode("manual");
        setManualItems(data.items.length ? data.items : [emptyItem()]);
        setPaymentType(data.paymentType);
        setCustomerName(data.customerName || "");
        setSaleDate(data.saleDateStr ? new Date(data.saleDateStr) : new Date());
      } else if (data.mode === "voice" && data.parsedResult) {
        setMode("voice");
        setTranscript(data.transcript);
        setParsedResult(data.parsedResult);
        setCustomerName(data.customerName || "");
        setSaleDate(data.saleDateStr ? new Date(data.saleDateStr) : new Date());
      }
      setDraftSavedAt(stored.savedAt);
    });
  }, [draftKey]));

  // Returns the first stock-quantity overflow found, or null if none.
  // Products not in stock list are allowed through — they auto-register later.
  type StockOverflow = { productName: string; available: number; entered: number; unit: string };

  const findStockOverflow = (items: Partial<SaleItem>[]): StockOverflow | null => {
    for (const item of items) {
      if (!item.productName?.trim()) continue;
      const stock = stockItems.find(
        (s) => s.name.toLowerCase().trim() === item.productName!.toLowerCase().trim()
      );
      if (stock && (item.quantity ?? 1) > stock.qty) {
        return { productName: item.productName!, available: stock.qty, entered: item.quantity ?? 1, unit: stock.unit };
      }
    }
    return null;
  };

  const showOverflowDialog = (overflow: StockOverflow, onSubmitAnyway: () => void) => {
    Alert.alert(
      "Stock Balance Low",
      `Your stock balance for "${overflow.productName}" is ${overflow.available} ${overflow.unit}${overflow.available !== 1 ? "s" : ""}, but you entered ${overflow.entered}. What would you like to do?`,
      [
        { text: "Submit Anyway", onPress: onSubmitAnyway },
        { text: "Update Stock", onPress: () => router.push("/(tabs)/stock" as any) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleDiscard = () => {
    Alert.alert("Discard Draft", "Clear this draft and start fresh?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard", style: "destructive",
        onPress: async () => {
          if (draftKey) await draftStorage.clear(draftKey);
          setDraftSavedAt(null);
          setManualItems([emptyItem()]);
          setPaymentType("cash");
          setParsedResult(null);
          setTranscript("");
          setCustomerName("");
          setSaleDate(new Date());
        },
      },
    ]);
  };

  // ── Voice ──────────────────────────────────────────────────────────────────

  const handleTranscript = async (text: string) => {
    setTranscript(text);
    setIsParsing(true);
    try {
      const result = await parseText(text) as ParsedResult;
      setParsedResult(result);
    } catch (err) {
      Alert.alert("Couldn't Parse", parseErrorMessage(err));
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveDraftVoice = async () => {
    if (!draftKey || !parsedResult) return;
    const at = await draftStorage.save<SalesDraft>(draftKey, {
      mode: "voice", transcript, parsedResult,
      customerName, saleDateStr: saleDate.toISOString(),
    });
    setDraftSavedAt(at);
    Alert.alert("Draft Saved", "What would you like to do next?", [
      { text: "Keep Editing", style: "cancel" },
      {
        text: "New Entry",
        onPress: () => {
          setDraftSavedAt(null);
          setTranscript("");
          setParsedResult(null);
          setCustomerName("");
          setSaleDate(new Date());
        },
      },
    ]);
  };

  const doSubmitVoice = async () => {
    if (!parsedResult || !user) return;
    setIsSaving(true);
    try {
      const items: SaleItem[] = parsedResult.items.map((item) => ({
        productName: item.productName, category: item.category,
        quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice,
        costPrice: 0, totalAmount: item.totalAmount, profit: item.totalAmount,
      }));
      await addSale({
        date: saleDate.toISOString(), items,
        paymentType: parsedResult.paymentType || "cash",
        inputMethod: "voice", rawInput: transcript,
        customerName: customerName.trim() || undefined,
        userId: user._id,
      });
      if (customerName.trim()) saveCustomerName(user._id, customerName.trim());
      if (draftKey) await draftStorage.clear(draftKey);
      setDraftSavedAt(null);
      setTranscript("");
      setParsedResult(null);
      setCustomerName("");
      setSaleDate(new Date());
      Alert.alert("✅ Recorded!", "Your sale don enter.");
    } catch (err) {
      Alert.alert("Save Failed", saveErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitVoice = () => {
    if (!parsedResult || !user) return;
    if (!customerName.trim()) {
      Alert.alert("", "Customer name is required.");
      return;
    }
    const overflow = findStockOverflow(
      parsedResult.items.map((i) => ({ productName: i.productName, quantity: i.quantity } as Partial<SaleItem>))
    );
    if (overflow) {
      showOverflowDialog(overflow, doSubmitVoice);
      return;
    }
    doSubmitVoice();
  };

  // ── Manual ─────────────────────────────────────────────────────────────────

  const handleSaveDraftManual = async () => {
    if (!draftKey) return;
    const at = await draftStorage.save<SalesDraft>(draftKey, {
      mode: "manual", items: manualItems, paymentType,
      customerName, saleDateStr: saleDate.toISOString(),
    });
    setDraftSavedAt(at);
    Alert.alert("Draft Saved", "What would you like to do next?", [
      { text: "Keep Editing", style: "cancel" },
      {
        text: "New Entry",
        onPress: () => {
          setDraftSavedAt(null);
          setManualItems([emptyItem()]);
          setPaymentType("cash");
          setCustomerName("");
          setSaleDate(new Date());
        },
      },
    ]);
  };

  const doSubmitManual = async (validItems: Partial<SaleItem>[]) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const items: SaleItem[] = validItems.map((item) => ({
        productName: item.productName!,
        category: item.category || "other",
        quantity: item.quantity || 1,
        unit: item.unit || "piece",
        unitPrice: item.unitPrice!,
        costPrice: item.costPrice || 0,
        totalAmount: item.unitPrice! * (item.quantity || 1),
        profit: (item.unitPrice! - (item.costPrice || 0)) * (item.quantity || 1),
      }));
      await addSale({
        date: saleDate.toISOString(), items, paymentType,
        inputMethod: "manual_form",
        customerName: customerName.trim() || undefined,
        userId: user._id,
      });
      if (customerName.trim()) saveCustomerName(user._id, customerName.trim());
      if (draftKey) await draftStorage.clear(draftKey);
      setDraftSavedAt(null);
      setManualItems([emptyItem()]);
      setCustomerName("");
      setSaleDate(new Date());
      Alert.alert("✅ Recorded!", "Your sale don enter.");
    } catch (err) {
      Alert.alert("Save Failed", saveErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitManual = () => {
    if (!user) return;
    const validItems = manualItems.filter((i) => i.productName && i.unitPrice && i.unitPrice > 0);
    if (!validItems.length) {
      Alert.alert("", "Add at least one item with product name and price.");
      return;
    }
    if (!customerName.trim()) {
      Alert.alert("", "Customer name is required.");
      return;
    }
    const overflow = findStockOverflow(validItems);
    if (overflow) {
      showOverflowDialog(overflow, () => doSubmitManual(validItems));
      return;
    }
    doSubmitManual(validItems);
  };

  const updateManualItem = (index: number, field: keyof SaleItem, value: string | number) => {
    setManualItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <AppStatusBar />
      <OfflineBanner />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>Record Sale</Text>
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === "voice" && styles.tabActive]}
              onPress={() => { setMode("voice"); setParsedResult(null); setTranscript(""); }}
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
          {mode === "voice" ? (
            <View>
              {!parsedResult && !isParsing && (
                <VoiceInput
                  onTranscript={handleTranscript}
                  hint={"Speak your sale naturally\ne.g. \"I sell 5 bags rice 45k each\""}
                />
              )}
              {isParsing && (
                <View style={styles.parsingBox}>
                  <Text style={styles.parsingText}>Parsing your sale...</Text>
                </View>
              )}
              {parsedResult && (
                <View style={styles.parsedCard}>
                  <Text style={styles.parsedTitle}>
                    We parse am ✅ {Math.round(parsedResult.confidence * 100)}% sure
                  </Text>
                  {transcript ? <Text style={styles.transcriptText}>"{transcript}"</Text> : null}
                  {parsedResult.items.map((item, i) => (
                    <View key={i} style={styles.parsedItem}>
                      <Text style={styles.parsedName}>{item.productName}</Text>
                      <Text style={styles.parsedDetail}>
                        {item.quantity} {item.unit} × {formatNaira(item.unitPrice)} = {formatNaira(item.totalAmount)}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.parsedTotal}>
                    <Text style={styles.parsedTotalLabel}>Total</Text>
                    <Text style={styles.parsedTotalAmount}>{formatNaira(parsedResult.totalAmount)}</Text>
                  </View>
                  {parsedResult.needsClarification && (
                    <Text style={styles.clarification}>⚠️ {parsedResult.clarificationQuestion}</Text>
                  )}
                  <SaleDetailsBox
                    userId={user?._id ?? ""}
                    customerName={customerName}
                    onCustomerChange={setCustomerName}
                    saleDate={saleDate}
                    onDatePress={() => setShowDatePicker(true)}
                    colors={colors}
                  />
                  <View style={styles.parsedActions}>
                    {draftSavedAt ? (
                      <Button title="Submit" onPress={handleSubmitVoice} loading={isSaving} style={{ flex: 1 }} />
                    ) : (
                      <Button title="Save Draft" onPress={handleSaveDraftVoice} style={{ flex: 1 }} />
                    )}
                    <Button
                      title="Try Again"
                      variant="outline"
                      onPress={() => { setParsedResult(null); setTranscript(""); }}
                      style={{ flex: 1 }}
                    />
                  </View>
                  {draftSavedAt && (
                    <DraftBanner savedAt={draftSavedAt} onDiscard={handleDiscard} />
                  )}
                </View>
              )}
            </View>
          ) : (
            <View>
              {draftSavedAt && <DraftBanner savedAt={draftSavedAt} onDiscard={handleDiscard} />}
              <SaleDetailsBox
                userId={user?._id ?? ""}
                customerName={customerName}
                onCustomerChange={setCustomerName}
                saleDate={saleDate}
                onDatePress={() => setShowDatePicker(true)}
                colors={colors}
              />
              {manualItems.map((item, index) => (
                <View key={index} style={[styles.manualItem, { zIndex: manualItems.length - index }]}>
                  <View style={styles.manualItemHeader}>
                    <Text style={styles.manualItemTitle}>Item {index + 1}</Text>
                    {manualItems.length > 1 && (
                      <TouchableOpacity onPress={() => setManualItems((p) => p.filter((_, i) => i !== index))}>
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <ProductPickerInput
                    value={item.productName ?? ""}
                    onChange={(name, stockItem) => {
                      setManualItems((prev) =>
                        prev.map((it, i) => {
                          if (i !== index) return it;
                          const updated: typeof it = { ...it, productName: name };
                          if (stockItem) {
                            if (!it.unitPrice || it.unitPrice === 0)
                              updated.unitPrice = stockItem.sellingPrice || stockItem.costPrice;
                            if (!it.costPrice || it.costPrice === 0)
                              updated.costPrice = stockItem.costPrice;
                          }
                          return updated;
                        })
                      );
                    }}
                    placeholder="Product name *"
                    inputStyle={{ ...styles.manualField, marginBottom: 0 }}
                    containerStyle={{ marginBottom: 8 }}
                    colors={colors}
                  />
                  <View style={styles.manualRow}>
                    <TextInput
                      style={[styles.manualField, { flex: 1 }]}
                      placeholder="Qty"
                      placeholderTextColor={colors.textMuted}
                      value={item.quantity?.toString()}
                      onChangeText={(v) => updateManualItem(index, "quantity", parseFloat(v) || 0)}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={[styles.manualField, { flex: 2 }]}
                      placeholder="Unit price (₦) *"
                      placeholderTextColor={colors.textMuted}
                      value={item.unitPrice ? item.unitPrice.toString() : ""}
                      onChangeText={(v) => updateManualItem(index, "unitPrice", parseFloat(v) || 0)}
                      keyboardType="numeric"
                    />
                  </View>
                  <TextInput
                    style={styles.manualField}
                    placeholder="Cost price (₦) — optional"
                    placeholderTextColor={colors.textMuted}
                    value={item.costPrice ? item.costPrice.toString() : ""}
                    onChangeText={(v) => updateManualItem(index, "costPrice", parseFloat(v) || 0)}
                    keyboardType="numeric"
                  />
                  <Text style={styles.itemTotal}>
                    = {formatNaira((item.unitPrice || 0) * (item.quantity || 1))}
                  </Text>
                </View>
              ))}
              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={() => setManualItems((p) => [...p, emptyItem()])}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.addItemText}>Add Another Item</Text>
              </TouchableOpacity>
              <Text style={styles.fieldLabel}>Payment Type</Text>
              <View style={styles.paymentRow}>
                {["cash", "transfer", "pos", "credit"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.payChip, paymentType === type && styles.payChipActive]}
                    onPress={() => setPaymentType(type)}
                  >
                    <Text style={[styles.payChipText, paymentType === type && styles.payChipTextActive]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {draftSavedAt ? (
                <Button title="Submit" onPress={handleSubmitManual} loading={isSaving} style={styles.saveBtn} />
              ) : (
                <Button title="Save Draft" onPress={handleSaveDraftManual} style={styles.saveBtn} />
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={showDatePicker}
        value={saleDate}
        onConfirm={(date) => { setSaleDate(date); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
        colors={colors}
        disableFuture
      />
    </SafeAreaView>
  );
}

function SaleDetailsBox({ userId, customerName, onCustomerChange, saleDate, onDatePress, colors }: {
  userId: string;
  customerName: string;
  onCustomerChange: (v: string) => void;
  saleDate: Date;
  onDatePress: () => void;
  colors: AppColors;
}) {
  const today = new Date();
  const isToday = saleDate.toDateString() === today.toDateString();
  const dateLabel = isToday
    ? "Today"
    : saleDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      <CustomerPickerInput
        value={customerName}
        onChange={onCustomerChange}
        userId={userId}
        containerStyle={{ zIndex: 30 }}
        colors={colors}
      />
      <TouchableOpacity
        style={[detailStyles.dateBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
        onPress={onDatePress}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
        <Text style={[detailStyles.dateBtnText, { color: isToday ? colors.textMuted : colors.primary }]}>
          {dateLabel}
        </Text>
        <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  dateBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, height: 48, paddingHorizontal: 14,
  },
  dateBtnText: { flex: 1, fontSize: 15, fontWeight: "500" },
});


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
  transcriptText: { fontSize: 13, color: colors.textSecondary, fontStyle: "italic", marginBottom: 12, lineHeight: 20 },
  parsedCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#C6F6D5" },
  parsedTitle: { fontSize: 14, fontWeight: "600", color: colors.success, marginBottom: 12 },
  parsedItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  parsedName: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  parsedDetail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  parsedTotal: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 12 },
  parsedTotalLabel: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  parsedTotalAmount: { fontSize: 18, fontWeight: "700", color: colors.primary },
  clarification: { fontSize: 13, color: colors.warning, marginTop: 8, lineHeight: 20 },
  parsedActions: { flexDirection: "row", gap: 12, marginTop: 16, marginBottom: 12 },
  manualItem: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  manualItemHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  manualItemTitle: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  manualField: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: colors.textPrimary, marginBottom: 8,
  },
  manualRow: { flexDirection: "row", gap: 8 },
  itemTotal: { fontSize: 14, fontWeight: "700", color: colors.primary, textAlign: "right", marginTop: 4 },
  addItemBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, justifyContent: "center", marginBottom: 20 },
  addItemText: { color: colors.primary, fontWeight: "600", fontSize: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 10 },
  paymentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  payChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  payChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  payChipText: { fontSize: 13, color: colors.textSecondary },
  payChipTextActive: { color: colors.white, fontWeight: "600" },
  saveBtn: { marginBottom: 40 },
});
