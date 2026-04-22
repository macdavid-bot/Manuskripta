import { useLocation } from "wouter";
import { useApp } from "@/context/AppContext";
import { NavBar } from "./dashboard";
import { exportToPDF, exportToDocx } from "@/lib/pdfExport";

const GOLD = "#D4AF37";

function logColor(type: "info" | "error" | "success") {
  if (type === "error") return "#ff6b6b";
  if (type === "success") return "#4CAF50";
  return "#888";
}

export default function BookDetailsPage({ id }: { id: string }) {
  const { jobs, removeJob, stopGeneration, startGeneration, resumeGeneration, updateJob, settings } = useApp();
  const [, setLocation] = useLocation();
  const theme = settings.theme;
  const bg     = theme === "light" ? "#F5F5F0" : "#000000";
  const card   = theme === "light" ? "#FFFDF8" : "#0A0A0A";
  const border = theme === "light" ? "#DDD6C8" : "#1A1A1A";
  const text   = theme === "light" ? "#111111" : "#E8E8E8";
  const muted  = theme === "light" ? "#666666" : "#888888";
  const logBg  = theme === "light" ? "#F0EDE6" : "#060606";

  const job = jobs.find((j) => j.id === id);

  if (!job) {
    return (
      <div style={{ backgroundColor: bg, minHeight: "100vh" }}>
        <NavBar />
        <div style={{ maxWidth: "800px", margin: "80px auto", textAlign: "center" }}>
          <p style={{ color: muted }}>Job not found.</p>
          <button onClick={() => setLocation("/")} style={{ color: GOLD, background: "none", border: "none", cursor: "pointer", marginTop: "16px" }}>← Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const savedChapters = job.chapterContents?.filter((c) => c && c.length > 0).length ?? 0;
  const resumeChapter = savedChapters + 1;

  const handleResume = () => {
    // Resume from last saved chapter — does NOT wipe chapterContents
    resumeGeneration(job.id);
  };

  const handleRestartFresh = () => {
    if (!confirm(`This will delete all ${savedChapters} saved chapter(s) and start from Chapter 1. Are you sure?`)) return;
    const resetJob = { ...job, status: "pending" as const, progress: 0, currentChapter: 0, chapterContents: [], chapterSummaries: [], logs: [], blueprint: "", tocParsed: [], errorMessage: undefined, markdownContent: undefined };
    updateJob(job.id, resetJob);
    startGeneration(resetJob);
  };

  const wordCount = job.markdownContent ? job.markdownContent.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div style={{ backgroundColor: bg, minHeight: "100vh" }}>
      <NavBar />
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
        <button onClick={() => setLocation("/")} style={{ color: muted, background: "none", border: "none", cursor: "pointer", fontSize: "13px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "6px" }}>← Back</button>

        <div style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "24px", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <h1 style={{ color: text, fontSize: "22px", fontWeight: "600", margin: "0 0 8px 0" }}>{job.title}</h1>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ color: muted, fontSize: "12px" }}>{new Date(job.createdAt).toLocaleString()}</span>
                <span style={{ color: border }}>·</span>
                <span style={{ color: muted, fontSize: "12px" }}>{job.mode === "format" ? "Format" : "Generate"}</span>
                {job.status === "completed" && <><span style={{ color: border }}>·</span><span style={{ color: muted, fontSize: "12px" }}>{wordCount.toLocaleString()} words</span></>}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {job.status === "completed" && (
                <>
                  <button onClick={() => setLocation(`/reader/${job.id}`)} style={{ backgroundColor: GOLD, color: "#000", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600", border: "none" }}>Read Book</button>
                  <button onClick={() => exportToPDF(job)} style={{ backgroundColor: "transparent", border: `1px solid ${GOLD}`, color: GOLD, padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>Export PDF</button>
                  <button onClick={() => exportToDocx(job)} style={{ backgroundColor: "transparent", border: `1px solid ${border}`, color: muted, padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>Export DOCX</button>
                </>
              )}
              {job.status === "processing" && <button onClick={() => stopGeneration(job.id)} style={{ backgroundColor: "transparent", border: "1px solid #f44336", color: "#f44336", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>Stop</button>}
              {job.status === "failed" && job.mode !== "format" && savedChapters > 0 && (
                <button onClick={handleResume} style={{ backgroundColor: GOLD, color: "#000", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600", border: "none" }}>
                  Resume from Ch.{resumeChapter}
                </button>
              )}
              {job.status === "failed" && (
                <button onClick={handleRestartFresh} style={{ backgroundColor: "transparent", border: `1px solid ${GOLD}`, color: GOLD, padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
                  {savedChapters > 0 ? "Restart from Ch.1" : "Restart"}
                </button>
              )}
              <button onClick={() => { if (confirm("Delete this job?")) { removeJob(job.id); setLocation("/"); } }} style={{ backgroundColor: "transparent", border: `1px solid ${border}`, color: muted, padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>Delete</button>
            </div>
          </div>

          {job.status === "processing" && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ color: muted, fontSize: "13px" }}>
                  {job.mode === "create" ? `Chapter ${job.currentChapter} of ${job.totalChapters}` : `Section ${job.currentChapter} of ${job.totalChapters}`}
                </span>
                <span style={{ color: GOLD, fontSize: "13px", fontWeight: "600" }}>{job.progress}%</span>
              </div>
              <div style={{ backgroundColor: border, borderRadius: "4px", height: "6px" }}>
                <div style={{ backgroundColor: GOLD, height: "6px", borderRadius: "4px", width: `${job.progress}%`, transition: "width 0.5s" }} />
              </div>
            </div>
          )}

          {job.status === "failed" && job.errorMessage && (
            <div style={{ backgroundColor: "rgba(244,67,54,0.1)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: "8px", padding: "12px", marginTop: "12px" }}>
              <p style={{ color: "#ff6b6b", fontSize: "13px", margin: 0 }}>Error: {job.errorMessage}</p>
            </div>
          )}
        </div>

        {job.mode === "create" && job.tocParsed?.length > 0 && (
          <div style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
            <h3 style={{ color: muted, fontSize: "13px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 14px 0" }}>Table of Contents</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {job.tocParsed.map((chapter, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ color: GOLD, fontSize: "12px", fontWeight: "600", minWidth: "24px" }}>{i + 1}.</span>
                  <span style={{ color: job.chapterContents[i] ? text : muted, fontSize: "14px" }}>{chapter}</span>
                  {job.chapterContents[i] && <span style={{ color: "#4CAF50", fontSize: "11px", marginLeft: "auto" }}>✓</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "20px" }}>
          <h3 style={{ color: muted, fontSize: "13px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 14px 0" }}>Generation Log</h3>
          <div style={{ maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
            {job.logs.length === 0 ? (
              <p style={{ color: muted, fontSize: "13px" }}>No logs yet.</p>
            ) : (
              [...job.logs].reverse().map((log, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", padding: "4px 0", borderBottom: i < job.logs.length - 1 ? `1px solid ${border}` : "none" }}>
                  <span style={{ color: muted, fontSize: "11px", whiteSpace: "nowrap", paddingTop: "1px" }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span style={{ color: logColor(log.type), fontSize: "13px" }}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
