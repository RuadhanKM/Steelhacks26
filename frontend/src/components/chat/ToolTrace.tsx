import { Text, View } from "react-native";

import type { ToolTrace } from "@/types/chat";

export function ToolTraceRow({ trace }: { readonly trace: ToolTrace }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="flex-1 font-mono text-[12px] text-chase-textMuted" numberOfLines={1}>
        {trace.name}
      </Text>
      <Text className="ml-3 font-mono text-[12px] text-chase-textMuted">
        {trace.timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </Text>
    </View>
  );
}
