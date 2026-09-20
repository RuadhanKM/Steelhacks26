import { Image } from "expo-image";
import type { ViewStyle } from "react-native";
import { View } from "react-native";

interface AppLogoProps {
  size?: number;
  style?: ViewStyle;
  /**
   * "white" swaps the star to white for dark backgrounds — the default star is
   * the deep purple brand colour and disappears on the purple ground.
   */
  variant?: "default" | "white";
}

const SOURCES = {
  default: require("@/assets/images/logo.svg"),
  white: require("@/assets/images/logo-white.svg"),
} as const;

export function AppLogo({ size = 32, style, variant = "default" }: AppLogoProps) {
  const width = Math.round(size * (432 / 354));

  return (
    <View
      style={[
        {
          width,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Image
        source={SOURCES[variant]}
        style={{ width, height: size }}
        contentFit="contain"
        accessibilityLabel="App Logo"
      />
    </View>
  );
}
