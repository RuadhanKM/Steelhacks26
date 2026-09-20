import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppLogo } from "@/components/ui/AppLogo";

/**
 * Landing screen. Public — the auth gate sends signed-in visitors to /chat.
 *
 * Three rows inside a safe area: logo, pitch, actions. The middle row takes the
 * leftover space, so the layout fills exactly one screen at any size. The
 * diagonal is a rotated white slab clipped by the screen.
 */
export default function LandingScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.slab} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.header}>
          <AppLogo size={32} variant="white" />
        </View>

        <View style={styles.pitch}>
          <Text style={styles.title}>Pyre</Text>
          <Text style={styles.subtitle}>
            Ask about a charge, dispute it, and follow the case — all in one
            conversation.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/login")}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonLabel}>Sign in</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.push("/signup")}
            style={styles.link}
          >
            <Text style={styles.linkLabel}>
              New here? <Text style={styles.linkStrong}>Create an account</Text>
            </Text>
          </Pressable>

          <Text style={styles.disclaimer}>
            A demo built on synthetic accounts. No real banking data.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#2A1848",
    overflow: "hidden",
  },
  // Oversized so its corners stay off screen once rotated; the screen clips it.
  slab: {
    position: "absolute",
    left: -80,
    right: -80,
    bottom: -130,
    height: 400,
    backgroundColor: "#FFFFFF",
    transform: [{ rotate: "-9deg" }],
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 28,
  },
  header: {
    paddingTop: 12,
  },
  // Takes the leftover height, so the rows above and below stay put.
  pitch: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 72,
    lineHeight: 78,
    fontWeight: "800",
    letterSpacing: -2,
    color: "#FFFFFF",
  },
  subtitle: {
    marginTop: 12,
    maxWidth: 320,
    fontSize: 16,
    lineHeight: 24,
    color: "#F1ECF8",
  },
  actions: {
    paddingBottom: 12,
  },
  button: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 27,
    backgroundColor: "#2A1848",
  },
  buttonPressed: {
    backgroundColor: "#5B3D85",
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  link: {
    marginTop: 16,
    alignItems: "center",
  },
  linkLabel: {
    fontSize: 14,
    color: "#6F647B",
  },
  linkStrong: {
    fontWeight: "600",
    color: "#2A1848",
  },
  disclaimer: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 16,
    color: "#A79CAF",
  },
});
