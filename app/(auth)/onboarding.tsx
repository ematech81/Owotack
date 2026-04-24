import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  ListRenderItem,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../../src/components/common/Button";
import { useAuthStore } from "../../src/store/authStore";
import { colors } from "../../src/constants/colors";

const { width } = Dimensions.get("window");

interface Slide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  bg: string;
}

const SLIDES: Slide[] = [
  {
    id: "1",
    icon: "cash-outline",
    title: "Know How Your Money Dey Move",
    subtitle: "Record every sale, expense, and credit in seconds — by voice or typing.",
    bg: colors.primary,
  },
  {
    id: "2",
    icon: "mic-outline",
    title: "Talk Am, We Go Record Am",
    subtitle: 'Just say "I sell 10 bags of rice 45k each" and OwoTrack go handle the rest.',
    bg: "#2D6A4F",
  },
  {
    id: "3",
    icon: "people-outline",
    title: "Chase Your Debtors Easy",
    subtitle: "Track who owes you and send WhatsApp reminder with one tap.",
    bg: "#1B4332",
  },
  {
    id: "4",
    icon: "analytics-outline",
    title: "See Your Business Report",
    subtitle: "Get daily, weekly, and monthly reports. Download PDF for bank or loan applications.",
    bg: "#081C15",
  },
];

export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);
  const { completeOnboarding } = useAuthStore();

  const goToPhone = async () => {
    await completeOnboarding();
    router.push("/(auth)/phone");
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
      setActiveIndex(activeIndex + 1);
    } else {
      goToPhone();
    }
  };

  const renderItem: ListRenderItem<Slide> = ({ item }) => (
    <View style={[styles.slide, { backgroundColor: item.bg, width }]}>
      <View style={styles.iconContainer}>
        <Ionicons name={item.icon} size={80} color="rgba(255,255,255,0.9)" />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <TouchableOpacity style={styles.skipBtn} onPress={goToPhone}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>

        <Button
          title={activeIndex === SLIDES.length - 1 ? "Start Now" : "Next"}
          onPress={handleNext}
          style={styles.btn}
          textStyle={{ color: colors.primary }}
        />

        {activeIndex === SLIDES.length - 1 && (
          <TouchableOpacity onPress={() => router.push("/(auth)/login")} style={styles.loginLink}>
            <Text style={styles.loginText}>I get account already</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  skipBtn: { position: "absolute", top: 50, right: 20, zIndex: 10 },
  skipText: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 120,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.white,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 24,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  dots: { flexDirection: "row", gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { width: 24, backgroundColor: colors.white },
  btn: { width: "100%", backgroundColor: colors.white },
  loginLink: { marginTop: 16 },
  loginText: { color: "rgba(255,255,255,0.8)", fontSize: 14, textDecorationLine: "underline" },
});
