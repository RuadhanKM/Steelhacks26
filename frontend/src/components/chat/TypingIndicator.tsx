import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export function TypingIndicator() {
  const dot1Y = useSharedValue(0);
  const dot2Y = useSharedValue(0);
  const dot3Y = useSharedValue(0);
  const dot1Opacity = useSharedValue(0.4);
  const dot2Opacity = useSharedValue(0.4);
  const dot3Opacity = useSharedValue(0.4);

  useEffect(() => {
    const animateBounce = (
      sharedY: typeof dot1Y,
      sharedOpacity: typeof dot1Opacity,
      delay: number,
    ) => {
      sharedY.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-6, { duration: 250, easing: Easing.bezier(0.33, 1, 0.68, 1) }),
            withTiming(0, { duration: 250, easing: Easing.bezier(0.32, 0, 0.67, 0) }),
            withTiming(0, { duration: 450 }),
          ),
          -1,
          false,
        ),
      );

      sharedOpacity.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 250 }),
            withTiming(0.4, { duration: 250 }),
            withTiming(0.4, { duration: 450 }),
          ),
          -1,
          false,
        ),
      );
    };

    animateBounce(dot1Y, dot1Opacity, 0);
    animateBounce(dot2Y, dot2Opacity, 160);
    animateBounce(dot3Y, dot3Opacity, 320);
  }, [dot1Opacity, dot1Y, dot2Opacity, dot2Y, dot3Opacity, dot3Y]);

  const dotStyle1 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1Y.value }],
    opacity: dot1Opacity.value,
  }));

  const dotStyle2 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2Y.value }],
    opacity: dot2Opacity.value,
  }));

  const dotStyle3 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3Y.value }],
    opacity: dot3Opacity.value,
  }));

  return (
    <View className="mb-5 flex items-start px-4">
      <Text className="mb-1.5 mt-1.5 text-[12px] font-semibold text-chase-textMuted">
        Pyre
      </Text>
      <Animated.View
        entering={FadeIn.duration(180)}
        className="flex-row items-center rounded-[14px] rounded-bl-[4px] border border-chase-border bg-white"
        style={{
          height: 40,
          paddingHorizontal: 16,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View className="flex-row items-center" style={{ gap: 6, height: 16 }}>
          <Animated.View
            style={[
              dotStyle1,
              { width: 8, height: 8, borderRadius: 4, backgroundColor: "#5B3D85" },
            ]}
          />
          <Animated.View
            style={[
              dotStyle2,
              { width: 8, height: 8, borderRadius: 4, backgroundColor: "#5B3D85" },
            ]}
          />
          <Animated.View
            style={[
              dotStyle3,
              { width: 8, height: 8, borderRadius: 4, backgroundColor: "#5B3D85" },
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
}
