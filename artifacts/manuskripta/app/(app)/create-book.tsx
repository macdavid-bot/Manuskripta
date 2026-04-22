import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { AppHeader } from "@/components/AppHeader";
import { GoldButton } from "@/components/GoldButton";
import { GoldInput } from "@/components/GoldInput";
import { ToneChip } from "@/components/ToneChip";
import { useApp, type BookInputs, type BookJob } from "@/context/AppContext";
import { runBookGeneration } from "@/services/generationEngine";
import { parseTOC } from "@/services/aiService";
import { useColors } from "@/hooks/useColors";

const TONES = [
  "Professional", "Conversational", "Persuasive",
  "Authoritative", "Inspirational", "Educational", "Analytical",
];

const PAGE_SIZES = [
  "5 x 8 in", "5.25 x 8 in", "5.5 x 8.5 in", "6 x 9 in",
  "5.06 x 7.81 in", "6.14 x 9.21 in", "6.69 x 9.61 in",
  "7 x 10 in", "7.44 x 9.69 in", "7.5 x 9.25 in",
  "8 x 10 in", "8.5 x 11 in", "8.27 x 11.69 in",
  "8.25 x 6 in", "8.25 x 8.25 in", "8.5 x 8.5 in", "Custom Size",
];

function generateJobId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export default function CreateBookScreen() {
  const colors = useColors();
  const { settings, addJob, updateJob, addLog, user, jobs } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [toc, setToc] = useState("");
  const [minPages, setMinPages] = useState("");
  const [maxPages, setMaxPages] = useState("");
  const [tones, setTones] = useState<string[]>(settings.defaultTones);
  const [allowStorytelling, setAllowStorytelling] = useState(false);
  const [pageSize, setPageSize] = useState("6 x 9 in");
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [useHeadingColor, setUseHeadingColor] = useState(false);
  const [copyrightOption, setCopyrightOption] = useState<"generate" | "insert" | "default">("generate");
  const [copyrightText, setCopyrightText] = useState(settings.defaultCopyright);
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const toggleTone = (t: string) => {
    if (tones.includes(t)) {
      setTones(tones.filter((x) => x !== t));
    } else if (tones.length < 4) {
      setTones([...tones, t]);
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Book title is required";
    if (!toc.trim()) errs.toc = "Table of contents is required";
    const min = parseInt(minPages);
    const max = parseInt(maxPages);
    if (isNaN(min) || min < 30) errs.minPages = "Minimum must be ≥ 30";
    if (isNaN(max)) errs.maxPages = "Maximum is required";
    if (!isNaN(min) && !isNaN(max) && max > min + 30) {
      errs.maxPages = "Maximum must be ≤ minimum + 30";
    }
    if (!isNaN(min) && !isNaN(max) && max < min) {
      errs.maxPages = "Maximum must be ≥ minimum";
    }
    if (pageSize === "Custom Size") {
      if (!customWidth.trim()) errs.customWidth = "Width is required";
      if (!customHeight.trim()) errs.customHeight = "Height is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGenerate = async () => {
    if (!validate()) return;

    if (!user?.isAdmin) {
      const now = Date.now();
      if (user?.limitExpiresAt != null && now > user.limitExpiresAt) {
        Alert.alert(
          "Access Expired",
          "Your access limit has expired. Please contact the admin to renew."
        );
        return;
      }
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const booksThisMonth = jobs.filter((j) => j.createdAt >= monthStart.getTime()).length;
      const maxBooks = user?.maxBooksPerMonth ?? 10;
      if (booksThisMonth >= maxBooks) {
        Alert.alert(
          "Monthly Limit Reached",
          `You've reached your limit of ${maxBooks} book(s) this month. Contact admin to increase your limit.`
        );
        return;
      }
    }

    setSubmitting(true);

    const tocParsed = parseTOC(toc);
    const inputs: BookInputs = {
      title: title.trim(),
      tableOfContents: toc.trim(),
      minPages: parseInt(minPages),
      maxPages: parseInt(maxPages),
      tones,
      allowStorytelling,
      pageSize,
      customWidth: customWidth ? parseFloat(customWidth) : undefined,
      customHeight: customHeight ? parseFloat(customHeight) : undefined,
      useHeadingColor,
      copyrightOption,
      copyrightText: copyrightOption === "default" ? settings.defaultCopyright : copyrightText,
      additionalPrompt: additionalPrompt.trim() || undefined,
      memoryBank: settings.memoryBank || undefined,
      mode: "create",
    };

    const job: BookJob = {
      id: generateJobId(),
      title: inputs.title,
      status: "pending",
      progress: 0,
      currentChapter: 0,
      totalChapters: tocParsed.length,
      chapterContents: [],
      chapterSummaries: [],
      blueprint: "",
      tocParsed,
      inputs,
      logs: [],
      createdAt: Date.now(),
      retryCount: 0,
      mode: "create",
    };

    addJob(job);
    router.replace("/(app)/dashboard");

    runBookGeneration(job, updateJob, addLog);
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Create New Book"
        showBack
        onBack={() => router.back()}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <GoldInput
              label="Book Title"
              value={title}
              onChangeText={setTitle}
              placeholder="Enter your book title"
              error={errors.title}
            />
          </View>

          <View style={styles.section}>
            <GoldInput
              label="Table of Contents"
              value={toc}
              onChangeText={setToc}
              placeholder={"Chapter 1: Introduction\nChapter 2: ...\nChapter 3: ..."}
              multiline
              numberOfLines={6}
              style={{ minHeight: 120 }}
              error={errors.toc}
            />
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              List each chapter on a new line
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              PAGE COUNT RANGE
            </Text>
            <View style={styles.row}>
              <GoldInput
                label="Min Pages"
                value={minPages}
                onChangeText={setMinPages}
                placeholder="30"
                keyboardType="numeric"
                containerStyle={{ flex: 1 }}
                error={errors.minPages}
              />
              <View style={{ width: 12 }} />
              <GoldInput
                label="Max Pages"
                value={maxPages}
                onChangeText={setMaxPages}
                placeholder="60"
                keyboardType="numeric"
                containerStyle={{ flex: 1 }}
                error={errors.maxPages}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              TONE SELECTION{" "}
              <Text style={{ fontFamily: "Inter_400Regular" }}>(max 4)</Text>
            </Text>
            <View style={styles.chips}>
              {TONES.map((t) => (
                <ToneChip
                  key={t}
                  label={t}
                  selected={tones.includes(t)}
                  onPress={() => toggleTone(t)}
                  disabled={tones.length >= 4 && !tones.includes(t)}
                />
              ))}
            </View>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Leave empty for AI auto-selection
            </Text>
          </View>

          <View style={styles.section}>
            <View style={[styles.toggleRow, { borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
                  Allow Storytelling
                </Text>
                <Text style={[styles.toggleHint, { color: colors.mutedForeground }]}>
                  Include examples, analogies, narratives
                </Text>
              </View>
              <Switch
                value={allowStorytelling}
                onValueChange={setAllowStorytelling}
                trackColor={{ false: colors.border, true: "#D4AF37" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              PAGE SIZE
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pageSizes}
            >
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
            </ScrollView>
            {pageSize === "Custom Size" && (
              <View style={[styles.row, { marginTop: 12 }]}>
                <GoldInput
                  label="Width (in)"
                  value={customWidth}
                  onChangeText={setCustomWidth}
                  placeholder="6.5"
                  keyboardType="decimal-pad"
                  containerStyle={{ flex: 1 }}
                  error={errors.customWidth}
                />
                <View style={{ width: 12 }} />
                <GoldInput
                  label="Height (in)"
                  value={customHeight}
                  onChangeText={setCustomHeight}
                  placeholder="9.5"
                  keyboardType="decimal-pad"
                  containerStyle={{ flex: 1 }}
                  error={errors.customHeight}
                />
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={[styles.toggleRow, { borderColor: colors.border }]}>
              <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
                Styled Heading Colors
              </Text>
              <Switch
                value={useHeadingColor}
                onValueChange={setUseHeadingColor}
                trackColor={{ false: colors.border, true: "#D4AF37" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              COPYRIGHT
            </Text>
            <View style={styles.radioGroup}>
              {(["generate", "insert", "default"] as const).map((opt) => (
                <Pressable
                  key={opt}
                  style={styles.radioRow}
                  onPress={() => setCopyrightOption(opt)}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      {
                        borderColor: copyrightOption === opt ? "#D4AF37" : colors.border,
                        backgroundColor: copyrightOption === opt ? "#D4AF37" : "transparent",
                      },
                    ]}
                  />
                  <Text style={[styles.radioLabel, { color: colors.foreground }]}>
                    {opt === "generate"
                      ? "Generate for me"
                      : opt === "insert"
                      ? "Insert manually"
                      : "Use default copyright"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {copyrightOption === "insert" && (
              <TextInput
                value={copyrightText}
                onChangeText={setCopyrightText}
                placeholder="Enter your copyright text..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
                style={[
                  styles.textarea,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
              />
            )}
          </View>

          <View style={styles.section}>
            <GoldInput
              label="Additional Prompt (Optional)"
              value={additionalPrompt}
              onChangeText={setAdditionalPrompt}
              placeholder="Any additional style or direction..."
              multiline
              numberOfLines={3}
              style={{ minHeight: 80 }}
            />
          </View>

          <View style={{ marginTop: 8 }}>
            <GoldButton
              label="Generate Book"
              onPress={handleGenerate}
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
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  row: { flexDirection: "row" },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  hint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  toggleHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  pageSizes: {
    paddingBottom: 8,
    gap: 8,
  },
  pageSizeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 8,
  },
  pageSizeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  radioGroup: { gap: 12 },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  radioLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
    minHeight: 80,
  },
});
