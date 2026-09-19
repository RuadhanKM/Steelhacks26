import React, { useState, useRef, useCallback } from "react";
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInputBar } from "@/components/chat/ChatInputBar";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { QuickActions } from "@/components/chat/QuickActions";
import { sendMessage, generateMessageId } from "@/services/chatService";
import type { ChatMessage } from "@/types/chat";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Welcome! 👋 I'm your personal banking assistant. I can help you check balances, make transfers, pay bills, and more. How can I help you today?",
  timestamp: new Date(),
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      // Add user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);
      scrollToBottom();

      try {
        // Send to API
        const response = await sendMessage(text, [
          ...messages,
          userMessage,
        ]);

        // Add assistant response
        const assistantMessage: ChatMessage = {
          id: generateMessageId(),
          role: "assistant",
          content: response,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch {
        // Add error message
        const errorMessage: ChatMessage = {
          id: generateMessageId(),
          role: "assistant",
          content:
            "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsTyping(false);
        scrollToBottom();
      }
    },
    [messages, scrollToBottom]
  );

  const showQuickActions = messages.length <= 1;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <ChatHeader />

        {/* Messages */}
        <View className="flex-1 bg-chase-bg">
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
            onContentSizeChange={scrollToBottom}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          />

          {/* Quick Actions — shown only at start */}
          {showQuickActions && <QuickActions onSelect={handleSend} />}
        </View>

        {/* Input Bar */}
        <SafeAreaView edges={["bottom"]} className="bg-white">
          <ChatInputBar onSend={handleSend} disabled={isTyping} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
