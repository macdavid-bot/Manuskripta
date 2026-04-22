import { Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";

export default function AppLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "fade",
      }}
    >
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="create-book" />
      <Stack.Screen name="format-book" />
      <Stack.Screen name="book-details" />
      <Stack.Screen name="reader" />
    </Stack>
  );
}
