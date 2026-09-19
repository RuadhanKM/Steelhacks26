import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

interface QuickAction {
  label: string;
  message: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "💰 Balances", message: "What are my account balances?" },
  { label: "📋 Transactions", message: "Show my recent transactions" },
  { label: "💸 Transfer", message: "I'd like to transfer money" },
  { label: "📄 Pay Bills", message: "Show my upcoming bills" },
  { label: "🔒 Lock Card", message: "I need to lock my card" },
  { label: "❓ Help", message: "What can you help me with?" },
];

interface QuickActionsProps {
  onSelect: (message: string) => void;
}

export function QuickActions({ onSelect }: QuickActionsProps) {
  return (
    <View className="px-4 py-3">
      <Text className="text-xs text-chase-textSecondary font-medium mb-2.5 ml-1">
        Quick Actions
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.label}
            onPress={() => onSelect(action.message)}
            className="bg-white border border-chase-border rounded-full px-4 py-2.5 active:bg-chase-lightBlue"
          >
            <Text className="text-sm text-chase-blue font-medium">
              {action.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
