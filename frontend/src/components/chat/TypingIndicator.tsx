import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

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
    <View className="mb-5 flex items-start px-4">
      <Text className="mb-1.5 mt-1.5 text-[12px] font-semibold text-chase-textMuted">
        Assistant
      </Text>
      <Animated.View
        entering={FadeIn.duration(180)}
        className="flex-row items-center gap-1.5 rounded-[14px] rounded-bl-[4px] border border-chase-border bg-white px-4 py-3"
      >
        <Animated.View
          style={dotStyle1}
          className="w-2 h-2 rounded-full bg-chase-purple600"
        />
        <Animated.View
          style={dotStyle2}
          className="w-2 h-2 rounded-full bg-chase-purple600"
        />
        <Animated.View
          style={dotStyle3}
          className="w-2 h-2 rounded-full bg-chase-purple600"
        />
      </Animated.View>
    </View>
  );
}
