import api from "./api";

export interface IUserNotification {
  _id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export const inAppNotificationService = {
  async list(): Promise<{ notifications: IUserNotification[]; unreadCount: number }> {
    const res = await api.get<{ success: boolean; data: { notifications: IUserNotification[]; unreadCount: number } }>(
      "/notifications"
    );
    return res.data.data;
  },

  async unreadCount(): Promise<number> {
    const res = await api.get<{ success: boolean; data: { count: number } }>("/notifications/unread-count");
    return res.data.data.count;
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await api.patch("/notifications/read-all");
  },
};
