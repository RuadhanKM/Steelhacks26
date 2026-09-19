import React from "react";
import { View, Text } from "react-native";

export function ChatHeader() {
  return (
    <View className="bg-white border-b border-chase-border px-5 pt-2 pb-3">
      <View className="flex-row items-center">
        {/* Bank Logo / Icon */}
        <View className="w-10 h-10 rounded-full bg-chase-blue items-center justify-center mr-3">
          <Text className="text-white text-lg font-bold">B</Text>
        </View>

        {/* Title & Status */}
        <View className="flex-1">
          <Text className="text-lg font-semibold text-chase-textPrimary">
            Bank Assistant
          </Text>
          <View className="flex-row items-center mt-0.5">
            <View className="w-2 h-2 rounded-full bg-chase-success mr-1.5" />
            <Text className="text-xs text-chase-textSecondary">
              Online · Ready to help
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
