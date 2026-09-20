import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppLogo } from "@/components/ui/AppLogo";

/**
 * Landing screen. Public — the auth gate sends signed-in visitors to /chat.
 *
 * Three rows inside a safe area: logo, pitch, actions. The middle row takes the
 * leftover space, so the layout fills exactly one screen at any size.
 *
 * The diagonal is a border triangle sitting on a white block — not a rotated
 * view. A transformed view gets its own compositing layer on iOS and paints
 * over its siblings whatever the zIndex says, which hid the sign-in button.
 */
export default function LandingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.backdrop} pointerEvents="none">
        <View style={[styles.diagonal, { borderRightWidth: width }]} />
        <View style={styles.block} />
      </View>

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
  // The white lower half: a triangle for the slope, a solid block beneath it.
  backdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  diagonal: {
    width: 0,
    height: 0,
    borderRightColor: "transparent",
    borderBottomColor: "#FFFFFF",
    borderBottomWidth: 86,
    borderStyle: "solid",
  },
  block: {
    height: 300,
    backgroundColor: "#FFFFFF",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 28,
    zIndex: 1,
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
