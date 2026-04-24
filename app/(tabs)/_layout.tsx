import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/hooks/useTheme";
import { useAuthStore } from "../../src/store/authStore";
import { useUIStore } from "../../src/store/uiStore";

type IoniconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  index:   { active: "home",      inactive: "home-outline"      },
  sales:   { active: "cart",      inactive: "cart-outline"      },
  stock:   { active: "cube",      inactive: "cube-outline"      },
  reports: { active: "bar-chart", inactive: "bar-chart-outline" },
  profile: { active: "person",    inactive: "person-outline"    },
};

export default function TabLayout() {
  const { isAuthenticated } = useAuthStore();
  const { pendingCount, isSyncing } = useUIStore();
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  if (!isAuthenticated) return <Redirect href="/(auth)/onboarding" />;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const name = focused ? icons?.active : icons?.inactive;
          return <Ionicons name={name || "ellipse-outline"} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarBadge: isSyncing ? "↑" : pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#F59E0B", fontSize: 10, minWidth: 18 },
        }}
      />
      <Tabs.Screen name="sales"    options={{ title: "Sales"   }} />
      <Tabs.Screen name="stock"    options={{ title: "Stock"   }} />
      <Tabs.Screen name="reports"  options={{ title: "Reports" }} />
      <Tabs.Screen name="profile"  options={{ title: "Profile" }} />

      {/* Hidden screens — accessible via quick actions / direct routes */}
      <Tabs.Screen name="expenses"  options={{ href: null }} />
      <Tabs.Screen name="credits"   options={{ href: null }} />
      <Tabs.Screen name="advisor"   options={{ href: null }} />
      <Tabs.Screen name="ledger"    options={{ href: null }} />
      <Tabs.Screen name="customers" options={{ href: null }} />
    </Tabs>
  );
}
