import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface GoldButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function GoldButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
  fullWidth = false,
}: GoldButtonProps) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePress = () => {
    if (!disabled && !loading) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onPress();
    }
  };

  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";

  return (
    <Animated.View style={[{ transform: [{ scale }] }, fullWidth && { width: "100%" }]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
        style={[
          styles.button,
          fullWidth && styles.fullWidth,
          isPrimary && { backgroundColor: colors.primary },
          isDanger && styles.danger,
          !isPrimary && !isDanger && styles.secondary,
          (disabled || loading) && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={isPrimary ? "#000" : colors.primary}
            size="small"
          />
        ) : (
          <Text
            style={[
              styles.label,
              isPrimary && styles.primaryLabel,
              isDanger && styles.dangerLabel,
              !isPrimary && !isDanger && { color: colors.primary },
            ]}
          >
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  fullWidth: {
    width: "100%",
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#D4AF37",
  },
  danger: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  primaryLabel: {
    color: "#000000",
  },
  dangerLabel: {
    color: "#EF4444",
  },
});
