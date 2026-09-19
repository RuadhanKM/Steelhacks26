import React from "react";
import { View, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useEffect } from "react";

export function TypingIndicator() {
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    const animateDot = (dot: typeof dot1, delay: number) => {
      dot.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0.3, { duration: 400 })
          ),
          -1,
          false
        )
      );
    };

    animateDot(dot1, 0);
    animateDot(dot2, 200);
    animateDot(dot3, 400);
  }, [dot1, dot2, dot3]);

  const dotStyle1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const dotStyle2 = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const dotStyle3 = useAnimatedStyle(() => ({ opacity: dot3.value }));

  return (
    <View className="flex items-start mb-3 px-4">
      <View className="flex-row items-center mb-1.5 ml-1">
        <View className="w-6 h-6 rounded-full bg-chase-blue items-center justify-center mr-2">
          <Text className="text-white text-xs font-bold">B</Text>
        </View>
        <Text className="text-xs text-chase-textSecondary font-medium">
          Bank Assistant
        </Text>
      </View>

      <View className="bg-chase-aiBubble rounded-2xl rounded-bl-md border border-chase-border px-5 py-4 flex-row items-center gap-1.5">
        <Animated.View
          style={dotStyle1}
          className="w-2.5 h-2.5 rounded-full bg-chase-blue"
        />
        <Animated.View
          style={dotStyle2}
          className="w-2.5 h-2.5 rounded-full bg-chase-blue"
        />
        <Animated.View
          style={dotStyle3}
          className="w-2.5 h-2.5 rounded-full bg-chase-blue"
        />
      </View>
    </View>
  );
}
