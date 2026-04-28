import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";
import { ApiResponse } from "../types";

export interface IBroadcast {
  _id: string;
  title: string;
  content: string;
  createdAt: string;
}

const DISMISSED_KEY = "dismissed_broadcasts";

export const broadcastService = {
  async fetch(): Promise<IBroadcast[]> {
    const res = await api.get<ApiResponse<IBroadcast[]>>("/broadcasts");
    return res.data.data ?? [];
  },

  async getDismissed(): Promise<string[]> {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    return raw ? JSON.parse(raw) : [];
  },

  async dismiss(id: string): Promise<void> {
    const current = await broadcastService.getDismissed();
    if (!current.includes(id)) {
      await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify([...current, id]));
    }
  },

  async getVisible(): Promise<IBroadcast[]> {
    const [broadcasts, dismissed] = await Promise.all([
      broadcastService.fetch(),
      broadcastService.getDismissed(),
    ]);
    return broadcasts.filter((b) => !dismissed.includes(b._id));
  },
};
