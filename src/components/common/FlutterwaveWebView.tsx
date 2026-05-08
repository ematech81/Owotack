import React, { useRef, useState } from "react";
import {
  Modal, View, StyleSheet, TouchableOpacity, Text,
  ActivityIndicator, StatusBar,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/colors";

// Must match the redirect_url set in the backend initializeSubscription call
const REDIRECT_HOST = "owotracbackend-production.up.railway.app";
const REDIRECT_PATH = "/payment/callback";

interface Props {
  visible: boolean;
  paymentLink: string;
  txRef: string;
  onSuccess: (txRef: string) => void;
  onCancel: () => void;
}

export function FlutterwaveWebView({ visible, paymentLink, txRef, onSuccess, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Guard so we only fire onSuccess/onCancel once per session
  const handledRef = useRef(false);

  const handleRedirect = (url: string) => {
    if (handledRef.current) return;
    handledRef.current = true;
    try {
      const params = new URL(url).searchParams;
      const status = params.get("status");
      const ref = params.get("tx_ref") || txRef;
      if (status === "successful" && ref) onSuccess(ref);
      else onCancel();
    } catch {
      onSuccess(txRef);
    }
  };

  const handleNavChange = (state: WebViewNavigation) => {
    if ((state.url || "").includes(REDIRECT_HOST + REDIRECT_PATH)) {
      handleRedirect(state.url);
    }
  };

  const handleShouldStartLoad = (request: { url: string }) => {
    if ((request.url || "").includes(REDIRECT_HOST + REDIRECT_PATH)) {
      handleRedirect(request.url);
      return false; // block the redirect page from rendering
    }
    return true;
  };

  const handleOpen = () => {
    // Reset state every time the modal opens
    handledRef.current = false;
    setLoadError(false);
    setPageLoading(true);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
      onShow={handleOpen}
    >
      <View style={[s.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={onCancel} style={s.iconBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.topTitle}>Secure Payment</Text>
          <View style={[s.iconBtn, s.lockBtn]}>
            <Ionicons name="lock-closed" size={15} color="#16A34A" />
          </View>
        </View>

        {/* Content */}
        {loadError ? (
          <View style={s.centered}>
            <View style={s.errorIconWrap}>
              <Ionicons name="wifi-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={s.errorTitle}>Could not load payment page</Text>
            <Text style={s.errorSub}>Check your internet connection and try again.</Text>
            <TouchableOpacity
              style={[s.retryBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                setLoadError(false);
                setPageLoading(true);
                webRef.current?.reload();
              }}
            >
              <Ionicons name="refresh-outline" size={16} color="#fff" />
              <Text style={s.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {pageLoading && (
              <View style={s.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={s.loadingText}>Loading secure payment...</Text>
              </View>
            )}
            <WebView
              ref={webRef}
              source={{ uri: paymentLink }}
              onLoadStart={() => setPageLoading(true)}
              onLoadEnd={() => setPageLoading(false)}
              onError={() => { setPageLoading(false); setLoadError(true); }}
              onNavigationStateChange={handleNavChange}
              onShouldStartLoadWithRequest={handleShouldStartLoad}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
              style={{ flex: 1 }}
            />
          </View>
        )}

        {/* Manual fallback — for cases where the redirect doesn't fire */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
          <TouchableOpacity
            style={s.paidBtn}
            onPress={() => {
              if (!handledRef.current) {
                handledRef.current = true;
                onSuccess(txRef);
              }
            }}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={s.paidBtnText}>I've Completed Payment</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#fff",
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#F9FAFB",
    alignItems: "center", justifyContent: "center",
  },
  lockBtn: { backgroundColor: "#F0FDF4" },
  topTitle: { fontSize: 15, fontWeight: "700", color: "#1F2937" },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 10,
  },
  loadingText: { fontSize: 14, color: "#6B7280", fontWeight: "500" },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  errorIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#F9FAFB",
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  errorTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937" },
  errorSub: { fontSize: 13, color: "#6B7280", textAlign: "center" },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 24, marginTop: 8,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  footer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  paidBtn: {
    height: 52, borderRadius: 26,
    backgroundColor: "#16A34A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  paidBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
