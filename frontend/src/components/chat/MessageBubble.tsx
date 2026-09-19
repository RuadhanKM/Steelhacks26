import { ChevronDown, Link2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
    FadeInLeft,
    FadeInRight,
    LinearTransition,
} from "react-native-reanimated";

import { ToolTraceRow } from "@/components/chat/ToolTrace";
import type { AgentChatMessage, ChatMessage, ChatMessageGroup, ToolTrace } from "@/types/chat";

const THREE_MINUTES = 3 * 60 * 1000;

function isSameCalendarDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export function groupMessages(messages: ChatMessage[]): ChatMessageGroup[] {
  return messages.reduce<ChatMessageGroup[]>((groups, message) => {
    const previous = groups.at(-1);
    const canJoin =
      previous?.role === message.role &&
      message.timestamp.getTime() - previous.endedAt.getTime() <= THREE_MINUTES;

    if (canJoin) {
      previous.messages.push(message);
      previous.endedAt = message.timestamp;
      return groups;
    }

    groups.push({
      id: `group-${message.id}`,
      role: message.role,
      messages: [message],
      startedAt: message.timestamp,
      endedAt: message.timestamp,
    });
    return groups;
  }, []);
}

export function formatDayDivider(date: Date, now = new Date()) {
  if (isSameCalendarDay(date, now)) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameCalendarDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MessageBubble({
  message,
  index = 0,
}: {
  readonly message: ChatMessage;
  readonly index?: number;
}) {
  const isUser = message.role === "user";
  const entering = (isUser ? FadeInRight : FadeInLeft)
    .duration(240)
    .delay(Math.min(index * 45, 135))
    .springify()
    .damping(18);

  return (
    <Animated.View
      entering={entering}
      layout={LinearTransition.springify().damping(20)}
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        backgroundColor: isUser ? "#5B3D85" : "#FFFFFF",
        borderColor: isUser ? "#1D1033" : "#D4C8E0",
        borderRadius: 14,
        borderBottomRightRadius: isUser ? 4 : 14,
        borderBottomLeftRadius: isUser ? 14 : 4,
        borderWidth: 1,
        maxWidth: "86%",
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <Text className={`text-[16px] leading-6 ${isUser ? "text-white" : "text-chase-textPrimary"}`}>
        {message.content}
      </Text>
      {!isUser && <SourceFooter message={message} />}
    </Animated.View>
  );
}

function SourceFooter({ message }: { readonly message: AgentChatMessage }) {
  const [expanded, setExpanded] = useState(false);
  if (message.sourcedFrom.length === 0) return null;

  const traces: ToolTrace[] = message.sourcedFrom.map((sourceId) => {
    const trace = message.toolTraces?.find((candidate) => candidate.id === sourceId);
    return trace ?? { id: sourceId, name: sourceId, timestamp: message.timestamp };
  });
  const lookupLabel = message.sourcedFrom.length === 1 ? "account lookup" : "account lookups";

  return (
    <View className="mt-2 border-t border-chase-border pt-2">
      <Pressable
        accessibilityRole="button"
        className="flex-row items-center"
        onPress={() => setExpanded((current) => !current)}
      >
        <Link2 color="#6F647B" size={11} strokeWidth={2} />
        <Text className="ml-1 flex-1 text-[11px] text-chase-textMuted">
          Sourced from {message.sourcedFrom.length} {lookupLabel}
        </Text>
        <ChevronDown
          color="#6F647B"
          size={13}
          strokeWidth={2}
          style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {expanded && (
        <View className="mt-2 border-t border-chase-border pt-1">
          {traces.map((trace) => (
            <ToolTraceRow key={trace.id} trace={trace} />
          ))}
        </View>
      )}
    </View>
  );
}

export function MessageGroup({ group }: { readonly group: ChatMessageGroup }) {
  const isUser = group.role === "user";

  return (
    <View className={`mb-5 flex px-4 ${isUser ? "items-end" : "items-start"}`}>
      {!isUser && (
        <Text className="mb-1.5 mt-1.5 text-[12px] font-semibold text-chase-textMuted">
          Assistant
        </Text>
      )}
      <View className="w-full gap-1">
        {group.messages.map((message, index) => (
          <MessageBubble key={message.id} message={message} index={index} />
        ))}
      </View>
      <Text
        className={`mt-1 text-[11px] text-chase-textMuted ${
          isUser ? "self-end" : "self-start"
        }`}
      >
        {formatTime(group.endedAt)}
      </Text>
    </View>
  );
}

export function DayDivider({ label }: { readonly label: string }) {
  return (
    <View className="my-4 flex-row items-center px-4">
      <View className="h-px flex-1 bg-chase-border" />
      <Text className="px-3 font-mono text-[11px] uppercase text-chase-textMuted">
        {label}
      </Text>
      <View className="h-px flex-1 bg-chase-border" />
    </View>
  );
}

export { isSameCalendarDay };
