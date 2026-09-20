import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import type { ChatSuggestion } from "@/types/chat";

interface SuggestionChipsProps {
  readonly suggestions: ChatSuggestion[];
  readonly onSelect: (prompt: string) => void;
  readonly disabled?: boolean;
}

/**
 * What the assistant can actually help with, offered after an off-topic or
 * unclear message. Tapping one sends that request, so the customer is never
 * left guessing at the wording that works.
 */
export function SuggestionChips({ suggestions, onSelect, disabled }: SuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <View
      className="mb-4 px-4"
      style={{ paddingHorizontal: 16, marginBottom: 16 }}
    >
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.prompt}
              accessibilityRole="button"
              accessibilityLabel={suggestion.label}
              disabled={disabled}
              onPress={() => onSelect(suggestion.prompt)}
              className="rounded-full border border-chase-border bg-white px-4 py-2.5"
              style={({ pressed, hovered }: any) => ({
                cursor: (disabled ? "default" : "pointer") as any,
                backgroundColor: pressed ? "#F1ECF8" : hovered ? "#F8F5FC" : "#FFFFFF",
              })}
            >
              <Text className="text-[13px] font-medium text-chase-purple600">
                {suggestion.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}
