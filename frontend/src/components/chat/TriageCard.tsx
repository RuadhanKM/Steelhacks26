import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Info,
  ShieldAlert,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  TextInput,
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

type TriageStepId = 1 | 2 | 3 | 4;

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

/** Outcome view when customer has completed triage. */
function TriageOutcome({ result }: { readonly result: TriageResult }) {
  const openedClaim = result.outcome !== "no_claim";
  return (
    <View className="px-4 py-4">
      <View className="flex-row items-start">
        <View
          className={`mt-0.5 h-8 w-8 items-center justify-center rounded-full ${openedClaim ? "bg-chase-blue" : "bg-chase-lightBlue"
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
            <View className="mt-3 rounded-xl border border-chase-border bg-white p-3">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 pr-2">
                  <CreditCard color="#5B3D85" size={15} strokeWidth={2} />
                  <Text className="ml-2 text-[13px] font-semibold text-chase-textPrimary">
                    {result.card.network} ····{result.card.last4}
                  </Text>
                </View>
                <View className="rounded-full bg-purple-50 px-2.5 py-0.5 border border-purple-200">
                  <Text className="text-[11px] font-semibold text-chase-purple600">
                    {result.card.status === "cancelled"
                      ? "Cancelled"
                      : result.card.status === "locked"
                        ? "Blocked"
                        : "Active"}
                  </Text>
                </View>
              </View>

              {result.card.replacementOrdered && (
                <View className="mt-2.5 pt-2 border-t border-chase-border flex-row items-center">
                  <Text className="text-[12px] text-chase-textSecondary">
                    Replacement card on the way
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export function TriageCard({
  form,
  result,
  onAnswered,
  onAuthError,
}: TriageCardProps) {
  const chargeField = fieldByName(form, "transactionId");
  const recognitionField = fieldByName(form, "recognition");
  const cardActionField = fieldByName(form, "cardAction");
  const cardField = fieldByName(form, "cardId");
  const noteField = fieldByName(form, "note");

  // Step state, animation direction & Answers
  const [currentStep, setCurrentStep] = useState<TriageStepId>(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [showOtherCharges, setShowOtherCharges] = useState(false);

  const [transactionId, setTransactionId] = useState<string>(
    (chargeField?.prefill as string) ?? chargeField?.options[0]?.value ?? "",
  );
  const [recognition, setRecognition] = useState<string>("");
  const [cardAction, setCardAction] = useState<string>(
    (cardActionField?.prefill as string) ?? "none",
  );
  const [cardId, setCardId] = useState<string | null>(
    (cardField?.prefill as string) ?? cardField?.options[0]?.value ?? null,
  );
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashingOptionValue, setFlashingOptionValue] = useState<string | null>(null);
  const isNavigatingRef = useRef(false);
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

  // Derived charges
  const charge = useMemo(
    () =>
      chargeField?.options.find((option) => option.value === transactionId) ??
      chargeField?.options[0],
    [chargeField, transactionId],
  );

  const otherCharges = useMemo(
    () => chargeField?.options.filter((opt) => opt.value !== transactionId) ?? [],
    [chargeField, transactionId],
  );

  const opensClaim = recognition === "not_recognised";

  // Derived recognition options
  const recognitionOptions: DisputeFormOption[] = useMemo(() => {
    if (recognitionField?.options && recognitionField.options.length > 0) {
      return recognitionField.options;
    }
    return [
      {
        value: "recognised",
        label: "I recognise this charge",
        outcome: "No claim needed. We will keep your card active.",
      },
      {
        value: "not_recognised",
        label: "I do not recognise this charge",
        outcome: "We will help secure your card and open a claim.",
      },
    ];
  }, [recognitionField]);

  // Derived card action options
  const cardActionOptions: DisputeFormOption[] = useMemo(() => {
    if (cardActionField?.options && cardActionField.options.length > 0) {
      return cardActionField.options;
    }
    return [
      { value: "none", label: "Leave card active" },
      { value: "lock", label: "Block card (temporary)" },
      { value: "replace", label: "Cancel and replace card" },
    ];
  }, [cardActionField]);

  // Selected labels for Review Screen
  const selectedRecognitionLabel = useMemo(() => {
    return (
      recognitionOptions.find((opt) => opt.value === recognition)?.label ??
      recognition ??
      "Not answered"
    );
  }, [recognition, recognitionOptions]);

  const selectedCardActionLabel = useMemo(() => {
    return (
      cardActionOptions.find((opt) => opt.value === cardAction)?.label ??
      cardAction ??
      "Leave card active"
    );
  }, [cardAction, cardActionOptions]);

  const selectedCardLabel = useMemo(() => {
    if (!cardId || !cardField?.options) return null;
    return cardField.options.find((opt) => opt.value === cardId)?.label ?? cardId;
  }, [cardField, cardId]);

  // Execute submission logic
  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const answered = await answerTriage(form.formId, {
        transactionId: transactionId || charge?.value || "",
        recognition,
        cardAction: opensClaim ? cardAction : "none",
        cardId: opensClaim && cardAction !== "none" ? cardId : null,
        note: note.trim() || undefined,
      });
      onAnswered(answered);
    } catch (answerError) {
      if (answerError instanceof ApiRequestError) {
        setError(answerError.message);
      } else if (answerError instanceof Error && answerError.name === "AuthenticationError") {
        onAuthError();
      } else {
        setError("Could not submit right now. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    cardAction,
    cardId,
    charge?.value,
    form.formId,
    note,
    onAnswered,
    onAuthError,
    opensClaim,
    recognition,
    transactionId,
  ]);

  // Step 1: Charge selection
  const handleSelectCharge = (id: string) => {
    setFlashingOptionValue(id);
    setTimeout(() => {
      setFlashingOptionValue(null);
      setTransactionId(id);
      setShowOtherCharges(false);
    }, 150);
  };

  const handleContinueFromCharges = () => {
    if (isNavigatingRef.current || submitting || result) return;
    setError(null);
    setDirection("forward");
    setCurrentStep(2);
  };

  // Step 2: Recognition selection with guaranteed visible gray flash
  const handleSelectRecognition = (optionValue: string) => {
    if (isNavigatingRef.current || submitting || result) return;
    setError(null);
    isNavigatingRef.current = true;
    setFlashingOptionValue(optionValue);

    // Visible gray flash for 150ms
    setTimeout(() => {
      setFlashingOptionValue(null);
      setRecognition(optionValue);

      // Brief selection display (blue overlay) before sliding forward
      setTimeout(() => {
        setDirection("forward");
        if (optionValue === "not_recognised") {
          setCurrentStep(3);
        } else {
          setCurrentStep(4);
        }
        isNavigatingRef.current = false;
      }, 120);
    }, 150);
  };

  // Step 3: Card action & card selection
  const handleSelectCardAction = (actionValue: string) => {
    setFlashingOptionValue(actionValue);
    setTimeout(() => {
      setFlashingOptionValue(null);
      setCardAction(actionValue);
    }, 150);
  };

  const handleSelectCard = (cId: string) => {
    setFlashingOptionValue(cId);
    setTimeout(() => {
      setFlashingOptionValue(null);
      setCardId(cId);
    }, 150);
  };

  const handleContinueFromCardProtection = () => {
    if (isNavigatingRef.current || submitting || result) return;
    setError(null);
    setDirection("forward");
    setCurrentStep(4);
  };

  // Back affordance with backward swipe direction
  const handleBack = () => {
    if (isNavigatingRef.current || submitting || result) return;
    setError(null);
    setDirection("backward");
    if (currentStep === 4) {
      setCurrentStep(opensClaim ? 3 : 2);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return "Which charge is this about?";
      case 2:
        return recognitionField?.label || "Did you make this charge?";
      case 3:
        return cardActionField?.label || "Protect your card";
      case 4:
        return "Review your answers";
    }
  };

  const isSubmitted = Boolean(result);

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
          {isSubmitted && result ? (
            <TriageOutcome result={result} />
          ) : (
            <View style={{ width: "100%" }}>
              {/* Form Title Badge */}
              <View className="flex-row items-center border-b border-chase-border bg-chase-lightBlue px-4 py-2.5">
                <View className="h-7 w-7 items-center justify-center rounded-full bg-chase-blue mr-2.5">
                  <ShieldAlert color="#FFFFFF" size={14} strokeWidth={2.2} />
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-semibold text-chase-textPrimary" numberOfLines={1}>
                    {form.title}
                  </Text>
                  <Text className="text-[11px] text-chase-textSecondary">
                    Step {currentStep} of {opensClaim ? 4 : 3}
                  </Text>
                </View>
              </View>

              {/* Animated Step Container */}
              <Animated.View
                key={currentStep}
                entering={
                  direction === "forward" ? SlideInRight.duration(220) : SlideInLeft.duration(220)
                }
                style={{ width: "100%" }}
              >
                {/* Step Question Header with Back Button */}
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
                    {getStepTitle()}
                  </Text>
                </View>

                {/* Error banner if submit fails */}
                {error && (
                  <View className="border-t border-red-200 bg-red-50 px-4 py-2 flex-row items-center justify-between">
                    <Text className="text-[12px] text-red-700 flex-1 pr-2">{error}</Text>
                    <Pressable
                      onPress={handleSubmit}
                      className="bg-red-700 px-2.5 py-1 rounded-md"
                    >
                      <Text className="text-[11px] font-semibold text-white">Retry</Text>
                    </Pressable>
                  </View>
                )}

                {/* STEP 1: Charge Confirmation */}
                {currentStep === 1 && (
                  <View>
                    {charge && (
                      <View className="border-t border-chase-border px-4 py-3.5 bg-white">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center flex-1 pr-3">
                            <BlueRadio selected={true} />
                            <View className="flex-1">
                              <Text className="text-[14px] font-semibold text-chase-textPrimary leading-5">
                                {charge.merchant ?? charge.label}
                              </Text>
                              <Text className="mt-0.5 text-[12px] text-chase-textMuted leading-4">
                                {formatDate(charge.createdAt)}
                              </Text>
                            </View>
                          </View>
                          <Text className="text-[14px] font-bold text-chase-textPrimary">
                            {formatAmount(charge.amountCents)}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Expandable alternative charges */}
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
                              ? "Hide other charges"
                              : `It was a different charge (${otherCharges.length})`}
                          </Text>
                          {showOtherCharges ? (
                            <ChevronUp color="#5B3D85" size={16} strokeWidth={2} />
                          ) : (
                            <ChevronDown color="#5B3D85" size={16} strokeWidth={2} />
                          )}
                        </Pressable>

                        {showOtherCharges && (
                          <ScrollView
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={true}
                            style={{ maxHeight: 180 }}
                          >
                            {otherCharges.map((option) => (
                              <Pressable
                                key={option.value}
                                accessibilityRole="button"
                                onPress={() => handleSelectCharge(option.value)}
                                className="border-t border-chase-border flex-row items-center justify-between px-4 py-3 bg-white"
                                style={({ pressed, hovered }) =>
                                  getOptionRowStyle({
                                    isSelected: option.value === transactionId,
                                    isFlashing: flashingOptionValue === option.value,
                                    hovered,
                                    pressed,
                                  })
                                }
                              >
                                <View className="flex-row items-center flex-1 pr-3">
                                  <BlueRadio selected={option.value === transactionId} />
                                  <View className="flex-1">
                                    <Text className="text-[13px] font-medium text-chase-textPrimary">
                                      {option.merchant ?? option.label}
                                    </Text>
                                    <Text className="mt-0.5 text-[12px] text-chase-textMuted">
                                      {formatDate(option.createdAt)}
                                    </Text>
                                  </View>
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

                    {/* Continue Button */}
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleContinueFromCharges}
                      className="border-t border-chase-border flex-row items-center justify-center px-4 py-3.5 bg-blue-600 active:bg-blue-700"
                      style={({ pressed, hovered }) => ({
                        cursor: "pointer",
                        backgroundColor:
                          pressed ? "#1E40AF" : hovered ? "#1D4ED8" : "#2563EB",
                      })}
                    >
                      <Text className="text-[14px] font-semibold text-white">Continue</Text>
                    </Pressable>
                  </View>
                )}

                {/* STEP 2: Recognition Selection */}
                {currentStep === 2 && (
                  <View>
                    {recognitionField?.helpText && (
                      <View className="border-t border-chase-border bg-[#FAF8FC] px-4 py-2">
                        <Text className="text-[12px] leading-4 text-chase-textSecondary">
                          {recognitionField.helpText}
                        </Text>
                      </View>
                    )}

                    {recognitionOptions.map((option, index) => {
                      const isSelected = recognition === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          ref={index === 0 ? firstOptionRef : undefined}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: isSelected }}
                          focusable={true}
                          onPress={() => handleSelectRecognition(option.value)}
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
                                {option.label}
                              </Text>
                              {option.outcome ? (
                                <Text className="mt-0.5 text-[12px] text-chase-textMuted leading-4">
                                  {option.outcome}
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

                {/* STEP 3: Card Protection & Optional Note (Only when opensClaim) */}
                {currentStep === 3 && (
                  <View>
                    <View className="border-t border-chase-border bg-[#FAF8FC] px-4 py-2">
                      <Text className="text-[12px] leading-4 text-chase-textSecondary">
                        Because you don&apos;t recognize this charge, we can secure your card immediately.
                      </Text>
                    </View>

                    {cardActionOptions.map((option) => {
                      const isSelected = cardAction === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: isSelected }}
                          onPress={() => handleSelectCardAction(option.value)}
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
                              {option.label}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}

                    {/* Card Selector if action involves the card */}
                    {cardAction !== "none" && cardField && cardField.options && cardField.options.length > 0 && (
                      <View className="border-t border-chase-border bg-[#FAF8FC] px-4 py-3">
                        <Text className="text-[11px] font-bold uppercase tracking-wider text-chase-textMuted mb-2">
                          Select card
                        </Text>
                        <View style={{ gap: 6 }}>
                          {cardField.options.map((option) => {
                            const isSelected = cardId === option.value;
                            return (
                              <Pressable
                                key={option.value}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: isSelected }}
                                onPress={() => handleSelectCard(option.value)}
                                className={`flex-row items-center rounded-xl border px-3 py-2.5 bg-white ${isSelected ? "border-blue-600" : "border-chase-border"
                                  }`}
                                style={({ pressed, hovered }) =>
                                  getOptionRowStyle({
                                    isSelected,
                                    isFlashing: flashingOptionValue === option.value,
                                    hovered,
                                    pressed,
                                  })
                                }
                              >
                                <CreditCard
                                  color={isSelected ? "#2563EB" : "#6F647B"}
                                  size={15}
                                  strokeWidth={2}
                                />
                                <Text className="ml-2.5 flex-1 text-[13px] text-chase-textPrimary">
                                  {option.label}
                                </Text>
                                {isSelected && <Check color="#2563EB" size={15} strokeWidth={3} />}
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Optional Note */}
                    {noteField && (
                      <View className="border-t border-chase-border px-4 py-3 bg-white">
                        <Text className="text-[12px] font-medium text-chase-textSecondary mb-1.5">
                          Additional details (optional)
                        </Text>
                        <TextInput
                          editable={!submitting}
                          multiline
                          onChangeText={setNote}
                          placeholder="Add any helpful details for the banker..."
                          placeholderTextColor="#A79CAF"
                          value={note}
                          className="min-h-[56px] rounded-xl border border-chase-border bg-white px-3 py-2 text-[13px] leading-5 text-chase-textPrimary"
                          style={{ textAlignVertical: "top" }}
                        />
                      </View>
                    )}

                    {/* Continue Button */}
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleContinueFromCardProtection}
                      className="border-t border-chase-border flex-row items-center justify-center px-4 py-3.5 bg-blue-600 active:bg-blue-700"
                      style={({ pressed, hovered }) => ({
                        cursor: "pointer",
                        backgroundColor:
                          pressed ? "#1E40AF" : hovered ? "#1D4ED8" : "#2563EB",
                      })}
                    >
                      <Text className="text-[14px] font-semibold text-white">
                        Continue to review
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* STEP 4: Review & Submit */}
                {currentStep === 4 && (
                  <View>
                    <View className="border-t border-chase-border bg-[#FAF8FC] px-4 py-3">
                      <Text className="text-[11px] font-bold uppercase tracking-wider text-chase-textMuted mb-2">
                        Review your answers
                      </Text>
                      <View style={{ gap: 6 }}>
                        <View className="flex-row justify-between items-center">
                          <Text className="text-[12px] text-chase-textSecondary">Charge</Text>
                          <Text className="text-[12px] font-medium text-chase-textPrimary">
                            {charge?.merchant ?? charge?.label ?? "Selected charge"} ·{" "}
                            {formatAmount(charge?.amountCents)}
                          </Text>
                        </View>
                        <View className="flex-row justify-between items-start">
                          <Text className="text-[12px] text-chase-textSecondary pt-0.5">
                            Recognition
                          </Text>
                          <Text className="text-[12px] font-medium text-chase-textPrimary flex-1 text-right ml-4">
                            {selectedRecognitionLabel}
                          </Text>
                        </View>
                        {opensClaim && (
                          <View className="flex-row justify-between items-center">
                            <Text className="text-[12px] text-chase-textSecondary">Card action</Text>
                            <Text className="text-[12px] font-medium text-chase-textPrimary">
                              {selectedCardActionLabel}
                              {selectedCardLabel ? ` (${selectedCardLabel})` : ""}
                            </Text>
                          </View>
                        )}
                        {opensClaim && note.trim().length > 0 && (
                          <View className="flex-row justify-between items-start">
                            <Text className="text-[12px] text-chase-textSecondary pt-0.5">Note</Text>
                            <Text
                              className="text-[12px] font-medium text-chase-textPrimary flex-1 text-right ml-4"
                              numberOfLines={2}
                            >
                              {note.trim()}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Submit Button */}
                    <Pressable
                      accessibilityRole="button"
                      disabled={submitting}
                      onPress={handleSubmit}
                      className="border-t border-chase-border flex-row items-center justify-center px-4 py-3.5 bg-blue-600 active:bg-blue-700"
                      style={({ pressed, hovered }) => ({
                        cursor: (submitting ? "not-allowed" : "pointer") as any,
                        backgroundColor:
                          pressed ? "#1E40AF" : hovered ? "#1D4ED8" : "#2563EB",
                      })}
                    >
                      {submitting ? (
                        <>
                          <ActivityIndicator color="#FFFFFF" size="small" />
                          <Text className="ml-2 text-[14px] font-semibold text-white">
                            Submitting...
                          </Text>
                        </>
                      ) : (
                        <Text className="text-[14px] font-semibold text-white">
                          {opensClaim
                            ? cardAction === "lock"
                              ? "Block card and open claim"
                              : cardAction === "replace"
                                ? "Replace card and open claim"
                                : "Open a claim"
                            : "Submit"}
                        </Text>
                      )}
                    </Pressable>

                    <Text className="px-4 py-2.5 text-center text-[11px] leading-4 text-chase-textMuted bg-[#FAF8FC] border-t border-chase-border">
                      {opensClaim
                        ? form.investigationNotice ||
                        "A banker reviews your claim. Nothing is reversed yet."
                        : "Your answer will be recorded and no claim will be opened."}
                    </Text>
                  </View>
                )}
              </Animated.View>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

export { formatAmount };
