import { Check, CreditCard, Info, ShieldAlert } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { ApiRequestError } from "@/services/apiClient";
import { answerTriage } from "@/services/fraudService";
import type {
  DisputeFormField,
  DisputeFormOption,
  TriageForm,
  TriageResult,
} from "@/types/chat";

interface TriageCardProps {
  readonly form: TriageForm;
  readonly result?: TriageResult;
  readonly onAnswered: (result: TriageResult) => void;
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

function fieldByName(form: TriageForm, name: string): DisputeFormField | undefined {
  return form.fields.find((field) => field.name === name);
}

function SectionLabel({ children }: { readonly children: string }) {
  return (
    <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-chase-textMuted">
      {children}
    </Text>
  );
}

function Radio({ selected }: { readonly selected: boolean }) {
  return (
    <View
      className={`mr-3 h-[18px] w-[18px] items-center justify-center rounded-full border-2 ${
        selected ? "border-chase-purple600" : "border-chase-border"
      }`}
    >
      {selected && <View className="h-2 w-2 rounded-full bg-chase-purple600" />}
    </View>
  );
}

function OptionRow({
  option,
  selected,
  disabled,
  onPress,
  children,
}: {
  readonly option: DisputeFormOption;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onPress: () => void;
  readonly children?: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`rounded-xl px-3 py-2.5 ${selected ? "bg-chase-lightBlue" : "bg-transparent"}`}
    >
      <View className="flex-row items-center">
        <Radio selected={selected} />
        <Text
          className={`flex-1 text-[13px] leading-5 ${
            selected ? "font-medium text-chase-textPrimary" : "text-chase-textSecondary"
          }`}
        >
          {option.label}
        </Text>
      </View>
      {children}
    </Pressable>
  );
}

/** What happened after the customer answered: an explanation, or a claim. */
function TriageOutcome({ result }: { readonly result: TriageResult }) {
  const openedClaim = result.outcome !== "no_claim";
  return (
    <View className="px-4 py-4">
      <View className="flex-row items-start">
        <View
          className={`mt-0.5 h-8 w-8 items-center justify-center rounded-full ${
            openedClaim ? "bg-chase-blue" : "bg-chase-lightBlue"
          }`}
        >
          {openedClaim ? (
            <ShieldAlert color="#FFFFFF" size={16} strokeWidth={2} />
          ) : (
            <Info color="#5B3D85" size={16} strokeWidth={2} />
          )}
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-[14px] font-semibold text-chase-textPrimary">
            {openedClaim ? "Claim opened" : "No claim needed"}
          </Text>
          <Text className="mt-1 text-[13px] leading-5 text-chase-textSecondary">
            {result.message}
          </Text>

          {result.card && (
            <View className="mt-3 flex-row items-center rounded-xl border border-chase-border bg-white px-3 py-2.5">
              <CreditCard color="#6F647B" size={15} strokeWidth={2} />
              <Text className="ml-2.5 flex-1 text-[13px] text-chase-textPrimary">
                {result.card.network} ····{result.card.last4}
              </Text>
              <Text className="text-[12px] font-semibold text-chase-purple600">
                {result.card.status === "cancelled"
                  ? result.card.replacementOrdered
                    ? "Cancelled · replacement on the way"
                    : "Cancelled"
                  : result.card.status === "locked"
                    ? "Blocked"
                    : "Active"}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export function TriageCard({ form, result, onAnswered, onAuthError }: TriageCardProps) {
  const chargeField = fieldByName(form, "transactionId");
  const recognitionField = fieldByName(form, "recognition");
  const cardActionField = fieldByName(form, "cardAction");
  const cardField = fieldByName(form, "cardId");
  const noteField = fieldByName(form, "note");

  const [transactionId, setTransactionId] = useState<string>(
    (chargeField?.prefill as string) ?? chargeField?.options[0]?.value ?? "",
  );
  const [recognition, setRecognition] = useState<string>("");
  const [cardAction, setCardAction] = useState<string>("none");
  const [cardId, setCardId] = useState<string | null>((cardField?.prefill as string) ?? null);
  const [note, setNote] = useState("");
  const [showOtherCharges, setShowOtherCharges] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charge = useMemo(
    () => chargeField?.options.find((option) => option.value === transactionId),
    [chargeField, transactionId],
  );
  const opensClaim = recognition === "not_recognised";
  const canSubmit = !submitting && recognition !== "";

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      onAnswered(
        await answerTriage(form.formId, {
          transactionId,
          recognition,
          cardAction: opensClaim ? cardAction : "none",
          cardId: opensClaim && cardAction !== "none" ? cardId : null,
          note,
        }),
      );
    } catch (answerError) {
      if (answerError instanceof ApiRequestError) {
        setError(answerError.message);
      } else if (answerError instanceof Error && answerError.name === "AuthenticationError") {
        onAuthError();
      } else {
        setError("Could not send that just now. Please try again.");
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
        {/* Header */}
        <View className="flex-row items-center border-b border-chase-border bg-chase-lightBlue px-4 py-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-chase-blue">
            <ShieldAlert color="#FFFFFF" size={17} strokeWidth={2} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-[15px] font-semibold text-chase-textPrimary">{form.title}</Text>
            <Text className="mt-0.5 text-[12px] leading-4 text-chase-textSecondary">
              {result ? "Answered" : "A few questions before anything is blocked."}
            </Text>
          </View>
        </View>

        {result ? (
          <TriageOutcome result={result} />
        ) : (
          <>
            <View className="px-4 py-4">
              {/* The charge in question */}
              {chargeField && charge && (
                <View>
                  <SectionLabel>The charge</SectionLabel>
                  <View className="flex-row items-center rounded-xl border border-chase-border bg-white px-3 py-2.5">
                    <View className="flex-1">
                      <Text className="text-[14px] font-medium text-chase-textPrimary">
                        {charge.merchant ?? charge.label}
                      </Text>
                      <Text className="mt-0.5 text-[12px] text-chase-textMuted">
                        {formatDate(charge.createdAt)}
                      </Text>
                    </View>
                    <Text className="text-[14px] font-semibold text-chase-textPrimary">
                      {formatAmount(charge.amountCents)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowOtherCharges((value) => !value)}
                    className="mt-2 py-1"
                  >
                    <Text className="text-[13px] font-medium text-chase-purple600">
                      {showOtherCharges ? "Hide other charges" : "It was a different charge"}
                    </Text>
                  </Pressable>
                  {showOtherCharges && (
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                      style={{ maxHeight: 180 }}
                      contentContainerStyle={{ gap: 6, paddingTop: 4 }}
                    >
                      {chargeField.options
                        .filter((option) => option.value !== transactionId)
                        .map((option) => (
                          <Pressable
                            key={option.value}
                            accessibilityRole="button"
                            onPress={() => {
                              setTransactionId(option.value);
                              setShowOtherCharges(false);
                            }}
                            className="flex-row items-center rounded-xl border border-chase-border bg-white px-3 py-2.5"
                          >
                            <View className="flex-1">
                              <Text className="text-[13px] text-chase-textPrimary">
                                {option.merchant ?? option.label}
                              </Text>
                              <Text className="mt-0.5 text-[12px] text-chase-textMuted">
                                {formatDate(option.createdAt)}
                              </Text>
                            </View>
                            <Text className="text-[13px] font-semibold text-chase-textPrimary">
                              {formatAmount(option.amountCents)}
                            </Text>
                          </Pressable>
                        ))}
                    </ScrollView>
                  )}
                </View>
              )}

              {/* Did you make this? */}
              {recognitionField && (
                <View className="mt-5">
                  <SectionLabel>{recognitionField.label}</SectionLabel>
                  {recognitionField.helpText && (
                    <Text className="mb-2 text-[12px] leading-4 text-chase-textMuted">
                      {recognitionField.helpText}
                    </Text>
                  )}
                  <View style={{ gap: 4 }}>
                    {recognitionField.options.map((option) => (
                      <OptionRow
                        key={option.value}
                        option={option}
                        selected={recognition === option.value}
                        disabled={submitting}
                        onPress={() => setRecognition(option.value)}
                      >
                        {recognition === option.value && option.outcome && (
                          <Text className="ml-[30px] mt-1 text-[12px] leading-4 text-chase-textSecondary">
                            {option.outcome}
                          </Text>
                        )}
                      </OptionRow>
                    ))}
                  </View>
                </View>
              )}

              {/* Card protection — only once they disown the charge */}
              {opensClaim && cardActionField && (
                <View className="mt-5">
                  <SectionLabel>{cardActionField.label}</SectionLabel>
                  <View style={{ gap: 4 }}>
                    {cardActionField.options.map((option) => (
                      <OptionRow
                        key={option.value}
                        option={option}
                        selected={cardAction === option.value}
                        disabled={submitting}
                        onPress={() => setCardAction(option.value)}
                      />
                    ))}
                  </View>

                  {cardAction !== "none" && cardField && (
                    <View className="mt-3">
                      <SectionLabel>{cardField.label}</SectionLabel>
                      <View style={{ gap: 6 }}>
                        {cardField.options.map((option) => {
                          const selected = cardId === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              accessibilityRole="radio"
                              accessibilityState={{ selected }}
                              disabled={submitting}
                              onPress={() => setCardId(option.value)}
                              className={`flex-row items-center rounded-xl border px-3 py-2.5 ${
                                selected
                                  ? "border-chase-purple600 bg-chase-lightBlue"
                                  : "border-chase-border bg-white"
                              }`}
                            >
                              <CreditCard
                                color={selected ? "#5B3D85" : "#6F647B"}
                                size={15}
                                strokeWidth={2}
                              />
                              {/* Named to the last four: a mis-tap is visible before it happens. */}
                              <Text className="ml-2.5 flex-1 text-[13px] text-chase-textPrimary">
                                {option.label}
                              </Text>
                              {selected && <Check color="#5B3D85" size={15} strokeWidth={3} />}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Note */}
              {opensClaim && noteField && (
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

            {/* Footer */}
            <View className="border-t border-chase-border bg-chase-bg px-4 py-3">
              {opensClaim && (
                <Text className="mb-2.5 text-[11px] leading-4 text-chase-textMuted">
                  {form.investigationNotice}
                </Text>
              )}
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
                    canSubmit ? "text-white" : "text-chase-textMuted"
                  }`}
                >
                  {recognition === ""
                    ? "Answer to continue"
                    : opensClaim
                      ? cardAction === "lock"
                        ? "Block card and open a claim"
                        : cardAction === "replace"
                          ? "Replace card and open a claim"
                          : "Open a claim"
                      : "Send answer"}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Animated.View>
  );
}
