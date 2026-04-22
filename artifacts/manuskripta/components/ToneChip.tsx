import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text } from "react-native";
import { useColors } from "@/hooks/useColors";

interface ToneChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function ToneChip({ label, selected, onPress, disabled }: ToneChipProps) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 60 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 60 }).start();
  };

  const handlePress = () => {
    if (!disabled) {
      if (Platform.OS !== "web") {
        Haptics.selectionAsync();
      }
      onPress();
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[
          styles.chip,
          {
            backgroundColor: selected ? "#D4AF37" : colors.card,
            borderColor: selected ? "#D4AF37" : colors.border,
            opacity: disabled && !selected ? 0.4 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.label,
            { color: selected ? "#000" : colors.mutedForeground },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    margin: 4,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
