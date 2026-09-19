import { AlertTriangle, Info, WifiOff } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import type { ChatSystemNotice } from "@/types/chat";

interface SystemNoticeProps {
  readonly notice: ChatSystemNotice;
  readonly onRetry?: () => void;
}

const ICONS = {
  info: Info,
  degraded: AlertTriangle,
  offline: WifiOff,
} as const;

export function SystemNotice({ notice, onRetry }: SystemNoticeProps) {
  const Icon = ICONS[notice.severity];
  const canRetry = notice.severity === "degraded" || notice.severity === "offline";

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      className="w-full border-b border-t border-chase-border py-3"
    >
      <View className="flex-row items-center justify-center px-4">
        <Icon color="#6F647B" size={14} strokeWidth={2} />
        <Text className="ml-2 flex-shrink text-center text-[13px] text-chase-textMuted">
          {notice.content}
        </Text>
        {canRetry && onRetry && (
          <Pressable
            accessibilityRole="button"
            className="ml-3"
            onPress={onRetry}
          >
            <Text className="text-[13px] font-semibold text-chase-textSecondary">
              Retry
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}
