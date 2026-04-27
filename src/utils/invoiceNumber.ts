import AsyncStorage from "@react-native-async-storage/async-storage";

export async function generateInvoiceNumber(userId: string): Promise<string> {
  const year = new Date().getFullYear();
  const key = `invoice_counter:${userId}:${year}`;
  const current = parseInt((await AsyncStorage.getItem(key)) ?? "0", 10);
  const next = current + 1;
  await AsyncStorage.setItem(key, String(next));
  return `INV-${year}-${String(next).padStart(4, "0")}`;
}
