import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated,
} from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { ApiIPAddress } from "../../utils/config";
import { useTheme } from "../../hooks/useTheme";
import { voiceErrorMessage } from "../../utils/errorMessages";

const RECORDING_TIPS = [
  "Speak clearly and at a steady pace.",
  "Be in a quiet environment for best results.",
  "Avoid background noise while recording.",
];

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  hint?: string;
}

type State = "idle" | "recording" | "processing";

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscript,
  hint = 'e.g. "I sell 5 bags rice 45k each"',
}) => {
  const colors = useTheme();
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const [showTips, setShowTips] = useState(true);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === "recording") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [state]);

  const startRecording = async () => {
    setError("");
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError("Microphone access is needed to record. Please enable it in your phone settings.");
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setShowTips(false);
      setState("recording");
    } catch (err) {
      setError(voiceErrorMessage(err));
    }
  };

  const stopAndTranscribe = async () => {
    if (!recordingRef.current) return;
    setState("processing");
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("No audio recorded");

      const token = await SecureStore.getItemAsync("accessToken");
      const appKey = process.env.EXPO_PUBLIC_APP_KEY ?? "";

      const formData = new FormData();
      formData.append("audio", { uri, type: "audio/m4a", name: "recording.m4a" } as never);

      const response = await fetch(`${ApiIPAddress}/voice/transcribe`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-app-key": appKey,
        },
        body: formData,
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json?.message || "Transcription failed");
      onTranscript(json.data.transcript);
    } catch (err) {
      setError(voiceErrorMessage(err));
    } finally {
      setState("idle");
    }
  };

  const handlePress = () => {
    if (state === "idle") startRecording();
    else if (state === "recording") stopAndTranscribe();
  };

  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>{hint}</Text>

      {/* Recording tips — shown when idle, hidden once recording starts */}
      {showTips && state === "idle" && (
        <View style={[styles.tipsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.tipsHeader}
            onPress={() => setShowTips((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.tipsTitle, { color: colors.textMuted }]}>Tips for best results</Text>
            <Ionicons name="chevron-up" size={14} color={colors.textMuted} />
          </TouchableOpacity>
          {RECORDING_TIPS.map((tip) => (
            <Text key={tip} style={[styles.tipItem, { color: colors.textSecondary }]}>
              · {tip}
            </Text>
          ))}
        </View>
      )}

      {!showTips && state === "idle" && (
        <TouchableOpacity
          style={styles.tipsToggle}
          onPress={() => setShowTips(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.tipsToggleText, { color: colors.textMuted }]}>Show recording tips</Text>
        </TouchableOpacity>
      )}

      <View style={styles.micWrapper}>
        <Animated.View style={[styles.pulse, { transform: [{ scale: pulseAnim }] }]} />
        <TouchableOpacity
          style={[styles.micBtn, state === "recording" && styles.micBtnActive]}
          onPress={handlePress}
          disabled={state === "processing"}
          activeOpacity={0.8}
        >
          {state === "processing" ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <Ionicons
              name={state === "recording" ? "stop" : "mic"}
              size={36}
              color="#fff"
            />
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.statusText}>
        {state === "idle" && "Tap mic to speak"}
        {state === "recording" && "Recording... tap to stop"}
        {state === "processing" && "Processing your voice..."}
      </Text>

      {error ? (
        <View style={[styles.errorBox, { borderColor: colors.danger + "40", backgroundColor: colors.danger + "10" }]}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: { alignItems: "center", paddingVertical: 24 },
    hint: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 32,
      textAlign: "center",
      lineHeight: 20,
      fontStyle: "italic",
    },
    micWrapper: { alignItems: "center", justifyContent: "center", marginBottom: 16 },
    pulse: {
      position: "absolute",
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.primary + "30",
    },
    micBtn: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      elevation: 4,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    micBtnActive: { backgroundColor: colors.danger },
    statusText: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },

    tipsBox: {
      width: "100%", borderRadius: 12, borderWidth: 1,
      padding: 12, marginBottom: 20, gap: 4,
    },
    tipsHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
    tipsTitle: { flex: 1, fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
    tipItem: { fontSize: 12, lineHeight: 18, paddingLeft: 4 },
    tipsToggle: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 16 },
    tipsToggleText: { fontSize: 11 },

    errorBox: {
      flexDirection: "row", alignItems: "flex-start", gap: 6,
      borderWidth: 1, borderRadius: 10,
      padding: 10, marginTop: 14, maxWidth: "90%",
    },
    error: { flex: 1, fontSize: 13, lineHeight: 18 },
  });
