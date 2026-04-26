import { useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { NavBar } from "./dashboard";
import { exportToPDF, exportToDocx } from "@/lib/pdfExport";

const GOLD = "#D4AF37";

function headingToAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-");
}

function parseChapters(markdown: string) {
  const lines = markdown.split("\n");
  const chapters: { title: string; content: string; anchor: string }[] = [];
  let current: { title: string; lines: string[]; anchor: string } | null = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) chapters.push({ title: current.title, content: current.lines.join("\n").trim(), anchor: current.anchor });
      const title = line.replace(/^## /, "");
      current = { title, lines: [line], anchor: headingToAnchor(title) };
    } else if (line.startsWith("# ") && !current) {
      const title = line.replace(/^# /, "");
      current = { title, lines: [line], anchor: headingToAnchor(title) };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) chapters.push({ title: current.title, content: current.lines.join("\n").trim(), anchor: current.anchor });
  return chapters.length > 0 ? chapters : [{ title: "Book", content: markdown, anchor: "book" }];
}

function renderMarkdown(md: string, theme: string): string {
  const headingText = theme === "light" ? "#111111" : "#E8E8E8";
  const paraText = theme === "light" ? "#333333" : "#C8C8C8";
  const subText = theme === "light" ? "#444444" : "#C8C8C8";
  const borderColor = theme === "light" ? "#DDD6C8" : "#1A1A1A";

  return md
    // Headings with id anchors so internal links resolve
    .replace(/^#### (.+)$/gm, (_, t) =>
      `<h4 id="${headingToAnchor(t)}" style="color:${GOLD};font-size:14px;font-weight:600;margin:20px 0 8px">${t}</h4>`)
    .replace(/^### (.+)$/gm, (_, t) =>
      `<h3 id="${headingToAnchor(t)}" style="color:${GOLD};font-size:16px;font-weight:600;margin:24px 0 10px">${t}</h3>`)
    .replace(/^## (.+)$/gm, (_, t) =>
      `<h2 id="${headingToAnchor(t)}" style="color:${headingText};font-size:20px;font-weight:700;margin:0 0 20px;border-bottom:1px solid ${borderColor};padding-bottom:12px">${t}</h2>`)
    .replace(/^# (.+)$/gm, (_, t) =>
      `<h1 id="${headingToAnchor(t)}" style="color:${GOLD};font-size:24px;font-weight:700;letter-spacing:1px;margin:0 0 24px;text-align:center">${t}</h1>`)
    // Inline Markdown links [text](#anchor) → clickable styled links
    .replace(/\[([^\]]+)\]\(#([^)]+)\)/g,
      `<a href="#$2" class="msk-toc-link" style="color:${GOLD};text-decoration:underline;cursor:pointer;font-weight:500">$1</a>`)
    // Other inline links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      `<a href="$2" target="_blank" rel="noopener noreferrer" style="color:${GOLD};text-decoration:underline">$1</a>`)
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${headingText};font-weight:700">$1</strong>`)
    .replace(/\*(.+?)\*/g, `<em style="color:${subText};font-style:italic">$1</em>`)
    // List items
    .replace(/^- (.+)$/gm, `<li style="color:${paraText};margin:4px 0 4px 20px">$1</li>`)
    .replace(/^(\d+)\. (.+)$/gm, `<li style="color:${paraText};margin:4px 0 4px 20px"><strong>$1.</strong> $2</li>`)
    // Paragraphs
    .replace(/\n\n/g, `</p><p style="color:${paraText};line-height:1.8;margin:0 0 16px;font-size:15px">`)
    .replace(/\n/g, "<br/>")
    .replace(/^/, `<p style="color:${paraText};line-height:1.8;margin:0 0 16px;font-size:15px">`)
    .replace(/$/, "</p>");
}

export default function ReaderPage({ id }: { id: string }) {
  const { jobs, settings } = useApp();
  const [, setLocation] = useLocation();
  const [currentChapter, setCurrentChapter] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const theme = settings.theme;
  const bg     = theme === "light" ? "#F5F5F0" : "#000000";
  const card   = theme === "light" ? "#FFFDF8" : "#0A0A0A";
  const border = theme === "light" ? "#DDD6C8" : "#1A1A1A";
  const text   = theme === "light" ? "#111111" : "#E8E8E8";
  const muted  = theme === "light" ? "#666666" : "#888888";

  const job = jobs.find((j) => j.id === id);
  if (!job?.markdownContent) {
    return (
      <div style={{ backgroundColor: bg, minHeight: "100vh" }}>
        <NavBar />
        <div style={{ maxWidth: "800px", margin: "80px auto", textAlign: "center" }}>
          <p style={{ color: muted }}>Book not found or not completed.</p>
          <button onClick={() => setLocation("/")} style={{ color: GOLD, background: "none", border: "none", cursor: "pointer", marginTop: "16px" }}>← Back</button>
        </div>
      </div>
    );
  }

  const chapters = parseChapters(job.markdownContent);
  const chapter = chapters[currentChapter];

  // Intercept clicks on ToC anchor links and navigate to the correct chapter
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a");
    if (!link) return;

    const href = link.getAttribute("href") ?? "";
    if (!href.startsWith("#")) return;

    e.preventDefault();
    const anchorId = href.slice(1);
    const idx = chapters.findIndex((ch) => ch.anchor === anchorId);
    if (idx !== -1) {
      setCurrentChapter(idx);
      window.scrollTo(0, 0);
    }
  };

  return (
    <div style={{ backgroundColor: bg, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <NavBar />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {sidebarOpen && (
          <div style={{ width: "260px", backgroundColor: card, borderRight: `1px solid ${border}`, overflowY: "auto", flexShrink: 0, padding: "20px 0" }}>
            <div style={{ padding: "0 16px 16px", borderBottom: `1px solid ${border}`, marginBottom: "8px" }}>
              <p style={{ color: muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>Reading</p>
              <p style={{ color: text, fontSize: "14px", fontWeight: "600", margin: 0 }}>{job.title}</p>
            </div>
            {chapters.map((ch, i) => (
              <button
                key={i}
                onClick={() => { setCurrentChapter(i); window.scrollTo(0, 0); }}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 16px",
                  backgroundColor: i === currentChapter ? "rgba(212,175,55,0.1)" : "transparent",
                  borderLeft: i === currentChapter ? `3px solid ${GOLD}` : "3px solid transparent",
                  color: i === currentChapter ? GOLD : muted,
                  fontSize: "13px", border: "none", cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "10px", fontWeight: "600", marginRight: "8px", color: i === currentChapter ? GOLD : "#555" }}>{i + 1}</span>
                {ch.title}
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
          <div style={{ maxWidth: "680px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "8px" }}>
              <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ color: muted, background: "none", border: "none", cursor: "pointer", fontSize: "13px" }}>
                {sidebarOpen ? "⟨ Hide Chapters" : "⟩ Show Chapters"}
              </button>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button onClick={() => exportToPDF(job)} style={{ color: GOLD, background: "none", border: `1px solid ${GOLD}`, padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>Export PDF</button>
                <button onClick={() => exportToDocx(job)} style={{ color: muted, background: "none", border: `1px solid ${border}`, padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Export DOCX</button>
                <button onClick={() => { setCurrentChapter(Math.max(0, currentChapter - 1)); window.scrollTo(0, 0); }} disabled={currentChapter === 0} style={{ color: muted, background: "none", border: `1px solid ${border}`, padding: "6px 12px", borderRadius: "6px", cursor: currentChapter === 0 ? "not-allowed" : "pointer", fontSize: "12px", opacity: currentChapter === 0 ? 0.4 : 1 }}>← Prev</button>
                <span style={{ color: muted, fontSize: "12px", alignSelf: "center" }}>{currentChapter + 1} / {chapters.length}</span>
                <button onClick={() => { setCurrentChapter(Math.min(chapters.length - 1, currentChapter + 1)); window.scrollTo(0, 0); }} disabled={currentChapter === chapters.length - 1} style={{ color: muted, background: "none", border: `1px solid ${border}`, padding: "6px 12px", borderRadius: "6px", cursor: currentChapter === chapters.length - 1 ? "not-allowed" : "pointer", fontSize: "12px", opacity: currentChapter === chapters.length - 1 ? 0.4 : 1 }}>Next →</button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={chapter.anchor}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                style={{ fontFamily: "Georgia, serif", color: text }}
                onClick={handleContentClick}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(chapter.content, theme) }}
              />
            </AnimatePresence>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px", paddingTop: "20px", borderTop: `1px solid ${border}` }}>
              <button onClick={() => { setCurrentChapter(Math.max(0, currentChapter - 1)); window.scrollTo(0, 0); }} disabled={currentChapter === 0} style={{ color: currentChapter === 0 ? "#444" : GOLD, background: "none", border: "none", cursor: currentChapter === 0 ? "not-allowed" : "pointer", fontSize: "13px" }}>← Previous Chapter</button>
              <button onClick={() => { setCurrentChapter(Math.min(chapters.length - 1, currentChapter + 1)); window.scrollTo(0, 0); }} disabled={currentChapter === chapters.length - 1} style={{ color: currentChapter === chapters.length - 1 ? "#444" : GOLD, background: "none", border: "none", cursor: currentChapter === chapters.length - 1 ? "not-allowed" : "pointer", fontSize: "13px" }}>Next Chapter →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
