import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

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

type StepId = 1 | 2 | 3 | 4;

interface DisputeAnswers {
  accountId: string;
  reasonCode: string;
  transactionIds: string[];
  contactedMerchant: boolean | null;
}

interface StepOption {
  value: string;
  title: string;
  subtitle?: string;
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

/** Blue radio circle displayed on the left side of single-select options. */
function BlueRadio({ selected }: { readonly selected: boolean }) {
  return (
    <View
      className={`mr-3 h-4 w-4 items-center justify-center rounded-full border-2 ${selected ? "border-blue-600 bg-white" : "border-chase-border bg-white"
        }`}
    >
      {selected && <View className="h-2 w-2 rounded-full bg-blue-600" />}
    </View>
  );
}

/** Blue checkbox displayed on the left side of transaction options (allows picking up to 2). */
function BlueCheckbox({
  checked,
  disabled,
}: {
  readonly checked: boolean;
  readonly disabled?: boolean;
}) {
  return (
    <View
      className={`mr-3 h-4 w-4 items-center justify-center rounded-[4px] border-2 ${checked
          ? "border-blue-600 bg-blue-600"
          : disabled
            ? "border-gray-200 bg-gray-50"
            : "border-chase-border bg-white"
        }`}
    >
      {checked && <Check color="#FFFFFF" size={10} strokeWidth={3.5} />}
    </View>
  );
}

interface OptionRowStyleProps {
  isSelected: boolean;
  isFlashing?: boolean;
  hovered?: boolean;
  pressed?: boolean;
  disabled?: boolean;
}

function getOptionRowStyle({
  isSelected,
  isFlashing,
  hovered,
  pressed,
  disabled,
}: OptionRowStyleProps) {
  if (disabled) {
    return {
      backgroundColor: "transparent",
      opacity: 0.4,
      cursor: "not-allowed" as any,
    };
  }

  // Guaranteed visible gray flash on tap start or active press
  if (isFlashing || pressed) {
    return {
      backgroundColor: "#D1D5DB",
      cursor: "pointer" as any,
    };
  }

  // Desktop hover
  if (hovered) {
    return {
      backgroundColor: isSelected ? "rgba(37, 99, 235, 0.13)" : "#F3F4F6",
      cursor: "pointer" as any,
    };
  }

  // Idle state
  return {
    backgroundColor: isSelected ? "rgba(37, 99, 235, 0.08)" : "transparent",
    cursor: "pointer" as any,
  };
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
  const contactedField = fieldByName(form, "contactedMerchant");

  // Step state, animation direction & Answers
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [showOtherCharges, setShowOtherCharges] = useState(false);

  const initialPrefilledCharges = (chargesField?.prefill as string[]) ?? [];
  const [answers, setAnswers] = useState<DisputeAnswers>({
    accountId: "",
    reasonCode: "",
    transactionIds: initialPrefilledCharges.length === 2 ? initialPrefilledCharges : [],
    contactedMerchant: null,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSubmitted = Boolean(submittedCaseId);
  const firstOptionRef = useRef<View | null>(null);

  // Height animation without scaling/stretching content
  const animatedHeight = useSharedValue<number>(0);
  const isMounted = useRef(false);

  const onContentLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = Math.round(e.nativeEvent.layout.height);
      if (h <= 0) return;

      if (!isMounted.current) {
        isMounted.current = true;
        animatedHeight.value = h;
      } else {
        animatedHeight.value = withTiming(h, { duration: 240 });
      }
    },
    [animatedHeight],
  );

  const animatedBubbleStyle = useAnimatedStyle(() => {
    if (animatedHeight.value === 0) return {};
    return {
      height: animatedHeight.value,
    };
  });

  // Auto-focus the first option of the new step
  useEffect(() => {
    const timer = setTimeout(() => {
      (firstOptionRef.current as any)?.focus?.();
    }, 60);
    return () => clearTimeout(timer);
  }, [currentStep]);

  // Derived options for Step 1
  const accountOptions: StepOption[] = useMemo(() => {
    if (accountField?.options && accountField.options.length > 0) {
      return accountField.options.map((opt) => ({
        value: opt.value,
        title: opt.label.split(" — ")[0] || opt.label,
        subtitle: opt.label.includes(" — ") ? opt.label.split(" — ")[1] : undefined,
      }));
    }
    return [
      { value: "checking", title: "Checking" },
      { value: "savings", title: "Savings" },
    ];
  }, [accountField]);

  // Derived options for Step 2
  const reasonOptions: StepOption[] = useMemo(() => {
    if (reasonField?.options && reasonField.options.length > 0) {
      return reasonField.options.map((opt) => ({
        value: opt.value,
        title: opt.label,
      }));
    }
    return [
      { value: "duplicate", title: "I was charged more than once for the same purchase" },
      { value: "unauthorized", title: "I did not authorize this charge" },
      { value: "wrong_amount", title: "The amount is wrong" },
      { value: "not_received", title: "I never received what I paid for" },
    ];
  }, [reasonField]);

  // Derived transactions for Step 3
  const rawCharges: DisputeFormOption[] = useMemo(() => {
    const available = chargesField?.options ?? [];
    const matching = answers.accountId
      ? available.filter((opt) => opt.accountId === answers.accountId)
      : available;
    const finalCharges = matching.length > 0 ? matching : available;

    if (finalCharges.length > 0) {
      return finalCharges;
    }

    // Default sample fallback matching the design wireframe
    return [
      {
        value: "tx_1",
        label: "Blue Bottle Coffee",
        merchant: "Blue Bottle Coffee",
        createdAt: "2026-09-17T12:00:00Z",
        amountCents: 2410,
        isDuplicateCandidate: true,
      },
      {
        value: "tx_2",
        label: "Riverside Market",
        merchant: "Riverside Market",
        createdAt: "2026-09-15T10:30:00Z",
        amountCents: 8642,
        isDuplicateCandidate: true,
      },
      {
        value: "tx_3",
        label: "Halide Auto Repair",
        merchant: "Halide Auto Repair",
        createdAt: "2026-09-12T14:15:00Z",
        amountCents: 41200,
        isDuplicateCandidate: false,
      },
      {
        value: "tx_4",
        label: "Northside Pharmacy",
        merchant: "Northside Pharmacy",
        createdAt: "2026-09-09T09:45:00Z",
        amountCents: 3175,
        isDuplicateCandidate: false,
      },
      {
        value: "tx_5",
        label: "Lumen Utilities",
        merchant: "Lumen Utilities",
        createdAt: "2026-09-05T16:20:00Z",
        amountCents: 12890,
        isDuplicateCandidate: false,
      },
    ];
  }, [answers.accountId, chargesField]);

  const { recommendedCharges, otherCharges } = useMemo(() => {
    const recommended = rawCharges.filter((opt) => opt.isDuplicateCandidate);
    const others = rawCharges.filter((opt) => !opt.isDuplicateCandidate);

    if (recommended.length === 0 && rawCharges.length > 3) {
      return {
        recommendedCharges: rawCharges.slice(0, 2),
        otherCharges: rawCharges.slice(2),
      };
    }

    return {
      recommendedCharges: recommended.length > 0 ? recommended : rawCharges,
      otherCharges: recommended.length > 0 ? others : [],
    };
  }, [rawCharges]);

  // Selected charges for Step 4 review
  const selectedTransactions = useMemo(() => {
    return rawCharges.filter((c) => answers.transactionIds.includes(c.value));
  }, [answers.transactionIds, rawCharges]);

  const selectedAccountLabel = useMemo(() => {
    return (
      accountOptions.find((o) => o.value === answers.accountId)?.title ??
      answers.accountId ??
      "Checking"
    );
  }, [accountOptions, answers.accountId]);

  const selectedReasonLabel = useMemo(() => {
    return (
      reasonOptions.find((o) => o.value === answers.reasonCode)?.title ??
      answers.reasonCode ??
      "Dispute"
    );
  }, [answers.reasonCode, reasonOptions]);

  // Step 4 Options
  const merchantContactOptions: StepOption[] = useMemo(
    () => [
      { value: "true", title: "I have contacted the merchant" },
      { value: "false", title: "I have not contacted the merchant" },
    ],
    [],
  );

  // Execute submission logic
  const handleFinalSubmit = useCallback(
    async (finalAnswers: DisputeAnswers) => {
      setSubmitting(true);
      setError(null);
      try {
        const opened = await submitDispute({
          formId: form.formId,
          accountId: finalAnswers.accountId || accountOptions[0]?.value || "checking",
          reasonCode: finalAnswers.reasonCode || reasonOptions[0]?.value || "wrong_amount",
          transactionIds:
            finalAnswers.transactionIds.length > 0
              ? finalAnswers.transactionIds
              : [rawCharges[0]?.value || "tx_1"],
          contactedMerchant: Boolean(finalAnswers.contactedMerchant),
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
    },
    [accountOptions, form.formId, onAuthError, onSubmitted, rawCharges, reasonOptions],
  );

  const isNavigatingRef = useRef(false);
  const [flashingOptionValue, setFlashingOptionValue] = useState<string | null>(null);
  const hasExactTwoCharges = answers.transactionIds.length === 2;

  // Single select for Step 1 and 2: guarantees visible gray flash before setting answer & transitioning
  const handleSingleSelect = (step: StepId, optionValue: string) => {
    if (isNavigatingRef.current || submitting || isSubmitted) return;
    setError(null);
    isNavigatingRef.current = true;
    setFlashingOptionValue(optionValue);

    // Visible gray flash for 150ms
    setTimeout(() => {
      setFlashingOptionValue(null);
      if (step === 1) {
        setAnswers((prev) => ({ ...prev, accountId: optionValue }));
      } else if (step === 2) {
        setAnswers((prev) => ({ ...prev, reasonCode: optionValue }));
      }

      // Brief selection display (blue overlay) before sliding forward
      setTimeout(() => {
        setDirection("forward");
        setCurrentStep((step + 1) as StepId);
        isNavigatingRef.current = false;
      }, 120);
    }, 150);
  };

  // Toggle selection for Step 3 (Allows picking only up to 2 options)
  const handleToggleTransaction = (txId: string) => {
    setFlashingOptionValue(txId);
    setTimeout(() => {
      setFlashingOptionValue(null);
    }, 150);

    setAnswers((prev) => {
      const isChecked = prev.transactionIds.includes(txId);
      if (isChecked) {
        return {
          ...prev,
          transactionIds: prev.transactionIds.filter((id) => id !== txId),
        };
      }
      if (prev.transactionIds.length >= 2) {
        // Enforce maximum of 2 selections
        return prev;
      }
      return {
        ...prev,
        transactionIds: [...prev.transactionIds, txId],
      };
    });
  };

  // Step 4 merchant contact selection with visible gray flash
  const handleSelectMerchantContact = (contacted: boolean) => {
    const valKey = String(contacted);
    setFlashingOptionValue(valKey);
    setTimeout(() => {
      setFlashingOptionValue(null);
      setAnswers((prev) => ({
        ...prev,
        contactedMerchant: contacted,
      }));
    }, 150);
  };

  // Back affordance with backward swipe direction
  const handleBack = () => {
    if (isNavigatingRef.current || submitting || isSubmitted) return;
    if (currentStep > 1) {
      setError(null);
      setDirection("backward");
      setCurrentStep((prev) => (prev - 1) as StepId);
    }
  };

  const renderTransactionItem = (
    option: DisputeFormOption,
    index: number,
    isFirst: boolean = false,
  ) => {
    const isChecked = answers.transactionIds.includes(option.value);
    const isMaxReached = answers.transactionIds.length >= 2 && !isChecked;
    const dateStr = formatDate(option.createdAt);
    const amountStr = formatAmount(option.amountCents);
    const subtitle = [dateStr, amountStr].filter(Boolean).join(" · ");

    return (
      <Pressable
        key={option.value}
        ref={isFirst ? firstOptionRef : undefined}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isChecked, disabled: isMaxReached }}
        disabled={isMaxReached}
        focusable={!isMaxReached}
        onPress={() => handleToggleTransaction(option.value)}
        className="border-t border-chase-border flex-row items-center justify-between px-4 py-3.5"
        style={({ pressed, hovered }) =>
          getOptionRowStyle({
            isSelected: isChecked,
            isFlashing: flashingOptionValue === option.value,
            hovered,
            pressed,
            disabled: isMaxReached,
          })
        }
      >
        <View className="flex-row items-center flex-1 pr-3">
          <BlueCheckbox checked={isChecked} disabled={isMaxReached} />
          <View className="flex-1">
            <Text className="text-[14px] font-medium text-chase-textPrimary leading-5">
              {option.merchant ?? option.label}
            </Text>
            {subtitle ? (
              <Text className="mt-0.5 text-[12px] text-chase-textMuted leading-4">{subtitle}</Text>
            ) : null}
          </View>
        </View>
        <ChevronRight color={isChecked ? "#2563EB" : "#A79CAF"} size={16} strokeWidth={2} />
      </Pressable>
    );
  };

  return (
    <View className="mb-4 px-4 flex items-start">
      <Animated.View
        entering={FadeIn.duration(180)}
        style={[
          {
            alignSelf: "flex-start",
            width: "100%",
            maxWidth: 360,
            backgroundColor: "#FFFFFF",
            borderColor: "#D4C8E0",
            borderWidth: 1,
            borderRadius: 14,
            borderBottomLeftRadius: 4,
            overflow: "hidden",
          },
          animatedBubbleStyle,
        ]}
      >
        {/* Inner measurement container to drive smooth height transition without scaling */}
        <View onLayout={onContentLayout} style={{ width: "100%" }}>
          {isSubmitted ? (
            <View className="p-4 flex-row items-center">
              <View className="h-8 w-8 rounded-full bg-chase-lightBlue items-center justify-center mr-3">
                <Check color="#5B3D85" size={16} strokeWidth={2.5} />
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-semibold text-chase-textPrimary">
                  Dispute submitted
                </Text>
                <Text className="text-[12px] text-chase-textMuted mt-0.5">
                  Case {submittedCaseId ?? "opened"} · Under banker review
                </Text>
              </View>
            </View>
          ) : (
            <Animated.View
              key={currentStep}
              entering={
                direction === "forward" ? SlideInRight.duration(220) : SlideInLeft.duration(220)
              }
              style={{ width: "100%" }}
            >
              {/* Question Header */}
              <View className="flex-row items-center px-4 pt-3.5 pb-3">
                {currentStep > 1 && !submitting && (
                  <Pressable
                    accessibilityLabel="Go back to previous step"
                    accessibilityRole="button"
                    onPress={handleBack}
                    className="mr-2 -ml-1 p-1 rounded-md"
                    style={({ pressed, hovered }) => ({
                      backgroundColor:
                        pressed ? "#E5E7EB" : hovered ? "rgba(91, 61, 133, 0.08)" : "transparent",
                    })}
                  >
                    <ChevronLeft color="#5B3D85" size={18} strokeWidth={2.5} />
                  </Pressable>
                )}
                <Text className="text-[15px] font-semibold text-chase-textPrimary flex-1 leading-5">
                  {currentStep === 1
                    ? "Which account is this about?"
                    : currentStep === 2
                      ? "What went wrong?"
                      : currentStep === 3
                        ? "Select a transaction"
                        : "Have you contacted the merchant?"}
                </Text>
              </View>

              {/* Error banner if submit fails */}
              {error && (
                <View className="border-t border-red-200 bg-red-50 px-4 py-2 flex-row items-center justify-between">
                  <Text className="text-[12px] text-red-700 flex-1 pr-2">{error}</Text>
                  <Pressable
                    onPress={() => handleFinalSubmit(answers)}
                    className="bg-red-700 px-2.5 py-1 rounded-md"
                  >
                    <Text className="text-[11px] font-semibold text-white">Retry</Text>
                  </Pressable>
                </View>
              )}

              {/* Step 1: Account Selection (with Blue Radio Circle) */}
              {currentStep === 1 && (
                <View>
                  {accountOptions.map((option, index) => {
                    const isSelected = answers.accountId === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        ref={index === 0 ? firstOptionRef : undefined}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        focusable={true}
                        onPress={() => handleSingleSelect(1, option.value)}
                        className="border-t border-chase-border flex-row items-center justify-between px-4 py-3.5"
                        style={({ pressed, hovered }) =>
                          getOptionRowStyle({
                            isSelected,
                            isFlashing: flashingOptionValue === option.value,
                            hovered,
                            pressed,
                          })
                        }
                      >
                        <View className="flex-row items-center flex-1 pr-3">
                          <BlueRadio selected={isSelected} />
                          <View className="flex-1">
                            <Text className="text-[14px] font-medium text-chase-textPrimary leading-5">
                              {option.title}
                            </Text>
                            {option.subtitle ? (
                              <Text className="mt-0.5 text-[12px] text-chase-textMuted leading-4">
                                {option.subtitle}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <ChevronRight
                          color={isSelected ? "#2563EB" : "#A79CAF"}
                          size={16}
                          strokeWidth={2}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Step 2: Issue Type Selection (with Blue Radio Circle) */}
              {currentStep === 2 && (
                <View>
                  {reasonOptions.map((option, index) => {
                    const isSelected = answers.reasonCode === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        ref={index === 0 ? firstOptionRef : undefined}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        focusable={true}
                        onPress={() => handleSingleSelect(2, option.value)}
                        className="border-t border-chase-border flex-row items-center justify-between px-4 py-3.5"
                        style={({ pressed, hovered }) =>
                          getOptionRowStyle({
                            isSelected,
                            isFlashing: flashingOptionValue === option.value,
                            hovered,
                            pressed,
                          })
                        }
                      >
                        <View className="flex-row items-center flex-1 pr-3">
                          <BlueRadio selected={isSelected} />
                          <View className="flex-1">
                            <Text className="text-[14px] font-medium text-chase-textPrimary leading-5">
                              {option.title}
                            </Text>
                          </View>
                        </View>
                        <ChevronRight
                          color={isSelected ? "#2563EB" : "#A79CAF"}
                          size={16}
                          strokeWidth={2}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Step 3: Transaction Selection (with Checkboxes - Allows Picking Only 2) */}
              {currentStep === 3 && (
                <View>
                  {/* Micro-instruction indicating 2 options */}
                  <View className="border-t border-chase-border bg-[#FAF8FC] px-4 py-2 flex-row items-center justify-between">
                    <Text className="text-[12px] text-chase-textSecondary">
                      Select 2 transactions to dispute
                    </Text>
                    <Text
                      className={`text-[12px] font-semibold ${hasExactTwoCharges ? "text-blue-600" : "text-chase-textSecondary"
                        }`}
                    >
                      {answers.transactionIds.length} / 2 selected
                    </Text>
                  </View>

                  {/* Recommended Similar Transactions */}
                  {recommendedCharges.map((option, index) =>
                    renderTransactionItem(option, index, index === 0),
                  )}

                  {/* Dropdown for Remaining Transactions */}
                  {otherCharges.length > 0 && (
                    <View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setShowOtherCharges((open) => !open)}
                        className="border-t border-chase-border flex-row items-center justify-between px-4 py-3 bg-[#FAF8FC]"
                        style={({ pressed, hovered }) => ({
                          backgroundColor:
                            pressed ? "#E5E7EB" : hovered ? "#F3F4F6" : "#FAF8FC",
                          cursor: "pointer",
                        })}
                      >
                        <Text className="text-[13px] font-semibold text-chase-purple600">
                          {showOtherCharges
                            ? "Hide other transactions"
                            : `Choose a different transaction (${otherCharges.length})`}
                        </Text>
                        {showOtherCharges ? (
                          <ChevronUp color="#5B3D85" size={16} strokeWidth={2} />
                        ) : (
                          <ChevronDown color="#5B3D85" size={16} strokeWidth={2} />
                        )}
                      </Pressable>

                      {/* Scrollable area for remaining transactions */}
                      {showOtherCharges && (
                        <ScrollView
                          nestedScrollEnabled
                          showsVerticalScrollIndicator={true}
                          style={{ maxHeight: 180 }}
                        >
                          {otherCharges.map((option, index) =>
                            renderTransactionItem(option, index),
                          )}
                        </ScrollView>
                      )}
                    </View>
                  )}

                  {/* Continue Button to Advance to Review - Requires EXACTLY 2 */}
                  <Pressable
                    accessibilityRole="button"
                    disabled={!hasExactTwoCharges}
                    onPress={() => {
                      if (!hasExactTwoCharges) return;
                      setDirection("forward");
                      setCurrentStep(4);
                    }}
                    className={`border-t border-chase-border flex-row items-center justify-center px-4 py-3.5 ${hasExactTwoCharges ? "bg-blue-600 active:bg-blue-700" : "bg-gray-100"
                      }`}
                    style={({ pressed, hovered }) => ({
                      cursor: (hasExactTwoCharges ? "pointer" : "not-allowed") as any,
                      backgroundColor:
                        hasExactTwoCharges
                          ? pressed
                            ? "#1E40AF"
                            : hovered
                              ? "#1D4ED8"
                              : "#2563EB"
                          : "#F3F4F6",
                    })}
                  >
                    <Text
                      className={`text-[14px] font-semibold ${hasExactTwoCharges ? "text-white" : "text-gray-400"
                        }`}
                    >
                      {answers.transactionIds.length === 0
                        ? "Select 2 charges to continue"
                        : answers.transactionIds.length === 1
                          ? "Select 1 more charge (1 of 2)"
                          : "Continue (2 of 2 selected)"}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* Step 4: Merchant Contact & Review Submit Screen */}
              {currentStep === 4 && (
                <View>
                  {/* Merchant Contact Radio Options with Blue Radio Circle */}
                  {merchantContactOptions.map((option, index) => {
                    const isSelected =
                      answers.contactedMerchant === (option.value === "true");
                    return (
                      <Pressable
                        key={option.value}
                        ref={index === 0 ? firstOptionRef : undefined}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        focusable={true}
                        onPress={() => handleSelectMerchantContact(option.value === "true")}
                        className="border-t border-chase-border flex-row items-center justify-between px-4 py-3.5"
                        style={({ pressed, hovered }) =>
                          getOptionRowStyle({
                            isSelected,
                            isFlashing: flashingOptionValue === option.value,
                            hovered,
                            pressed,
                          })
                        }
                      >
                        <View className="flex-row items-center flex-1 pr-3">
                          <BlueRadio selected={isSelected} />
                          <Text className="text-[14px] font-medium text-chase-textPrimary leading-5 flex-1">
                            {option.title}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}

                  {/* Dispute Options Review Summary */}
                  <View className="border-t border-chase-border bg-[#FAF8FC] px-4 py-3">
                    <Text className="text-[11px] font-bold uppercase tracking-wider text-chase-textMuted mb-2">
                      Review your selections
                    </Text>
                    <View style={{ gap: 4 }}>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-[12px] text-chase-textSecondary">Account</Text>
                        <Text className="text-[12px] font-medium text-chase-textPrimary">
                          {selectedAccountLabel}
                        </Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-[12px] text-chase-textSecondary">Issue</Text>
                        <Text
                          className="text-[12px] font-medium text-chase-textPrimary flex-1 text-right ml-4"
                          numberOfLines={1}
                        >
                          {selectedReasonLabel}
                        </Text>
                      </View>
                      <View className="flex-row justify-between items-start">
                        <Text className="text-[12px] text-chase-textSecondary pt-0.5">
                          Charges ({selectedTransactions.length})
                        </Text>
                        <View className="flex-1 items-end ml-4" style={{ gap: 2 }}>
                          {selectedTransactions.length > 0 ? (
                            selectedTransactions.map((tx) => (
                              <Text
                                key={tx.value}
                                className="text-[12px] font-medium text-chase-textPrimary text-right"
                                numberOfLines={1}
                              >
                                {tx.merchant ?? tx.label}
                              </Text>
                            ))
                          ) : (
                            <Text className="text-[12px] font-medium text-chase-textMuted text-right">
                              None selected
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Submit Button */}
                  <Pressable
                    accessibilityRole="button"
                    disabled={submitting || answers.contactedMerchant === null}
                    onPress={() => handleFinalSubmit(answers)}
                    className={`border-t border-chase-border flex-row items-center justify-center px-4 py-3.5 ${answers.contactedMerchant !== null && !submitting
                        ? "bg-blue-600 active:bg-blue-700"
                        : "bg-gray-100"
                      }`}
                    style={({ pressed, hovered }) => ({
                      cursor:
                        (answers.contactedMerchant !== null && !submitting ? "pointer" : "not-allowed") as any,
                      backgroundColor:
                        answers.contactedMerchant !== null && !submitting
                          ? pressed
                            ? "#1E40AF"
                            : hovered
                              ? "#1D4ED8"
                              : "#2563EB"
                          : "#F3F4F6",
                    })}
                  >
                    {submitting ? (
                      <>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text className="ml-2 text-[14px] font-semibold text-white">
                          Submitting dispute...
                        </Text>
                      </>
                    ) : (
                      <Text
                        className={`text-[14px] font-semibold ${answers.contactedMerchant !== null ? "text-white" : "text-gray-400"
                          }`}
                      >
                        Submit dispute
                      </Text>
                    )}
                  </Pressable>

                  <Text className="px-4 py-2.5 text-center text-[11px] leading-4 text-chase-textMuted bg-[#FAF8FC] border-t border-chase-border">
                    A banker reviews your claim. Nothing is reversed yet.
                  </Text>
                </View>
              )}
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

export { formatAmount };
