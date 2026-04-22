import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { GoldButton } from "./GoldButton";
import { ToneChip } from "./ToneChip";

const TONES = ["Professional", "Conversational", "Persuasive", "Authoritative", "Inspirational", "Educational", "Analytical"];

interface SettingsPanelProps {
  visible: boolean;
  onClose: () => void;
}

const WIDTH = Math.min(Dimensions.get("window").width * 0.82, 320);

export function SettingsPanel({ visible, onClose }: SettingsPanelProps) {
  const colors = useColors();
  const { settings, updateSettings, logout, user, announcements, unreadAnnouncements, markAnnouncementsRead } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(overlayOpacity, { toValue: 0.6, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const toggleTone = (tone: string) => {
    const current = settings.defaultTones;
    if (current.includes(tone)) {
      updateSettings({ defaultTones: current.filter((t) => t !== tone) });
    } else if (current.length < 4) {
      updateSettings({ defaultTones: [...current, tone] });
    }
  };

  if (!visible && translateX._value === -WIDTH) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View
        style={[styles.overlay, { opacity: overlayOpacity }]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            width: WIDTH,
            backgroundColor: colors.card,
            borderRightColor: colors.border,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateX }],
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
          <Pressable onPress={onClose}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>APPEARANCE</Text>
            <View style={[styles.row, { borderColor: colors.border }]}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>Dark Mode</Text>
              <Switch
                value={settings.theme === "dark"}
                onValueChange={(val) => updateSettings({ theme: val ? "dark" : "light" })}
                trackColor={{ false: colors.border, true: "#D4AF37" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DEFAULT COPYRIGHT</Text>
            <TextInput
              value={settings.defaultCopyright}
              onChangeText={(v) => updateSettings({ defaultCopyright: v })}
              multiline
              numberOfLines={3}
              placeholder="Your default copyright text..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MEMORY BANK</Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Preferences injected into every book generation
            </Text>
            <TextInput
              value={settings.memoryBank}
              onChangeText={(v) => updateSettings({ memoryBank: v })}
              multiline
              numberOfLines={4}
              placeholder="E.g. I prefer a concise, no-fluff style with real-world examples..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, minHeight: 80 }]}
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DEFAULT TONES</Text>
            <View style={styles.chips}>
              {TONES.map((t) => (
                <ToneChip
                  key={t}
                  label={t}
                  selected={settings.defaultTones.includes(t)}
                  onPress={() => toggleTone(t)}
                  disabled={settings.defaultTones.length >= 4 && !settings.defaultTones.includes(t)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DOWNLOADS</Text>
            <View style={[styles.row, { borderColor: colors.border }]}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>Auto-Download</Text>
              <Switch
                value={settings.autoDownload}
                onValueChange={(v) => updateSettings({ autoDownload: v })}
                trackColor={{ false: colors.border, true: "#D4AF37" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                markAnnouncementsRead();
                onClose();
                router.push("/announcements");
              }}
            >
              <Feather name="mail" size={18} color={colors.foreground} />
              <Text style={[styles.menuText, { color: colors.foreground }]}>Announcements</Text>
              {unreadAnnouncements > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadAnnouncements}</Text>
                </View>
              )}
            </Pressable>
          </View>

          {user?.isAdmin && (
            <View style={styles.section}>
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  router.push("/admin");
                }}
              >
                <Feather name="shield" size={18} color="#D4AF37" />
                <Text style={[styles.menuText, { color: "#D4AF37" }]}>Admin Panel</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
          <GoldButton label="Logout" onPress={logout} variant="secondary" fullWidth />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    borderRightWidth: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    minHeight: 60,
    textAlignVertical: "top",
  },
  hint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  menuText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  badge: {
    backgroundColor: "#D4AF37",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  footer: {
    gap: 10,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#1A1A1A",
  },
  userEmail: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
