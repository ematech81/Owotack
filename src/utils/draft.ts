import AsyncStorage from "@react-native-async-storage/async-storage";

export interface StoredDraft<T> {
  data: T;
  savedAt: string;
}

export const draftStorage = {
  async load<T>(key: string): Promise<StoredDraft<T> | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as StoredDraft<T>) : null;
    } catch {
      return null;
    }
  },

  async save<T>(key: string, data: T): Promise<string> {
    const savedAt = new Date().toISOString();
    await AsyncStorage.setItem(key, JSON.stringify({ data, savedAt }));
    return savedAt;
  },

  async clear(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

export function formatDraftAge(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
