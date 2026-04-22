import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/AppHeader";
import { BookCard } from "@/components/BookCard";
import { GoldButton } from "@/components/GoldButton";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function DashboardScreen() {
  const colors = useColors();
  const { jobs, user } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const userJobs = user?.isAdmin
    ? jobs
    : jobs.filter((j) => true);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader />
      <FlatList
        data={userJobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BookCard
            job={item}
            onPress={() =>
              router.push({
                pathname: "/(app)/book-details",
                params: { jobId: item.id },
              })
            }
          />
        )}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
              Welcome back{user?.name ? `, ${user.name}` : ""}
            </Text>
            <Text style={[styles.headline, { color: colors.foreground }]}>
              Your Library
            </Text>

            <View style={styles.buttonRow}>
              <View style={{ flex: 1 }}>
                <Pressable
                  style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push("/(app)/create-book")}
                >
                  <Feather name="plus" size={18} color="#000" />
                  <Text style={styles.primaryActionLabel}>Create New Book</Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <Pressable
                  style={[styles.secondaryActionBtn, { borderColor: colors.primary }]}
                  onPress={() => router.push("/(app)/format-book")}
                >
                  <Feather name="edit-3" size={18} color={colors.primary} />
                  <Text style={[styles.secondaryActionLabel, { color: colors.primary }]}>
                    Format Book
                  </Text>
                </Pressable>
              </View>
            </View>

            {userJobs.length > 0 && (
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                RECENT BOOKS
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="book-open" size={48} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No books yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Create your first book or format an existing manuscript
            </Text>
          </View>
        }
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  headline: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  primaryActionLabel: {
    color: "#000",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryActionLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
