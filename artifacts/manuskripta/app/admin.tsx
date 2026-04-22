import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/AppHeader";
import { GoldButton } from "@/components/GoldButton";
import { useApp, type User } from "@/context/AppContext";
import { stopAllJobs } from "@/services/generationEngine";
import { useColors } from "@/hooks/useColors";

type Tab = "members" | "jobs" | "announce" | "health";

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export default function AdminScreen() {
  const colors = useColors();
  const { user, allUsers, jobs, updateUser, updateJob, addAnnouncement, removeAnnouncement, announcements } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("members");
  const [memberFilter, setMemberFilter] = useState<"approved" | "pending" | "rejected">("pending");
  const [announcement, setAnnouncement] = useState("");
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  if (!user?.isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="Admin" showBack onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={{ color: "#EF4444", fontSize: 18, fontFamily: "Inter_600SemiBold" }}>Access Denied</Text>
        </View>
      </View>
    );
  }

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const filteredUsers = allUsers.filter((u) => u.status === memberFilter && !u.isAdmin);
  const activeJobs = jobs.filter((j) => j.status === "processing");

  const handleSendAnnouncement = () => {
    if (!announcement.trim()) return;
    setSendingAnnouncement(true);
    const preview = announcement.split("\n")[0].substring(0, 100);
    addAnnouncement({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
      message: announcement.trim(),
      preview,
      createdAt: Date.now(),
    });
    setAnnouncement("");
    setSendingAnnouncement(false);
    Alert.alert("Sent", "Announcement delivered to all users.");
  };

  const handleKillAllJobs = () => {
    if (activeJobs.length === 0) {
      Alert.alert("No Active Jobs", "There are no jobs currently running.");
      return;
    }
    Alert.alert(
      "Stop All Jobs",
      `This will stop all ${activeJobs.length} active job(s). Are you sure?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop All",
          style: "destructive",
          onPress: () => {
            stopAllJobs();
            for (const job of activeJobs) {
              updateJob(job.id, { status: "failed", errorMessage: "Stopped by admin" });
            }
            Alert.alert("Done", `${activeJobs.length} job(s) stopped.`);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Admin Panel" showBack onBack={() => router.back()} />

      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["members", "jobs", "announce", "health"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, t === tab && { borderBottomColor: "#D4AF37", borderBottomWidth: 2 }]}
          >
            <Text style={[styles.tabText, { color: t === tab ? "#D4AF37" : colors.mutedForeground }]}>
              {t === "members" ? "Members" : t === "jobs" ? "Jobs" : t === "announce" ? "Announce" : "Health"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {tab === "members" && (
          <View>
            <View style={styles.filterRow}>
              {(["pending", "approved", "rejected"] as const).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setMemberFilter(f)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: memberFilter === f ? colors.primary : colors.card,
                      borderColor: memberFilter === f ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.filterText, { color: memberFilter === f ? "#000" : colors.mutedForeground }]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {filteredUsers.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No {memberFilter} users
              </Text>
            ) : (
              filteredUsers.map((u) => (
                <UserCard
                  key={u.email}
                  user={u}
                  onApprove={() => updateUser(u.email, {
                    status: "approved",
                    isApproved: true,
                    maxBooksPerMonth: 10,
                    limitSetAt: Date.now(),
                    limitExpiresAt: Date.now() + ONE_MONTH_MS,
                  })}
                  onReject={() => updateUser(u.email, { status: "rejected", isApproved: false })}
                  onPend={() => updateUser(u.email, { status: "pending", isApproved: false })}
                  onUpdateLimit={(limit) => updateUser(u.email, {
                    maxBooksPerMonth: limit,
                    limitSetAt: Date.now(),
                    limitExpiresAt: Date.now() + ONE_MONTH_MS,
                  })}
                  onRenew={() => updateUser(u.email, {
                    limitSetAt: Date.now(),
                    limitExpiresAt: Date.now() + ONE_MONTH_MS,
                  })}
                />
              ))
            )}
          </View>
        )}

        {tab === "jobs" && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              ACTIVE JOBS ({activeJobs.length})
            </Text>
            {activeJobs.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No active jobs</Text>
            ) : (
              activeJobs.map((job) => (
                <View key={job.id} style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.jobTitle, { color: colors.foreground }]}>{job.title}</Text>
                  <Text style={[styles.jobMeta, { color: colors.mutedForeground }]}>
                    Chapter {job.currentChapter}/{job.totalChapters} • {job.progress}% • {job.mode}
                  </Text>
                  <Pressable onPress={() => updateJob(job.id, { status: "failed", errorMessage: "Stopped by admin" })}>
                    <Text style={{ color: "#EF4444", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 8 }}>
                      Stop
                    </Text>
                  </Pressable>
                </View>
              ))
            )}

            <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 20 }]}>
              ALL BOOKS ({jobs.length})
            </Text>
            {jobs.map((job) => (
              <View key={job.id} style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.jobTitle, { color: colors.foreground }]}>{job.title}</Text>
                <Text style={[styles.jobMeta, { color: colors.mutedForeground }]}>
                  {job.status} • {job.mode} • {job.inputs.pageSize}
                </Text>
                <Text style={[styles.jobMeta, { color: colors.mutedForeground }]}>
                  {new Date(job.createdAt).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {tab === "announce" && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>SEND ANNOUNCEMENT</Text>
            <TextInput
              value={announcement}
              onChangeText={setAnnouncement}
              multiline
              numberOfLines={8}
              placeholder="Type your announcement..."
              placeholderTextColor={colors.mutedForeground}
              maxLength={24000}
              style={[styles.announceInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            />
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
              {announcement.split(/\s+/).filter(Boolean).length} / 4000 words
            </Text>
            <GoldButton
              label="Send to All Users"
              onPress={handleSendAnnouncement}
              loading={sendingAnnouncement}
              disabled={!announcement.trim()}
              fullWidth
            />

            {announcements.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 24 }]}>
                  SENT ANNOUNCEMENTS
                </Text>
                {announcements.map((a) => (
                  <View key={a.id} style={[styles.announceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.announceDate, { color: colors.mutedForeground }]}>
                      {new Date(a.createdAt).toLocaleString()}
                    </Text>
                    <Text style={[styles.announceMsg, { color: colors.foreground }]} numberOfLines={3}>
                      {a.message}
                    </Text>
                    <Pressable onPress={() => removeAnnouncement(a.id)} style={styles.deleteRow}>
                      <Feather name="trash-2" size={14} color="#EF4444" />
                      <Text style={{ color: "#EF4444", fontSize: 12, fontFamily: "Inter_500Medium" }}>Delete</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {tab === "health" && (
          <View>
            <Pressable
              onPress={handleKillAllJobs}
              style={[
                styles.killBtn,
                {
                  borderColor: activeJobs.length > 0 ? "#EF4444" : colors.border,
                  backgroundColor: activeJobs.length > 0 ? "#EF444415" : colors.card,
                },
              ]}
            >
              <Feather
                name="zap-off"
                size={16}
                color={activeJobs.length > 0 ? "#EF4444" : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.killBtnText,
                  { color: activeJobs.length > 0 ? "#EF4444" : colors.mutedForeground },
                ]}
              >
                Stop All Active Jobs {activeJobs.length > 0 ? `(${activeJobs.length})` : ""}
              </Text>
            </Pressable>

            <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 20 }]}>
              SYSTEM HEALTH
            </Text>
            <View style={styles.healthGrid}>
              <HealthMetric label="Active Jobs" value={String(jobs.filter((j) => j.status === "processing").length)} color="#D4AF37" />
              <HealthMetric label="Completed" value={String(jobs.filter((j) => j.status === "completed").length)} color="#22C55E" />
              <HealthMetric label="Failed" value={String(jobs.filter((j) => j.status === "failed").length)} color="#EF4444" />
              <HealthMetric label="Total Books" value={String(jobs.length)} color="#B0B0B0" />
              <HealthMetric label="Total Users" value={String(allUsers.length)} color="#B0B0B0" />
              <HealthMetric label="Approved" value={String(allUsers.filter((u) => u.status === "approved").length)} color="#22C55E" />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function UserCard({
  user,
  onApprove,
  onReject,
  onPend,
  onUpdateLimit,
  onRenew,
}: {
  user: User;
  onApprove: () => void;
  onReject: () => void;
  onPend: () => void;
  onUpdateLimit: (limit: number) => void;
  onRenew: () => void;
}) {
  const colors = useColors();
  const [limitInput, setLimitInput] = useState(String(user.maxBooksPerMonth ?? 10));
  const [showLimitEditor, setShowLimitEditor] = useState(false);

  const isApproved = user.status === "approved";
  const now = Date.now();
  const isExpired = isApproved && user.limitExpiresAt != null && now > user.limitExpiresAt;
  const expiresIn = user.limitExpiresAt
    ? Math.max(0, Math.ceil((user.limitExpiresAt - now) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: isExpired ? "#EF4444" : colors.border }]}>
      <Text style={[styles.userName, { color: colors.foreground }]}>{user.name}</Text>
      <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user.email}</Text>

      <View style={styles.userStatusRow}>
        <Text style={[styles.userStatus, {
          color: user.status === "approved" ? "#22C55E" : user.status === "rejected" ? "#EF4444" : "#D4AF37"
        }]}>
          {user.status.toUpperCase()}
        </Text>
        {isApproved && user.limitExpiresAt != null && (
          <Text style={[styles.expiry, { color: isExpired ? "#EF4444" : colors.mutedForeground }]}>
            {isExpired ? "LIMIT EXPIRED" : `Expires in ${expiresIn}d`}
          </Text>
        )}
      </View>

      {isApproved && (
        <View style={[styles.limitRow, { borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.limitLabel, { color: colors.mutedForeground }]}>
              MONTHLY LIMIT
            </Text>
            <Text style={[styles.limitValue, { color: colors.foreground }]}>
              {user.maxBooksPerMonth} books / month
            </Text>
          </View>
          <Pressable
            onPress={() => setShowLimitEditor(!showLimitEditor)}
            style={[styles.editBtn, { borderColor: colors.border }]}
          >
            <Feather name={showLimitEditor ? "chevron-up" : "edit-2"} size={14} color={colors.mutedForeground} />
          </Pressable>
        </View>
      )}

      {isApproved && showLimitEditor && (
        <View style={styles.limitEditor}>
          <View style={styles.limitInputRow}>
            <TextInput
              value={limitInput}
              onChangeText={setLimitInput}
              keyboardType="numeric"
              style={[styles.limitInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="4"
              placeholderTextColor={colors.mutedForeground}
            />
            <Pressable
              onPress={() => {
                const val = parseInt(limitInput);
                if (isNaN(val) || val < 1) return;
                onUpdateLimit(val);
                setShowLimitEditor(false);
              }}
              style={styles.setLimitBtn}
            >
              <Text style={styles.setLimitText}>Set (1 month)</Text>
            </Pressable>
          </View>
          {isExpired && (
            <Pressable onPress={onRenew} style={styles.renewBtn}>
              <Feather name="refresh-cw" size={14} color="#22C55E" />
              <Text style={styles.renewText}>Renew for 1 Month</Text>
            </Pressable>
          )}
        </View>
      )}

      {isApproved && isExpired && !showLimitEditor && (
        <Pressable onPress={onRenew} style={styles.renewBtnStandalone}>
          <Feather name="refresh-cw" size={14} color="#22C55E" />
          <Text style={styles.renewText}>Renew Limit for 1 Month</Text>
        </Pressable>
      )}

      <View style={styles.userActions}>
        {user.status !== "approved" && (
          <Pressable onPress={onApprove} style={[styles.actionBtn, { borderColor: "#22C55E" }]}>
            <Text style={{ color: "#22C55E", fontSize: 12, fontFamily: "Inter_500Medium" }}>Approve</Text>
          </Pressable>
        )}
        {user.status !== "pending" && (
          <Pressable onPress={onPend} style={[styles.actionBtn, { borderColor: "#D4AF37" }]}>
            <Text style={{ color: "#D4AF37", fontSize: 12, fontFamily: "Inter_500Medium" }}>Pend</Text>
          </Pressable>
        )}
        {user.status !== "rejected" && (
          <Pressable onPress={onReject} style={[styles.actionBtn, { borderColor: "#EF4444" }]}>
            <Text style={{ color: "#EF4444", fontSize: 12, fontFamily: "Inter_500Medium" }}>Reject</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function HealthMetric({ label, value, color }: { label: string; value: string; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabBar: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  emptyText: { textAlign: "center", fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 20 },
  userCard: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 10, gap: 6 },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  userEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  userStatusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  userStatus: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  expiry: { fontSize: 11, fontFamily: "Inter_500Medium" },
  limitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  limitLabel: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.5, marginBottom: 2 },
  limitValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  editBtn: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  limitEditor: { gap: 10, paddingTop: 8 },
  limitInputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  limitInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  setLimitBtn: {
    backgroundColor: "#D4AF37",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 6,
  },
  setLimitText: { color: "#000", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  renewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  renewBtnStandalone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    marginTop: 2,
  },
  renewText: { color: "#22C55E", fontSize: 13, fontFamily: "Inter_500Medium" },
  userActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, marginBottom: 12 },
  jobCard: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 10, gap: 4 },
  jobTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  jobMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  killBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  killBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  announceInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
    minHeight: 140,
    marginBottom: 8,
  },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 12, textAlign: "right" },
  announceCard: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 10, gap: 6 },
  announceDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  announceMsg: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  deleteRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  healthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { flex: 1, minWidth: "28%", borderRadius: 8, borderWidth: 1, padding: 14, alignItems: "center", gap: 4 },
  metricValue: { fontSize: 28, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
});
