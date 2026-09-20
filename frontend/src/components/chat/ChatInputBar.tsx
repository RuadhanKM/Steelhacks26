import { Pressable, Text, TextInput, View } from "react-native";

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
    <View className="px-4 pt-2 pb-2 bg-white border-t border-chase-border">
      <View className="flex-row items-end bg-chase-bg rounded-3xl border border-chase-border px-4 py-1">
        <TextInput
          className="flex-1 text-[16px] text-chase-textPrimary py-2.5 max-h-[100px]"
          placeholder={placeholder}
          placeholderTextColor="#A79CAF"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={handleSend}
          multiline
          editable={!disabled}
          returnKeyType="send"
          submitBehavior="submit"
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          className={`ml-2 mb-1.5 w-9 h-9 rounded-full items-center justify-center ${
            canSend ? "bg-chase-blue" : "bg-chase-border"
          }`}
          style={({ pressed }) => ({
            opacity: pressed && canSend ? 0.7 : 1,
          })}
        >
          <Text
            className={`text-lg font-bold ${
              canSend ? "text-white" : "text-chase-textMuted"
            }`}
          >
            ↑
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
