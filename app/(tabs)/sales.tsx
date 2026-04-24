// import React, { useState, useEffect, useCallback } from "react";
// import {
//   View, Text, StyleSheet, TouchableOpacity,
//   TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform,
// } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { useFocusEffect, router } from "expo-router";
// import { Ionicons } from "@expo/vector-icons";
// import { useAuthStore } from "../../src/store/authStore";
// import { useSalesStore } from "../../src/store/salesStore";
// import { useStockStore } from "../../src/store/stockStore";
// import { OfflineBanner } from "../../src/components/common/OfflineBanner";
// import { AppStatusBar } from "../../src/components/common/AppStatusBar";
// import { Button } from "../../src/components/common/Button";
// import { VoiceInput } from "../../src/components/common/VoiceInput";
// import { ProductPickerInput } from "../../src/components/common/ProductPickerInput";
// import { DraftBanner } from "../../src/components/common/DraftBanner";
// import { CustomerPickerInput } from "../../src/components/common/CustomerPickerInput";
// import { DatePickerModal } from "../../src/components/common/DatePickerModal";
// import { colors, AppColors } from "../../src/constants/colors";
// import { parseErrorMessage, saveErrorMessage } from "../../src/utils/errorMessages";
// import { formatNaira } from "../../src/utils/formatters";
// import { draftStorage } from "../../src/utils/draft";
// import { saveCustomerName } from "../../src/utils/customers";
// import { SaleItem } from "../../src/types";

// type InputMode = "voice" | "manual";

// interface ParsedResult {
//   items: Array<{
//     productName: string;
//     category: string;
//     quantity: number;
//     unit: string;
//     unitPrice: number;
//     totalAmount: number;
//   }>;
//   totalAmount: number;
//   paymentType: string;
//   confidence: number;
//   needsClarification: boolean;
//   clarificationQuestion: string;
// }

// type SalesDraft =
//   | { mode: "manual"; items: Partial<SaleItem>[]; paymentType: string; customerName: string; saleDateStr: string }
//   | { mode: "voice"; transcript: string; parsedResult: ParsedResult; customerName: string; saleDateStr: string };

// const emptyItem = (): Partial<SaleItem> => ({
//   productName: "", quantity: 1, unit: "piece", unitPrice: 0, costPrice: 0,
// });

// export default function AddSaleScreen() {
//   const { user } = useAuthStore();
//   const { addSale, parseText } = useSalesStore();
//   const { items: stockItems } = useStockStore();

//   const [mode, setMode] = useState<InputMode>("voice");
//   const [isParsing, setIsParsing] = useState(false);
//   const [isSaving, setIsSaving] = useState(false);
//   const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
//   const [transcript, setTranscript] = useState("");
//   const [manualItems, setManualItems] = useState<Partial<SaleItem>[]>([emptyItem()]);
//   const [paymentType, setPaymentType] = useState("cash");
//   const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
//   const [customerName, setCustomerName] = useState("");
//   const [saleDate, setSaleDate] = useState(new Date());
//   const [showDatePicker, setShowDatePicker] = useState(false);

//   const draftKey = user ? `draft:sales:${user._id}` : null;

//   useFocusEffect(useCallback(() => {
//     if (!draftKey) return;
//     draftStorage.load<SalesDraft>(draftKey).then((stored) => {
//       if (!stored) return;
//       const { data } = stored;
//       if (data.mode === "manual") {
//         setMode("manual");
//         setManualItems(data.items.length ? data.items : [emptyItem()]);
//         setPaymentType(data.paymentType);
//         setCustomerName(data.customerName || "");
//         setSaleDate(data.saleDateStr ? new Date(data.saleDateStr) : new Date());
//       } else if (data.mode === "voice" && data.parsedResult) {
//         setMode("voice");
//         setTranscript(data.transcript);
//         setParsedResult(data.parsedResult);
//         setCustomerName(data.customerName || "");
//         setSaleDate(data.saleDateStr ? new Date(data.saleDateStr) : new Date());
//       }
//       setDraftSavedAt(stored.savedAt);
//     });
//   }, [draftKey]));

//   // Returns the first stock-quantity overflow found, or null if none.
//   // Products not in stock list are allowed through — they auto-register later.
//   type StockOverflow = { productName: string; available: number; entered: number; unit: string };

//   const findStockOverflow = (items: Partial<SaleItem>[]): StockOverflow | null => {
//     for (const item of items) {
//       if (!item.productName?.trim()) continue;
//       const stock = stockItems.find(
//         (s) => s.name.toLowerCase().trim() === item.productName!.toLowerCase().trim()
//       );
//       if (stock && (item.quantity ?? 1) > stock.qty) {
//         return { productName: item.productName!, available: stock.qty, entered: item.quantity ?? 1, unit: stock.unit };
//       }
//     }
//     return null;
//   };

//   const showOverflowDialog = (overflow: StockOverflow, onSubmitAnyway: () => void) => {
//     Alert.alert(
//       "Stock Balance Low",
//       `Your stock balance for "${overflow.productName}" is ${overflow.available} ${overflow.unit}${overflow.available !== 1 ? "s" : ""}, but you entered ${overflow.entered}. What would you like to do?`,
//       [
//         { text: "Submit Anyway", onPress: onSubmitAnyway },
//         { text: "Update Stock", onPress: () => router.push("/(tabs)/stock" as any) },
//         { text: "Cancel", style: "cancel" },
//       ]
//     );
//   };

//   const handleDiscard = () => {
//     Alert.alert("Discard Draft", "Clear this draft and start fresh?", [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Discard", style: "destructive",
//         onPress: async () => {
//           if (draftKey) await draftStorage.clear(draftKey);
//           setDraftSavedAt(null);
//           setManualItems([emptyItem()]);
//           setPaymentType("cash");
//           setParsedResult(null);
//           setTranscript("");
//           setCustomerName("");
//           setSaleDate(new Date());
//         },
//       },
//     ]);
//   };

//   // ── Voice ──────────────────────────────────────────────────────────────────

//   const handleTranscript = async (text: string) => {
//     setTranscript(text);
//     setIsParsing(true);
//     try {
//       const result = await parseText(text) as ParsedResult;
//       setParsedResult(result);
//     } catch (err) {
//       Alert.alert("Couldn't Parse", parseErrorMessage(err));
//     } finally {
//       setIsParsing(false);
//     }
//   };

//   const handleSaveDraftVoice = async () => {
//     if (!draftKey || !parsedResult) return;
//     const at = await draftStorage.save<SalesDraft>(draftKey, {
//       mode: "voice", transcript, parsedResult,
//       customerName, saleDateStr: saleDate.toISOString(),
//     });
//     setDraftSavedAt(at);
//     Alert.alert("Draft Saved", "What would you like to do next?", [
//       { text: "Keep Editing", style: "cancel" },
//       {
//         text: "New Entry",
//         onPress: () => {
//           setDraftSavedAt(null);
//           setTranscript("");
//           setParsedResult(null);
//           setCustomerName("");
//           setSaleDate(new Date());
//         },
//       },
//     ]);
//   };

//   const doSubmitVoice = async () => {
//     if (!parsedResult || !user) return;
//     setIsSaving(true);
//     try {
//       const items: SaleItem[] = parsedResult.items.map((item) => ({
//         productName: item.productName, category: item.category,
//         quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice,
//         costPrice: 0, totalAmount: item.totalAmount, profit: item.totalAmount,
//       }));
//       await addSale({
//         date: saleDate.toISOString(), items,
//         paymentType: parsedResult.paymentType || "cash",
//         inputMethod: "voice", rawInput: transcript,
//         customerName: customerName.trim() || undefined,
//         userId: user._id,
//       });
//       if (customerName.trim()) saveCustomerName(user._id, customerName.trim());
//       if (draftKey) await draftStorage.clear(draftKey);
//       setDraftSavedAt(null);
//       setTranscript("");
//       setParsedResult(null);
//       setCustomerName("");
//       setSaleDate(new Date());
//       Alert.alert("✅ Recorded!", "Your sale don enter.");
//     } catch (err) {
//       Alert.alert("Save Failed", saveErrorMessage(err));
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   const handleSubmitVoice = () => {
//     if (!parsedResult || !user) return;
//     if (!customerName.trim()) {
//       Alert.alert("", "Customer name is required.");
//       return;
//     }
//     const overflow = findStockOverflow(
//       parsedResult.items.map((i) => ({ productName: i.productName, quantity: i.quantity } as Partial<SaleItem>))
//     );
//     if (overflow) {
//       showOverflowDialog(overflow, doSubmitVoice);
//       return;
//     }
//     doSubmitVoice();
//   };

//   // ── Manual ─────────────────────────────────────────────────────────────────

//   const handleSaveDraftManual = async () => {
//     if (!draftKey) return;
//     const at = await draftStorage.save<SalesDraft>(draftKey, {
//       mode: "manual", items: manualItems, paymentType,
//       customerName, saleDateStr: saleDate.toISOString(),
//     });
//     setDraftSavedAt(at);
//     Alert.alert("Draft Saved", "What would you like to do next?", [
//       { text: "Keep Editing", style: "cancel" },
//       {
//         text: "New Entry",
//         onPress: () => {
//           setDraftSavedAt(null);
//           setManualItems([emptyItem()]);
//           setPaymentType("cash");
//           setCustomerName("");
//           setSaleDate(new Date());
//         },
//       },
//     ]);
//   };

//   const doSubmitManual = async (validItems: Partial<SaleItem>[]) => {
//     if (!user) return;
//     setIsSaving(true);
//     try {
//       const items: SaleItem[] = validItems.map((item) => ({
//         productName: item.productName!,
//         category: item.category || "other",
//         quantity: item.quantity || 1,
//         unit: item.unit || "piece",
//         unitPrice: item.unitPrice!,
//         costPrice: item.costPrice || 0,
//         totalAmount: item.unitPrice! * (item.quantity || 1),
//         profit: (item.unitPrice! - (item.costPrice || 0)) * (item.quantity || 1),
//       }));
//       await addSale({
//         date: saleDate.toISOString(), items, paymentType,
//         inputMethod: "manual_form",
//         customerName: customerName.trim() || undefined,
//         userId: user._id,
//       });
//       if (customerName.trim()) saveCustomerName(user._id, customerName.trim());
//       if (draftKey) await draftStorage.clear(draftKey);
//       setDraftSavedAt(null);
//       setManualItems([emptyItem()]);
//       setCustomerName("");
//       setSaleDate(new Date());
//       Alert.alert("✅ Recorded!", "Your sale don enter.");
//     } catch (err) {
//       Alert.alert("Save Failed", saveErrorMessage(err));
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   const handleSubmitManual = () => {
//     if (!user) return;
//     const validItems = manualItems.filter((i) => i.productName && i.unitPrice && i.unitPrice > 0);
//     if (!validItems.length) {
//       Alert.alert("", "Add at least one item with product name and price.");
//       return;
//     }
//     if (!customerName.trim()) {
//       Alert.alert("", "Customer name is required.");
//       return;
//     }
//     const overflow = findStockOverflow(validItems);
//     if (overflow) {
//       showOverflowDialog(overflow, () => doSubmitManual(validItems));
//       return;
//     }
//     doSubmitManual(validItems);
//   };

//   const updateManualItem = (index: number, field: keyof SaleItem, value: string | number) => {
//     setManualItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
//   };

//   return (
//     <SafeAreaView style={styles.safe}>
//       <AppStatusBar />
//       <OfflineBanner />
//       <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
//         <View style={styles.header}>
//           <Text style={styles.title}>Record Sale</Text>
//           <View style={styles.tabs}>
//             <TouchableOpacity
//               style={[styles.tab, mode === "voice" && styles.tabActive]}
//               onPress={() => { setMode("voice"); setParsedResult(null); setTranscript(""); }}
//             >
//               <Text style={[styles.tabText, mode === "voice" && styles.tabTextActive]}>🎙 Voice</Text>
//             </TouchableOpacity>
//             <TouchableOpacity
//               style={[styles.tab, mode === "manual" && styles.tabActive]}
//               onPress={() => setMode("manual")}
//             >
//               <Text style={[styles.tabText, mode === "manual" && styles.tabTextActive]}>Manual</Text>
//             </TouchableOpacity>
//           </View>
//         </View>

//         <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
//           {mode === "voice" ? (
//             <View>
//               {!parsedResult && !isParsing && (
//                 <VoiceInput
//                   onTranscript={handleTranscript}
//                   hint={"Speak your sale naturally\ne.g. \"I sell 5 bags rice 45k each\""}
//                 />
//               )}
//               {isParsing && (
//                 <View style={styles.parsingBox}>
//                   <Text style={styles.parsingText}>Parsing your sale...</Text>
//                 </View>
//               )}
//               {parsedResult && (
//                 <View style={styles.parsedCard}>
//                   <Text style={styles.parsedTitle}>
//                     We parse am ✅ {Math.round(parsedResult.confidence * 100)}% sure
//                   </Text>
//                   {transcript ? <Text style={styles.transcriptText}>"{transcript}"</Text> : null}
//                   {parsedResult.items.map((item, i) => (
//                     <View key={i} style={styles.parsedItem}>
//                       <Text style={styles.parsedName}>{item.productName}</Text>
//                       <Text style={styles.parsedDetail}>
//                         {item.quantity} {item.unit} × {formatNaira(item.unitPrice)} = {formatNaira(item.totalAmount)}
//                       </Text>
//                     </View>
//                   ))}
//                   <View style={styles.parsedTotal}>
//                     <Text style={styles.parsedTotalLabel}>Total</Text>
//                     <Text style={styles.parsedTotalAmount}>{formatNaira(parsedResult.totalAmount)}</Text>
//                   </View>
//                   {parsedResult.needsClarification && (
//                     <Text style={styles.clarification}>⚠️ {parsedResult.clarificationQuestion}</Text>
//                   )}
//                   <SaleDetailsBox
//                     userId={user?._id ?? ""}
//                     customerName={customerName}
//                     onCustomerChange={setCustomerName}
//                     saleDate={saleDate}
//                     onDatePress={() => setShowDatePicker(true)}
//                     colors={colors}
//                   />
//                   <View style={styles.parsedActions}>
//                     {draftSavedAt ? (
//                       <Button title="Submit" onPress={handleSubmitVoice} loading={isSaving} style={{ flex: 1 }} />
//                     ) : (
//                       <Button title="Save Draft" onPress={handleSaveDraftVoice} style={{ flex: 1 }} />
//                     )}
//                     <Button
//                       title="Try Again"
//                       variant="outline"
//                       onPress={() => { setParsedResult(null); setTranscript(""); }}
//                       style={{ flex: 1 }}
//                     />
//                   </View>
//                   {draftSavedAt && (
//                     <DraftBanner savedAt={draftSavedAt} onDiscard={handleDiscard} />
//                   )}
//                 </View>
//               )}
//             </View>
//           ) : (
//             <View>
//               {draftSavedAt && <DraftBanner savedAt={draftSavedAt} onDiscard={handleDiscard} />}
//               <SaleDetailsBox
//                 userId={user?._id ?? ""}
//                 customerName={customerName}
//                 onCustomerChange={setCustomerName}
//                 saleDate={saleDate}
//                 onDatePress={() => setShowDatePicker(true)}
//                 colors={colors}
//               />
//               {manualItems.map((item, index) => (
//                 <View key={index} style={[styles.manualItem, { zIndex: manualItems.length - index }]}>
//                   <View style={styles.manualItemHeader}>
//                     <Text style={styles.manualItemTitle}>Item {index + 1}</Text>
//                     {manualItems.length > 1 && (
//                       <TouchableOpacity onPress={() => setManualItems((p) => p.filter((_, i) => i !== index))}>
//                         <Ionicons name="trash-outline" size={18} color={colors.danger} />
//                       </TouchableOpacity>
//                     )}
//                   </View>
//                   <ProductPickerInput
//                     value={item.productName ?? ""}
//                     onChange={(name, stockItem) => {
//                       setManualItems((prev) =>
//                         prev.map((it, i) => {
//                           if (i !== index) return it;
//                           const updated: typeof it = { ...it, productName: name };
//                           if (stockItem) {
//                             if (!it.unitPrice || it.unitPrice === 0)
//                               updated.unitPrice = stockItem.sellingPrice || stockItem.costPrice;
//                             if (!it.costPrice || it.costPrice === 0)
//                               updated.costPrice = stockItem.costPrice;
//                           }
//                           return updated;
//                         })
//                       );
//                     }}
//                     placeholder="Product name *"
//                     inputStyle={{ ...styles.manualField, marginBottom: 0 }}
//                     containerStyle={{ marginBottom: 8 }}
//                     colors={colors}
//                   />
//                   <View style={styles.manualRow}>
//                     <TextInput
//                       style={[styles.manualField, { flex: 1 }]}
//                       placeholder="Qty"
//                       placeholderTextColor={colors.textMuted}
//                       value={item.quantity?.toString()}
//                       onChangeText={(v) => updateManualItem(index, "quantity", parseFloat(v) || 0)}
//                       keyboardType="numeric"
//                     />
//                     <TextInput
//                       style={[styles.manualField, { flex: 2 }]}
//                       placeholder="Unit price (₦) *"
//                       placeholderTextColor={colors.textMuted}
//                       value={item.unitPrice ? item.unitPrice.toString() : ""}
//                       onChangeText={(v) => updateManualItem(index, "unitPrice", parseFloat(v) || 0)}
//                       keyboardType="numeric"
//                     />
//                   </View>
//                   <TextInput
//                     style={styles.manualField}
//                     placeholder="Cost price (₦) — optional"
//                     placeholderTextColor={colors.textMuted}
//                     value={item.costPrice ? item.costPrice.toString() : ""}
//                     onChangeText={(v) => updateManualItem(index, "costPrice", parseFloat(v) || 0)}
//                     keyboardType="numeric"
//                   />
//                   <Text style={styles.itemTotal}>
//                     = {formatNaira((item.unitPrice || 0) * (item.quantity || 1))}
//                   </Text>
//                 </View>
//               ))}
//               <TouchableOpacity
//                 style={styles.addItemBtn}
//                 onPress={() => setManualItems((p) => [...p, emptyItem()])}
//               >
//                 <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
//                 <Text style={styles.addItemText}>Add Another Item</Text>
//               </TouchableOpacity>
//               <Text style={styles.fieldLabel}>Payment Type</Text>
//               <View style={styles.paymentRow}>
//                 {["cash", "transfer", "pos", "credit"].map((type) => (
//                   <TouchableOpacity
//                     key={type}
//                     style={[styles.payChip, paymentType === type && styles.payChipActive]}
//                     onPress={() => setPaymentType(type)}
//                   >
//                     <Text style={[styles.payChipText, paymentType === type && styles.payChipTextActive]}>
//                       {type.charAt(0).toUpperCase() + type.slice(1)}
//                     </Text>
//                   </TouchableOpacity>
//                 ))}
//               </View>
//               {draftSavedAt ? (
//                 <Button title="Submit" onPress={handleSubmitManual} loading={isSaving} style={styles.saveBtn} />
//               ) : (
//                 <Button title="Save Draft" onPress={handleSaveDraftManual} style={styles.saveBtn} />
//               )}
//             </View>
//           )}
//         </ScrollView>
//       </KeyboardAvoidingView>

//       <DatePickerModal
//         visible={showDatePicker}
//         value={saleDate}
//         onConfirm={(date) => { setSaleDate(date); setShowDatePicker(false); }}
//         onClose={() => setShowDatePicker(false)}
//         colors={colors}
//         disableFuture
//       />
//     </SafeAreaView>
//   );
// }

// function SaleDetailsBox({ userId, customerName, onCustomerChange, saleDate, onDatePress, colors }: {
//   userId: string;
//   customerName: string;
//   onCustomerChange: (v: string) => void;
//   saleDate: Date;
//   onDatePress: () => void;
//   colors: AppColors;
// }) {
//   const today = new Date();
//   const isToday = saleDate.toDateString() === today.toDateString();
//   const dateLabel = isToday
//     ? "Today"
//     : saleDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

//   return (
//     <View style={{ marginTop: 12, gap: 8 }}>
//       <CustomerPickerInput
//         value={customerName}
//         onChange={onCustomerChange}
//         userId={userId}
//         containerStyle={{ zIndex: 30 }}
//         colors={colors}
//       />
//       <TouchableOpacity
//         style={[detailStyles.dateBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
//         onPress={onDatePress}
//         activeOpacity={0.7}
//       >
//         <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
//         <Text style={[detailStyles.dateBtnText, { color: isToday ? colors.textMuted : colors.primary }]}>
//           {dateLabel}
//         </Text>
//         <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
//       </TouchableOpacity>
//     </View>
//   );
// }

// const detailStyles = StyleSheet.create({
//   dateBtn: {
//     flexDirection: "row", alignItems: "center", gap: 8,
//     borderWidth: 1, borderRadius: 10, height: 48, paddingHorizontal: 14,
//   },
//   dateBtnText: { flex: 1, fontSize: 15, fontWeight: "500" },
// });


// const styles = StyleSheet.create({
//   safe: { flex: 1, backgroundColor: colors.background },
//   header: { padding: 20, paddingBottom: 0 },
//   title: { fontSize: 22, fontWeight: "700", color: colors.textPrimary, marginBottom: 16 },
//   tabs: { flexDirection: "row", backgroundColor: colors.border, borderRadius: 10, padding: 3, marginBottom: 4 },
//   tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
//   tabActive: { backgroundColor: colors.white },
//   tabText: { fontSize: 14, fontWeight: "500", color: colors.textMuted },
//   tabTextActive: { color: colors.primary, fontWeight: "700" },
//   body: { padding: 20, paddingTop: 16 },
//   parsingBox: { alignItems: "center", padding: 40 },
//   parsingText: { fontSize: 15, color: colors.textSecondary },
//   transcriptText: { fontSize: 13, color: colors.textSecondary, fontStyle: "italic", marginBottom: 12, lineHeight: 20 },
//   parsedCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#C6F6D5" },
//   parsedTitle: { fontSize: 14, fontWeight: "600", color: colors.success, marginBottom: 12 },
//   parsedItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
//   parsedName: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
//   parsedDetail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
//   parsedTotal: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 12 },
//   parsedTotalLabel: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
//   parsedTotalAmount: { fontSize: 18, fontWeight: "700", color: colors.primary },
//   clarification: { fontSize: 13, color: colors.warning, marginTop: 8, lineHeight: 20 },
//   parsedActions: { flexDirection: "row", gap: 12, marginTop: 16, marginBottom: 12 },
//   manualItem: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
//   manualItemHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
//   manualItemTitle: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
//   manualField: {
//     backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
//     borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
//     fontSize: 15, color: colors.textPrimary, marginBottom: 8,
//   },
//   manualRow: { flexDirection: "row", gap: 8 },
//   itemTotal: { fontSize: 14, fontWeight: "700", color: colors.primary, textAlign: "right", marginTop: 4 },
//   addItemBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, justifyContent: "center", marginBottom: 20 },
//   addItemText: { color: colors.primary, fontWeight: "600", fontSize: 14 },
//   fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: 10 },
//   paymentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
//   payChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
//   payChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
//   payChipText: { fontSize: 13, color: colors.textSecondary },
//   payChipTextActive: { color: colors.white, fontWeight: "600" },
//   saveBtn: { marginBottom: 40 },
// });



import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert, KeyboardAvoidingView,
  Platform, Animated, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../../src/store/authStore";
import { useSalesStore } from "../../src/store/salesStore";
import { useStockStore } from "../../src/store/stockStore";
import { OfflineBanner } from "../../src/components/common/OfflineBanner";
import { AppStatusBar } from "../../src/components/common/AppStatusBar";
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
import { checkSalesLimit, checkVoiceAccess, recordSaleUsage } from "../../src/utils/usageLimits";
import { UpgradePromptModal, UpgradeFeature } from "../../src/components/common/UpgradePromptModal";
import { SaleItem } from "../../src/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Design Tokens ────────────────────────────────────────────────────────────

const D = {
  radius: { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, full: 999 },
  shadow: {
    soft: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 3,
    },
    medium: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.11,
      shadowRadius: 18,
      elevation: 6,
    },
    colored: (color: string) => ({
      shadowColor: color,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 10,
    }),
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Payment Config ───────────────────────────────────────────────────────────

const PAYMENT_OPTIONS: Array<{
  key: string; label: string; icon: string; color: string; bg: string;
}> = [
  { key: "cash",     label: "Cash",     icon: "cash-outline",             color: "#059669", bg: "#ECFDF5" },
  { key: "transfer", label: "Transfer", icon: "swap-horizontal-outline",  color: "#2563EB", bg: "#EFF6FF" },
  { key: "pos",      label: "POS",      icon: "card-outline",             color: "#7C3AED", bg: "#F5F3FF" },
  { key: "credit",   label: "Credit",   icon: "time-outline",             color: "#D97706", bg: "#FFFBEB" },
];

// ─── Animated Press Wrapper ───────────────────────────────────────────────────

function Pressable({
  children, onPress, style, disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={onPress} onPressIn={onIn} onPressOut={onOut}
        activeOpacity={1} disabled={disabled}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Mode Toggle ──────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: InputMode; onChange: (m: InputMode) => void }) {
  const slideAnim = useRef(new Animated.Value(mode === "voice" ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: mode === "voice" ? 0 : 1,
      useNativeDriver: false,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [mode]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, (SCREEN_WIDTH - 32 - 4) / 2],
  });

  return (
    <View style={toggleS.track}>
      <Animated.View
        style={[
          toggleS.thumb,
          {
            width: (SCREEN_WIDTH - 32 - 8) / 2,
            transform: [{ translateX }],
          },
          D.shadow.soft,
        ]}
      />
      {(["voice", "manual"] as InputMode[]).map((m) => (
        <TouchableOpacity
          key={m}
          style={toggleS.option}
          onPress={() => onChange(m)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={m === "voice" ? "mic-outline" : "create-outline"}
            size={15}
            color={mode === m ? colors.primary : colors.textMuted}
          />
          <Text style={[toggleS.label, mode === m && toggleS.labelActive]}>
            {m === "voice" ? "Voice" : "Manual"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const toggleS = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.border,
    borderRadius: D.radius.full,
    padding: 2,
    position: "relative",
    height: 44,
    alignItems: "center",
  },
  thumb: {
    position: "absolute",
    top: 2, bottom: 2,
    backgroundColor: "#fff",
    borderRadius: D.radius.full,
    ...D.shadow.soft,
  },
  option: {
    flex: 1, flexDirection: "row",
    alignItems: "center", justifyContent: "center",
    gap: 6, zIndex: 1, height: "100%",
  },
  label: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  labelActive: { color: colors.primary, fontWeight: "700" },
});

// ─── Sale Details Box ─────────────────────────────────────────────────────────

function SaleDetailsBox({
  userId, customerName, onCustomerChange,
  saleDate, onDatePress,
}: {
  userId: string;
  customerName: string;
  onCustomerChange: (v: string) => void;
  saleDate: Date;
  onDatePress: () => void;
}) {
  const today = new Date();
  const isToday = saleDate.toDateString() === today.toDateString();
  const dateLabel = isToday
    ? "Today"
    : saleDate.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

  return (
    <View style={detailS.container}>
      <View style={detailS.sectionHeader}>
        <View style={[detailS.sectionIcon, { backgroundColor: colors.primary + "18" }]}>
          <Ionicons name="person-outline" size={14} color={colors.primary} />
        </View>
        <Text style={detailS.sectionTitle}>Sale Details</Text>
      </View>

      <CustomerPickerInput
        value={customerName}
        onChange={onCustomerChange}
        userId={userId}
        placeholder="Customer name / walk-in customer"
        containerStyle={{ zIndex: 30 }}
        colors={colors}
      />

      <TouchableOpacity
        style={detailS.dateBtn}
        onPress={onDatePress}
        activeOpacity={0.75}
      >
        <View style={[detailS.dateIcon, { backgroundColor: isToday ? colors.border : colors.primary + "15" }]}>
          <Ionicons name="calendar" size={16} color={isToday ? colors.textMuted : colors.primary} />
        </View>
        <Text style={[detailS.dateBtnText, { color: isToday ? colors.textSecondary : colors.primary }]}>
          {dateLabel}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const detailS = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: D.radius.xl,
    padding: 16,
    marginBottom: 12,
    gap: 10,
    ...D.shadow.soft,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  sectionIcon: {
    width: 26, height: 26, borderRadius: D.radius.sm,
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },
  dateBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.background,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: D.radius.lg, height: 48, paddingHorizontal: 14,
  },
  dateIcon: {
    width: 28, height: 28, borderRadius: D.radius.sm,
    alignItems: "center", justifyContent: "center",
  },
  dateBtnText: { flex: 1, fontSize: 14, fontWeight: "600" },
});

// ─── Payment Type Selector ────────────────────────────────────────────────────

function PaymentSelector({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={payS.wrap}>
      <View style={payS.header}>
        <View style={[payS.headerIcon, { backgroundColor: colors.primary + "18" }]}>
          <Ionicons name="wallet-outline" size={14} color={colors.primary} />
        </View>
        <Text style={payS.headerTitle}>Payment Method</Text>
      </View>
      <View style={payS.grid}>
        {PAYMENT_OPTIONS.map((opt) => {
          const active = value === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                payS.option,
                { borderColor: active ? opt.color : colors.border },
                active && { backgroundColor: opt.bg },
              ]}
              onPress={() => onChange(opt.key)}
              activeOpacity={0.75}
            >
              <View style={[payS.optIcon, { backgroundColor: active ? opt.color + "25" : colors.background }]}>
                <Ionicons name={opt.icon as any} size={18} color={active ? opt.color : colors.textMuted} />
              </View>
              <Text style={[payS.optLabel, active && { color: opt.color, fontWeight: "700" }]}>
                {opt.label}
              </Text>
              {active && (
                <View style={[payS.checkDot, { backgroundColor: opt.color }]}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const payS = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: D.radius.xl,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    ...D.shadow.soft,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIcon: {
    width: 26, height: 26, borderRadius: D.radius.sm,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },
  grid: { flexDirection: "row", gap: 8 },
  option: {
    flex: 1, alignItems: "center", gap: 6,
    paddingVertical: 12,
    borderRadius: D.radius.lg,
    borderWidth: 1.5,
    backgroundColor: colors.background,
    position: "relative",
  },
  optIcon: {
    width: 36, height: 36, borderRadius: D.radius.md,
    alignItems: "center", justifyContent: "center",
  },
  optLabel: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
  checkDot: {
    position: "absolute", top: 6, right: 6,
    width: 16, height: 16, borderRadius: D.radius.full,
    alignItems: "center", justifyContent: "center",
  },
});

// ─── Manual Item Card ─────────────────────────────────────────────────────────

function ManualItemCard({
  item, index, total, onUpdate, onRemove,
}: {
  item: Partial<SaleItem>;
  index: number;
  total: number;
  onUpdate: (field: keyof SaleItem, value: string | number) => void;
  onRemove: () => void;
}) {
  const itemTotal = (item.unitPrice || 0) * (item.quantity || 1);
  const profit = ((item.unitPrice || 0) - (item.costPrice || 0)) * (item.quantity || 1);
  const hasProfit = (item.costPrice || 0) > 0 && (item.unitPrice || 0) > 0;

  return (
    <View style={[itemCardS.card, { zIndex: total - index }]}>
      {/* Card header */}
      <LinearGradient
        colors={[colors.primary + "10", "transparent"]}
        style={itemCardS.cardHeader}
      >
        <View style={itemCardS.cardHeaderLeft}>
          <View style={[itemCardS.indexBadge, { backgroundColor: colors.primary }]}>
            <Text style={itemCardS.indexText}>{index + 1}</Text>
          </View>
          <Text style={itemCardS.cardTitle} numberOfLines={1}>
            {item.productName?.trim() || `Item ${index + 1}`}
          </Text>
        </View>
        {total > 1 && (
          <TouchableOpacity style={itemCardS.removeBtn} onPress={onRemove}>
            <Ionicons name="trash-outline" size={15} color="#EF4444" />
          </TouchableOpacity>
        )}
      </LinearGradient>

      <View style={itemCardS.body}>
        {/* Product picker */}
        <ProductPickerInput
          value={item.productName ?? ""}
          onChange={(name, stockItem) => {
            onUpdate("productName", name);
            if (stockItem) {
              if (!item.unitPrice || item.unitPrice === 0)
                onUpdate("unitPrice", stockItem.sellingPrice || stockItem.costPrice);
              if (!item.costPrice || item.costPrice === 0)
                onUpdate("costPrice", stockItem.costPrice);
            }
          }}
          placeholder="Product name *"
          inputStyle={[itemCardS.input, { marginBottom: 0 }]}
          containerStyle={{ marginBottom: 8 }}
          colors={colors}
        />

        {/* Qty + Unit Price row */}
        <View style={itemCardS.row}>
          <View style={[itemCardS.fieldWrap, { flex: 1 }]}>
            <Text style={itemCardS.fieldLabel}>Qty</Text>
            <View style={itemCardS.inputWrap}>
              <Ionicons name="layers-outline" size={14} color={colors.textMuted} />
              <TextInput
                style={itemCardS.inputInner}
                placeholder="1"
                placeholderTextColor={colors.textMuted}
                value={item.quantity?.toString()}
                onChangeText={(v) => onUpdate("quantity", parseFloat(v) || 0)}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={[itemCardS.fieldWrap, { flex: 2 }]}>
            <Text style={itemCardS.fieldLabel}>Unit Price *</Text>
            <View style={itemCardS.inputWrap}>
              <Text style={itemCardS.currencyPrefix}>₦</Text>
              <TextInput
                style={itemCardS.inputInner}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                value={item.unitPrice ? item.unitPrice.toString() : ""}
                onChangeText={(v) => onUpdate("unitPrice", parseFloat(v) || 0)}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Cost price */}
        <View style={itemCardS.fieldWrap}>
          <Text style={itemCardS.fieldLabel}>Cost Price (optional)</Text>
          <View style={itemCardS.inputWrap}>
            <Text style={itemCardS.currencyPrefix}>₦</Text>
            <TextInput
              style={itemCardS.inputInner}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              value={item.costPrice ? item.costPrice.toString() : ""}
              onChangeText={(v) => onUpdate("costPrice", parseFloat(v) || 0)}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Total row */}
        <View style={itemCardS.totalRow}>
          <View style={itemCardS.totalLeft}>
            <Text style={itemCardS.totalLabel}>Line Total</Text>
            {hasProfit && (
              <Text style={[itemCardS.profitLabel, { color: profit >= 0 ? "#10B981" : "#EF4444" }]}>
                {profit >= 0 ? "+" : ""}{formatNaira(profit)} profit
              </Text>
            )}
          </View>
          <Text style={itemCardS.totalAmount}>{formatNaira(itemTotal)}</Text>
        </View>
      </View>
    </View>
  );
}

const itemCardS = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: D.radius.xl,
    overflow: "hidden",
    marginBottom: 10,
    ...D.shadow.soft,
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 12,
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  indexBadge: {
    width: 24, height: 24, borderRadius: D.radius.full,
    alignItems: "center", justifyContent: "center",
  },
  indexText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, maxWidth: SCREEN_WIDTH - 140 },
  removeBtn: {
    width: 32, height: 32, borderRadius: D.radius.full,
    backgroundColor: "#FEF2F2",
    alignItems: "center", justifyContent: "center",
  },
  body: { padding: 14, gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  fieldWrap: { gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.background,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: D.radius.md, height: 46, paddingHorizontal: 12,
  },
  inputInner: { flex: 1, fontSize: 14, fontWeight: "500", color: colors.textPrimary, height: 46 },
  input: {
    backgroundColor: colors.background, borderWidth: 1.5,
    borderColor: colors.border, borderRadius: D.radius.md,
    height: 46, paddingHorizontal: 12, fontSize: 14, color: colors.textPrimary,
  },
  currencyPrefix: { fontSize: 14, fontWeight: "700", color: colors.textMuted },
  totalRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary + "0C",
    borderRadius: D.radius.md,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  totalLeft: { gap: 2 },
  totalLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  profitLabel: { fontSize: 11, fontWeight: "600" },
  totalAmount: { fontSize: 18, fontWeight: "900", color: colors.primary, letterSpacing: -0.3 },
});

// ─── Voice Result Card ────────────────────────────────────────────────────────

function VoiceResultCard({
  parsedResult, transcript, onRetry,
}: {
  parsedResult: ParsedResult;
  transcript: string;
  onRetry: () => void;
}) {
  const confidence = Math.round(parsedResult.confidence * 100);
  const confColor = confidence >= 80 ? "#10B981" : confidence >= 60 ? "#F59E0B" : "#EF4444";

  return (
    <View style={voiceS.card}>
      {/* Header */}
      <LinearGradient colors={["#ECFDF5", "#F0FDF4"]} style={voiceS.cardHeader}>
        <View style={voiceS.confRow}>
          <View style={[voiceS.confBadge, { backgroundColor: confColor + "20" }]}>
            <Ionicons name="checkmark-circle" size={14} color={confColor} />
            <Text style={[voiceS.confText, { color: confColor }]}>{confidence}% confident</Text>
          </View>
          <TouchableOpacity onPress={onRetry} style={voiceS.retryBtn}>
            <Ionicons name="refresh-outline" size={14} color={colors.textSecondary} />
            <Text style={voiceS.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>

        {transcript ? (
          <View style={voiceS.transcriptWrap}>
            <Ionicons name="mic" size={12} color={colors.textMuted} />
            <Text style={voiceS.transcriptText} numberOfLines={2}>"{transcript}"</Text>
          </View>
        ) : null}
      </LinearGradient>

      {/* Items */}
      <View style={voiceS.itemsWrap}>
        {parsedResult.items.map((item, i) => (
          <View key={i} style={[voiceS.item, i < parsedResult.items.length - 1 && voiceS.itemBorder]}>
            <View style={voiceS.itemLeft}>
              <View style={[voiceS.itemDot, { backgroundColor: colors.primary }]} />
              <View>
                <Text style={voiceS.itemName}>{item.productName}</Text>
                <Text style={voiceS.itemDetail}>
                  {item.quantity} {item.unit} × {formatNaira(item.unitPrice)}
                </Text>
              </View>
            </View>
            <Text style={voiceS.itemAmount}>{formatNaira(item.totalAmount)}</Text>
          </View>
        ))}
      </View>

      {/* Total */}
      <LinearGradient
        colors={[colors.primary, colors.primary + "DD"]}
        style={voiceS.totalBar}
      >
        <View style={voiceS.totalBarLeft}>
          <Text style={voiceS.totalBarLabel}>Total Amount</Text>
          <Text style={voiceS.totalBarSub}>{parsedResult.items.length} item{parsedResult.items.length !== 1 ? "s" : ""}</Text>
        </View>
        <Text style={voiceS.totalBarAmount}>{formatNaira(parsedResult.totalAmount)}</Text>
      </LinearGradient>

      {/* Clarification */}
      {parsedResult.needsClarification && (
        <View style={voiceS.clarifyWrap}>
          <Ionicons name="warning-outline" size={16} color="#D97706" />
          <Text style={voiceS.clarifyText}>{parsedResult.clarificationQuestion}</Text>
        </View>
      )}
    </View>
  );
}

const voiceS = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: D.radius.xl,
    overflow: "hidden",
    marginBottom: 12,
    ...D.shadow.soft,
  },
  cardHeader: { padding: 14, gap: 10 },
  confRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  confBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: D.radius.full,
  },
  confText: { fontSize: 12, fontWeight: "700" },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: D.radius.full,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
  },
  retryText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  transcriptWrap: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: D.radius.md, paddingHorizontal: 10, paddingVertical: 8,
  },
  transcriptText: {
    flex: 1, fontSize: 13, color: colors.textSecondary,
    fontStyle: "italic", lineHeight: 18,
  },
  itemsWrap: { paddingHorizontal: 14, paddingVertical: 6 },
  item: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  itemDot: { width: 8, height: 8, borderRadius: D.radius.full },
  itemName: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  itemDetail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  itemAmount: { fontSize: 14, fontWeight: "800", color: colors.primary },
  totalBar: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  totalBarLeft: { gap: 2 },
  totalBarLabel: { fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  totalBarSub: { fontSize: 11, color: "rgba(255,255,255,0.6)" },
  totalBarAmount: { fontSize: 22, fontWeight: "900", color: "#fff", letterSpacing: -0.3 },
  clarifyWrap: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FFFBEB", padding: 12,
    borderTopWidth: 1, borderTopColor: "#FDE68A",
  },
  clarifyText: { flex: 1, fontSize: 13, color: "#92400E", lineHeight: 18, fontWeight: "500" },
});

// ─── Parsing State ────────────────────────────────────────────────────────────

function ParsingState() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={parsingS.wrap}>
      <Animated.View style={[parsingS.iconWrap, { opacity: pulse }]}>
        <LinearGradient colors={[colors.primary + "30", colors.primary + "10"]} style={parsingS.iconGrad}>
          <Ionicons name="mic" size={32} color={colors.primary} />
        </LinearGradient>
      </Animated.View>
      <Text style={parsingS.title}>Parsing your sale...</Text>
      <Text style={parsingS.sub}>AI is analysing your voice input</Text>
      <View style={parsingS.dots}>
        {[0, 1, 2].map((i) => (
          <Animated.View key={i} style={[parsingS.dot, { opacity: pulse, backgroundColor: colors.primary }]} />
        ))}
      </View>
    </View>
  );
}

const parsingS = StyleSheet.create({
  wrap: {
    alignItems: "center", paddingVertical: 48, gap: 12,
    backgroundColor: colors.surface,
    borderRadius: D.radius.xl, marginBottom: 12,
    ...D.shadow.soft,
  },
  iconWrap: { marginBottom: 4 },
  iconGrad: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  sub: { fontSize: 13, color: colors.textMuted },
  dots: { flexDirection: "row", gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

// ─── Summary Strip ────────────────────────────────────────────────────────────

function SummaryStrip({ items }: { items: Partial<SaleItem>[] }) {
  const validItems = items.filter((i) => i.productName && (i.unitPrice || 0) > 0);
  const total = validItems.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0);
  const totalProfit = validItems.reduce(
    (s, i) => s + ((i.unitPrice || 0) - (i.costPrice || 0)) * (i.quantity || 1), 0
  );
  const hasProfit = validItems.some((i) => (i.costPrice || 0) > 0);

  if (validItems.length === 0) return null;

  return (
    <LinearGradient
      colors={[colors.primary, colors.primary + "CC"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={stripS.card}
    >
      <View style={stripS.circle1} />
      <View style={stripS.circle2} />

      <View style={stripS.row}>
        <View style={stripS.stat}>
          <Text style={stripS.statLabel}>{validItems.length} Item{validItems.length !== 1 ? "s" : ""}</Text>
          <Text style={stripS.statValue}>{formatNaira(total)}</Text>
        </View>

        {hasProfit && (
          <>
            <View style={stripS.sep} />
            <View style={stripS.stat}>
              <Text style={stripS.statLabel}>Est. Profit</Text>
              <Text style={[stripS.statValue, { color: totalProfit >= 0 ? "#A7F3D0" : "#FCA5A5" }]}>
                {formatNaira(totalProfit)}
              </Text>
            </View>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const stripS = StyleSheet.create({
  card: {
    borderRadius: D.radius.xl, padding: 16,
    marginBottom: 10, overflow: "hidden",
    ...D.shadow.medium,
  },
  circle1: {
    position: "absolute", width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.08)", top: -30, right: -20,
  },
  circle2: {
    position: "absolute", width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: -15, left: 10,
  },
  row: { flexDirection: "row", alignItems: "center" },
  stat: { flex: 1 },
  statLabel: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: "600", marginBottom: 2 },
  statValue: { fontSize: 22, fontWeight: "900", color: "#fff", letterSpacing: -0.3 },
  sep: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.25)", marginHorizontal: 20 },
});

// ─── Action Buttons ───────────────────────────────────────────────────────────

function ActionButtons({
  draftSavedAt,
  onDraft, onSubmit,
  loading, disabled,
}: {
  draftSavedAt: string | null;
  onDraft: () => void;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={actionS.row}>
      {!draftSavedAt ? (
        <TouchableOpacity
          style={[actionS.draftBtn, disabled && { opacity: 0.5 }]}
          onPress={onDraft}
          disabled={disabled}
          activeOpacity={0.75}
        >
          <Ionicons name="bookmark-outline" size={18} color={colors.primary} />
          <Text style={actionS.draftText}>Save Draft</Text>
        </TouchableOpacity>
      ) : null}

      <Pressable
        onPress={onSubmit}
        disabled={loading || disabled}
        style={[actionS.submitWrap, !draftSavedAt && { flex: 2 }]}
      >
        <LinearGradient
          colors={loading ? [colors.textMuted, colors.textMuted] : [colors.primary, colors.primary + "DD"]}
          style={actionS.submitGrad}
        >
          <Ionicons
            name={loading ? "hourglass-outline" : "checkmark-circle-outline"}
            size={20} color="#fff"
          />
          <Text style={actionS.submitText}>
            {loading ? "Recording..." : draftSavedAt ? "Submit Sale" : "Submit"}
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const actionS = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, marginBottom: 16 },
  draftBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: D.radius.xl, paddingVertical: 14,
    backgroundColor: colors.primary + "08",
  },
  draftText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  submitWrap: { flex: 3, borderRadius: D.radius.xl, overflow: "hidden" },
  submitGrad: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8, paddingVertical: 16,
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

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
  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<UpgradeFeature>("sales");
  const [upgradeUsed, setUpgradeUsed] = useState(0);
  const [upgradeLimit, setUpgradeLimit] = useState(0);

  const planId = user?.subscription?.plan ?? "free";
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

  // ── Stock overflow check ───────────────────────────────────────────────────

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
      "Low Stock Alert",
      `"${overflow.productName}" has ${overflow.available} ${overflow.unit}${overflow.available !== 1 ? "s" : ""} available but you entered ${overflow.entered}.`,
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
      await recordSaleUsage(user._id);
      if (customerName.trim()) saveCustomerName(user._id, customerName.trim());
      if (draftKey) await draftStorage.clear(draftKey);
      setDraftSavedAt(null); setTranscript(""); setParsedResult(null);
      setCustomerName(""); setSaleDate(new Date());
      Alert.alert("✅ Recorded!", "Sale has been saved successfully.");
    } catch (err) {
      Alert.alert("Save Failed", saveErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitVoice = async () => {
    if (!parsedResult || !user) return;
    if (!customerName.trim()) { Alert.alert("", "Customer name is required."); return; }
    const limitCheck = await checkSalesLimit(user._id, planId);
    if (!limitCheck.allowed) {
      setUpgradeFeature("sales"); setUpgradeUsed(limitCheck.used); setUpgradeLimit(limitCheck.limit);
      setUpgradeVisible(true); return;
    }
    const overflow = findStockOverflow(
      parsedResult.items.map((i) => ({ productName: i.productName, quantity: i.quantity } as Partial<SaleItem>))
    );
    if (overflow) { showOverflowDialog(overflow, doSubmitVoice); return; }
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
      await recordSaleUsage(user._id);
      if (draftKey) await draftStorage.clear(draftKey);
      setDraftSavedAt(null); setManualItems([emptyItem()]);
      setCustomerName(""); setSaleDate(new Date());
      Alert.alert("✅ Recorded!", "Sale has been saved successfully.");
    } catch (err) {
      Alert.alert("Save Failed", saveErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitManual = async () => {
    if (!user) return;
    const validItems = manualItems.filter((i) => i.productName && i.unitPrice && i.unitPrice > 0);
    if (!validItems.length) {
      Alert.alert("", "Add at least one item with product name and price.");
      return;
    }
    if (!customerName.trim()) { Alert.alert("", "Customer name is required."); return; }
    const limitCheck = await checkSalesLimit(user._id, planId);
    if (!limitCheck.allowed) {
      setUpgradeFeature("sales"); setUpgradeUsed(limitCheck.used); setUpgradeLimit(limitCheck.limit);
      setUpgradeVisible(true); return;
    }
    const overflow = findStockOverflow(validItems);
    if (overflow) { showOverflowDialog(overflow, () => doSubmitManual(validItems)); return; }
    doSubmitManual(validItems);
  };

  const updateManualItem = (index: number, field: keyof SaleItem, value: string | number) => {
    setManualItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      <AppStatusBar />
      <OfflineBanner />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

        {/* ── Hero Header ──────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[colors.primary + "14", colors.background]}
          style={screenS.heroGrad}
        >
          <View style={screenS.headerRow}>
            <View>
              <Text style={screenS.headerSup}>New Entry</Text>
              <Text style={screenS.headerTitle}>Record Sale</Text>
            </View>
            <View style={[screenS.headerBadge, { backgroundColor: colors.surface }, D.shadow.soft]}>
              <Ionicons name="storefront-outline" size={18} color={colors.primary} />
            </View>
          </View>

          <ModeToggle
            mode={mode}
            onChange={(m) => {
              if (m === "voice" && !checkVoiceAccess(planId)) {
                setUpgradeFeature("voice");
                setUpgradeVisible(true);
                return;
              }
              setMode(m);
              if (m === "voice") { setParsedResult(null); setTranscript(""); }
            }}
          />
        </LinearGradient>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={screenS.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Voice Mode ── */}
          {mode === "voice" && (
            <>
              {!parsedResult && !isParsing && (
                <VoiceInput
                  onTranscript={handleTranscript}
                  hint={"Speak your sale naturally\ne.g. \"I sell 5 bags rice 45k each\""}
                />
              )}

              {isParsing && <ParsingState />}

              {parsedResult && !isParsing && (
                <>
                  <VoiceResultCard
                    parsedResult={parsedResult}
                    transcript={transcript}
                    onRetry={() => { setParsedResult(null); setTranscript(""); }}
                  />

                  <SaleDetailsBox
                    userId={user?._id ?? ""}
                    customerName={customerName}
                    onCustomerChange={setCustomerName}
                    saleDate={saleDate}
                    onDatePress={() => setShowDatePicker(true)}
                  />

                  {draftSavedAt && <DraftBanner savedAt={draftSavedAt} onDiscard={handleDiscard} />}

                  <ActionButtons
                    draftSavedAt={draftSavedAt}
                    onDraft={handleSaveDraftVoice}
                    onSubmit={handleSubmitVoice}
                    loading={isSaving}
                  />
                </>
              )}
            </>
          )}

          {/* ── Manual Mode ── */}
          {mode === "manual" && (
            <>
              {draftSavedAt && <DraftBanner savedAt={draftSavedAt} onDiscard={handleDiscard} />}

              <SaleDetailsBox
                userId={user?._id ?? ""}
                customerName={customerName}
                onCustomerChange={setCustomerName}
                saleDate={saleDate}
                onDatePress={() => setShowDatePicker(true)}
              />

              {/* Item cards */}
              {manualItems.map((item, index) => (
                <ManualItemCard
                  key={index}
                  item={item}
                  index={index}
                  total={manualItems.length}
                  onUpdate={(field, value) => updateManualItem(index, field, value)}
                  onRemove={() => setManualItems((p) => p.filter((_, i) => i !== index))}
                />
              ))}

              {/* Live summary strip */}
              <SummaryStrip items={manualItems} />

              {/* Add item button */}
              <TouchableOpacity
                style={[screenS.addItemBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "08" }]}
                onPress={() => setManualItems((p) => [...p, emptyItem()])}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={[screenS.addItemText, { color: colors.primary }]}>Add Another Item</Text>
              </TouchableOpacity>

              {/* Payment method */}
              <PaymentSelector value={paymentType} onChange={setPaymentType} />

              {/* Actions */}
              <ActionButtons
                draftSavedAt={draftSavedAt}
                onDraft={handleSaveDraftManual}
                onSubmit={handleSubmitManual}
                loading={isSaving}
              />
            </>
          )}

          <View style={{ height: 40 }} />
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

      <UpgradePromptModal
        visible={upgradeVisible}
        onClose={() => setUpgradeVisible(false)}
        feature={upgradeFeature}
        used={upgradeUsed}
        limit={upgradeLimit}
      />
    </SafeAreaView>
  );
}

const screenS = StyleSheet.create({
  heroGrad: { paddingBottom: 16 },
  headerRow: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 12, marginBottom: 14,
  },
  headerSup: {
    fontSize: 11, fontWeight: "700", color: colors.textMuted,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2,
  },
  headerTitle: { fontSize: 24, fontWeight: "900", color: colors.textPrimary, letterSpacing: -0.4 },
  headerBadge: {
    width: 44, height: 44, borderRadius: D.radius.full,
    alignItems: "center", justifyContent: "center",
  },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  addItemBtn: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    height: 50, borderRadius: D.radius.xl,
    borderWidth: 1.5, marginBottom: 10,
  },
  addItemText: { fontSize: 14, fontWeight: "700" },
});