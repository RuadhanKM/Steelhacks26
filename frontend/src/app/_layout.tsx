import "@/global.css";

import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { AuthProvider, useAuth } from "@/context/AuthContext";

SplashScreen.preventAutoHideAsync();

function AuthGate() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthFlow = segments[0] === "login" || segments[0] === "signup";
    if (!user && !inAuthFlow) {
      router.replace("/login");
    } else if (user && inAuthFlow) {
      router.replace("/");
    }
  }, [loading, router, segments, user]);

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
        animation: "fade_from_bottom",
        animationDuration: 420,
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
