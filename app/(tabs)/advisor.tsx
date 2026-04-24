import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useAuthStore } from "../../src/store/authStore";
import { aiService, AdvisorCard, ChatMessage, startRecording, stopAndTranscribe } from "../../src/services/aiService";
import { useTheme } from "../../src/hooks/useTheme";
import { AppStatusBar } from "../../src/components/common/AppStatusBar";
import { chatErrorMessage, voiceErrorMessage } from "../../src/utils/errorMessages";
import { checkAIAccess } from "../../src/utils/usageLimits";
import { UpgradePromptModal } from "../../src/components/common/UpgradePromptModal";

type RecState = "idle" | "recording" | "processing";

interface Message {
  id: string;
  role: "ai" | "user";
  content: string;
  card?: AdvisorCard;
  timestamp: Date;
}

const SUGGESTED = [
  "Why did my profit drop?",
  "How is my business doing?",
  "Should I take a loan?",
  "Which product is best?",
];

const timeStr = (d: Date) =>
  d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

// ── Tracker / Alert card embedded in chat ───────────────────────────────────
function AdvisorCardView({ card, colors }: { card: AdvisorCard; colors: ReturnType<typeof useTheme> }) {
  const isPositive = card.positive !== false;
  return (
    <View style={[cardStyles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[cardStyles.title, { color: colors.textPrimary }]}>
        {card.title} {card.type === "tracker" ? "📊" : card.type === "alert" ? "⚠️" : "💡"}
      </Text>
      <Text style={[cardStyles.subtitle, { color: colors.textSecondary }]}>{card.subtitle}</Text>
      <View style={[cardStyles.valueBox, { backgroundColor: colors.background }]}>
        <Text style={[cardStyles.value, { color: isPositive ? "#16A34A" : "#DC2626" }]}>
          {card.value}
        </Text>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  wrap: {
    borderRadius: 16, padding: 16, marginTop: 10,
    borderWidth: 1, shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  title: { fontSize: 15, fontWeight: "700", marginBottom: 6 },
  subtitle: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  valueBox: { borderRadius: 12, padding: 16, alignItems: "center" },
  value: { fontSize: 28, fontWeight: "800" },
});

// ── Main screen ──────────────────────────────────────────────────────────────
export default function AdvisorScreen() {
  const colors = useTheme();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [recState, setRecState] = useState<RecState>("idle");
  const [greetingLoaded, setGreetingLoaded] = useState(false);
  const [upgradeVisible, setUpgradeVisible] = useState(false);

  const planId = user?.subscription?.plan ?? "free";
  const hasAIAccess = checkAIAccess(planId);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const streamAbortRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef(false);

  // Pulse animation for recording
  useEffect(() => {
    if (recState === "recording") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [recState]);

  // Cancel any in-flight stream and release recording on unmount
  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  // Load greeting on mount
  useEffect(() => {
    if (greetingLoaded) return;
    setGreetingLoaded(true);
    setIsTyping(true);
    aiService.getGreeting()
      .then((res) => {
        addAiMessage(res.message, res.card);
      })
      .catch(() => {
        addAiMessage(`Hello ${user?.name?.split(" ")[0] ?? "there"}! How can I help your business today?`);
      })
      .finally(() => setIsTyping(false));
  }, []);

  const addAiMessage = useCallback((content: string, card?: AdvisorCard) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "ai", content, card, timestamp: new Date() },
    ]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const addUserMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content, timestamp: new Date() },
    ]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const buildHistory = (): ChatMessage[] =>
    messages.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSendingRef.current) return;
    if (!hasAIAccess) { setUpgradeVisible(true); return; }
    isSendingRef.current = true;

    // Cancel any previous stream before starting a new one
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    // Timeout: abort the stream after 45s if no response
    const timeoutId = setTimeout(() => controller.abort(), 45_000);

    setInput("");
    addUserMessage(trimmed);

    const msgId = Date.now().toString();
    setIsTyping(true);
    try {
      let firstToken = true;
      await aiService.chatStream(trimmed, buildHistory(), (token) => {
        if (firstToken) {
          firstToken = false;
          setIsTyping(false);
          setStreamingId(msgId);
          setMessages((prev) => [
            ...prev,
            { id: msgId, role: "ai", content: token, timestamp: new Date() },
          ]);
        } else {
          setMessages((prev) =>
            prev.map((m) => m.id === msgId ? { ...m, content: m.content + token } : m)
          );
        }
        scrollRef.current?.scrollToEnd({ animated: false });
      }, controller.signal);
    } catch (err: unknown) {
      setIsTyping(false);
      // Ignore aborts from unmount/cancel — don't show an error to the user
      if (err instanceof Error && err.name === "AbortError") return;
      addAiMessage(chatErrorMessage(err));
    } finally {
      clearTimeout(timeoutId);
      setIsTyping(false);
      setStreamingId(null);
      isSendingRef.current = false;
    }
  };

  const handleMic = async () => {
    if (recState === "idle") {
      try {
        // Start recording first — only update state on success
        const recording = await startRecording();
        recordingRef.current = recording;
        setRecState("recording");
      } catch (err) {
        // Permission denied or hardware error — stay idle and show error in chat
        addAiMessage(voiceErrorMessage(err) + " You can type your question instead.");
        setRecState("idle");
      }
    } else if (recState === "recording" && recordingRef.current) {
      setRecState("processing");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      try {
        const transcript = await stopAndTranscribe(recordingRef.current, controller.signal);
        recordingRef.current = null;
        if (transcript) await sendMessage(transcript);
      } catch (err: unknown) {
        recordingRef.current = null;
        if (err instanceof Error && err.name === "AbortError") {
          addAiMessage("Voice transcription timed out. Please check your connection and try again.");
        } else {
          addAiMessage(voiceErrorMessage(err) + " You can type your question instead.");
        }
      } finally {
        clearTimeout(timeoutId);
        setRecState("idle");
      }
    }
  };

  const styles = makeStyles(colors);
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const initials = (user?.name ?? "AI")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={styles.safe}>
      <AppStatusBar />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarText}>AI</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>OwoTrack Business AI</Text>
            <Text style={styles.headerSub}>Your Business Coach ✨</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.menuBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        {/* Chat messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {/* AI Companion label */}
          {messages.length > 0 && (
            <View style={styles.senderLabel}>
              <Text style={styles.senderName}>OWOTRACK AI</Text>
              <Text style={styles.senderTime}>{timeStr(messages[0].timestamp)}</Text>
            </View>
          )}

          {messages.map((msg, idx) => (
            <View key={msg.id}>
              {/* Show sender label when role changes */}
              {idx > 0 && msg.role !== messages[idx - 1].role && (
                <View style={[styles.senderLabel, msg.role === "user" && { alignSelf: "flex-end" }]}>
                  {msg.role === "user" ? (
                    <Text style={[styles.senderName, { color: colors.primary }]}>{firstName.toUpperCase()}</Text>
                  ) : (
                    <Text style={styles.senderName}>OWOTRACK AI</Text>
                  )}
                  <Text style={styles.senderTime}>{timeStr(msg.timestamp)}</Text>
                </View>
              )}

              {msg.role === "ai" ? (
                <View style={styles.aiBubbleWrap}>
                  <View style={[styles.aiBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.aiBubbleAccent, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.aiBubbleText, { color: colors.textPrimary }]}>
                      {msg.content}
                      {streamingId === msg.id ? (
                        <Text style={{ color: colors.primary }}>▌</Text>
                      ) : null}
                    </Text>
                  </View>
                  {msg.card && <AdvisorCardView card={msg.card} colors={colors} />}
                </View>
              ) : (
                <View style={[styles.userBubble, { backgroundColor: colors.primary }]}>
                  <Text style={styles.userBubbleText}>{msg.content}</Text>
                </View>
              )}
            </View>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <View style={styles.aiBubbleWrap}>
              <View style={[styles.aiBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.aiBubbleAccent, { backgroundColor: colors.primary }]} />
                <View style={styles.typingDots}>
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: colors.textMuted }]} />
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Suggested questions + tips — show when only greeting loaded */}
          {messages.length <= 1 && !isTyping && (
            <View style={styles.suggestedSection}>
              <Text style={styles.suggestedLabel}>Suggested for you</Text>
              <View style={styles.suggestedList}>
                {SUGGESTED.map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => sendMessage(q)}
                  >
                    <Text style={[styles.chipText, { color: colors.textPrimary }]}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.tipsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.tipsTitle, { color: colors.textMuted }]}>💬 Tips for better answers</Text>
                {[
                  "Be specific — mention product names, amounts, or dates.",
                  "Include a timeframe, e.g. \"last week\" or \"this month\".",
                  "Ask one question at a time for clearer insights.",
                ].map((tip) => (
                  <Text key={tip} style={[styles.tipItem, { color: colors.textSecondary }]}>
                    · {tip}
                  </Text>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input bar — locked for free plan */}
        {!hasAIAccess ? (
          <TouchableOpacity
            style={[styles.lockedBar, { backgroundColor: "#7C3AED" + "18", borderTopColor: "#7C3AED" + "30" }]}
            onPress={() => setUpgradeVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="lock-closed" size={16} color="#7C3AED" />
            <Text style={[styles.lockedText, { color: "#7C3AED" }]}>
              AI Advisor is a paid feature — Tap to unlock
            </Text>
            <Ionicons name="arrow-forward" size={14} color="#7C3AED" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <TouchableOpacity style={styles.addBtn}>
              <Ionicons name="add-circle-outline" size={26} color={colors.textMuted} />
            </TouchableOpacity>

            <TextInput
              style={[styles.textInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
              value={input}
              onChangeText={setInput}
              placeholder="Ask your business coach..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              onSubmitEditing={() => sendMessage(input)}
            />

            {/* Mic button */}
            <TouchableOpacity
              style={[styles.micBtn, recState === "recording" && styles.micBtnActive]}
              onPress={handleMic}
              disabled={recState === "processing" || isTyping}
            >
              {recState === "processing" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Animated.View style={{ transform: [{ scale: recState === "recording" ? pulseAnim : 1 }] }}>
                  <Ionicons
                    name={recState === "recording" ? "stop" : "mic"}
                    size={20}
                    color="#fff"
                  />
                </Animated.View>
              )}
            </TouchableOpacity>

            {/* Send button */}
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : colors.border }]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || isTyping}
            >
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      <UpgradePromptModal
        visible={upgradeVisible}
        onClose={() => setUpgradeVisible(false)}
        feature="ai"
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 20, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    aiAvatar: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: "#1A1A2E",
      alignItems: "center", justifyContent: "center",
    },
    aiAvatarText: { color: "#4ADE80", fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
    headerTitle: { fontSize: 17, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.3 },
    headerSub: { fontSize: 12, fontWeight: "600", color: colors.primary, marginTop: 1 },
    menuBtn: { padding: 8 },

    chatArea: { flex: 1 },
    chatContent: { padding: 16, paddingBottom: 8, gap: 4 },

    senderLabel: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 4 },
    senderName: { fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 1 },
    senderTime: { fontSize: 11, color: colors.textMuted },

    aiBubbleWrap: { marginBottom: 8 },
    aiBubble: {
      borderRadius: 16, borderTopLeftRadius: 4,
      borderWidth: 1, flexDirection: "row",
      overflow: "hidden",
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
    },
    aiBubbleAccent: { width: 4 },
    aiBubbleText: { flex: 1, fontSize: 14, lineHeight: 22, padding: 14, paddingLeft: 12 },

    userBubble: {
      alignSelf: "flex-end", maxWidth: "80%",
      borderRadius: 16, borderBottomRightRadius: 4,
      padding: 14, marginBottom: 8,
    },
    userBubbleText: { color: "#fff", fontSize: 14, lineHeight: 22 },

    typingDots: { flexDirection: "row", alignItems: "center", gap: 5, padding: 14, paddingLeft: 12 },
    dot: { width: 8, height: 8, borderRadius: 4 },

    suggestedSection: { marginTop: 20 },
    suggestedLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "600", marginBottom: 10 },
    suggestedList: { gap: 8 },
    chip: {
      borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
      borderWidth: 1, alignSelf: "flex-start",
    },
    chipText: { fontSize: 14 },

    tipsBox: {
      marginTop: 20, borderRadius: 12, padding: 14,
      borderWidth: 1, gap: 6,
    },
    tipsTitle: { fontSize: 12, fontWeight: "700", marginBottom: 4, letterSpacing: 0.3 },
    tipItem: { fontSize: 12, lineHeight: 18 },

    lockedBar: {
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 20, paddingVertical: 16,
      borderTopWidth: 1,
    },
    lockedText: { flex: 1, fontSize: 13, fontWeight: "600" },
    inputBar: {
      flexDirection: "row", alignItems: "flex-end", gap: 8,
      paddingHorizontal: 12, paddingVertical: 10,
      borderTopWidth: 1,
    },
    addBtn: { paddingBottom: 6 },
    textInput: {
      flex: 1, borderRadius: 22, borderWidth: 1,
      paddingHorizontal: 16, paddingVertical: 10,
      fontSize: 14, maxHeight: 100, minHeight: 42,
    },
    micBtn: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: "#F59E0B",
      alignItems: "center", justifyContent: "center",
    },
    micBtnActive: { backgroundColor: "#DC2626" },
    sendBtn: {
      width: 42, height: 42, borderRadius: 21,
      alignItems: "center", justifyContent: "center",
    },
  });
