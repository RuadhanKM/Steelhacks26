import React from "react";
import { View, Text } from "react-native";
import type { ChatMessage } from "@/types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  const formattedTime = message.timestamp.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <View className={`flex mb-3 px-4 ${isUser ? "items-end" : "items-start"}`}>
      {/* Avatar + Name row for assistant */}
      {!isUser && (
        <View className="flex-row items-center mb-1.5 ml-1">
          <View className="w-6 h-6 rounded-full bg-chase-blue items-center justify-center mr-2">
            <Text className="text-white text-xs font-bold">B</Text>
          </View>
          <Text className="text-xs text-chase-textSecondary font-medium">
            Bank Assistant
          </Text>
        </View>
      )}

      {/* Message bubble */}
      <View
        className={`max-w-[85%] px-4 py-3 ${
          isUser
            ? "bg-chase-userBubble rounded-2xl rounded-br-md"
            : "bg-chase-aiBubble rounded-2xl rounded-bl-md border border-chase-border"
        }`}
      >
        <Text
          className={`text-[15px] leading-6 ${
            isUser ? "text-white" : "text-chase-textPrimary"
          }`}
        >
          {message.content}
        </Text>
      </View>

      {/* Timestamp */}
      <Text className="text-[10px] text-chase-textMuted mt-1 mx-2">
        {formattedTime}
      </Text>
    </View>
  );
}
