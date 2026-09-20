import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

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
    <Animated.View entering={FadeIn.duration(200)} className="px-4 pb-2 pt-1">
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion.prompt}
            accessibilityRole="button"
            accessibilityLabel={suggestion.label}
            disabled={disabled}
            onPress={() => onSelect(suggestion.prompt)}
            className="rounded-full border border-chase-border bg-white px-3.5 py-2 active:bg-chase-lightBlue"
          >
            <Text className="text-[13px] font-medium text-chase-blue">{suggestion.label}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}
