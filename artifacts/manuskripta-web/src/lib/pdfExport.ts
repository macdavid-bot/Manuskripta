import { Marked } from "marked";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageNumber,
  convertInchesToTwip,
  Footer,
  PageBreak,
  TableOfContents,
  StyleLevel,
  LevelFormat,
  SectionType,
} from "docx";
import type { BookJob } from "./types";

// ─── Page size tables (must match create-book.tsx and format-book.tsx exactly) ─

// CSS @page size values
const PAGE_SIZE_CSS: Record<string, string> = {
  "5 x 8 in":       "5in 8in",
  "5.25 x 8 in":    "5.25in 8in",
  "5.5 x 8.5 in":   "5.5in 8.5in",
  "5.06 x 7.81 in": "5.06in 7.81in",
  "6 x 9 in":       "6in 9in",
  "6.14 x 9.21 in": "6.14in 9.21in",
  "6.69 x 9.61 in": "6.69in 9.61in",
  "7 x 10 in":      "7in 10in",
  "8 x 10 in":      "8in 10in",
  "8.5 x 11 in":    "8.5in 11in",
};

// Page dimensions in inches [width, height]
const PAGE_SIZE_INCHES: Record<string, [number, number]> = {
  "5 x 8 in":       [5,    8],
  "5.25 x 8 in":    [5.25, 8],
  "5.5 x 8.5 in":   [5.5,  8.5],
  "5.06 x 7.81 in": [5.06, 7.81],
  "6 x 9 in":       [6,    9],
  "6.14 x 9.21 in": [6.14, 9.21],
  "6.69 x 9.61 in": [6.69, 9.61],
  "7 x 10 in":      [7,    10],
  "8 x 10 in":      [8,    10],
  "8.5 x 11 in":    [8.5,  11],
};

const DEFAULT_BLACK = "#111111";

function resolveHeadingColors(job: BookJob) {
  const { useHeadingColor, headingColors } = job.inputs;
  if (!useHeadingColor) return { h1: DEFAULT_BLACK, h2: DEFAULT_BLACK, h3: "#222222", h4: "#333333" };
  return {
    h1: headingColors?.h1 ?? DEFAULT_BLACK,
    h2: headingColors?.h2 ?? DEFAULT_BLACK,
    h3: headingColors?.h3 ?? "#222222",
    h4: headingColors?.h4 ?? "#333333",
  };
}

function toDocxColor(hex: string): string {
  return hex.replace(/^#/, "");
}

function getPageCss(job: BookJob): string {
  const { pageSize, customWidth, customHeight } = job.inputs;
  if (pageSize === "Custom Size" && customWidth && customHeight)
    return `${customWidth}in ${customHeight}in`;
  return PAGE_SIZE_CSS[pageSize] ?? "6in 9in";
}

function getPageInches(job: BookJob): [number, number] {
  const { pageSize, customWidth, customHeight } = job.inputs;
  if (pageSize === "Custom Size" && customWidth && customHeight)
    return [customWidth, customHeight];
  return PAGE_SIZE_INCHES[pageSize] ?? [6, 9];
}

// ─── HTML/Markdown → Print HTML (PDF) ───────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function escHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPrintHTML(title: string, markdown: string, pageCss: string, hc: ReturnType<typeof resolveHeadingColors>): string {
  const h1Color  = hc.h1;
  const h2Color  = hc.h2;
  const h3Color  = hc.h3;
  const h4Color  = hc.h4;
  const h1Border = hc.h1;
  const h2Border = hc.h2;

  const tocEntries: { level: number; text: string; id: string }[] = [];

  // Create a fresh Marked instance per call — avoids any global state mutation
  const markedInstance = new Marked();
  markedInstance.use({
    renderer: {
      heading({ text, depth }: { text: string; depth: number }) {
        const id = slugify(text);
        if (depth <= 3) tocEntries.push({ level: depth, text, id });
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
    },
  });

  const bodyHtml = markedInstance.parse(markdown) as string;

  const filteredToc = tocEntries.filter(
    (e) => !/^table of contents$/i.test(e.text) && !/^copyright$/i.test(e.text)
  );

  const tocHtml = filteredToc
    .map((e) => {
      const indent = e.level <= 2 ? 0 : (e.level - 2) * 20;
      const weight = e.level <= 2 ? "600" : "400";
      const size   = e.level === 1 ? "16px" : e.level === 2 ? "14px" : "13px";
      const color  = e.level === 1 ? hc.h1 : e.level === 2 ? hc.h2 : e.level === 3 ? hc.h3 : hc.h4;
      return `<div class="toc-entry" style="margin-left:${indent}px;font-weight:${weight};font-size:${size}">
        <a href="#${e.id}" class="toc-link" style="color:${color}">${e.text}</a>
      </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${escHtml(title)}</title>
  <style>
    @page {
      size: ${pageCss};
      margin: 1in 1in 0.9in 1in;
      @bottom-right { content: counter(page); font-family: Georgia,serif; font-size:10pt; color:#555; }
    }
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;font-family:Georgia,"Times New Roman",serif;font-size:11pt;color:#111;background:#fff;line-height:1.75}

    .title-page{page-break-after:always;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:calc(100vh - 2in);text-align:center;padding:1in 0}
    .title-page h1{font-size:28pt;font-weight:700;color:${h1Color};line-height:1.2;margin:0 0 24pt;border:none}
    .title-page .subtitle{font-size:12pt;color:#555;font-style:italic}

    .toc-page{page-break-after:always}
    .toc-page h2.toc-title{font-size:18pt;font-weight:700;color:${h2Color};border-bottom:2px solid ${h1Border};padding-bottom:8pt;margin-bottom:20pt}
    .toc-entry{padding:4pt 0;border-bottom:1px dotted #ccc}
    .toc-link{text-decoration:none}
    .toc-link:hover{text-decoration:underline}

    h1{font-size:22pt;font-weight:700;color:${h1Color};margin:48pt 0 12pt;page-break-before:always;page-break-after:avoid;border-bottom:2px solid ${h1Border};padding-bottom:8pt;line-height:1.2}
    h1:first-of-type{page-break-before:avoid}
    h2{font-size:17pt;font-weight:700;color:${h2Color};margin:36pt 0 10pt;page-break-before:always;page-break-after:avoid;border-bottom:1px solid ${h2Border};padding-bottom:6pt;line-height:1.3}
    h3{font-size:13pt;font-weight:700;color:${h3Color};margin:24pt 0 8pt;page-break-after:avoid}
    h4{font-size:11pt;font-weight:700;font-style:italic;color:${h4Color};margin:16pt 0 6pt;page-break-after:avoid}
    p{margin:0 0 10pt;text-align:justify;orphans:3;widows:3}
    ul,ol{margin:8pt 0 10pt 22pt;padding:0}
    li{margin:4pt 0;text-align:left}
    strong{font-weight:700}
    em{font-style:italic}
    blockquote{border-left:3px solid #ccc;margin:12pt 0 12pt 12pt;padding:4pt 0 4pt 14pt;color:#444;font-style:italic}
    hr{border:none;border-top:1px solid #ccc;margin:20pt 0}
    @media print{a[href^="http"]::after{content:""}}
  </style>
</head>
<body>
  <div class="title-page">
    <h1>${escHtml(title)}</h1>
  </div>
  <div class="toc-page">
    <h2 class="toc-title">Table of Contents</h2>
    ${tocHtml}
  </div>
  <div class="content">${bodyHtml}</div>
</body>
</html>`;
}

// ─── Markdown → DOCX ────────────────────────────────────────────────────────

interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  boldItalic?: boolean;
}

function parseInline(text: string): InlineSegment[] {
  const segs: InlineSegment[] = [];
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index) });
    if (m[2]) segs.push({ text: m[2], boldItalic: true });
    else if (m[3]) segs.push({ text: m[3], bold: true });
    else if (m[4]) segs.push({ text: m[4], italic: true });
    else if (m[5]) segs.push({ text: m[5], italic: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last) });
  return segs;
}

function makeRuns(text: string): TextRun[] {
  return parseInline(text).map(
    (s) =>
      new TextRun({
        text: s.text,
        bold: !!(s.bold || s.boldItalic),
        italics: !!(s.italic || s.boldItalic),
        size: 22,
        font: "Georgia",
      })
  );
}

function markdownToDocxParagraphs(markdown: string): Paragraph[] {
  const lines = markdown.split("\n");
  const paragraphs: Paragraph[] = [];
  let buffer: string[] = [];

  function flushBuffer() {
    const text = buffer.join(" ").trim();
    buffer = [];
    if (!text) return;
    paragraphs.push(
      new Paragraph({
        children: makeRuns(text),
        spacing: { after: 160, line: 280, lineRule: "auto" as any },
        alignment: AlignmentType.JUSTIFIED,
      })
    );
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^# /.test(line)) {
      flushBuffer();
      const text = line.replace(/^# /, "");
      if (/^table of contents$/i.test(text)) continue;
      paragraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 120 }, pageBreakBefore: true }));
      continue;
    }
    if (/^## /.test(line)) {
      flushBuffer();
      const text = line.replace(/^## /, "");
      if (/^table of contents$/i.test(text)) continue;
      paragraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 100 }, pageBreakBefore: true }));
      continue;
    }
    if (/^### /.test(line)) {
      flushBuffer();
      paragraphs.push(new Paragraph({ text: line.replace(/^### /, ""), heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 80 } }));
      continue;
    }
    if (/^#### /.test(line)) {
      flushBuffer();
      paragraphs.push(new Paragraph({ text: line.replace(/^#### /, ""), heading: HeadingLevel.HEADING_4, spacing: { before: 160, after: 60 } }));
      continue;
    }
    if (/^---+$/.test(line)) { flushBuffer(); continue; }
    if (/^[*-] /.test(line)) {
      flushBuffer();
      paragraphs.push(new Paragraph({ children: makeRuns(line.replace(/^[*-] /, "")), bullet: { level: 0 }, spacing: { after: 60 } }));
      continue;
    }
    if (/^\d+\. /.test(line)) {
      flushBuffer();
      paragraphs.push(new Paragraph({ children: makeRuns(line.replace(/^\d+\. /, "")), numbering: { reference: "ordered-list", level: 0 }, spacing: { after: 60 } }));
      continue;
    }
    if (/^> /.test(line)) {
      flushBuffer();
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.replace(/^> /, ""), italics: true, color: "555555", font: "Georgia", size: 22 })],
        indent: { left: convertInchesToTwip(0.5) }, spacing: { after: 120 },
      }));
      continue;
    }
    if (line === "") { flushBuffer(); continue; }
    buffer.push(line);
  }
  flushBuffer();
  return paragraphs;
}

// ─── Public: Export to PDF ───────────────────────────────────────────────────

export function exportToPDF(job: BookJob) {
  if (!job.markdownContent) {
    alert("No content available to export.");
    return;
  }
  const pageCss = getPageCss(job);
  const hc = resolveHeadingColors(job);
  const html = buildPrintHTML(job.title, job.markdownContent, pageCss, hc);

  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups for this site, then click Export PDF again.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Trigger print from the opener — avoids inline-script CSP restrictions
  setTimeout(() => win.print(), 1000);
}

// ─── Public: Export to DOCX ─────────────────────────────────────────────────

export async function exportToDocx(job: BookJob) {
  if (!job.markdownContent) return;

  const [widthIn, heightIn] = getPageInches(job);
  const marginIn = 1;
  const hc = resolveHeadingColors(job);
  const h1Color = toDocxColor(hc.h1);
  const h2Color = toDocxColor(hc.h2);
  const h3Color = toDocxColor(hc.h3);
  const h4Color = toDocxColor(hc.h4);

  const contentParagraphs = markdownToDocxParagraphs(job.markdownContent);

  const pageSize = {
    width: convertInchesToTwip(widthIn),
    height: convertInchesToTwip(heightIn),
  };
  const pageMargin = {
    top: convertInchesToTwip(marginIn),
    right: convertInchesToTwip(marginIn),
    bottom: convertInchesToTwip(marginIn),
    left: convertInchesToTwip(marginIn),
  };

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "ordered-list",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } },
              },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: "Georgia", size: 22 },
          paragraph: { spacing: { after: 160, line: 280 } },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          run: { bold: true, size: 44, font: "Georgia", color: h1Color },
          paragraph: {
            spacing: { before: 480, after: 120 },
            border: { bottom: { style: "single" as any, size: 12, color: h1Color } },
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          run: { bold: true, size: 34, font: "Georgia", color: h2Color },
          paragraph: {
            spacing: { before: 360, after: 100 },
            border: { bottom: { style: "single" as any, size: 6, color: h2Color } },
          },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          run: { bold: true, size: 26, font: "Georgia", color: h3Color },
          paragraph: { spacing: { before: 240, after: 80 } },
        },
        {
          id: "Heading4",
          name: "Heading 4",
          basedOn: "Normal",
          next: "Normal",
          run: { bold: true, italics: true, size: 22, font: "Georgia", color: h4Color },
          paragraph: { spacing: { before: 160, after: 60 } },
        },
      ],
    },
    sections: [
      // Title page
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: { size: pageSize, margin: pageMargin },
        },
        children: [
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: job.title, bold: true, size: 56, font: "Georgia", color: h1Color })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
          }),
          new Paragraph({ children: [new PageBreak()] }),
        ],
      },
      // TOC page
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: { size: pageSize, margin: pageMargin },
        },
        children: [
          new TableOfContents("Table of Contents", {
            hyperlink: true,
            headingStyleRange: "1-3",
            stylesWithLevels: [
              new StyleLevel("Heading1", 1),
              new StyleLevel("Heading2", 2),
              new StyleLevel("Heading3", 3),
            ],
          }),
          new Paragraph({ children: [new PageBreak()] }),
        ],
      },
      // Main content
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: pageSize,
            margin: { ...pageMargin, bottom: convertInchesToTwip(0.9) },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [new TextRun({ children: [PageNumber.CURRENT], font: "Georgia", size: 18, color: "555555" })],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        children: contentParagraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${job.title.replace(/[^\w\s]/g, "").replace(/\s+/g, "_")}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
