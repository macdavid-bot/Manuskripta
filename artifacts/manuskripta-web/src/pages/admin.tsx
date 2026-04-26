import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { NavBar } from "./dashboard";
import { jobsApi, usersApi } from "@/lib/api";
import type { Announcement, BookJob, User } from "@/lib/types";

const GOLD = "#D4AF37";
const GREEN = "#4CAF50";
const RED = "#f44336";
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

type Tab = "members" | "usage" | "livejobs" | "announcements" | "health";
type MemberFilter = "pending" | "approved" | "rejected";

type ThemeColors = { bg: string; card: string; border: string; text: string; muted: string; inputBg: string };

function themeColors(theme: string): ThemeColors {
  if (theme === "light") {
    return { bg: "#F5F5F0", card: "#FFFDF8", border: "#DDD6C8", text: "#111111", muted: "#666666", inputBg: "#FFFFFF" };
  }
  return { bg: "#000000", card: "#0A0A0A", border: "#1A1A1A", text: "#E8E8E8", muted: "#888888", inputBg: "#0D0D0D" };
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    approved: { bg: "rgba(76,175,80,0.12)", border: "rgba(76,175,80,0.3)", text: GREEN },
    pending:  { bg: "rgba(212,175,55,0.12)", border: "rgba(212,175,55,0.3)", text: GOLD },
    rejected: { bg: "rgba(244,67,54,0.12)", border: "rgba(244,67,54,0.3)", text: RED },
  };
  const c = colors[status] ?? colors.pending;
  return (
    <span style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.text, borderRadius: "20px", padding: "2px 10px", fontSize: "11px", fontWeight: "600" }}>
      {status}
    </span>
  );
}

function CountUp({ value, color = "inherit" }: { value: number; color?: string }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.45, ease: "easeOut" });
    const unsub = rounded.on("change", (latest) => setDisplay(latest));
    return () => {
      controls.stop();
      unsub();
    };
  }, [motionValue, rounded, value]);

  return <span style={{ color }}>{display.toLocaleString()}</span>;
}

function UserCard({
  u, onApprove, onReject, onPend, onEditLimit,
  editingLimit, setEditMaxBooks, editMaxBooks, onSaveLimit, onCancelEdit, colors,
}: {
  u: User;
  onApprove: (email: string) => void;
  onReject: (email: string) => void;
  onPend: (email: string) => void;
  onEditLimit: (email: string) => void;
  editingLimit: boolean;
  editMaxBooks: number;
  setEditMaxBooks: (v: number) => void;
  onSaveLimit: (email: string) => void;
  onCancelEdit: () => void;
  colors: ThemeColors;
}) {
  const { card, border, text, muted, inputBg } = colors;
  const inputStyle = { width: "100%", backgroundColor: inputBg, border: `1px solid ${border}`, borderRadius: "8px", padding: "10px 14px", color: text, fontSize: "14px", outline: "none", boxSizing: "border-box" as const };

  return (
    <div style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "10px", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <p style={{ color: text, fontSize: "15px", fontWeight: "500", margin: "0 0 4px 0" }}>{u.name}</p>
          <p style={{ color: muted, fontSize: "12px", margin: "0 0 8px 0" }}>{u.email}</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <StatusBadge status={u.status} />
            {u.status === "approved" && (
              <span style={{ color: muted, fontSize: "11px", padding: "2px 10px", border: `1px solid ${border}`, borderRadius: "20px" }}>
                {u.maxBooksPerMonth === 999999 ? "∞" : u.maxBooksPerMonth} books/month
                {u.limitExpiresAt && ` · expires ${new Date(u.limitExpiresAt).toLocaleDateString()}`}
                {u.limitExpiresAt && u.limitExpiresAt < Date.now() && " ⚠ expired"}
              </span>
            )}
            <span style={{ color: muted, fontSize: "11px" }}>{u.booksGenerated} books generated</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {u.status === "pending" && (
            <>
              <button onClick={() => onApprove(u.email)} style={{ backgroundColor: "rgba(76,175,80,0.12)", border: "1px solid rgba(76,175,80,0.3)", color: GREEN, padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Approve</button>
              <button onClick={() => onReject(u.email)} style={{ backgroundColor: "rgba(244,67,54,0.1)", border: "1px solid rgba(244,67,54,0.3)", color: RED, padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Reject</button>
            </>
          )}
          {u.status === "approved" && (
            <>
              <button onClick={() => onEditLimit(u.email)} style={{ backgroundColor: "transparent", border: `1px solid ${border}`, color: muted, padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Edit Limit</button>
              <button onClick={() => onReject(u.email)} style={{ backgroundColor: "rgba(244,67,54,0.08)", border: "1px solid rgba(244,67,54,0.2)", color: "#f44336", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Revoke</button>
            </>
          )}
          {u.status === "rejected" && (
            <>
              <button onClick={() => onApprove(u.email)} style={{ backgroundColor: "rgba(76,175,80,0.12)", border: "1px solid rgba(76,175,80,0.3)", color: GREEN, padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Approve</button>
              <button onClick={() => onPend(u.email)} style={{ backgroundColor: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", color: GOLD, padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Set Pending</button>
            </>
          )}
        </div>
      </div>
      {editingLimit && (
        <div style={{ marginTop: "12px", display: "flex", gap: "10px", alignItems: "center", backgroundColor: inputBg, padding: "12px", borderRadius: "8px" }}>
          <span style={{ color: muted, fontSize: "13px", whiteSpace: "nowrap" }}>Books / month:</span>
          <input
            type="number"
            value={editMaxBooks}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1) setEditMaxBooks(v);
            }}
            min={1}
            max={9999}
            style={{ ...inputStyle, width: "80px", color: text, backgroundColor: inputBg }}
          />
          <button onClick={() => onSaveLimit(u.email)} style={{ backgroundColor: GOLD, color: "#000", padding: "6px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600", border: "none" }}>Save</button>
          <button onClick={onCancelEdit} style={{ backgroundColor: "transparent", border: `1px solid ${border}`, color: muted, padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Cancel</button>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user, allUsers, updateUser, addAnnouncement, announcements, removeAnnouncement, refreshUsers, jobs, settings } = useApp();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("members");
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("pending");
  const [newMessage, setNewMessage] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editMaxBooks, setEditMaxBooks] = useState(10);
  const [killAllLoading, setKillAllLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");

  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [userJobs, setUserJobs] = useState<BookJob[]>([]);
  const [loadingUserJobs, setLoadingUserJobs] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const [allServerJobs, setAllServerJobs] = useState<BookJob[]>([]);
  const [loadingAllJobs, setLoadingAllJobs] = useState(false);

  const colors = themeColors(settings.theme);
  const { bg, card, border, text, muted, inputBg } = colors;

  const inputStyle = { width: "100%", backgroundColor: inputBg, border: `1px solid ${border}`, borderRadius: "8px", padding: "10px 14px", color: text, fontSize: "14px", outline: "none", boxSizing: "border-box" as const };

  const showMsg = (t: string, type: "success" | "error" = "success") => {
    setMsg(t); setMsgType(type); setTimeout(() => setMsg(""), 3000);
  };

  const loadAllJobs = useCallback(async () => {
    setLoadingAllJobs(true);
    try {
      const { jobs: all } = await jobsApi.listAll();
      setAllServerJobs(all);
    } catch { }
    finally { setLoadingAllJobs(false); }
  }, []);

  useEffect(() => {
    if (tab === "livejobs") loadAllJobs();
  }, [tab, loadAllJobs]);

  if (!user?.isAdmin) {
    return (
      <div style={{ backgroundColor: bg, minHeight: "100vh" }}>
        <NavBar />
        <div style={{ textAlign: "center", padding: "80px" }}>
          <p style={{ color: RED }}>Admin access required.</p>
          <button onClick={() => setLocation("/")} style={{ color: GOLD, background: "none", border: "none", cursor: "pointer", marginTop: "16px" }}>← Back</button>
        </div>
      </div>
    );
  }

  const nonAdminUsers = allUsers.filter((u) => !u.isAdmin);
  const pendingUsers  = nonAdminUsers.filter((u) => u.status === "pending");
  const approvedUsers = nonAdminUsers.filter((u) => u.status === "approved");
  const rejectedUsers = nonAdminUsers.filter((u) => u.status === "rejected");
  const filteredUsers = memberFilter === "pending" ? pendingUsers : memberFilter === "approved" ? approvedUsers : rejectedUsers;

  const activeJobsGlobal = allServerJobs.filter((j) => j.status === "processing" || j.status === "pending");

  const handleApprove = async (email: string) => {
    const now = Date.now();
    await updateUser(email, { isApproved: true, status: "approved", limitSetAt: now, limitExpiresAt: now + ONE_MONTH_MS, maxBooksPerMonth: 10 });
    showMsg(`Approved ${email}`);
  };
  const handleReject = async (email: string) => {
    await updateUser(email, { isApproved: false, status: "rejected" });
    showMsg(`Rejected ${email}`);
  };
  const handlePend = async (email: string) => {
    await updateUser(email, { isApproved: false, status: "pending" });
    showMsg(`Set ${email} to pending`);
  };
  const handleSetLimit = async (email: string) => {
    const now = Date.now();
    await updateUser(email, { maxBooksPerMonth: editMaxBooks, limitSetAt: now, limitExpiresAt: now + ONE_MONTH_MS });
    setEditingUser(null);
    showMsg(`Limit updated for ${email}`);
  };
  const handleLoadUserJobs = async (email: string) => {
    setSelectedUserEmail(email); setLoadingUserJobs(true);
    try { const { jobs: uj } = await usersApi.getUserJobs(email); setUserJobs(uj); }
    catch { setUserJobs([]); }
    finally { setLoadingUserJobs(false); }
  };
  const handleAddAnnouncement = () => {
    if (!newMessage.trim()) return;
    const ann: Announcement = { id: crypto.randomUUID(), message: newMessage.trim(), preview: newMessage.trim().substring(0, 100), createdAt: Date.now() };
    addAnnouncement(ann); setNewMessage(""); showMsg("Announcement posted");
  };
  const handleKillAllJobs = async () => {
    if (!confirm("Kill ALL active jobs? This cannot be undone.")) return;
    setKillAllLoading(true);
    try {
      await loadAllJobs();
      const active = allServerJobs.filter((j) => j.status === "processing" || j.status === "pending");
      for (const job of active) await jobsApi.update(job.id, { status: "failed", errorMessage: "Killed by admin" });
      showMsg(`Killed ${active.length} jobs`);
      await loadAllJobs();
    } catch (err) { showMsg("Error: " + (err as Error).message, "error"); }
    finally { setKillAllLoading(false); }
  };
  const handleStopJob = async (jobId: string) => {
    try { await jobsApi.stop(jobId); await loadAllJobs(); showMsg("Job stopped"); }
    catch { showMsg("Failed to stop job", "error"); }
  };

  const tabStyle = (active: boolean) => ({
    padding: "7px 16px", borderRadius: "8px", fontSize: "12px", cursor: "pointer",
    backgroundColor: active ? "rgba(212,175,55,0.1)" : "transparent",
    border: `1px solid ${active ? GOLD : border}`,
    color: active ? GOLD : muted,
    whiteSpace: "nowrap" as const,
  });

  const filterTabStyle = (active: boolean) => ({
    padding: "6px 14px", borderRadius: "8px", fontSize: "12px", cursor: "pointer",
    backgroundColor: active ? (settings.theme === "light" ? "#E8E4DC" : "#111") : "transparent",
    border: `1px solid ${active ? (settings.theme === "light" ? "#C8C4BC" : "#333") : border}`,
    color: active ? text : muted,
    display: "flex", alignItems: "center", gap: "6px",
  });

  const getJobUser = (email: string) => allUsers.find((u) => u.email === email);

  return (
    <div style={{ backgroundColor: bg, minHeight: "100vh" }}>
      <NavBar />
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ color: text, fontSize: "22px", fontWeight: "600", margin: 0 }}>Admin Panel</h1>
            {pendingUsers.length > 0 && (
              <span style={{ backgroundColor: GOLD, color: "#000", borderRadius: "20px", padding: "2px 10px", fontSize: "11px", fontWeight: "700" }}>{pendingUsers.length} pending</span>
            )}
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {([ ["members", "Members"], ["usage", "Usage Monitor"], ["livejobs", "Live Jobs"], ["announcements", "Announcements"], ["health", "Health"] ] as const).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={tabStyle(tab === key)}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "16px" }}>
          {[
            { label: "Members", value: nonAdminUsers.length, color: text },
            { label: "Approved", value: approvedUsers.length, color: GREEN },
            { label: "Pending", value: pendingUsers.length, color: GOLD },
            { label: "Live Jobs", value: activeJobsGlobal.length, color: muted },
          ].map((metric) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "10px", padding: "12px 14px" }}
            >
              <p style={{ color: muted, fontSize: "11px", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{metric.label}</p>
              <p style={{ color: metric.color, fontSize: "22px", fontWeight: 600, margin: 0 }}><CountUp value={metric.value} color={metric.color} /></p>
            </motion.div>
          ))}
        </div>

        {msg && (
          <div style={{ backgroundColor: msgType === "success" ? "rgba(76,175,80,0.12)" : "rgba(244,67,54,0.12)", border: `1px solid ${msgType === "success" ? "rgba(76,175,80,0.3)" : "rgba(244,67,54,0.3)"}`, borderRadius: "8px", padding: "10px 16px", color: msgType === "success" ? GREEN : RED, fontSize: "13px", marginBottom: "16px" }}>
            {msg}
          </div>
        )}

        {/* ── MEMBERS DASHBOARD ─────────────────────────────────────── */}
        {tab === "members" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                {([ ["pending", "Pending", pendingUsers.length], ["approved", "Approved", approvedUsers.length], ["rejected", "Rejected", rejectedUsers.length] ] as const).map(([key, label, count]) => (
                  <button key={key} onClick={() => setMemberFilter(key)} style={filterTabStyle(memberFilter === key)}>
                    {label}
                    {count > 0 && (
                      <span style={{
                        backgroundColor: memberFilter === key ? (key === "pending" ? GOLD : key === "approved" ? GREEN : RED) : (settings.theme === "light" ? "#C8C4BC" : "#333"),
                        color: memberFilter === key ? "#000" : muted,
                        borderRadius: "10px", padding: "1px 6px", fontSize: "10px", fontWeight: "700"
                      }}>{count}</span>
                    )}
                  </button>
                ))}
              </div>
              <button onClick={() => { refreshUsers(); showMsg("Users refreshed"); }} style={{ backgroundColor: "transparent", border: `1px solid ${border}`, color: muted, padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>↻ Refresh</button>
            </div>
            {filteredUsers.length === 0 ? (
              <p style={{ color: muted, textAlign: "center", padding: "40px 0" }}>No {memberFilter} users.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredUsers.map((u) => (
                  <UserCard key={u.email} u={u} onApprove={handleApprove} onReject={handleReject} onPend={handlePend}
                    onEditLimit={(email) => { setEditingUser(email); setEditMaxBooks(u.maxBooksPerMonth || 10); }}
                    editingLimit={editingUser === u.email} editMaxBooks={editMaxBooks} setEditMaxBooks={setEditMaxBooks}
                    onSaveLimit={handleSetLimit} onCancelEdit={() => setEditingUser(null)} colors={colors} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── USAGE MONITOR ─────────────────────────────────────────── */}
        {tab === "usage" && (
          <div style={{ display: "grid", gridTemplateColumns: selectedUserEmail ? "240px 1fr" : "1fr", gap: "16px" }}>
            <div>
              <p style={{ color: muted, fontSize: "12px", marginBottom: "12px" }}>{approvedUsers.length} approved users</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {nonAdminUsers.map((u) => (
                  <button key={u.email} onClick={() => handleLoadUserJobs(u.email)}
                    style={{ backgroundColor: selectedUserEmail === u.email ? (settings.theme === "light" ? "#E8E4DC" : "#111") : "transparent", border: `1px solid ${selectedUserEmail === u.email ? (settings.theme === "light" ? "#C8C4BC" : "#333") : border}`, borderRadius: "8px", padding: "10px 12px", cursor: "pointer", textAlign: "left" }}>
                    <p style={{ color: text, fontSize: "13px", fontWeight: "500", margin: "0 0 2px" }}>{u.name}</p>
                    <p style={{ color: muted, fontSize: "11px", margin: 0 }}>{u.booksGenerated} books · {u.status}</p>
                  </button>
                ))}
              </div>
            </div>
            {selectedUserEmail && (
              <div>
                {loadingUserJobs ? <p style={{ color: muted }}>Loading...</p> : (
                  <div>
                    <p style={{ color: muted, fontSize: "13px", marginBottom: "12px" }}>{userJobs.length} books for {selectedUserEmail}</p>
                    {userJobs.length === 0 ? <p style={{ color: muted, fontSize: "13px" }}>No books generated yet.</p> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {userJobs.map((job) => (
                          <div key={job.id} style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "8px", padding: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }} onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}>
                              <div>
                                <p style={{ color: text, fontSize: "14px", fontWeight: "500", margin: "0 0 4px" }}>{job.title}</p>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                  <span style={{ color: muted, fontSize: "11px" }}>{new Date(job.createdAt).toLocaleDateString()}</span>
                                  <span style={{ color: muted, fontSize: "11px" }}>{job.tocParsed?.length || 0} chapters</span>
                                  <span style={{ color: muted, fontSize: "11px" }}>{job.markdownContent ? `~${Math.round(job.markdownContent.split(/\s+/).length / 200)} min read` : ""}</span>
                                  <span style={{ color: job.status === "completed" ? GREEN : job.status === "failed" ? RED : GOLD, fontSize: "11px", fontWeight: "600" }}>{job.status}</span>
                                </div>
                                {job.inputs && (
                                  <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                    {(job.inputs as Record<string, unknown>).tones && <span style={{ color: muted, fontSize: "11px" }}>Tones: {((job.inputs as Record<string, unknown>).tones as string[]).join(", ")}</span>}
                                    {(job.inputs as Record<string, unknown>).minPages && <span style={{ color: muted, fontSize: "11px" }}>{(job.inputs as Record<string, unknown>).minPages as number}–{(job.inputs as Record<string, unknown>).maxPages as number} pages</span>}
                                  </div>
                                )}
                              </div>
                              <span style={{ color: muted, fontSize: "18px" }}>{expandedJob === job.id ? "▲" : "▼"}</span>
                            </div>
                            {expandedJob === job.id && (
                              <div style={{ marginTop: "12px", borderTop: `1px solid ${border}`, paddingTop: "12px" }}>
                                {job.inputs && (
                                  <div style={{ marginBottom: "10px" }}>
                                    <p style={{ color: muted, fontSize: "11px", fontWeight: "600", letterSpacing: "0.05em", textTransform: "uppercase", margin: "0 0 6px" }}>Generation Inputs</p>
                                    {(job.inputs as Record<string, unknown>).additionalPrompt && <p style={{ color: muted, fontSize: "12px" }}>Prompt: {(job.inputs as Record<string, unknown>).additionalPrompt as string}</p>}
                                    {(job.inputs as Record<string, unknown>).memoryBank && <p style={{ color: muted, fontSize: "12px" }}>Memory Bank: {(job.inputs as Record<string, unknown>).memoryBank as string}</p>}
                                    {(job.inputs as Record<string, unknown>).tableOfContents && (
                                      <div>
                                        <p style={{ color: muted, fontSize: "11px", fontWeight: "600", letterSpacing: "0.05em", textTransform: "uppercase", margin: "8px 0 4px" }}>Table of Contents</p>
                                        <pre style={{ color: muted, fontSize: "12px", whiteSpace: "pre-wrap", margin: 0 }}>{(job.inputs as Record<string, unknown>).tableOfContents as string}</pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {job.markdownContent && (
                                  <div>
                                    <p style={{ color: muted, fontSize: "11px", fontWeight: "600", letterSpacing: "0.05em", textTransform: "uppercase", margin: "0 0 6px" }}>Content Preview</p>
                                    <div style={{ backgroundColor: inputBg, borderRadius: "6px", padding: "12px", maxHeight: "200px", overflow: "auto" }}>
                                      <pre style={{ color: muted, fontSize: "11px", margin: 0, whiteSpace: "pre-wrap", lineHeight: "1.5" }}>
                                        {job.markdownContent.substring(0, 600)}{job.markdownContent.length > 600 ? "..." : ""}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── LIVE JOB MONITOR ──────────────────────────────────────── */}
        {tab === "livejobs" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <p style={{ color: muted, fontSize: "13px", margin: 0 }}>
                {activeJobsGlobal.length} active job{activeJobsGlobal.length !== 1 ? "s" : ""} · {allServerJobs.length} total
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={handleKillAllJobs} disabled={killAllLoading || activeJobsGlobal.length === 0}
                  style={{ backgroundColor: "rgba(244,67,54,0.1)", border: "1px solid rgba(244,67,54,0.3)", color: RED, padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", opacity: activeJobsGlobal.length === 0 ? 0.4 : 1 }}>
                  {killAllLoading ? "Killing..." : "Kill All"}
                </button>
                <button onClick={loadAllJobs} disabled={loadingAllJobs} style={{ backgroundColor: "transparent", border: `1px solid ${border}`, color: muted, padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                  {loadingAllJobs ? "..." : "↻ Refresh"}
                </button>
              </div>
            </div>
            {allServerJobs.length === 0 ? <p style={{ color: muted, textAlign: "center", padding: "40px 0" }}>No jobs found.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {allServerJobs.sort((a, b) => { const o = { processing: 0, pending: 1, failed: 2, completed: 3 }; return (o[a.status] ?? 4) - (o[b.status] ?? 4); }).map((job) => {
                  const jobUser = getJobUser(job.userEmail ?? "");
                  return (
                    <div key={job.id} style={{ backgroundColor: card, border: `1px solid ${job.status === "processing" ? "rgba(212,175,55,0.25)" : border}`, borderRadius: "8px", padding: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                            <span style={{ color: text, fontSize: "14px", fontWeight: "500" }}>{job.title}</span>
                            <span style={{ color: job.status === "completed" ? GREEN : job.status === "failed" ? RED : GOLD, fontSize: "11px", fontWeight: "600" }}>{job.status}</span>
                            {job.status === "processing" && <span style={{ color: GOLD, fontSize: "11px" }}>{job.progress}%</span>}
                          </div>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ color: muted, fontSize: "11px" }}>{jobUser?.name || job.userEmail || "Unknown"}</span>
                            <span style={{ color: muted, fontSize: "11px" }}>{new Date(job.createdAt).toLocaleDateString()}</span>
                            <span style={{ color: muted, fontSize: "11px" }}>{job.tocParsed?.length || 0} chapters</span>
                          </div>
                          {job.status === "processing" && (
                            <div style={{ marginTop: "8px" }}>
                              <div style={{ backgroundColor: border, borderRadius: "3px", height: "4px", width: "200px" }}>
                                <div style={{ backgroundColor: GOLD, height: "4px", borderRadius: "3px", width: `${job.progress}%`, transition: "width 0.5s" }} />
                              </div>
                            </div>
                          )}
                        </div>
                        {(job.status === "processing" || job.status === "pending") && (
                          <button onClick={() => handleStopJob(job.id)} style={{ backgroundColor: "transparent", border: "1px solid rgba(244,67,54,0.4)", color: "#f44336", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Stop</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ANNOUNCEMENTS ─────────────────────────────────────────── */}
        {tab === "announcements" && (
          <div>
            <div style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "10px", padding: "20px", marginBottom: "20px" }}>
              <h3 style={{ color: text, fontSize: "15px", fontWeight: "600", margin: "0 0 14px 0" }}>Post Announcement</h3>
              <textarea
                value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Write your announcement..." rows={3}
                style={{ ...inputStyle, resize: "vertical" as const }}
                onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
                <button onClick={handleAddAnnouncement} style={{ backgroundColor: GOLD, color: "#000", padding: "8px 20px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600", border: "none" }}>Post</button>
              </div>
            </div>
            {announcements.length === 0 ? <p style={{ color: muted, textAlign: "center", padding: "40px 0" }}>No announcements yet.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[...announcements].sort((a, b) => b.createdAt - a.createdAt).map((ann) => (
                  <div key={ann.id} style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "10px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <p style={{ color: text, fontSize: "14px", margin: "0 0 8px", lineHeight: "1.5", flex: 1 }}>{ann.message}</p>
                      <button onClick={() => { if (confirm("Delete this announcement?")) removeAnnouncement(ann.id); }} style={{ color: RED, background: "none", border: "none", cursor: "pointer", fontSize: "18px", marginLeft: "12px", lineHeight: 1 }}>×</button>
                    </div>
                    <p style={{ color: muted, fontSize: "11px", margin: 0 }}>{new Date(ann.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SYSTEM HEALTH ─────────────────────────────────────────── */}
        {tab === "health" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[
              { label: "API Server", value: "Running", ok: true },
              { label: "Active Jobs (My Session)", value: `${jobs.filter((j) => j.status === "processing").length} processing`, ok: jobs.filter((j) => j.status === "processing").length < 5 },
              { label: "Total Users", value: `${nonAdminUsers.length} users (${approvedUsers.length} approved)`, ok: true },
              { label: "Pending Approvals", value: `${pendingUsers.length} pending`, ok: pendingUsers.length === 0 },
              { label: "Announcements", value: `${announcements.length} active`, ok: true },
            ].map(({ label, value, ok }) => (
              <div key={label} style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "10px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: text, fontSize: "14px" }}>{label}</span>
                <span style={{ color: ok ? GREEN : GOLD, fontSize: "13px", fontWeight: "600" }}>{value}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
