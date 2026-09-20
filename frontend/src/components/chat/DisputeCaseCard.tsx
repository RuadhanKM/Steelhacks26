import { RefreshCw } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { getDispute } from "@/services/disputeService";
import type { DisputeCase, DisputeStatus } from "@/types/chat";

interface DisputeCaseCardProps {
  readonly case: DisputeCase;
  readonly onRefreshed: (updated: DisputeCase) => void;
}

const STATUS_COPY: Record<DisputeStatus, { label: string; detail: string; tone: string }> = {
  submitted: {
    label: "Submitted",
    detail: "Waiting for a banker to pick it up.",
    tone: "text-chase-textSecondary",
  },
  under_review: {
    label: "Under review",
    detail: "A banker is looking at it now.",
    tone: "text-chase-purple600",
  },
  resolved: {
    label: "Resolved",
    detail: "Approved. A credit has been posted to your account.",
    tone: "text-chase-success",
  },
  rejected: {
    label: "Not approved",
    detail: "The charges were left as they are.",
    tone: "text-chase-textSecondary",
  },
};

export function DisputeCaseCard({ case: disputeCase, onRefreshed }: DisputeCaseCardProps) {
  const [refreshing, setRefreshing] = useState(false);
  const status = STATUS_COPY[disputeCase.status] ?? STATUS_COPY.submitted;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      onRefreshed(await getDispute(disputeCase.id));
    } catch {
      // Leave the last known status on screen rather than guessing a new one.
    } finally {
      setRefreshing(false);
    }
  };

  const amount =
    disputeCase.claimedAmountCents != null
      ? `$${(Math.abs(disputeCase.claimedAmountCents) / 100).toFixed(2)}`
      : null;

  return (
    <Animated.View entering={FadeIn.duration(200)} className="px-4 py-2">
      <View className="rounded-2xl border border-chase-border bg-chase-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-[15px] font-semibold text-chase-textPrimary">Dispute case</Text>
          <Pressable
            accessibilityLabel="Refresh case status"
            accessibilityRole="button"
            disabled={refreshing}
            onPress={handleRefresh}
            className="flex-row items-center"
          >
            <RefreshCw color="#6F647B" size={13} strokeWidth={2} />
            <Text className="ml-1.5 text-[12px] text-chase-textSecondary">
              {refreshing ? "Checking…" : "Refresh"}
            </Text>
          </Pressable>
        </View>

        <Text className={`mt-2 text-[13px] font-semibold ${status.tone}`}>{status.label}</Text>
        <Text className="mt-0.5 text-[13px] leading-5 text-chase-textSecondary">
          {status.detail}
        </Text>

        <View className="mt-3 border-t border-chase-border pt-3">
          <Text className="text-[12px] text-chase-textMuted">
            Case {disputeCase.id}
            {disputeCase.merchant ? ` · ${disputeCase.merchant}` : ""}
            {amount ? ` · ${amount}` : ""}
          </Text>
          <Text className="mt-1 text-[12px] text-chase-textMuted">
            {disputeCase.transactionIds.length} charge
            {disputeCase.transactionIds.length === 1 ? "" : "s"} under review
          </Text>
          {disputeCase.reviewNote && (
            <Text className="mt-2 text-[12px] italic text-chase-textSecondary">
              Reviewer: {disputeCase.reviewNote}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
