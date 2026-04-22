import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { GoldButton } from "@/components/GoldButton";
import { GoldInput } from "@/components/GoldInput";

export default function LoginScreen() {
  const colors = useColors();
  const { login, user } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notApproved, setNotApproved] = useState(false);

  const handleLogin = async () => {
    setError("");
    setNotApproved(false);
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    const success = await login(email.trim(), password);
    setLoading(false);
    if (success) {
      router.replace("/(app)/dashboard");
    } else {
      setError("Invalid email or password.");
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topPad + 40, paddingBottom: bottomPad + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoArea}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.appName, { color: colors.foreground }]}>
            MANUSKRIPTA
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Premium AI Book Writing
          </Text>
        </View>

        <View style={styles.form}>
          <GoldInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={{ marginBottom: 16 }}
          />
          <GoldInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            containerStyle={{ marginBottom: 24 }}
          />

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <GoldButton
            label="Sign In"
            onPress={handleLogin}
            loading={loading}
            fullWidth
          />

          <Pressable
            style={styles.linkRow}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
              Don't have an account?{" "}
              <Text style={{ color: "#D4AF37" }}>Create one</Text>
            </Text>
          </Pressable>

          <View style={styles.accessNote}>
            <Text style={[styles.accessText, { color: colors.mutedForeground }]}>
              Access is invite-only.{" "}
            </Text>
            <Pressable onPress={() => Linking.openURL("https://wa.link/tvplnb")}>
              <Text style={styles.accessLink}>Request Access</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 48,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  appName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    letterSpacing: 0.5,
  },
  form: {
    width: "100%",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
    textAlign: "center",
  },
  linkRow: {
    marginTop: 20,
    alignItems: "center",
  },
  linkText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  accessNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    flexWrap: "wrap",
  },
  accessText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  accessLink: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#D4AF37",
  },
});
