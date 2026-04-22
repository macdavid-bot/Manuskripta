import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/AppHeader";
import { GoldButton } from "@/components/GoldButton";
import { useApp } from "@/context/AppContext";
import { runBookGeneration, runFormatJob, stopJob } from "@/services/generationEngine";
import { useColors } from "@/hooks/useColors";

export default function BookDetailsScreen() {
  const colors = useColors();
  const { jobs, updateJob, addLog, removeJob } = useApp();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const job = jobs.find((j) => j.id === jobId);
  const shimmer = useRef(new Animated.Value(0)).current;
  const [downloading, setDownloading] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);

  useEffect(() => {
    if (job?.status === "processing") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 1500, useNativeDriver: false }),
          Animated.timing(shimmer, { toValue: 0, duration: 1500, useNativeDriver: false }),
        ])
      ).start();
    } else {
      shimmer.stopAnimation();
    }
  }, [job?.status]);

  if (!job) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="Book Details" showBack onBack={() => router.back()} />
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Book not found</Text>
        </View>
      </View>
    );
  }

  const handleDownload = async (format: "md" | "txt") => {
    if (!job.markdownContent) return;
    setDownloading(true);
    try {
      const fileName = `${job.title.replace(/[^a-z0-9]/gi, "_")}_${format === "md" ? "manuscript.md" : "manuscript.txt"}`;
      if (Platform.OS === "web") {
        const blob = new Blob([job.markdownContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const path = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(path, job.markdownContent);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(path, { mimeType: "text/plain", dialogTitle: `Share ${job.title}` });
        } else {
          Alert.alert("Saved", `Saved to: ${path}`);
        }
      }
    } catch {
      Alert.alert("Error", "Failed to download file.");
    } finally {
      setDownloading(false);
    }
  };

  const handleStop = () => {
    Alert.alert("Stop Generation", "Are you sure you want to stop this job?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: () => {
          stopJob(job.id);
          updateJob(job.id, { status: "failed", errorMessage: "Stopped by user" });
        },
      },
    ]);
  };

  const savedChapters = job.chapterContents?.filter((c) => c && c.length > 0).length ?? 0;
  const resumeChapter = savedChapters + 1;

  // Resume from last saved chapter — keeps existing chapterContents intact
  const handleResume = () => {
    const resumeJob = { ...job, status: "pending" as const, errorMessage: undefined };
    updateJob(job.id, resumeJob);
    if (job.mode === "format") {
      runFormatJob(resumeJob, updateJob, addLog);
    } else {
      runBookGeneration(resumeJob, updateJob, addLog);
    }
  };

  // Full fresh restart — wipes all saved chapters
  const handleRestartFresh = () => {
    Alert.alert(
      "Restart from scratch?",
      `This will delete all ${savedChapters} saved chapter(s) and restart from Chapter 1.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restart",
          style: "destructive",
          onPress: () => {
            const resetJob = {
              ...job,
              status: "pending" as const,
              progress: 0,
              currentChapter: 0,
              chapterContents: [],
              chapterSummaries: [],
              blueprint: "",
              errorMessage: undefined,
              retryCount: job.retryCount + 1,
            };
            updateJob(job.id, resetJob);
            runBookGeneration(resetJob, updateJob, addLog);
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert("Delete Book", "This will permanently delete this book job.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          removeJob(job.id);
          router.back();
        },
      },
    ]);
  };

  const progressBarBg = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ["#D4AF37", "#F0D060"],
  });

  const statusColors = {
    processing: "#D4AF37",
    completed: "#22C55E",
    failed: "#EF4444",
    pending: "#B0B0B0",
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={job.title}
        showBack
        onBack={() => router.back()}
        rightElement={
          <Pressable onPress={handleDelete}>
            <Feather name="trash-2" size={20} color="#EF4444" />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColors[job.status] }]} />
            <Text style={[styles.statusText, { color: statusColors[job.status] }]}>
              {job.status === "processing"
                ? job.currentChapter > 0
                  ? job.mode === "format"
                    ? `Formatting Chapter ${job.currentChapter}...`
                    : `Writing Chapter ${job.currentChapter}...`
                  : "Preparing..."
                : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Text>
          </View>

          {(job.status === "processing" || job.status === "completed") && (
            <>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: `${job.progress}%`,
                      backgroundColor: job.status === "processing" ? progressBarBg : "#D4AF37",
                    },
                  ]}
                />
              </View>
              <View style={styles.progressMeta}>
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {job.currentChapter} of {job.totalChapters} chapters
                </Text>
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {job.progress}%
                </Text>
              </View>
            </>
          )}

          {job.errorMessage && (
            <Text style={styles.errorText}>{job.errorMessage}</Text>
          )}
        </View>

        <View style={styles.infoGrid}>
          <View style={[styles.infoItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Mode</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {job.mode === "create" ? "Create" : "Format"}
            </Text>
          </View>
          <View style={[styles.infoItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Chapters</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{job.totalChapters}</Text>
          </View>
          <View style={[styles.infoItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Page Size</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{job.inputs.pageSize}</Text>
          </View>
          <View style={[styles.infoItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Created</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {new Date(job.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {job.status === "completed" && job.markdownContent && (
          <>
            <Pressable
              style={[styles.readBtn, { backgroundColor: "#D4AF3715", borderColor: "#D4AF37" }]}
              onPress={() =>
                router.push({ pathname: "/(app)/reader", params: { jobId: job.id } })
              }
            >
              <Feather name="book-open" size={18} color="#D4AF37" />
              <Text style={styles.readBtnText}>Read Manuscript</Text>
              <Feather name="chevron-right" size={16} color="#D4AF37" />
            </Pressable>

            <View style={styles.downloadSection}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>DOWNLOAD</Text>
              <View style={styles.downloadButtons}>
                <View style={{ flex: 1 }}>
                  <GoldButton
                    label="Markdown (.md)"
                    onPress={() => handleDownload("md")}
                    loading={downloading}
                    fullWidth
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <GoldButton
                    label="Plain Text (.txt)"
                    onPress={() => handleDownload("txt")}
                    loading={downloading}
                    variant="secondary"
                    fullWidth
                  />
                </View>
              </View>
            </View>
          </>
        )}

        {job.status === "processing" && (
          <GoldButton
            label="Stop Generation"
            onPress={handleStop}
            variant="danger"
            fullWidth
            style={{ marginBottom: 12 }}
          />
        )}

        {job.status === "failed" && (
          <View style={styles.actionRow}>
            {job.mode !== "format" && savedChapters > 0 ? (
              <>
                <View style={{ flex: 1 }}>
                  <GoldButton
                    label={`Resume Ch.${resumeChapter}`}
                    onPress={handleResume}
                    fullWidth
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <GoldButton
                    label="Restart Ch.1"
                    onPress={handleRestartFresh}
                    variant="secondary"
                    fullWidth
                  />
                </View>
              </>
            ) : (
              <View style={{ flex: 1 }}>
                <GoldButton
                  label={job.mode === "format" ? "Retry" : "Restart"}
                  onPress={job.mode === "format" ? handleResume : handleRestartFresh}
                  fullWidth
                />
              </View>
            )}
          </View>
        )}

        <Pressable style={styles.logsToggle} onPress={() => setLogsExpanded(!logsExpanded)}>
          <Text style={[styles.logsLabel, { color: colors.mutedForeground }]}>
            Generation Logs ({job.logs.length})
          </Text>
          <Feather name={logsExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
        </Pressable>

        {logsExpanded && (
          <View style={[styles.logsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {job.logs.length === 0 ? (
              <Text style={[styles.emptyLogs, { color: colors.mutedForeground }]}>No logs yet</Text>
            ) : (
              [...job.logs].reverse().map((log, idx) => (
                <View key={idx} style={styles.logEntry}>
                  <View
                    style={[
                      styles.logDot,
                      {
                        backgroundColor:
                          log.type === "error" ? "#EF4444" : log.type === "success" ? "#22C55E" : "#D4AF37",
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.logTime, { color: colors.mutedForeground }]}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                    <Text style={[styles.logMsg, { color: colors.foreground }]}>{log.message}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {job.inputs.tones.length > 0 && (
          <View style={[styles.infoBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoBlockLabel, { color: colors.mutedForeground }]}>Tones</Text>
            <Text style={[styles.infoBlockValue, { color: colors.foreground }]}>
              {job.inputs.tones.join(", ")}
            </Text>
          </View>
        )}

        {job.inputs.tableOfContents && (
          <View style={[styles.infoBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoBlockLabel, { color: colors.mutedForeground }]}>Table of Contents</Text>
            <Text style={[styles.infoBlockValue, { color: colors.foreground }]}>
              {job.inputs.tableOfContents}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center" },
  notFoundText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  statusCard: { borderRadius: 10, borderWidth: 1, padding: 16, gap: 12 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  progressMeta: { flexDirection: "row", justifyContent: "space-between" },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  errorText: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_400Regular" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  infoItem: { flex: 1, minWidth: "40%", borderRadius: 8, borderWidth: 1, padding: 12 },
  infoLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 4, letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  readBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  readBtnText: {
    flex: 1,
    color: "#D4AF37",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  downloadSection: { gap: 12 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2 },
  downloadButtons: { flexDirection: "row", gap: 10 },
  actionRow: { flexDirection: "row", gap: 10 },
  logsToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  logsLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  logsContainer: { borderRadius: 8, borderWidth: 1, padding: 12, gap: 10 },
  emptyLogs: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 8 },
  logEntry: { flexDirection: "row", gap: 10 },
  logDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  logTime: { fontSize: 10, fontFamily: "Inter_400Regular", marginBottom: 2 },
  logMsg: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  infoBlock: { borderRadius: 8, borderWidth: 1, padding: 14, gap: 6 },
  infoBlockLabel: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.5 },
  infoBlockValue: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
