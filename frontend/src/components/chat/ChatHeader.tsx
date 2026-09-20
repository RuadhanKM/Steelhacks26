import { Pressable, Text, View } from "react-native";
import { AppLogo } from "@/components/ui/AppLogo";

export function ChatHeader({ onSignOut }: Readonly<{ onSignOut: () => void }>) {
  return (
    <View className="bg-white border-b border-chase-border px-5 pt-2 pb-3">
      <View className="flex-row items-center">
        {/* Bank Logo / Icon */}
        <View className="mr-3 items-center justify-center">
          <AppLogo size={30} />
        </View>

        {/* Title & Status */}
        <View className="flex-1">
          <Text className="text-lg font-semibold text-chase-textPrimary">
            Pyre
          </Text>
          <View className="flex-row items-center mt-0.5">
            <View className="w-2 h-2 rounded-full bg-chase-success mr-1.5" />
            <Text className="text-xs text-chase-textSecondary">
              Online · Ready to help
            </Text>
          </View>
        </View>
        <Pressable onPress={onSignOut} accessibilityRole="button">
          <Text className="text-sm font-semibold text-chase-blue">Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}
