import React, { useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/AppHeader";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

interface Section {
  title: string;
  content: string;
  wordCount: number;
}

function parseManuscript(markdown: string): Section[] {
  const rawSections = markdown.split(/\n(?=## )/);
  const sections: Section[] = [];

  for (const raw of rawSections) {
    const lines = raw.split("\n");
    const firstLine = lines[0].trim();
    const isH1 = firstLine.startsWith("# ") && !firstLine.startsWith("## ");
    const isH2 = firstLine.startsWith("## ");

    if (isH1) {
      const title = firstLine.replace(/^#\s+/, "").trim();
      const content = lines.slice(1).join("\n").trim();
      if (title) sections.push({ title, content, wordCount: countWords(content) });
    } else if (isH2) {
      const title = firstLine.replace(/^##\s+/, "").trim();
      const content = lines.slice(1).join("\n").trim();
      if (title) sections.push({ title, content, wordCount: countWords(content) });
    }
  }

  return sections;
}

function countWords(text: string): number {
  return text
    .replace(/#{1,6}\s+/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function renderMarkdown(text: string, colors: ReturnType<typeof useColors>): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      nodes.push(<View key={key++} style={{ height: 12 }} />);
    } else if (trimmed.startsWith("#### ")) {
      nodes.push(
        <Text key={key++} style={[styles.h4, { color: "#D4AF37" }]}>
          {trimmed.replace(/^####\s+/, "")}
        </Text>
      );
    } else if (trimmed.startsWith("### ")) {
      nodes.push(
        <Text key={key++} style={[styles.h3, { color: colors.foreground }]}>
          {trimmed.replace(/^###\s+/, "")}
        </Text>
      );
    } else if (trimmed.startsWith("## ")) {
      nodes.push(
        <Text key={key++} style={[styles.h2, { color: "#D4AF37" }]}>
          {trimmed.replace(/^##\s+/, "")}
        </Text>
      );
    } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      nodes.push(
        <Text key={key++} style={[styles.bold, { color: colors.foreground }]}>
          {trimmed.replace(/\*\*/g, "")}
        </Text>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      nodes.push(
        <View key={key++} style={styles.bulletRow}>
          <Text style={[styles.bullet, { color: "#D4AF37" }]}>•</Text>
          <Text style={[styles.bulletText, { color: colors.foreground }]}>
            {trimmed.replace(/^[-*]\s+/, "")}
          </Text>
        </View>
      );
    } else {
      nodes.push(
        <Text key={key++} style={[styles.paragraph, { color: colors.foreground }]}>
          {trimmed}
        </Text>
      );
    }
  }
  return nodes;
}

export default function ReaderScreen() {
  const colors = useColors();
  const { jobs } = useApp();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [activeSection, setActiveSection] = useState(0);

  const job = jobs.find((j) => j.id === jobId);
  const sections = useMemo(() => {
    if (!job?.markdownContent) return [];
    return parseManuscript(job.markdownContent);
  }, [job?.markdownContent]);

  const totalWords = useMemo(
    () => sections.reduce((sum, s) => sum + s.wordCount, 0),
    [sections]
  );

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!job || !job.markdownContent) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="Reader" showBack onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No content available
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={job.title}
        showBack
        onBack={() => router.back()}
        rightElement={
          <View style={styles.wordCountBadge}>
            <Text style={styles.wordCountText}>
              {totalWords.toLocaleString()} words
            </Text>
          </View>
        }
      />

      <View style={[styles.chapNav, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chapNavContent}>
          {sections.map((section, idx) => (
            <Pressable
              key={idx}
              onPress={() => setActiveSection(idx)}
              style={[
                styles.chapChip,
                {
                  backgroundColor: activeSection === idx ? "#D4AF37" : colors.card,
                  borderColor: activeSection === idx ? "#D4AF37" : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chapChipText,
                  { color: activeSection === idx ? "#000" : colors.mutedForeground },
                ]}
                numberOfLines={1}
              >
                {section.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {sections[activeSection] && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: "#D4AF37" }]}>
                {sections[activeSection].title}
              </Text>
              <View style={[styles.wc, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="align-left" size={11} color={colors.mutedForeground} />
                <Text style={[styles.wcText, { color: colors.mutedForeground }]}>
                  {sections[activeSection].wordCount.toLocaleString()} words
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.body}>
              {renderMarkdown(sections[activeSection].content, colors)}
            </View>

            <View style={styles.navButtons}>
              {activeSection > 0 && (
                <Pressable
                  style={[styles.navBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    setActiveSection(activeSection - 1);
                    scrollRef.current?.scrollTo({ y: 0, animated: true });
                  }}
                >
                  <Feather name="arrow-left" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.navBtnText, { color: colors.mutedForeground }]}>
                    Previous
                  </Text>
                </Pressable>
              )}
              {activeSection < sections.length - 1 && (
                <Pressable
                  style={[styles.navBtn, styles.navBtnRight, { borderColor: "#D4AF37" }]}
                  onPress={() => {
                    setActiveSection(activeSection + 1);
                    scrollRef.current?.scrollTo({ y: 0, animated: true });
                  }}
                >
                  <Text style={[styles.navBtnText, { color: "#D4AF37" }]}>Next</Text>
                  <Feather name="arrow-right" size={14} color="#D4AF37" />
                </Pressable>
              )}
            </View>

            <Text style={[styles.pageIndicator, { color: colors.mutedForeground }]}>
              {activeSection + 1} / {sections.length}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  wordCountBadge: {
    backgroundColor: "#D4AF3720",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  wordCountText: {
    color: "#D4AF37",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  chapNav: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chapNavContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chapChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 160,
  },
  chapChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
  },
  sectionHeader: {
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 30,
  },
  wc: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  wcText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  divider: {
    height: 1,
    backgroundColor: "#1A1A1A",
    marginBottom: 20,
  },
  body: { gap: 4 },
  h2: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    marginTop: 20,
    marginBottom: 8,
    lineHeight: 26,
  },
  h3: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginTop: 16,
    marginBottom: 6,
    lineHeight: 22,
  },
  h4: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 12,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 26,
    marginBottom: 2,
  },
  bold: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 24,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
    paddingLeft: 4,
  },
  bullet: {
    fontSize: 15,
    lineHeight: 24,
  },
  bulletText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
    flex: 1,
  },
  navButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
    gap: 12,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  navBtnRight: {
    marginLeft: "auto",
  },
  navBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  pageIndicator: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 16,
    marginBottom: 8,
  },
});
