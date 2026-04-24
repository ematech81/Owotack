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
    onToken: (token: string) => void,
    signal?: AbortSignal
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
      signal,
    });

    if (!response.ok) {
      let errMsg = "Stream request failed";
      try { errMsg = (await response.json())?.message || errMsg; } catch { /* ignore */ }
      throw new Error(errMsg);
    }

    // React Native / Hermes does not expose response.body as a ReadableStream.
    // Fall back to reading the full SSE text at once and replaying the tokens.
    if (!response.body) {
      const text = await response.text();
      for (const line of text.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(line.slice(6)); } catch { continue; }
        // Server-side errors must propagate — never silently drop them
        if (parsed.error) throw new Error(parsed.error as string);
        if (parsed.token) onToken(parsed.token as string);
      }
      return;
    }

    // Full streaming path (environments that expose ReadableStream).
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
        let parsed: Record<string, unknown>;
        try { parsed = JSON.parse(line.slice(6)); } catch { continue; }
        if (parsed.error) throw new Error(parsed.error as string);
        if (parsed.done) return;
        if (parsed.token) onToken(parsed.token as string);
      }
    }
  },

  async transcribeVoice(uri: string, signal?: AbortSignal): Promise<string> {
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
      signal,
    });

    const json = await response.json();
    if (!response.ok) throw new Error(json?.message || "Transcription failed");
    const transcript: string = json?.data?.transcript ?? "";
    if (!transcript.trim()) throw new Error("No audio recorded");
    return transcript;
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

export async function stopAndTranscribe(
  recording: Audio.Recording,
  signal?: AbortSignal
): Promise<string> {
  await recording.stopAndUnloadAsync();
  // Restore normal audio mode so playback works after recording
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  const uri = recording.getURI();
  if (!uri) throw new Error("No audio");
  return aiService.transcribeVoice(uri, signal);
}
