import "@/global.css";

import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

import { AuthProvider, useAuth } from "@/context/AuthContext";

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // "/" is the landing page and is public. Typed routes give useSegments() no
    // entry for the index route, so the path is the reliable check.
    const onLanding = pathname === "/";
    const inAuthFlow = segments[0] === "login" || segments[0] === "signup";
    const isPublic = onLanding || inAuthFlow;

    if (!user && !isPublic) {
      router.replace("/login");
    } else if (user && isPublic) {
      // Signed in, so the hero and the sign-in forms have nothing to offer.
      router.replace("/chat");
    }
  }, [loading, pathname, router, segments, user]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-chase-bg">
        <ActivityIndicator color="#2A1848" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === "web" ? "none" : "fade",
        animationDuration: 200,
        contentStyle: { backgroundColor: "#FAF8FC" },
      }}
    />
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
