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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { GoldButton } from "@/components/GoldButton";
import { GoldInput } from "@/components/GoldInput";

export default function RegisterScreen() {
  const colors = useColors();
  const { register } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const success = await register(name.trim(), email.trim(), password);
    setLoading(false);
    if (success) {
      router.replace("/(app)/dashboard");
    } else {
      setError("An account with this email already exists.");
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
          { paddingTop: topPad + 30, paddingBottom: bottomPad + 40 },
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
        </View>

        <Text style={[styles.heading, { color: colors.foreground }]}>
          Create Account
        </Text>
        <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
          Your account will be reviewed before access is granted
        </Text>

        <View style={styles.form}>
          <GoldInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            containerStyle={{ marginBottom: 16 }}
          />
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
            placeholder="Min. 6 characters"
            secureTextEntry
            containerStyle={{ marginBottom: 24 }}
          />

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <GoldButton
            label="Create Account"
            onPress={handleRegister}
            loading={loading}
            fullWidth
          />

          <Pressable
            style={styles.linkRow}
            onPress={() => router.back()}
          >
            <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
              Already have an account?{" "}
              <Text style={{ color: "#D4AF37" }}>Sign In</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 12,
  },
  appName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: 4,
  },
  heading: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  subheading: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 28,
    lineHeight: 20,
  },
  form: { width: "100%" },
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
});
