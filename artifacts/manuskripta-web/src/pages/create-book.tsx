import { useState } from "react";
import { useLocation } from "wouter";
import { useApp } from "@/context/AppContext";
import type { BookJob, BookInputs, HeadingCapitalization, HeadingColors } from "@/lib/types";

const GOLD = "#D4AF37";
const BG = "#000000";
const CARD = "#0A0A0A";
const BORDER = "#1A1A1A";

const PAGE_SIZES = ["5 x 8 in", "5.25 x 8 in", "5.5 x 8.5 in", "5.06 x 7.81 in", "6 x 9 in", "6.14 x 9.21 in", "6.69 x 9.61 in", "7 x 10 in", "8 x 10 in", "8.5 x 11 in", "Custom Size"];
const AVAILABLE_TONES = ["Professional", "Academic", "Conversational", "Inspirational", "Authoritative", "Empathetic", "Humorous", "Storytelling", "Technical", "Philosophical", "Motivational", "Research-Based", "Practical", "Reflective"];

const PALETTE = [
  { name: "Jet Black", hex: "#111111" },
  { name: "Charcoal", hex: "#374151" },
  { name: "Slate", hex: "#64748B" },
  { name: "Navy", hex: "#1E3A5F" },
  { name: "Royal Blue", hex: "#1D4ED8" },
  { name: "Sky Blue", hex: "#0EA5E9" },
  { name: "Teal", hex: "#0D9488" },
  { name: "Emerald", hex: "#059669" },
  { name: "Forest Green", hex: "#166534" },
  { name: "Gold", hex: "#D4AF37" },
  { name: "Amber", hex: "#D97706" },
  { name: "Crimson", hex: "#DC2626" },
  { name: "Rose", hex: "#E11D48" },
  { name: "Purple", hex: "#7C3AED" },
  { name: "Mocha Brown", hex: "#92400E" },
];

const DEFAULT_HEADING_COLORS: HeadingColors = {
  h1: "#1E3A5F",
  h2: "#1D4ED8",
  h3: "#0D9488",
  h4: "#64748B",
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <label style={{ display: "block", color: "#C8C8C8", fontSize: "14px", fontWeight: "500", marginBottom: "6px" }}>{label}</label>
      {hint && <p style={{ color: "#555", fontSize: "12px", marginBottom: "8px", marginTop: "-4px" }}>{hint}</p>}
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  backgroundColor: "#0D0D0D",
  border: `1px solid ${BORDER}`,
  borderRadius: "8px",
  padding: "10px 14px",
  color: "#E8E8E8",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box" as const,
};

export default function CreateBookPage() {
  const { addJob, startGeneration, user, settings } = useApp();
  const [, setLocation] = useLocation();

  // All hooks must be declared before any conditional return
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [authorName, setAuthorName] = useState(
    (settings.defaultAuthor && settings.defaultAuthor.trim()) || user?.name || ""
  );
  const [toc, setToc] = useState("");
  const [minPages, setMinPages] = useState(80);
  const [maxPages, setMaxPages] = useState(120);
  const [tones, setTones] = useState<string[]>(settings.defaultTones ?? []);
  const [allowStorytelling, setAllowStorytelling] = useState(true);
  const [pageSize, setPageSize] = useState("6 x 9 in");
  const [useHeadingColor, setUseHeadingColor] = useState(false);
  const [headingColors, setHeadingColors] = useState<HeadingColors>(DEFAULT_HEADING_COLORS);
  const [headingCapitalization, setHeadingCapitalization] = useState<HeadingCapitalization>("titlecase");
  const [copyrightOption, setCopyrightOption] = useState<"generate" | "insert" | "default">("generate");
  const [copyrightText, setCopyrightText] = useState("");
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [memoryBank, setMemoryBank] = useState(settings.memoryBank ?? "");
  const [error, setError] = useState("");

  const isApproved = user?.isAdmin || user?.status === "approved";
  if (!isApproved) {
    return (
      <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ backgroundColor: "#0A0A0A", border: "1px solid rgba(244,67,54,0.4)", borderRadius: "12px", padding: "32px", maxWidth: "480px", width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "16px" }}>🔒</div>
          <h2 style={{ color: "#ff6b6b", fontSize: "18px", fontWeight: "600", margin: "0 0 12px" }}>Access Restricted</h2>
          <p style={{ color: "#888", fontSize: "14px", lineHeight: "1.6", margin: "0 0 20px" }}>Your account is pending admin approval. You cannot create books until approved.</p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="https://wa.link/tvplnb" target="_blank" rel="noopener noreferrer" style={{ backgroundColor: "rgba(244,67,54,0.15)", border: "1px solid rgba(244,67,54,0.4)", color: "#ff6b6b", padding: "10px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", textDecoration: "none" }}>Request Access</a>
            <button onClick={() => setLocation("/")} style={{ backgroundColor: "transparent", border: "1px solid #1A1A1A", color: "#888", padding: "10px 20px", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}>← Back</button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = () => {
    if (!title.trim()) { setError("Book title is required"); return; }
    if (!toc.trim()) { setError("Table of Contents is required"); return; }
    if (minPages > maxPages) { setError("Min pages cannot exceed max pages"); return; }

    const effectiveCopyright = copyrightOption === "default"
      ? settings.defaultCopyright
      : copyrightOption === "insert" ? copyrightText : undefined;

    const now = Date.now();
    const inputs: BookInputs = {
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      authorName: authorName.trim() || undefined,
      tableOfContents: toc.trim(),
      minPages,
      maxPages,
      tones,
      allowStorytelling,
      pageSize,
      useHeadingColor,
      headingColors: useHeadingColor ? headingColors : undefined,
      headingCapitalization,
      copyrightOption,
      copyrightText: copyrightOption !== "generate" ? effectiveCopyright : undefined,
      additionalPrompt: additionalPrompt.trim() || undefined,
      memoryBank: memoryBank.trim() || undefined,
      mode: "create",
    };

    const job: BookJob = {
      id: crypto.randomUUID(),
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      status: "pending",
      progress: 0,
      currentChapter: 0,
      totalChapters: 0,
      chapterContents: [],
      chapterSummaries: [],
      blueprint: "",
      tocParsed: [],
      inputs,
      logs: [],
      createdAt: now,
      retryCount: 0,
      mode: "create",
    };

    addJob(job);
    startGeneration(job);
    setLocation(`/book/${job.id}`);
  };

  const theme = settings.theme;
  const bg = theme === "light" ? "#F5F5F0" : BG;
  const card = theme === "light" ? "#FFFDF8" : CARD;
  const border = theme === "light" ? "#DDD6C8" : BORDER;
  const text = theme === "light" ? "#111111" : "#E8E8E8";
  const muted = theme === "light" ? "#666666" : "#555555";
  const fieldBg = theme === "light" ? "#FFFFFF" : "#0D0D0D";

  return (
    <div style={{ backgroundColor: bg, minHeight: "100vh" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
          <button onClick={() => setLocation("/")} style={{ color: muted, background: "none", border: "none", cursor: "pointer", fontSize: "13px" }}>← Back</button>
          <h1 style={{ color: text, fontSize: "22px", fontWeight: "600", margin: 0 }}>Create New Book</h1>
        </div>

        <div style={{ backgroundColor: card, border: `1px solid ${border}`, borderRadius: "12px", padding: "28px" }}>
          <Field label="Book Title *">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter your book title..." style={{ ...inputStyle, backgroundColor: fieldBg, color: text, border: `1px solid ${border}` }} onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
          </Field>
          <Field label="Subtitle">
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Enter an optional subtitle..." style={{ ...inputStyle, backgroundColor: fieldBg, color: text, border: `1px solid ${border}` }} onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
          </Field>
          <Field label="Author Name" hint="Appears on the title page and in the copyright notice of the final export.">
            <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="e.g. Jane Doe" style={{ ...inputStyle, backgroundColor: fieldBg, color: text, border: `1px solid ${border}` }} onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
          </Field>
          <Field label="Table of Contents *" hint="One chapter per line. Chapter numbers are optional.">
            <textarea value={toc} onChange={(e) => setToc(e.target.value)} placeholder={"Introduction\nChapter 1: Getting Started\nChapter 2: Core Concepts\nConclusion"} rows={8} style={{ ...inputStyle, backgroundColor: fieldBg, color: text, border: `1px solid ${border}`, resize: "vertical", fontFamily: "monospace", lineHeight: "1.6" }} onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
            <Field label="Min Pages">
              <input type="number" value={minPages} onChange={(e) => setMinPages(Number(e.target.value))} min={20} max={500} style={{ ...inputStyle, backgroundColor: fieldBg, color: text, border: `1px solid ${border}` }} onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
            </Field>
            <Field label="Max Pages">
              <input type="number" value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} min={20} max={500} style={{ ...inputStyle, backgroundColor: fieldBg, color: text, border: `1px solid ${border}` }} onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
            </Field>
          </div>
          <Field label="Tones" hint="Pre-selected from your settings. Change as needed.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {AVAILABLE_TONES.map((tone) => (
                <button key={tone} onClick={() => setTones((prev) => prev.includes(tone) ? prev.filter((t) => t !== tone) : [...prev, tone])} style={{ padding: "6px 14px", borderRadius: "20px", fontSize: "13px", cursor: "pointer", border: "none", backgroundColor: tones.includes(tone) ? GOLD : "#111", color: tones.includes(tone) ? "#000" : "#888", fontWeight: tones.includes(tone) ? "600" : "400" }}>
                  {tone}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Page Size">
            <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} style={{ ...inputStyle, backgroundColor: fieldBg, color: text, border: `1px solid ${border}`, cursor: "pointer" }}>
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Copyright">
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
              {(["generate", "insert", "default"] as const).map((opt) => (
                <button key={opt} onClick={() => setCopyrightOption(opt)} style={{ padding: "6px 16px", borderRadius: "8px", fontSize: "13px", cursor: "pointer", border: `1px solid ${copyrightOption === opt ? GOLD : border}`, backgroundColor: copyrightOption === opt ? "rgba(212,175,55,0.1)" : "transparent", color: copyrightOption === opt ? GOLD : muted }}>
                  {opt === "generate" ? "AI Generate" : opt === "insert" ? "Custom Text" : "Use Default"}
                </button>
              ))}
            </div>
            {copyrightOption === "insert" && <textarea value={copyrightText} onChange={(e) => setCopyrightText(e.target.value)} placeholder="Enter copyright text..." rows={3} style={{ ...inputStyle, backgroundColor: fieldBg, color: text, border: `1px solid ${border}`, resize: "vertical" }} onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />}
            {copyrightOption === "default" && (
              <div style={{ backgroundColor: fieldBg, border: `1px solid ${border}`, borderRadius: "8px", padding: "12px 14px" }}>
                {settings.defaultCopyright ? <p style={{ color: muted, fontSize: "13px", margin: 0, lineHeight: "1.5" }}>{settings.defaultCopyright}</p> : <p style={{ color: muted, fontSize: "13px", margin: 0 }}>No default copyright set. <button onClick={() => setLocation("/settings")} style={{ color: GOLD, background: "none", border: "none", cursor: "pointer", fontSize: "13px", padding: 0 }}>Set one in Settings →</button></p>}
              </div>
            )}
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: useHeadingColor ? "12px" : "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: fieldBg, border: `1px solid ${border}`, borderRadius: "8px", padding: "14px" }}>
              <span style={{ color: text, fontSize: "14px" }}>Allow Storytelling</span>
              <button onClick={() => setAllowStorytelling(!allowStorytelling)} style={{ width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer", backgroundColor: allowStorytelling ? GOLD : "#333", position: "relative", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: "2px", width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s", left: allowStorytelling ? "22px" : "2px" }} />
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: fieldBg, border: `1px solid ${border}`, borderRadius: "8px", padding: "14px" }}>
              <span style={{ color: text, fontSize: "14px" }}>Color Headings</span>
              <button onClick={() => setUseHeadingColor(!useHeadingColor)} style={{ width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer", backgroundColor: useHeadingColor ? GOLD : "#333", position: "relative", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: "2px", width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s", left: useHeadingColor ? "22px" : "2px" }} />
              </button>
            </div>
          </div>
          {useHeadingColor && (
            <div style={{ backgroundColor: fieldBg, border: `1px solid ${border}`, borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
              <p style={{ color: muted, fontSize: "12px", margin: "0 0 14px" }}>Pick one color per heading level — applied to your PDF and DOCX exports</p>
              {(["h1", "h2", "h3", "h4"] as const).map((level) => {
                const labels: Record<string, string> = { h1: "H1 — Chapter Title", h2: "H2 — Major Section", h3: "H3 — Sub-section", h4: "H4 — Sub-sub-section" };
                return (
                  <div key={level} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                    <span style={{ color: headingColors[level], fontSize: "12px", fontWeight: "700", minWidth: "148px", letterSpacing: "0.3px" }}>{labels[level]}</span>
                    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                      {PALETTE.map((c) => {
                        const selected = headingColors[level] === c.hex;
                        return (
                          <button key={c.hex} title={c.name} onClick={() => setHeadingColors((prev) => ({ ...prev, [level]: c.hex }))} style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: c.hex, border: selected ? "2px solid #fff" : "2px solid transparent", cursor: "pointer", boxSizing: "border-box" }} />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Field label="Heading Capitalization">
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {([
                { value: "uppercase", label: "ABC (uppercase)" },
                { value: "titlecase", label: "Abc (title case)" },
                { value: "lowercase", label: "abc (lowercase)" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setHeadingCapitalization(opt.value)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    cursor: "pointer",
                    border: `1px solid ${headingCapitalization === opt.value ? GOLD : border}`,
                    backgroundColor: headingCapitalization === opt.value ? "rgba(212,175,55,0.1)" : "transparent",
                    color: headingCapitalization === opt.value ? GOLD : muted,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Additional Prompt (Optional)" hint="Extra direction for the AI — specific style notes, key themes to emphasize, or anything else.">
            <textarea value={additionalPrompt} onChange={(e) => setAdditionalPrompt(e.target.value)} placeholder="e.g. Focus heavily on practical examples. Use a direct, no-nonsense tone throughout." rows={4} style={{ ...inputStyle, backgroundColor: fieldBg, color: text, border: `1px solid ${border}`, resize: "vertical", lineHeight: "1.6" }} onFocus={(e) => (e.target.style.borderColor = GOLD)} onBlur={(e) => (e.target.style.borderColor = border)} />
          </Field>
          {error && <div style={{ backgroundColor: "rgba(244,67,54,0.1)", border: "1px solid rgba(244,67,54,0.3)", borderRadius: "8px", padding: "12px 16px", color: "#ff6b6b", fontSize: "13px", marginBottom: "20px" }}>{error}</div>}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button onClick={() => setLocation("/")} style={{ backgroundColor: "transparent", border: `1px solid ${border}`, color: muted, padding: "12px 24px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" }}>Cancel</button>
            <button onClick={handleSubmit} style={{ backgroundColor: GOLD, color: "#000", padding: "12px 28px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", border: "none", cursor: "pointer" }}>Create Book</button>
          </div>
        </div>
      </div>
    </div>
  );
}
