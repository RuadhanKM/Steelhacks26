import { Check, ChevronDown, ChevronUp, ReceiptText } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

import { ApiRequestError } from "@/services/apiClient";
import { submitDispute } from "@/services/disputeService";
import type {
  DisputeCase,
  DisputeForm,
  DisputeFormField,
  DisputeFormOption,
} from "@/types/chat";

interface DisputeFormCardProps {
  readonly form: DisputeForm;
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

function fieldByName(form: DisputeForm, name: string): DisputeFormField | undefined {
  return form.fields.find((field) => field.name === name);
}

/** Small uppercase label that separates the card into steps. */
function SectionLabel({ children }: { readonly children: string }) {
  return (
    <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-chase-textMuted">
      {children}
    </Text>
  );
}

function Checkbox({ checked }: { readonly checked: boolean }) {
  return (
    <View
      className={`h-[18px] w-[18px] items-center justify-center rounded-[5px] border-2 ${
        checked ? "border-chase-purple600 bg-chase-purple600" : "border-chase-border bg-white"
      }`}
    >
      {checked && <Check color="#FFFFFF" size={12} strokeWidth={3} />}
    </View>
  );
}

/** One charge: merchant and date on the left, amount right-aligned so they line up. */
function ChargeRow({
  option,
  selected,
  disabled,
  onPress,
}: {
  readonly option: DisputeFormOption;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`flex-row items-center rounded-xl border px-3 py-2.5 ${
        selected ? "border-chase-purple600 bg-chase-lightBlue" : "border-chase-border bg-white"
      }`}
    >
      <Checkbox checked={selected} />
      <View className="ml-3 flex-1">
        <Text className="text-[14px] font-medium text-chase-textPrimary" numberOfLines={1}>
          {option.merchant ?? option.label}
        </Text>
        <Text className="mt-0.5 text-[12px] text-chase-textMuted">
          {formatDate(option.createdAt)}
          {option.isDuplicateCandidate ? " · looks like a repeat" : ""}
        </Text>
      </View>
      <Text className="ml-3 text-[14px] font-semibold text-chase-textPrimary">
        {formatAmount(option.amountCents)}
      </Text>
    </Pressable>
  );
}

export function DisputeFormCard({
  form,
  submittedCaseId,
  onSubmitted,
  onAuthError,
}: DisputeFormCardProps) {
  const accountField = fieldByName(form, "accountId");
  const reasonField = fieldByName(form, "reasonCode");
  const chargesField = fieldByName(form, "transactionIds");
  const noteField = fieldByName(form, "note");
  const contactedField = fieldByName(form, "contactedMerchant");

  // The server prefills a likely duplicate pair; the customer can change any of it.
  const [accountId, setAccountId] = useState<string>(
    (accountField?.prefill as string) ?? accountField?.options[0]?.value ?? "",
  );
  const [reasonCode, setReasonCode] = useState<string>(
    (reasonField?.prefill as string) ?? reasonField?.options[0]?.value ?? "",
  );
  const [transactionIds, setTransactionIds] = useState<string[]>(
    (chargesField?.prefill as string[]) ?? [],
  );
  const [note, setNote] = useState<string>("");
  const [contactedMerchant, setContactedMerchant] = useState<boolean>(
    Boolean(contactedField?.prefill),
  );
  const [showAllCharges, setShowAllCharges] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSubmitted = Boolean(submittedCaseId);

  // Only charges on the chosen account are selectable, matching what the
  // backend will accept.
  const charges = useMemo(
    () => (chargesField?.options ?? []).filter((option) => option.accountId === accountId),
    [accountId, chargesField],
  );

  // The suggested pair leads; the rest stays behind a disclosure so the card
  // does not open as a wall of twenty rows.
  const suggested = useMemo(
    () => charges.filter((option) => option.isDuplicateCandidate),
    [charges],
  );
  const others = useMemo(
    () => charges.filter((option) => !option.isDuplicateCandidate),
    [charges],
  );
  const listExpanded = showAllCharges || suggested.length === 0;

  const selectedCharges = charges.filter((option) => transactionIds.includes(option.value));
  const selectedTotal = selectedCharges.reduce(
    (total, option) => total + Math.abs(option.amountCents ?? 0),
    0,
  );

  const chargesRequired =
    reasonField?.options.find((option) => option.value === reasonCode)?.chargesRequired ?? 1;
  const canSubmit =
    !submitting && !isSubmitted && accountId !== "" && transactionIds.length >= chargesRequired;

  const toggleCharge = (value: string) => {
    setTransactionIds((current) =>
      current.includes(value) ? current.filter((id) => id !== value) : [...current, value],
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const opened = await submitDispute({
        formId: form.formId,
        accountId,
        reasonCode,
        transactionIds,
        note: note.trim() === "" ? undefined : note.trim(),
        contactedMerchant,
      });
      onSubmitted(opened);
    } catch (submitError) {
      if (submitError instanceof ApiRequestError) {
        setError(submitError.message);
      } else if (submitError instanceof Error && submitError.name === "AuthenticationError") {
        onAuthError();
      } else {
        setError("Could not submit right now. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      layout={LinearTransition.springify().damping(20)}
      className="px-4 py-2"
    >
      <View className="overflow-hidden rounded-2xl border border-chase-border bg-chase-card">
        {/* Header */}
        <View className="flex-row items-center border-b border-chase-border bg-chase-lightBlue px-4 py-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-chase-blue">
            <ReceiptText color="#FFFFFF" size={17} strokeWidth={2} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-[15px] font-semibold text-chase-textPrimary">{form.title}</Text>
            <Text className="mt-0.5 text-[12px] leading-4 text-chase-textSecondary">
              Pick the charges you want a banker to review.
            </Text>
          </View>
        </View>

        <View className="px-4 py-4">
          {/* Account */}
          {accountField && (
            <View>
              <SectionLabel>Account</SectionLabel>
              <View className="flex-row" style={{ gap: 8 }}>
                {accountField.options.map((option) => {
                  const selected = option.value === accountId;
                  const [name, balance] = option.label.split(" — ");
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={isSubmitted}
                      onPress={() => {
                        setAccountId(option.value);
                        setTransactionIds([]);
                      }}
                      className={`flex-1 rounded-xl border px-3 py-2.5 ${
                        selected
                          ? "border-chase-purple600 bg-chase-lightBlue"
                          : "border-chase-border bg-white"
                      }`}
                    >
                      <Text
                        className={`text-[13px] ${
                          selected
                            ? "font-semibold text-chase-blue"
                            : "font-medium text-chase-textSecondary"
                        }`}
                      >
                        {name}
                      </Text>
                      <Text className="mt-0.5 text-[12px] text-chase-textMuted">{balance}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Reason */}
          {reasonField && (
            <View className="mt-5">
              <SectionLabel>What went wrong</SectionLabel>
              <View style={{ gap: 6 }}>
                {reasonField.options.map((option) => {
                  const selected = option.value === reasonCode;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      disabled={isSubmitted}
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
                        {selected && (
                          <View className="h-2 w-2 rounded-full bg-chase-purple600" />
                        )}
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

          {/* Charges */}
          {chargesField && (
            <View className="mt-5">
              <SectionLabel>
                {chargesRequired > 1 ? `Charges · pick ${chargesRequired}` : "Charges"}
              </SectionLabel>

              {suggested.length > 0 && (
                <View style={{ gap: 6 }}>
                  <Text className="text-[12px] text-chase-textSecondary">
                    These two look like the same purchase.
                  </Text>
                  {suggested.map((option) => (
                    <ChargeRow
                      key={option.value}
                      option={option}
                      selected={transactionIds.includes(option.value)}
                      disabled={isSubmitted}
                      onPress={() => toggleCharge(option.value)}
                    />
                  ))}
                </View>
              )}

              {others.length > 0 && suggested.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowAllCharges((value) => !value)}
                  className="mt-2 flex-row items-center py-1"
                >
                  <Text className="text-[13px] font-medium text-chase-purple600">
                    {showAllCharges
                      ? "Hide other charges"
                      : `Choose a different charge (${others.length})`}
                  </Text>
                  {showAllCharges ? (
                    <ChevronUp color="#5B3D85" size={15} strokeWidth={2.5} />
                  ) : (
                    <ChevronDown color="#5B3D85" size={15} strokeWidth={2.5} />
                  )}
                </Pressable>
              )}

              {/* Capped height: a long history scrolls inside the card rather
                  than pushing the submit button off the conversation. */}
              {listExpanded && others.length > 0 && (
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 208 }}
                  contentContainerStyle={{ gap: 6, paddingTop: suggested.length > 0 ? 6 : 0 }}
                >
                  {others.map((option) => (
                    <ChargeRow
                      key={option.value}
                      option={option}
                      selected={transactionIds.includes(option.value)}
                      disabled={isSubmitted}
                      onPress={() => toggleCharge(option.value)}
                    />
                  ))}
                </ScrollView>
              )}

              {charges.length === 0 && (
                <Text className="text-[13px] text-chase-textMuted">
                  No recent charges on this account.
                </Text>
              )}
            </View>
          )}

          {/* Details */}
          <View className="mt-5">
            <SectionLabel>Details</SectionLabel>
            {contactedField && (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: contactedMerchant }}
                disabled={isSubmitted}
                onPress={() => setContactedMerchant((value) => !value)}
                className="flex-row items-center py-1"
              >
                <Checkbox checked={contactedMerchant} />
                <Text className="ml-3 flex-1 text-[13px] text-chase-textSecondary">
                  {contactedField.label}
                </Text>
              </Pressable>
            )}

            {noteField && !showNote && !isSubmitted && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowNote(true)}
                className="mt-1 py-1"
              >
                <Text className="text-[13px] font-medium text-chase-purple600">Add a note</Text>
              </Pressable>
            )}

            {noteField && (showNote || isSubmitted) && (
              <TextInput
                editable={!isSubmitted}
                multiline
                onChangeText={setNote}
                placeholder="Anything else the reviewer should know? (optional)"
                placeholderTextColor="#A79CAF"
                value={note}
                className="mt-2 min-h-[68px] rounded-xl border border-chase-border bg-white px-3 py-2.5 text-[13px] leading-5 text-chase-textPrimary"
                style={{ textAlignVertical: "top" }}
              />
            )}
          </View>
        </View>

        {/* Footer: what is about to happen, then the action. */}
        <View className="border-t border-chase-border bg-chase-bg px-4 py-3">
          {error && (
            <Text className="mb-2 text-[12px] text-red-600" accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}

          <View className="mb-2.5 flex-row items-center justify-between">
            <Text className="text-[12px] text-chase-textSecondary">
              {transactionIds.length === 0
                ? `Select ${chargesRequired} charge${chargesRequired === 1 ? "" : "s"} to continue`
                : `${transactionIds.length} charge${
                    transactionIds.length === 1 ? "" : "s"
                  } selected`}
            </Text>
            {selectedTotal > 0 && (
              <Text className="text-[13px] font-semibold text-chase-textPrimary">
                {formatAmount(selectedTotal)}
              </Text>
            )}
          </View>

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
              {isSubmitted ? "Case opened" : "Open a dispute case"}
            </Text>
          </Pressable>

          <Text className="mt-2 text-center text-[11px] leading-4 text-chase-textMuted">
            A banker reviews it. Nothing is reversed yet.
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

export { formatAmount };
