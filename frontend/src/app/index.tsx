import { StatusBar } from "expo-status-bar";
import { ChevronDown } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
    FlatList,
    KeyboardAvoidingView,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    Pressable,
    View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { DisputeCaseCard } from "@/components/chat/DisputeCaseCard";
import { DisputeFormCard } from "@/components/chat/DisputeFormCard";
import {
    DayDivider,
    formatDayDivider,
    groupMessages,
    isSameCalendarDay,
    MessageGroup,
} from "@/components/chat/MessageBubble";
import { QuickActions } from "@/components/chat/QuickActions";
import { SystemNotice } from "@/components/chat/SystemNotice";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useAuth } from "@/context/AuthContext";
import {
    AuthenticationError,
    ChatRequestError,
    generateMessageId,
    sendMessage,
} from "@/services/chatService";
import type {
    ChatEntry,
    ChatMessage,
    ChatSystemNotice,
    ChatTimelineItem,
    DisputeCase,
} from "@/types/chat";
import { appendChatEntry } from "@/types/chat";

const WELCOME_MESSAGE: ChatMessage = {
  kind: "message",
  id: "welcome",
  role: "assistant",
  sourcedFrom: [],
  content:
    "Welcome. I'm your personal banking assistant. I can help you check balances, make transfers, pay bills, and more. How can I help you today?",
  timestamp: new Date(),
};

export default function ChatScreen() {
  const [entries, setEntries] = useState<ChatEntry[]>([WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const flatListRef = useRef<FlatList<ChatTimelineItem>>(null);
  const failedMessageRef = useRef<{ id: string; text: string } | null>(null);
  const { signOut } = useAuth();

  const timeline = useMemo<ChatTimelineItem[]>(() => {
    const items: ChatTimelineItem[] = [];
    let messageRun: ChatMessage[] = [];
    let previousGroupDate: Date | undefined;

    const appendGroups = (run: ChatMessage[]) => {
      for (const [index, group] of groupMessages(run).entries()) {
        const needsDivider =
          !previousGroupDate || !isSameCalendarDay(previousGroupDate, group.startedAt);
        if (needsDivider) {
          items.push({
            type: "day",
            id: `day-${group.id}`,
            label: formatDayDivider(group.startedAt),
          });
        }
        items.push({ type: "group", id: `${group.id}-${index}`, group });
        previousGroupDate = group.startedAt;
      }
    };

    const flushMessages = () => {
      if (messageRun.length > 0) appendGroups(messageRun);
      messageRun = [];
    };

    for (const entry of entries) {
      if (entry.kind === "message") {
        messageRun.push(entry);
      } else if (entry.kind === "dispute_form") {
        flushMessages();
        items.push({ type: "dispute_form", id: entry.id, entry });
      } else if (entry.kind === "dispute_case") {
        flushMessages();
        items.push({ type: "dispute_case", id: entry.id, entry });
      } else {
        flushMessages();
        items.push({ type: "system_notice", id: entry.id, notice: entry });
      }
    }
    flushMessages();
    return items;
  }, [entries]);

  const activeNotice = useMemo(
    () => entries.findLast((entry): entry is ChatSystemNotice => entry.kind === "system_notice"),
    [entries],
  );
  const isOffline = activeNotice?.severity === "offline";

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
      setShowScrollToBottom(false);
    }, 100);
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      const isMoreThanOneScreenUp = distanceFromBottom > layoutMeasurement.height;
      setShowScrollToBottom(isMoreThanOneScreenUp);
    },
    [],
  );

  const handleSend = useCallback(
    async (text: string, existingMessageId?: string) => {
      const userMessage: ChatMessage = existingMessageId
        ? {
            kind: "message",
            id: existingMessageId,
            role: "user",
            content: text,
            timestamp: new Date(),
          }
        : {
            kind: "message",
            id: generateMessageId(),
            role: "user",
            content: text,
            timestamp: new Date(),
          };

      setEntries((prev) => {
        const withoutNotices = prev.filter((entry) => entry.kind !== "system_notice");
        if (withoutNotices.some((entry) => entry.id === userMessage.id)) {
          return withoutNotices;
        }
        return [...withoutNotices, userMessage];
      });
      setIsTyping(true);
      scrollToBottom();

      try {
        // Send to API
        const conversationHistory = entries.filter(
          (entry): entry is ChatMessage => entry.kind === "message",
        );
        const response = await sendMessage(text, [...conversationHistory, userMessage]);

        // Add assistant response
        const assistantMessage: ChatMessage = {
          kind: "message",
          id: generateMessageId(),
          role: "assistant",
          content: response.message,
          timestamp: new Date(),
          sourcedFrom: response.sourcedFrom,
          toolTraces: response.toolTraces,
        };

        setEntries((prev) => {
          const next = appendChatEntry(prev, assistantMessage);
          // The assistant hands back a server-built form; the customer fills it in.
          if (!response.disputeForm) return next;
          return [
            ...next,
            {
              kind: "dispute_form",
              id: `form_${response.disputeForm.formId}`,
              form: response.disputeForm,
            },
          ];
        });
        setDraft("");
        failedMessageRef.current = null;
      } catch (error) {
        if (error instanceof AuthenticationError) {
          setEntries((prev) => prev.filter((entry) => entry.id !== userMessage.id));
          await signOut();
          return;
        }

        if (error instanceof ChatRequestError) {
          const notice: ChatSystemNotice = {
            kind: "system_notice",
            id: generateMessageId(),
            severity: error.severity,
            content: error.message,
          };
          failedMessageRef.current = { id: userMessage.id, text };
          setEntries((prev) => {
            const priorMessages = prev.filter(
              (entry) => entry.kind !== "system_notice" && entry.id !== userMessage.id,
            );
            return [...priorMessages, userMessage, notice];
          });
        }
      } finally {
        setIsTyping(false);
        scrollToBottom();
      }
    },
    [entries, scrollToBottom, signOut]
  );

  const handleRetry = useCallback(() => {
    if (failedMessageRef.current) {
      handleSend(failedMessageRef.current.text, failedMessageRef.current.id);
    }
  }, [handleSend]);

  const handleDisputeSubmitted = useCallback((formEntryId: string, opened: DisputeCase) => {
    setEntries((prev) => [
      ...prev.map((entry) =>
        entry.kind === "dispute_form" && entry.id === formEntryId
          ? { ...entry, submittedCaseId: opened.id }
          : entry,
      ),
      { kind: "dispute_case", id: `case_${opened.id}`, case: opened },
    ]);
    scrollToBottom();
  }, [scrollToBottom]);

  const handleCaseRefreshed = useCallback((updated: DisputeCase) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.kind === "dispute_case" && entry.case.id === updated.id
          ? { ...entry, case: updated }
          : entry,
      ),
    );
  }, []);

  const renderTimelineItem = useCallback(
    ({ item }: { item: ChatTimelineItem }) => {
      if (item.type === "day") return <DayDivider label={item.label} />;
      if (item.type === "system_notice") {
        return <SystemNotice notice={item.notice} onRetry={handleRetry} />;
      }
      if (item.type === "dispute_form") {
        return (
          <DisputeFormCard
            form={item.entry.form}
            submittedCaseId={item.entry.submittedCaseId}
            onSubmitted={(opened) => handleDisputeSubmitted(item.entry.id, opened)}
            onAuthError={signOut}
          />
        );
      }
      if (item.type === "dispute_case") {
        return <DisputeCaseCard case={item.entry.case} onRefreshed={handleCaseRefreshed} />;
      }
      return <MessageGroup group={item.group} />;
    },
    [handleCaseRefreshed, handleDisputeSubmitted, handleRetry, signOut],
  );

  const showQuickActions = entries.filter((entry) => entry.kind === "message").length <= 1;

  return (
    <Animated.View
      entering={FadeInDown.duration(420).springify().damping(22)}
      className="flex-1"
      style={{ flex: 1, width: "100%", minHeight: "100%" }}
    >
      <SafeAreaView
        className="flex-1 bg-white"
        edges={["top"]}
        style={{ flex: 1, width: "100%", minHeight: "100%" }}
      >
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
        {/* Header */}
        <ChatHeader onSignOut={signOut} />

        {/* Messages */}
        <View className="flex-1 bg-chase-bg">
          <FlatList
            ref={flatListRef}
            data={timeline}
            keyExtractor={(item) => item.id}
            renderItem={renderTimelineItem}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
            onContentSizeChange={scrollToBottom}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          />

          {showScrollToBottom && (
            <Pressable
              accessibilityLabel="Scroll to latest messages"
              accessibilityRole="button"
              className="absolute bottom-4 right-4 h-9 w-9 items-center justify-center rounded-full bg-chase-purple600"
              onPress={scrollToBottom}
            >
              <ChevronDown color="#FFFFFF" size={18} strokeWidth={2.5} />
            </Pressable>
          )}

          {/* Quick Actions — shown only at start */}
          {showQuickActions && <QuickActions onSelect={handleSend} />}
        </View>

        {/* Input Bar */}
        <SafeAreaView edges={["bottom"]} className="bg-white">
          <ChatInputBar
            onSend={handleSend}
            value={draft}
            onChangeText={setDraft}
            disabled={isTyping}
            placeholder={isOffline ? "Assistant unavailable" : undefined}
          />
        </SafeAreaView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  );
}
