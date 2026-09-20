import { Image } from "expo-image";
import type { ViewStyle } from "react-native";
import { View } from "react-native";

interface AppLogoProps {
  size?: number;
  style?: ViewStyle;
}

export function AppLogo({ size = 32, style }: AppLogoProps) {
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
        source={require("@/assets/images/logo.svg")}
        style={{ width, height: size }}
        contentFit="contain"
        accessibilityLabel="App Logo"
      />
    </View>
  );
}
