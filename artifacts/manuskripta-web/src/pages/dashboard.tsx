import { useState } from "react";
import { useLocation } from "wouter";
import { useApp } from "@/context/AppContext";
import type { BookJob } from "@/lib/types";

const GOLD = "#D4AF37";
const BG = "#000000";
const CARD = "#0A0A0A";
const BORDER = "#1A1A1A";

function statusColor(status: BookJob["status"]) {
  if (status === "completed") return "#4CAF50";
  if (status === "processing") return GOLD;
  if (status === "failed") return "#f44336";
  return "#888";
}

function statusLabel(job: BookJob) {
  if (job.status === "completed") return "Completed";
  if (job.status === "processing") {
    if (job.mode === "format") {
      if (job.progress < 40) return "Parsing manuscript...";
      if (job.progress < 80) return "Formatting pages...";
      return "Finalizing export...";
    }

    if (job.currentChapter > 0) return `Writing Chapter ${job.currentChapter}...`;
    if (job.progress < 20) return "Planning chapter flow...";
    return "Preparing manuscript...";
  }
  if (job.status === "failed") return "Failed";
  return "Queued";
}

function getTitleSnippet(job: BookJob): string {
  const title = job.title.trim().replace(/\s+/g, " ");
  if (!title) return "";
  const words = title.split(" ").slice(0, 7).join(" ");
  return words ? `${words}…` : "";
}

function getBookSnippet(job: BookJob): string {
  return getTitleSnippet(job);
}

function NavBar() {
  const { user, logout, unreadAnnouncements, settings } = useApp();
  const [, setLocation] = useLocation();
  const bg = settings.theme === "light" ? "#F5F5F0" : CARD;
  const border = settings.theme === "light" ? "#DDD6C8" : BORDER;
  const text = settings.theme === "light" ? "#111111" : "#E8E8E8";
  const muted = settings.theme === "light" ? "#666666" : "#888888";
  return (
    <div style={{ backgroundColor: bg, borderBottom: `1px solid ${border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "56px", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
        <span style={{ color: GOLD, fontWeight: "700", letterSpacing: "1.5px", fontSize: "16px", cursor: "pointer" }} onClick={() => setLocation("/")}>MANUSKRIPTA</span>
        <button onClick={() => setLocation("/announcements")} style={{ color: muted, background: "none", border: "none", cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
          Announcements
          {unreadAnnouncements > 0 && <span style={{ backgroundColor: GOLD, color: "#000", borderRadius: "10px", padding: "1px 6px", fontSize: "10px", fontWeight: "700" }}>{unreadAnnouncements}</span>}
        </button>
        {user?.isAdmin && <button onClick={() => setLocation("/admin")} style={{ color: muted, background: "none", border: "none", cursor: "pointer", fontSize: "13px" }}>Admin</button>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <span style={{ color: text, fontSize: "13px" }}>{user?.name}</span>
        <button
          onClick={() => setLocation("/settings")}
          title="Settings"
          style={{ color: muted, background: "none", border: "none", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: "2px", display: "flex", alignItems: "center" }}
        >
          ⚙
        </button>
        <button onClick={() => { logout(); setLocation("/login"); }} style={{ color: muted, background: "none", border: "none", cursor: "pointer", fontSize: "13px" }}>Logout</button>
      </div>
    </div>
  );
}

export { NavBar };

export default function DashboardPage() {
  const { jobs, removeJob, user, refreshJobs, stopGeneration, settings } = useApp();
  const [, setLocation] = useLocation();
  const [refreshing, setRefreshing] = useState(false);
  const bg = settings.theme === "light" ? "#F5F5F0" : BG;
  const card = settings.theme === "light" ? "#FFFDF8" : CARD;
  const border = settings.theme === "light" ? "#DDD6C8" : BORDER;
  const text = settings.theme === "light" ? "#111111" : "#E8E8E8";
  const muted = settings.theme === "light" ? "#666666" : "#555555";

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshJobs();
    setRefreshing(false);
  };

  const now = Date.now();
  const isLimitExpired = user?.limitExpiresAt && user.limitExpiresAt < now;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const booksThisMonth = jobs.filter((j) => j.createdAt >= monthStart.getTime()).length;
  const canCreate = user?.isAdmin || (!isLimitExpired && booksThisMonth < (user?.maxBooksPerMonth ?? 0));

  const isApproved = user?.isAdmin || user?.status === "approved";

  return (
    <div style={{ backgroundColor: bg, minHeight: "100vh" }}>
      <NavBar />
      {!user?.isAdmin && !isApproved && (
        <div style={{ backgroundColor: "rgba(244,67,54,0.1)", borderBottom: "1px solid rgba(244,67,54,0.3)", padding: "12px 24px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <span style={{ color: "#ff6b6b", fontSize: "13px", fontWeight: "500" }}>
            ⚠ Your account is pending admin approval. You cannot create or format a book until approved.
          </span>
          <a href="https://wa.link/tvplnb" target="_blank" rel="noopener noreferrer" style={{ backgroundColor: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.4)", color: "#ff6b6b", padding: "4px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", textDecoration: "none", whiteSpace: "nowrap" }}>
            Request Access →
          </a>
        </div>
      )}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <h1 style={{ color: text, fontSize: "22px", fontWeight: "600", margin: 0 }}>My Books</h1>
            {!user?.isAdmin && (
              <p style={{ color: muted, fontSize: "12px", marginTop: "4px" }}>
                {isLimitExpired
                  ? "⚠ Monthly limit expired — contact admin"
                  : `${booksThisMonth} / ${user?.maxBooksPerMonth ?? 0} books this month`}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button onClick={handleRefresh} disabled={refreshing} style={{ backgroundColor: "transparent", border: `1px solid ${border}`, color: muted, padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
              {refreshing ? "..." : "↻ Refresh"}
            </button>
            <button onClick={() => setLocation("/format-book")} disabled={!canCreate} style={{ backgroundColor: "transparent", border: `1px solid ${GOLD}`, color: GOLD, padding: "8px 16px", borderRadius: "8px", cursor: canCreate ? "pointer" : "not-allowed", fontSize: "13px", opacity: canCreate ? 1 : 0.5 }}>
              Format Book
            </button>
            <button onClick={() => setLocation("/create-book")} disabled={!canCreate} style={{ backgroundColor: GOLD, color: "#000", padding: "8px 20px", borderRadius: "8px", cursor: canCreate ? "pointer" : "not-allowed", fontSize: "13px", fontWeight: "600", border: "none", opacity: canCreate ? 1 : 0.5 }}>
              + Create Book
            </button>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📚</div>
            <h3 style={{ color: muted, fontSize: "16px", fontWeight: "400" }}>No books yet</h3>
            <p style={{ color: muted, fontSize: "13px", marginTop: "8px" }}>Create your first AI-generated book to get started.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {jobs.map((job) => (
              <div key={job.id} style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "10px", padding: "20px", cursor: "pointer" }} onClick={() => setLocation(`/book/${job.id}`)}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      <h3 style={{ color: text, fontSize: "16px", fontWeight: "600", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.title}</h3>
                      <span style={{ color: statusColor(job.status), backgroundColor: `${statusColor(job.status)}15`, border: `1px solid ${statusColor(job.status)}40`, borderRadius: "20px", padding: "2px 10px", fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap" }}>
                        {statusLabel(job)}
                      </span>
                      <span style={{ color: muted, backgroundColor: "#0F0F0F", border: `1px solid ${border}`, borderRadius: "20px", padding: "2px 8px", fontSize: "11px", whiteSpace: "nowrap" }}>
                        {job.mode === "format" ? "Format" : "Generate"}
                      </span>
                    </div>
                    {(() => {
                      const snippet = getBookSnippet(job);
                      return snippet ? (
                        <p style={{ color: muted, fontSize: "12px", margin: "2px 0 0 0", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          “{snippet}”
                        </p>
                      ) : null;
                    })()}
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginLeft: "16px" }} onClick={(e) => e.stopPropagation()}>
                    {job.status === "completed" && <button onClick={() => setLocation(`/reader/${job.id}`)} style={{ backgroundColor: "transparent", border: `1px solid ${GOLD}`, color: GOLD, padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Read</button>}
                    {job.status === "processing" && <button onClick={() => stopGeneration(job.id)} style={{ backgroundColor: "transparent", border: "1px solid #f44336", color: "#f44336", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Stop</button>}
                    <button onClick={() => { if (confirm(`Delete "${job.title}"?`)) removeJob(job.id); }} style={{ backgroundColor: "transparent", border: `1px solid ${border}`, color: muted, padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
