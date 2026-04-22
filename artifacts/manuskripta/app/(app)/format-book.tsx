import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/AppHeader";
import { GoldButton } from "@/components/GoldButton";
import { GoldInput } from "@/components/GoldInput";
import { useApp, type BookInputs, type BookJob, type FormatBookData } from "@/context/AppContext";
import { runFormatJob } from "@/services/generationEngine";
import { useColors } from "@/hooks/useColors";

const PAGE_SIZES = [
  "5 x 8 in", "5.5 x 8.5 in", "6 x 9 in", "8.5 x 11 in", "Custom Size",
];

function generateJobId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export default function FormatBookScreen() {
  const colors = useColors();
  const { addJob, updateJob, addLog } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [bookTitle, setBookTitle] = useState("");
  const [copyright, setCopyright] = useState("");
  const [dedication, setDedication] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [chapters, setChapters] = useState<{ label: string; content: string }[]>([
    { label: "Chapter 1", content: "" },
  ]);
  const [conclusion, setConclusion] = useState("");
  const [backMatter, setBackMatter] = useState("");
  const [pageSize, setPageSize] = useState("6 x 9 in");
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const addChapter = () => {
    setChapters([...chapters, { label: `Chapter ${chapters.length + 1}`, content: "" }]);
  };

  const updateChapter = (idx: number, field: "label" | "content", value: string) => {
    const updated = [...chapters];
    updated[idx] = { ...updated[idx], [field]: value };
    setChapters(updated);
  };

  const removeChapter = (idx: number) => {
    if (chapters.length === 1) return;
    const updated = chapters.filter((_, i) => i !== idx);
    setChapters(updated);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!bookTitle.trim()) errs.title = "Book title is required";
    if (!copyright.trim()) errs.copyright = "Copyright is required";
    if (!introduction.trim()) errs.introduction = "Introduction is required";
    if (!conclusion.trim()) errs.conclusion = "Conclusion is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFormat = () => {
    if (!validate()) return;

    setSubmitting(true);

    const formatData: FormatBookData = {
      bookTitle: bookTitle.trim(),
      copyright: copyright.trim(),
      dedication: dedication.trim() || undefined,
      introduction: introduction.trim(),
      chapters,
      conclusion: conclusion.trim(),
      backMatter: backMatter.trim() || undefined,
      pageSize,
      customWidth: customWidth ? parseFloat(customWidth) : undefined,
      customHeight: customHeight ? parseFloat(customHeight) : undefined,
    };

    const inputs: BookInputs = {
      title: bookTitle.trim(),
      tableOfContents: chapters.map((c) => c.label).join("\n"),
      minPages: 30,
      maxPages: 60,
      tones: [],
      allowStorytelling: false,
      pageSize,
      useHeadingColor: false,
      copyrightOption: "insert",
      copyrightText: copyright,
      mode: "format",
      formatData,
    };

    const job: BookJob = {
      id: generateJobId(),
      title: bookTitle.trim(),
      status: "pending",
      progress: 0,
      currentChapter: 0,
      totalChapters: chapters.length,
      chapterContents: [],
      chapterSummaries: [],
      blueprint: "",
      tocParsed: chapters.map((c) => c.label),
      inputs,
      logs: [],
      createdAt: Date.now(),
      retryCount: 0,
      mode: "format",
    };

    addJob(job);
    router.replace("/(app)/dashboard");
    runFormatJob(job, updateJob, addLog);
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Format Book" showBack onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.desc, { color: colors.mutedForeground }]}>
            Paste your manuscript section by section. Each part will be individually AI-polished and assembled into a premium KDP-ready book.
          </Text>

          <GoldInput
            label="Book Title"
            value={bookTitle}
            onChangeText={setBookTitle}
            placeholder="Your book title"
            error={errors.title}
            containerStyle={{ marginBottom: 20 }}
          />

          <GoldInput
            label="Copyright"
            value={copyright}
            onChangeText={setCopyright}
            placeholder="Copyright © 2024 Your Name. All rights reserved."
            multiline
            numberOfLines={3}
            error={errors.copyright}
            containerStyle={{ marginBottom: 20 }}
          />

          <GoldInput
            label="Dedication (Optional)"
            value={dedication}
            onChangeText={setDedication}
            placeholder="To..."
            multiline
            numberOfLines={2}
            containerStyle={{ marginBottom: 20 }}
          />

          <GoldInput
            label="Introduction"
            value={introduction}
            onChangeText={setIntroduction}
            placeholder="Paste your introduction here..."
            multiline
            numberOfLines={6}
            style={{ minHeight: 100 }}
            error={errors.introduction}
            containerStyle={{ marginBottom: 20 }}
          />

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            CHAPTERS
          </Text>
          {chapters.map((ch, idx) => (
            <View
              key={idx}
              style={[styles.chapterBlock, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.chapterHeader}>
                <Text style={[styles.chapterNum, { color: colors.foreground }]}>
                  Chapter {idx + 1}
                </Text>
                {chapters.length > 1 && (
                  <Pressable onPress={() => removeChapter(idx)}>
                    <Feather name="trash-2" size={16} color="#EF4444" />
                  </Pressable>
                )}
              </View>
              <GoldInput
                label="Title"
                value={ch.label}
                onChangeText={(v) => updateChapter(idx, "label", v)}
                placeholder="Chapter title"
                containerStyle={{ marginBottom: 12 }}
              />
              <GoldInput
                label="Content"
                value={ch.content}
                onChangeText={(v) => updateChapter(idx, "content", v)}
                placeholder="Paste chapter content here..."
                multiline
                numberOfLines={8}
                style={{ minHeight: 120 }}
              />
            </View>
          ))}

          <Pressable
            style={[styles.addChapterBtn, { borderColor: colors.primary }]}
            onPress={addChapter}
          >
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={[styles.addChapterText, { color: colors.primary }]}>
              Add Chapter
            </Text>
          </Pressable>

          <GoldInput
            label="Conclusion"
            value={conclusion}
            onChangeText={setConclusion}
            placeholder="Paste your conclusion here..."
            multiline
            numberOfLines={5}
            style={{ minHeight: 90 }}
            error={errors.conclusion}
            containerStyle={{ marginTop: 20, marginBottom: 20 }}
          />

          <GoldInput
            label="Back Matter (Optional)"
            value={backMatter}
            onChangeText={setBackMatter}
            placeholder="Bibliography, index, about the author..."
            multiline
            numberOfLines={4}
            style={{ minHeight: 80 }}
            containerStyle={{ marginBottom: 20 }}
          />

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            PAGE SIZE
          </Text>
          <View style={styles.pageSizes}>
            {PAGE_SIZES.map((ps) => (
              <Pressable
                key={ps}
                onPress={() => setPageSize(ps)}
                style={[
                  styles.pageSizeChip,
                  {
                    backgroundColor: pageSize === ps ? colors.primary : colors.card,
                    borderColor: pageSize === ps ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pageSizeText,
                    { color: pageSize === ps ? "#000" : colors.mutedForeground },
                  ]}
                >
                  {ps}
                </Text>
              </Pressable>
            ))}
          </View>

          {pageSize === "Custom Size" && (
            <View style={[styles.row, { marginTop: 12, marginBottom: 20 }]}>
              <GoldInput
                label="Width (in)"
                value={customWidth}
                onChangeText={setCustomWidth}
                placeholder="6.5"
                keyboardType="decimal-pad"
                containerStyle={{ flex: 1 }}
              />
              <View style={{ width: 12 }} />
              <GoldInput
                label="Height (in)"
                value={customHeight}
                onChangeText={setCustomHeight}
                placeholder="9.5"
                keyboardType="decimal-pad"
                containerStyle={{ flex: 1 }}
              />
            </View>
          )}

          <View style={{ marginTop: 16 }}>
            <GoldButton
              label="Start Formatting"
              onPress={handleFormat}
              loading={submitting}
              fullWidth
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  desc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  chapterBlock: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  chapterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  chapterNum: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  addChapterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addChapterText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  pageSizes: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  pageSizeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  pageSizeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  row: { flexDirection: "row" },
});
