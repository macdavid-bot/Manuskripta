import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import type { BookJob } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

interface BookCardProps {
  job: BookJob;
  onPress: () => void;
}

const STATUS_COLORS = {
  processing: "#D4AF37",
  completed: "#22C55E",
  failed: "#EF4444",
  pending: "#B0B0B0",
};

const STATUS_ICONS: Record<BookJob["status"], keyof typeof Feather.glyphMap> = {
  processing: "loader",
  completed: "check-circle",
  failed: "x-circle",
  pending: "clock",
};

function getBookSnippet(job: BookJob): string {
  const title = job.title.trim().replace(/\s+/g, " ");
  if (!title) return "";
  const words = title.split(" ").slice(0, 7).join(" ");
  return words ? `${words}…` : "";
}

export function BookCard({ job, onPress }: BookCardProps) {
  const colors = useColors();
  const shimmer = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  const isProcessing = job.status === "processing";
  const statusColor = STATUS_COLORS[job.status];

  useEffect(() => {
    if (isProcessing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 1500, useNativeDriver: false }),
          Animated.timing(shimmer, { toValue: 0, duration: 1500, useNativeDriver: false }),
        ])
      ).start();
    } else {
      shimmer.stopAnimation();
      shimmer.setValue(0);
    }
  }, [isProcessing]);

  const handlePressIn = () => {
    Animated.spring(pressScale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  };

  const progressBarColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ["#D4AF37", "#F0D060"],
  });

  const statusText =
    isProcessing && job.currentChapter > 0
      ? `Writing Chapter ${job.currentChapter} of ${job.totalChapters}...`
      : job.status === "completed"
      ? "Completed"
      : job.status === "failed"
      ? "Failed"
      : "Pending";

  return (
    <Animated.View style={{ transform: [{ scale: pressScale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: isProcessing ? "#D4AF3730" : colors.border,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Feather
              name={job.mode === "format" ? "edit-3" : "book"}
              size={16}
              color={colors.mutedForeground}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[styles.title, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {job.title}
            </Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Feather name={STATUS_ICONS[job.status]} size={11} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {job.status === "processing" ? "Processing" : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Text>
          </View>
        </View>

        {(() => {
          const snippet = getBookSnippet(job);
          return snippet ? (
            <Text
              style={[styles.snippet, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              “{snippet}”
            </Text>
          ) : null;
        })()}

        <Text style={[styles.statusDetail, { color: colors.mutedForeground }]}>
          {statusText}
        </Text>

        {(isProcessing || job.status === "completed") && job.totalChapters > 0 && (
          <View style={styles.progressArea}>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: `${job.progress}%`,
                    backgroundColor: isProcessing ? progressBarColor : "#D4AF37",
                  },
                ]}
              />
            </View>
            <View style={styles.chapterRow}>
              <Text style={[styles.chapterText, { color: colors.mutedForeground }]}>
                {job.currentChapter > 0
                  ? `${job.currentChapter}/${job.totalChapters} chapters`
                  : "Starting..."}
              </Text>
              <Text style={[styles.percentText, { color: colors.mutedForeground }]}>
                {job.progress}%
              </Text>
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  snippet: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    marginBottom: 6,
  },
  statusDetail: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
  },
  progressArea: {
    gap: 6,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  chapterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chapterText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  percentText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
