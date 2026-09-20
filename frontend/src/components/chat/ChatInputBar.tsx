import { ArrowUp } from "lucide-react-native";
import { Pressable, TextInput, View } from "react-native";

interface ChatInputBarProps {
  onSend: (message: string) => void;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInputBar({
  onSend,
  value,
  onChangeText,
  placeholder = "Ask your banking assistant...",
  disabled = false,
}: Readonly<ChatInputBarProps>) {
  const handleSend = () => {
    const trimmed = value.trim();
    if (trimmed.length === 0 || disabled) return;
    onChangeText("");
    onSend(trimmed);
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <View className="px-4 py-2 bg-white border-t border-chase-border">
      <View
        className="flex-row items-center bg-chase-bg border border-chase-border pl-4 rounded-full"
        style={{
          height: 48,
          borderRadius: 24,
          paddingRight: 3,
          overflow: "hidden",
        }}
      >
        <TextInput
          className="flex-1 text-[15px] text-chase-textPrimary h-full pr-2"
          placeholder={placeholder}
          placeholderTextColor="#A79CAF"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={handleSend}
          editable={!disabled}
          returnKeyType="send"
          style={
            {
              outlineStyle: "none",
              borderWidth: 0,
              paddingVertical: 0,
              resize: "none",
            } as any
          }
        />
        <Pressable
          accessibilityLabel="Send message"
          accessibilityRole="button"
          onPress={handleSend}
          disabled={!canSend}
          className={`scale-[0.7] items-center justify-center rounded-full ${canSend ? "bg-chase-purple600 active:bg-chase-accent" : "bg-chase-border"
            }`}
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: 21,
            flexShrink: 0,
            opacity: pressed && canSend ? 0.8 : 1,
            cursor: (canSend ? "pointer" : "default") as any,
          })}
        >
          <ArrowUp
            size={40}
            color={canSend ? "#FFFFFF" : "#A79CAF"}
            strokeWidth={1}
            transform={[
              { scale: 0.8 },
              { translateX: 1.7 },
              { translateY: 1.7 },
            ]}
          />
        </Pressable>
      </View>
    </View>
  );
}
