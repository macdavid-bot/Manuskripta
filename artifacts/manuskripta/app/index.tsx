import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function RootRedirect() {
  const { isLoggedIn } = useApp();
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoggedIn) {
        router.replace("/(app)/dashboard");
      } else {
        router.replace("/(auth)/login");
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator color="#D4AF37" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
