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
  const isFraud = disputeCase.claimType === "fraud";
  const isFeeWaiver = disputeCase.claimType === "fee_waiver";
  const provisionalCents = disputeCase.provisionalCreditCents ?? 0;

  // A temporary credit is not an outcome: it can be taken back. Say so instead
  // of letting "Under review" imply the money is settled.
  let status = STATUS_COPY[disputeCase.status] ?? STATUS_COPY.submitted;
  if (disputeCase.status === "under_review" && provisionalCents > 0) {
    status = {
      label: "Temporary credit issued",
      detail:
        "The investigation is still open. This credit can be reversed if the charge turns out to be yours.",
      tone: "text-chase-purple600",
    };
  } else if (disputeCase.status === "resolved" && disputeCase.provisionalCreditPermanent) {
    status = {
      label: "Resolved",
      detail: "The investigation is finished and the credit is now permanent.",
      tone: "text-chase-success",
    };
  } else if (disputeCase.status === "rejected" && disputeCase.provisionalCreditReversedTransactionId) {
    status = {
      label: "Not approved",
      detail: "The charge was found to be yours, and the temporary credit has been taken back.",
      tone: "text-chase-textSecondary",
    };
  }

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
    <View className="mb-5 px-4 flex items-start">
      <Animated.View
        entering={FadeIn.duration(200)}
        style={{
          alignSelf: "flex-start",
          width: "100%",
          maxWidth: 360,
          backgroundColor: "#FFFFFF",
          borderColor: "#D4C8E0",
          borderWidth: 1,
          borderRadius: 14,
          borderBottomLeftRadius: 4,
          overflow: "hidden",
        }}
      >
        <View className="p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-[15px] font-semibold text-chase-textPrimary">
              {isFraud ? "Fraud claim" : isFeeWaiver ? "Fee refund request" : "Dispute case"}
            </Text>
            <Pressable
              accessibilityLabel="Refresh case status"
              accessibilityRole="button"
              disabled={refreshing}
              onPress={handleRefresh}
              className="flex-row items-center p-1 rounded-md"
              style={({ pressed, hovered }) => ({
                backgroundColor:
                  pressed ? "#E5E7EB" : hovered ? "rgba(91, 61, 133, 0.08)" : "transparent",
                cursor: (refreshing ? "not-allowed" : "pointer") as any,
              })}
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
              {disputeCase.cardAction === "lock"
                ? " · card blocked"
                : disputeCase.cardAction === "replace"
                  ? " · card replaced"
                  : ""}
            </Text>
            {provisionalCents > 0 && (
              <Text className="mt-1 text-[12px] text-chase-textMuted">
                Temporary credit of ${(provisionalCents / 100).toFixed(2)} posted while the bank
                investigates.
              </Text>
            )}
            {disputeCase.reviewNote && (
              <Text className="mt-2 text-[12px] italic text-chase-textSecondary">
                Reviewer: {disputeCase.reviewNote}
              </Text>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
