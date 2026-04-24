import api from "./api";
import { ApiResponse } from "../types";
import * as SecureStore from "expo-secure-store";
import { ApiIPAddress } from "../utils/config";
import { Audio } from "expo-av";

// Module-level tip cache — avoids calling OpenAI on every home screen focus
let _tipCache: { message: string; expiresAt: number } | null = null;

export interface AdvisorCard {
  type: "tracker" | "alert" | "tip";
  title: string;
  subtitle: string;
  value: string;
  positive?: boolean;
}

export interface AdvisorResponse {
  message: string;
  card?: AdvisorCard;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const aiService = {
  async getTip(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && _tipCache && _tipCache.expiresAt > now) {
      return _tipCache.message;
    }
    const res = await api.get<ApiResponse<AdvisorResponse>>("/advisor/tip");
    const message = res.data.data.message;
    _tipCache = { message, expiresAt: now + 5 * 60 * 1000 };
    return message;
  },

  async getGreeting(): Promise<AdvisorResponse> {
    const res = await api.get<ApiResponse<AdvisorResponse>>("/advisor/greeting");
    return res.data.data;
  },

  async chat(message: string, history: ChatMessage[]): Promise<AdvisorResponse> {
    const res = await api.post<ApiResponse<AdvisorResponse>>("/advisor/chat", { message, history });
    return res.data.data;
  },

  async chatStream(
    message: string,
    history: ChatMessage[],
    onToken: (token: string) => void
  ): Promise<void> {
    const token = await SecureStore.getItemAsync("accessToken");
    const appKey = process.env.EXPO_PUBLIC_APP_KEY ?? "";

    const response = await fetch(`${ApiIPAddress}/advisor/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-app-key": appKey,
      },
      body: JSON.stringify({ message, history }),
    });

    if (!response.ok) throw new Error("Stream request failed");

    // React Native / Hermes does not expose response.body as a ReadableStream.
    // Fall back to reading the full SSE text at once and replaying the tokens.
    if (!response.body) {
      const text = await response.text();
      for (const line of text.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.token) onToken(parsed.token);
        } catch { /* malformed line — skip */ }
      }
      return;
    }

    // Full streaming path (browser / environments that expose ReadableStream).
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.done) return;
          if (parsed.token) onToken(parsed.token);
        } catch { /* malformed chunk — skip */ }
      }
    }
  },

  async transcribeVoice(uri: string): Promise<string> {
    const token = await SecureStore.getItemAsync("accessToken");
    const appKey = process.env.EXPO_PUBLIC_APP_KEY ?? "";

    const formData = new FormData();
    formData.append("audio", { uri, type: "audio/m4a", name: "recording.m4a" } as never);

    const response = await fetch(`${ApiIPAddress}/voice/transcribe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-app-key": appKey,
      },
      body: formData,
    });

    const json = await response.json();
    if (!response.ok) throw new Error(json?.message || "Transcription failed");
    return json.data.transcript as string;
  },
};

// Inline voice recording helpers used by the advisor screen
export type RecordingState = "idle" | "recording" | "processing";

export async function startRecording(): Promise<Audio.Recording> {
  const { granted } = await Audio.requestPermissionsAsync();
  if (!granted) throw new Error("Microphone permission denied");
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  return recording;
}

export async function stopAndTranscribe(recording: Audio.Recording): Promise<string> {
  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  if (!uri) throw new Error("No audio");
  return aiService.transcribeVoice(uri);
}
