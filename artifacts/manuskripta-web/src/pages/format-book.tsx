import { useState } from "react";
import { useLocation } from "wouter";
import { useApp } from "@/context/AppContext";
import type { BookJob, BookInputs, FormatBookData } from "@/lib/types";

const GOLD = "#D4AF37";
const PAGE_SIZES = ["5 x 8 in", "5.25 x 8 in", "5.5 x 8.5 in", "5.06 x 7.81 in", "6 x 9 in", "6.14 x 9.21 in", "6.69 x 9.61 in", "7 x 10 in", "8 x 10 in", "8.5 x 11 in", "Custom Size"];

type ChapterEntry = { label: string; content: string };

export default function FormatBookPage() {
  const { addJob, startGeneration, settings, user } = useApp();
  const [, setLocation] = useLocation();

  // All hooks before any conditional return
  const [bookTitle, setBookTitle] = useState("");
  const [copyright, setCopyright] = useState("");
  const [dedication, setDedication] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [chapters, setChapters] = useState<ChapterEntry[]>([{ label: "", content: "" }]);
  const [conclusion, setConclusion] = useState("");
  const [backMatter, setBackMatter] = useState("");
  const [pageSize, setPageSize] = useState("6 x 9 in");
  const [error, setError] = useState("");

  const isApproved = user?.isAdmin || user?.status === "approved";
  if (!isApproved) {
    return (
      <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ backgroundColor: "#0A0A0A", border: "1px solid rgba(244,67,54,0.4)", borderRadius: "12px", padding: "32px", maxWidth: "480px", width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "16px" }}>🔒</div>
          <h2 style={{ color: "#ff6b6b", fontSize: "18px", fontWeight: "600", margin: "0 0 12px" }}>Access Restricted</h2>
          <p style={{ color: "#888", fontSize: "14px", lineHeight: "1.6", margin: "0 0 20px" }}>Your account is pending admin approval. You cannot format books until approved.</p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="https://wa.link/tvplnb" target="_blank" rel="noopener noreferrer" style={{ backgroundColor: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.4)", color: "#ff6b6b", padding: "10px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", textDecoration: "none" }}>Request Access</a>
            <button onClick={() => setLocation("/")} style={{ backgroundColor: "transparent", border: "1px solid #1A1A1A", color: "#888", padding: "10px 20px", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>← Back</button>
          </div>
        </div>
      </div>
    );
  }

  const theme = settings.theme;
  const bg     = theme === "light" ? "#F5F5F0" : "#000000";
  const card   = theme === "light" ? "#FFFDF8" : "#0A0A0A";
  const border = theme === "light" ? "#DDD6C8" : "#1A1A1A";
  const text   = theme === "light" ? "#111111" : "#E8E8E8";
  const muted  = theme === "light" ? "#666666" : "#C8C8C8";
  const inputBg = theme === "light" ? "#FFFFFF" : "#0D0D0D";

  const inputStyle = {
    width: "100%",
    backgroundColor: inputBg,
    border: `1px solid ${border}`,
    borderRadius: "8px",
    padding: "10px 14px",
    color: text,
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box" as const,
  };
  const textareaStyle = { ...inputStyle, resize: "vertical" as const };

  const addChapter = () => setChapters([...chapters, { label: "", content: "" }]);
  const removeChapter = (i: number) => setChapters(chapters.filter((_, idx) => idx !== i));
  const updateChapter = (i: number, key: "label" | "content", val: string) =>
    setChapters(chapters.map((ch, idx) => idx === i ? { ...ch, [key]: val } : ch));

  const handleSubmit = () => {
    if (!bookTitle.trim()) { setError("Book title is required"); return; }
    if (!introduction.trim()) { setError("Introduction is required"); return; }
    if (chapters.some((c) => !c.content.trim())) { setError("All chapters must have content"); return; }
    if (!conclusion.trim()) { setError("Conclusion is required"); return; }

    const formatData: FormatBookData = {
      bookTitle: bookTitle.trim(), copyright, dedication: dedication.trim() || undefined,
      introduction: introduction.trim(), chapters, conclusion: conclusion.trim(),
      backMatter: backMatter.trim() || undefined, pageSize,
    };

    const inputs: BookInputs = {
      title: bookTitle.trim(), tableOfContents: chapters.map((c, i) => c.label || `Chapter ${i + 1}`).join("\n"),
      minPages: 0, maxPages: 0, tones: [], allowStorytelling: false, pageSize,
      useHeadingColor: false, headingCapitalization: "titlecase", copyrightOption: "insert", mode: "format", formatData,
    };

    const job: BookJob = {
      id: crypto.randomUUID(), title: bookTitle.trim(), status: "pending", progress: 0,
      currentChapter: 0, totalChapters: chapters.length, chapterContents: [], chapterSummaries: [],
      blueprint: "", tocParsed: [], inputs, logs: [], createdAt: Date.now(), retryCount: 0, mode: "format",
    };

    addJob(job);
    startGeneration(job);
    setLocation(`/book/${job.id}`);
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: "20px" }}>
      <label style={{ display: "block", color: muted, fontSize: "14px", fontWeight: "500", marginBottom: "6px" }}>{label}</label>
      {children}
    </div>
  );

  return (
    <div style={{ backgroundColor: bg, minHeight: "100vh" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
          <button onClick={() => setLocation("/")} style={{ color: muted, background: "none", border: "none", cursor: "pointer", fontSize: "13px" }}>← Back</button>
          <h1 style={{ color: text, fontSize: "22px", fontWeight: "600", margin: 0 }}>Format & Polish Book</h1>
        </div>

        <div style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "28px" }}>
          <Field label="Book Title *">
            <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} placeholder="Your book title" style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
          </Field>

          <Field label="Page Size">
            <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Copyright">
            <textarea value={copyright} onChange={(e) => setCopyright(e.target.value)} placeholder="Copyright text..." rows={3} style={textareaStyle}
              onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
          </Field>

          <Field label="Dedication (optional)">
            <textarea value={dedication} onChange={(e) => setDedication(e.target.value)} placeholder="Dedication text..." rows={2} style={textareaStyle}
              onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
          </Field>

          <Field label="Introduction *">
            <textarea value={introduction} onChange={(e) => setIntroduction(e.target.value)} placeholder="Paste your introduction content..." rows={6} style={textareaStyle}
              onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
          </Field>

          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <label style={{ color: muted, fontSize: "14px", fontWeight: "500" }}>Chapters *</label>
              <button onClick={addChapter} style={{ backgroundColor: "transparent", border: `1px solid ${GOLD}`, color: GOLD, padding: "4px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>+ Add Chapter</button>
            </div>
            {chapters.map((ch, i) => (
              <div key={i} style={{ backgroundColor: inputBg, border: `1px solid ${border}`, borderRadius: "8px", padding: "16px", marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ color: GOLD, fontSize: "13px", fontWeight: "600" }}>Chapter {i + 1}</span>
                  {chapters.length > 1 && <button onClick={() => removeChapter(i)} style={{ color: "#f44336", background: "none", border: "none", cursor: "pointer", fontSize: "12px" }}>Remove</button>}
                </div>
                <input value={ch.label} onChange={(e) => updateChapter(i, "label", e.target.value)} placeholder={`Chapter ${i + 1} title`}
                  style={{ ...inputStyle, marginBottom: "10px" }}
                  onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
                <textarea value={ch.content} onChange={(e) => updateChapter(i, "content", e.target.value)} placeholder="Paste chapter content..." rows={5}
                  style={textareaStyle}
                  onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
              </div>
            ))}
          </div>

          <Field label="Conclusion *">
            <textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} placeholder="Paste your conclusion content..." rows={5} style={textareaStyle}
              onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
          </Field>

          <Field label="Back Matter (optional)">
            <textarea value={backMatter} onChange={(e) => setBackMatter(e.target.value)} placeholder="References, appendix, bibliography..." rows={4} style={textareaStyle}
              onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
          </Field>

          {error && <div style={{ backgroundColor: "rgba(244,67,54,0.1)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: "8px", padding: "12px 16px", color: "#ff6b6b", fontSize: "13px", marginBottom: "20px" }}>{error}</div>}

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button onClick={() => setLocation("/")} style={{ backgroundColor: "transparent", border: `1px solid ${border}`, color: muted, padding: "12px 24px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" }}>Cancel</button>
            <button onClick={handleSubmit} style={{ backgroundColor: GOLD, color: "#000", padding: "12px 28px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", border: "none", cursor: "pointer" }}>Format Book</button>
          </div>
        </div>
      </div>
    </div>
  );
}
