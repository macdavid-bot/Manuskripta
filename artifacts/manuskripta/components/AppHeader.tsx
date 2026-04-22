import React, { useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { SettingsPanel } from "./SettingsPanel";

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

export function AppHeader({ title, showBack, onBack, rightElement }: AppHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { unreadAnnouncements } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPadding + 10,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.left}>
          {showBack ? (
            <Pressable onPress={onBack} style={styles.iconBtn}>
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </Pressable>
          ) : (
            <Pressable onPress={() => setSettingsOpen(true)} style={styles.iconBtn}>
              <Feather name="menu" size={22} color={colors.foreground} />
              {unreadAnnouncements > 0 && <View style={styles.dot} />}
            </Pressable>
          )}
        </View>

        <View style={styles.center}>
          {title ? (
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <Image
              source={require("../assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          )}
        </View>

        <View style={styles.right}>
          {rightElement ?? <View style={{ width: 40 }} />}
        </View>
      </View>

      <SettingsPanel visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    width: 40,
    alignItems: "flex-start",
  },
  center: {
    flex: 1,
    alignItems: "center",
  },
  right: {
    width: 40,
    alignItems: "flex-end",
  },
  logo: {
    width: 36,
    height: 36,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  iconBtn: {
    position: "relative",
  },
  dot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D4AF37",
  },
});
