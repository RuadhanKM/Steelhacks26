import { Check, Receipt } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { ApiRequestError } from "@/services/apiClient";
import { submitFeeWaiver } from "@/services/feeService";
import type {
  DisputeCase,
  DisputeFormField,
  FeeWaiverForm,
} from "@/types/chat";

interface FeeWaiverCardProps {
  readonly form: FeeWaiverForm;
  readonly submittedCaseId?: string;
  readonly onSubmitted: (opened: DisputeCase) => void;
  readonly onAuthError: () => void;
}

function formatAmount(cents?: number | null): string {
  if (cents === null || cents === undefined) return "";
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fieldByName(form: FeeWaiverForm, name: string): DisputeFormField | undefined {
  return form.fields.find((field) => field.name === name);
}

function SectionLabel({ children }: { readonly children: string }) {
  return (
    <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-chase-textMuted">
      {children}
    </Text>
  );
}

export function FeeWaiverCard({
  form,
  submittedCaseId,
  onSubmitted,
  onAuthError,
}: FeeWaiverCardProps) {
  const feeField = fieldByName(form, "transactionId");
  const reasonField = fieldByName(form, "reasonCode");
  const noteField = fieldByName(form, "note");

  const [transactionId, setTransactionId] = useState<string>(
    (feeField?.prefill as string) ?? feeField?.options[0]?.value ?? "",
  );
  const [reasonCode, setReasonCode] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSubmitted = Boolean(submittedCaseId);
  const canSubmit = !submitting && !isSubmitted && transactionId !== "" && reasonCode !== "";

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      onSubmitted(
        await submitFeeWaiver({ formId: form.formId, transactionId, reasonCode, note }),
      );
    } catch (submitError) {
      if (submitError instanceof ApiRequestError) {
        setError(submitError.message);
      } else if (submitError instanceof Error && submitError.name === "AuthenticationError") {
        onAuthError();
      } else {
        setError("Could not send that request. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      layout={LinearTransition.duration(180)}
      className="px-4 py-2"
    >
      <View className="overflow-hidden rounded-2xl border border-chase-border bg-chase-card">
        <View className="flex-row items-center border-b border-chase-border bg-chase-lightBlue px-4 py-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-chase-blue">
            <Receipt color="#FFFFFF" size={17} strokeWidth={2} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-[15px] font-semibold text-chase-textPrimary">{form.title}</Text>
            <Text className="mt-0.5 text-[12px] leading-4 text-chase-textSecondary">
              {isSubmitted ? "Sent to a banker" : form.description}
            </Text>
          </View>
        </View>

        <View className="px-4 py-4">
          {/* Which fee */}
          {feeField && (
            <View>
              <SectionLabel>{feeField.label}</SectionLabel>
              <View style={{ gap: 6 }}>
                {feeField.options.map((option) => {
                  const selected = option.value === transactionId;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      disabled={isSubmitted || submitting}
                      onPress={() => setTransactionId(option.value)}
                      className={`flex-row items-center rounded-xl border px-3 py-2.5 ${
                        selected
                          ? "border-chase-purple600 bg-chase-lightBlue"
                          : "border-chase-border bg-white"
                      }`}
                    >
                      <View className="flex-1">
                        <Text className="text-[14px] font-medium text-chase-textPrimary">
                          {option.merchant ?? option.label}
                        </Text>
                        <Text className="mt-0.5 text-[12px] text-chase-textMuted">
                          {formatDate(option.createdAt)}
                        </Text>
                      </View>
                      <Text className="ml-3 text-[14px] font-semibold text-chase-textPrimary">
                        {formatAmount(option.amountCents)}
                      </Text>
                      {selected && (
                        <Check color="#5B3D85" size={15} strokeWidth={3} style={{ marginLeft: 8 }} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Why */}
          {reasonField && (
            <View className="mt-5">
              <SectionLabel>{reasonField.label}</SectionLabel>
              <View style={{ gap: 4 }}>
                {reasonField.options.map((option) => {
                  const selected = option.value === reasonCode;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      disabled={isSubmitted || submitting}
                      onPress={() => setReasonCode(option.value)}
                      className={`flex-row items-center rounded-xl px-3 py-2.5 ${
                        selected ? "bg-chase-lightBlue" : "bg-transparent"
                      }`}
                    >
                      <View
                        className={`mr-3 h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${
                          selected ? "border-chase-purple600" : "border-chase-border"
                        }`}
                      >
                        {selected && <View className="h-2 w-2 rounded-full bg-chase-purple600" />}
                      </View>
                      <Text
                        className={`flex-1 text-[13px] leading-5 ${
                          selected
                            ? "font-medium text-chase-textPrimary"
                            : "text-chase-textSecondary"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Note */}
          {noteField && !isSubmitted && (
            <View className="mt-5">
              <SectionLabel>{noteField.label}</SectionLabel>
              <TextInput
                editable={!submitting}
                multiline
                onChangeText={setNote}
                placeholder="Optional"
                placeholderTextColor="#A79CAF"
                value={note}
                className="min-h-[64px] rounded-xl border border-chase-border bg-white px-3 py-2.5 text-[13px] leading-5 text-chase-textPrimary"
                style={{ textAlignVertical: "top" }}
              />
            </View>
          )}
        </View>

        <View className="border-t border-chase-border bg-chase-bg px-4 py-3">
          {/* The promise wording comes from the server, not from the model. */}
          <Text className="mb-2.5 text-[11px] leading-4 text-chase-textMuted">
            {form.decisionNotice}
          </Text>

          {error && (
            <Text className="mb-2 text-[12px] text-red-600" accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            disabled={!canSubmit}
            onPress={handleSubmit}
            className={`flex-row items-center justify-center rounded-xl px-4 py-3 ${
              canSubmit ? "bg-chase-blue active:bg-chase-purple600" : "bg-chase-border"
            }`}
          >
            {submitting && <ActivityIndicator color="#FFFFFF" size="small" />}
            <Text
              className={`text-[14px] font-semibold ${submitting ? "ml-2" : ""} ${
                canSubmit || isSubmitted ? "text-white" : "text-chase-textMuted"
              }`}
            >
              {isSubmitted
                ? "Request sent"
                : reasonCode === ""
                  ? "Choose a reason to continue"
                  : "Send this request"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
