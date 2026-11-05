import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ModernSplashScreenProps {
  onFinish?: () => void;
  duration?: number;
}

export function ModernSplashScreen({
  onFinish,
  duration = 2200,
}: ModernSplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  // Animation Shared Values
  const containerOpacity = useSharedValue(1);
  const containerScale = useSharedValue(1);

  // Logo & Halo animations
  const logoScale = useSharedValue(0.65);
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(20);

  const halo1Scale = useSharedValue(0.9);
  const halo1Opacity = useSharedValue(0.6);

  const halo2Scale = useSharedValue(0.9);
  const halo2Opacity = useSharedValue(0.4);

  // Content text animations
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(18);

  const badgeOpacity = useSharedValue(0);
  const badgeScale = useSharedValue(0.85);

  // Progress Bar
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    // 1. Hide the native static splash screen so our animated screen takes over seamlessly
    SplashScreen.hideAsync().catch(() => {});

    // 2. Logo entrance with a smooth spring pop
    logoScale.value = withSpring(1, {
      damping: 12,
      stiffness: 90,
      mass: 0.9,
    });
    logoOpacity.value = withTiming(1, { duration: 500 });
    logoTranslateY.value = withSpring(0, { damping: 14, stiffness: 100 });

    // 3. Ambient pulsing halos radiating out from the logo
    halo1Scale.value = withRepeat(
      withSequence(
        withTiming(1.45, { duration: 1400, easing: Easing.out(Easing.ease) }),
        withTiming(1.0, { duration: 0 }),
      ),
      -1,
      false,
    );
    halo1Opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1400, easing: Easing.out(Easing.ease) }),
        withTiming(0.5, { duration: 0 }),
      ),
      -1,
      false,
    );

    halo2Scale.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1.65, { duration: 1600, easing: Easing.out(Easing.ease) }),
          withTiming(1.0, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );
    halo2Opacity.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 1600, easing: Easing.out(Easing.ease) }),
          withTiming(0.4, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );

    // 4. Staggered brand title and subtitle entrance
    textOpacity.value = withDelay(250, withTiming(1, { duration: 550 }));
    textTranslateY.value = withDelay(
      250,
      withSpring(0, { damping: 14, stiffness: 100 }),
    );

    badgeOpacity.value = withDelay(450, withTiming(1, { duration: 500 }));
    badgeScale.value = withDelay(
      450,
      withSpring(1, { damping: 12, stiffness: 90 }),
    );

    // 5. Sleek bottom progress indicator animation
    progressWidth.value = withDelay(
      200,
      withTiming(100, {
        duration: duration - 700,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
    );

    // 6. Smooth exit fade-out & scale-up handoff
    const exitTimer = setTimeout(() => {
      containerScale.value = withTiming(1.04, {
        duration: 450,
        easing: Easing.out(Easing.quad),
      });
      containerOpacity.value = withTiming(
        0,
        {
          duration: 450,
          easing: Easing.out(Easing.quad),
        },
        (finished) => {
          if (finished) {
            runOnJS(handleFinish)();
          }
        },
      );
    }, duration);

    return () => clearTimeout(exitTimer);
  }, []);

  const handleFinish = () => {
    setIsVisible(false);
    if (onFinish) onFinish();
  };

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value },
      { translateY: logoTranslateY.value },
    ],
  }));

  const halo1AnimatedStyle = useAnimatedStyle(() => ({
    opacity: halo1Opacity.value,
    transform: [{ scale: halo1Scale.value }],
  }));

  const halo2AnimatedStyle = useAnimatedStyle(() => ({
    opacity: halo2Opacity.value,
    transform: [{ scale: halo2Scale.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ scale: badgeScale.value }],
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.overlay, containerAnimatedStyle]}>
      <LinearGradient
        colors={["#4F0A0E", "#881318", "#240406"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.gradient}
      >
        {/* Ambient Decorative Background Circles */}
        <View style={styles.ambientCircleTop} />
        <View style={styles.ambientCircleBottom} />

        <View style={styles.centerContent}>
          {/* Pulsing Halos & Logo Container */}
          <View style={styles.logoWrapper}>
            <Animated.View style={[styles.haloRing, halo2AnimatedStyle]} />
            <Animated.View style={[styles.haloRing, halo1AnimatedStyle]} />

            {/* Elevated Modern Logo Card */}
            <Animated.View style={[styles.logoCard, logoAnimatedStyle]}>
              <Image
                source={require("@/assets/images/app-logo.png")}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </Animated.View>
          </View>

          {/* Animated App Title & Subtitle */}
          <Animated.View style={[styles.titleContainer, textAnimatedStyle]}>
            <Text style={styles.brandTitle}>MODORMC</Text>
            <Text style={styles.brandSubtitle}>
              Ready-Mix Concrete Operations
            </Text>
          </Animated.View>

          {/* Pill Badge */}
          <Animated.View style={[styles.badgeContainer, badgeAnimatedStyle]}>
            <View style={styles.badgePill}>
              <View style={styles.activeDot} />
              <Text style={styles.badgeText}>SMART LOGISTICS PLATFORM</Text>
            </View>
          </Animated.View>
        </View>

        {/* Bottom Loading Progress & Version */}
        <View style={styles.bottomSection}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressBar, progressAnimatedStyle]}
            />
          </View>
          <Text style={styles.versionText}>v1.0.0 • Enterprise Edition</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
  },
  gradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  ambientCircleTop: {
    position: "absolute",
    top: -SCREEN_WIDTH * 0.35,
    right: -SCREEN_WIDTH * 0.2,
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.85,
    borderRadius: (SCREEN_WIDTH * 0.85) / 2,
    backgroundColor: "rgba(219, 21, 22, 0.22)",
  },
  ambientCircleBottom: {
    position: "absolute",
    bottom: -SCREEN_WIDTH * 0.3,
    left: -SCREEN_WIDTH * 0.25,
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: (SCREEN_WIDTH * 0.9) / 2,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 140,
    height: 140,
    marginBottom: 26,
  },
  haloRing: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.5)",
    backgroundColor: "rgba(219, 21, 22, 0.22)",
  },
  logoCard: {
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: "#821215",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF2A2D",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.6)",
    overflow: "hidden",
  },
  logoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 26,
  },
  titleContainer: {
    alignItems: "center",
    marginBottom: 14,
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.8,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
  },
  brandSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 6,
    letterSpacing: 0.4,
    textAlign: "center",
  },
  badgeContainer: {
    marginTop: 4,
    alignItems: "center",
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34D399",
    marginRight: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FECACA",
    letterSpacing: 1.4,
  },
  bottomSection: {
    position: "absolute",
    bottom: 48,
    alignItems: "center",
    width: "100%",
  },
  progressTrack: {
    width: 140,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    overflow: "hidden",
    marginBottom: 14,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#F43F5E",
    borderRadius: 2,
  },
  versionText: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.55)",
    letterSpacing: 0.5,
  },
});
