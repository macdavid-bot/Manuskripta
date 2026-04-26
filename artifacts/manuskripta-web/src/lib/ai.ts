import { aiApi } from "./api";
import type { BookInputs } from "./types";

async function callAI(
  messages: { role: string; content: string }[],
  maxTokens = 4096
): Promise<string> {
  const data = await aiApi.complete(messages, maxTokens);
  return data.choices[0]?.message?.content ?? "";
}

function estimateWordsPerPage(pageSize: string): number {
  const smallSizes = ["5 x 8 in", "5.25 x 8 in", "5.5 x 8.5 in", "5.06 x 7.81 in", "6 x 9 in"];
  const isSmall = smallSizes.some((s) => pageSize.includes(s)) || pageSize === "Custom Size";
  return isSmall ? 250 : 350;
}

export function calculateWordTargets(inputs: BookInputs, chapterCount: number) {
  const wordsPerPage = estimateWordsPerPage(inputs.pageSize);
  const minWords = inputs.minPages * wordsPerPage;
  const maxWords = inputs.maxPages * wordsPerPage;
  const targetWords = Math.floor((minWords + maxWords) / 2);
  const wordsPerChapter = Math.floor(targetWords / chapterCount);
  const variation = Math.floor(wordsPerChapter * 0.1);
  return {
    minPerChapter: wordsPerChapter - variation,
    maxPerChapter: wordsPerChapter + variation,
    totalTarget: targetWords,
  };
}

// ---------------------------------------------------------------------------
// STRICT, DETERMINISTIC TOC PARSER (mirror of api-server/src/lib/ai.ts)
// ---------------------------------------------------------------------------
// Only lines starting with "Chapter N" or "Ch. N" count as chapters.
// Introduction / Conclusion / Foreword / Preface / Appendix / etc. are excluded.
// Other lines attach as subsections to the most recent chapter.
// Pure rule-based — no LLM involved.
// ---------------------------------------------------------------------------

export interface ParsedChapter {
  title: string;
  bareTitle: string;
  number: number;
  subsections: string[];
}

const NON_CHAPTER_PATTERN = /^(table of contents|contents|copyright|dedication|foreword|preface|introduction|conclusion|epilogue|prologue|index|bibliography|references|glossary|appendix(\s+\w+)?|about the author|acknowledgements?|afterword)$/i;
const STRICT_CHAPTER_PATTERN = /^(chapter|ch\.?|part|lesson|step)\s*(\d+)\b\s*[:\-\.\)]?\s*(.*)$/i;
const FLEX_CHAPTER_PATTERN = /^(\d+)\s*[\.\)]\s+(.+)$/;

function cleanTocLine(raw: string): string {
  return raw
    .replace(/[.\s]{2,}\d+\s*$/, "")
    .replace(/\s+\d+\s*$/, "")
    .replace(/^[-•◦▪▫·*\u2022\u2013\u2014>]+\s*/, "")
    .replace(/\.{3,}/g, "")
    .trim();
}

export interface ParseResult {
  chapters: ParsedChapter[];
  mode: "strict" | "flex" | "json";
  warnings: string[];
}

type Extractor = (m: RegExpMatchArray, counter: number) => { declared: number; bareTitle: string };

function runParser(rawLines: string[], pattern: RegExp, extract: Extractor): { chapters: ParsedChapter[]; warnings: string[] } {
  const chapters: ParsedChapter[] = [];
  const warnings: string[] = [];
  let counter = 0;
  let blankRun = 0;
  for (const raw of rawLines) {
    if (!raw.trim()) { blankRun += 1; continue; }
    const line = cleanTocLine(raw);
    if (!line) { blankRun += 1; continue; }
    if (NON_CHAPTER_PATTERN.test(line)) { blankRun = 0; continue; }
    const m = line.match(pattern);
    if (m) {
      counter += 1;
      const { declared, bareTitle } = extract(m, counter);
      if (declared !== counter) warnings.push(`Numbering hint: line says "${declared}" but position is ${counter}.`);
      chapters.push({ title: `Chapter ${counter}: ${bareTitle}`, bareTitle, number: counter, subsections: [] });
      blankRun = 0;
      continue;
    }
    if (chapters.length === 0) { warnings.push(`Orphan line discarded: "${line}"`); blankRun = 0; continue; }
    if (blankRun >= 2) { warnings.push(`Loose line skipped: "${line}"`); blankRun = 0; continue; }
    chapters[chapters.length - 1].subsections.push(line);
    blankRun = 0;
  }
  return { chapters, warnings };
}

function tryParseJsonToc(toc: string): ParsedChapter[] | null {
  const trimmed = toc.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const chapters = arr.map((it: { title?: unknown; subs?: unknown }, i: number) => {
      const num = i + 1;
      const cleaned = String(it?.title ?? "").trim().replace(/^chapter\s+\d+[:\s-]*/i, "").trim();
      const bareTitle = cleaned.length > 0 ? cleaned : `Chapter ${num}`;
      const subs = Array.isArray(it?.subs) ? it.subs.map((s) => String(s).trim()).filter((s) => s.length > 0) : [];
      return { title: `Chapter ${num}: ${bareTitle}`, bareTitle, number: num, subsections: subs };
    }).filter((c) => c.bareTitle.length > 0);
    return chapters.length > 0 ? chapters : null;
  } catch { return null; }
}

export function parseTOCDetailed(toc: string): ParseResult {
  const json = tryParseJsonToc(toc);
  if (json) return { chapters: json, mode: "json", warnings: [] };
  const lines = toc.split(/\r?\n/);
  const strict = runParser(lines, STRICT_CHAPTER_PATTERN, (m, n) => {
    const declared = parseInt(m[2], 10);
    const remainder = (m[3] ?? "").trim();
    return { declared, bareTitle: remainder.length > 0 ? remainder : `Chapter ${n}` };
  });
  if (strict.chapters.length > 0) return { chapters: strict.chapters, mode: "strict", warnings: strict.warnings };
  const flex = runParser(lines, FLEX_CHAPTER_PATTERN, (m, n) => {
    const declared = parseInt(m[1], 10);
    const remainder = (m[2] ?? "").trim();
    return { declared, bareTitle: remainder.length > 0 ? remainder : `Chapter ${n}` };
  });
  return { chapters: flex.chapters, mode: "flex", warnings: flex.warnings };
}

export function parseTOCStrict(toc: string): ParsedChapter[] {
  return parseTOCDetailed(toc).chapters;
}

export function parseTOC(toc: string): string[] {
  return parseTOCStrict(toc).map((c) => c.title);
}

export function stripRogueChapters(content: string, currentChapterNumber: number): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let seenSelf = false;
  for (const line of lines) {
    const m = line.match(/^##\s+chapter\s+(\d+)\b/i);
    if (m) {
      const num = parseInt(m[1], 10);
      if (!seenSelf && num === currentChapterNumber) { seenSelf = true; out.push(line); continue; }
      break;
    }
    out.push(line);
  }
  return out.join("\n").trim();
}

export async function createBookBlueprint(inputs: BookInputs): Promise<string> {
  const tones = inputs.tones.length > 0 ? inputs.tones.join(", ") : "auto-determined";
  const prompt = `You are a world-class writing strategist. Create an internal Book Blueprint for:

Title: "${inputs.title}"
Table of Contents: ${inputs.tableOfContents}
Tone(s): ${tones}
Storytelling: ${inputs.allowStorytelling ? "Enabled" : "Disabled"}
${inputs.additionalPrompt ? `Additional Direction: ${inputs.additionalPrompt}` : ""}
${inputs.memoryBank ? `Author Memory Bank: ${inputs.memoryBank}` : ""}

Create a concise blueprint (max 800 words) covering:
1. Overall book objective and target audience
2. Tone strategy
3. Chapter-by-chapter breakdown: goal, key ideas, logical progression
4. How chapters connect to form a cohesive whole

Be specific and strategic. This is for internal use only.`;

  return await callAI([{ role: "user", content: prompt }], 1500);
}

export async function generateChapter(
  inputs: BookInputs,
  blueprint: string,
  chapterTitle: string,
  chapterIndex: number,
  totalChapters: number,
  previousSummaries: string[],
  minWords: number,
  maxWords: number
): Promise<string> {
  const tones = inputs.tones.length > 0 ? inputs.tones.join(", ") : "auto-determined based on content";
  const prevContext =
    previousSummaries.length > 0
      ? `Previous chapters summary: ${previousSummaries.slice(-3).join(" | ")}`
      : "This is the first chapter.";

  const systemPrompt = `You are a world-class, elite-level writing intelligence producing a premium, KDP-ready book.

IDENTITY: You are a high-performance author who produces books that feel human-written, polished, and valuable.

CORE RULES:
- Write with clarity AND depth — never sacrifice one for the other
- Write naturally, varying sentence structures and rhythm
- NEVER repeat ideas from previous chapters
- NEVER use filler content — every paragraph must add new value
- Be assertive, confident, and direct
- ${inputs.allowStorytelling ? "Use meaningful stories, analogies, and examples that enhance understanding" : "Remain strictly informational and direct"}
- Maintain consistent tone throughout

STRUCTURE PER CHAPTER:
- Strong, engaging opening
- Logically structured body with subsections
- Clear, memorable closing

FORMAT: Use clean Markdown with ## for chapter title, ### for subsections, #### for sub-subsections`;

  const userPrompt = `Write Chapter ${chapterIndex + 1} of ${totalChapters}: "${chapterTitle}"

Book: "${inputs.title}"
Full TOC: ${inputs.tableOfContents}
Tone(s): ${tones}
Target word count: ${minWords}–${maxWords} words (stay within ±10%)

${prevContext}

Relevant Blueprint Context:
${blueprint.substring(0, 600)}

${inputs.memoryBank ? `Author preferences: ${inputs.memoryBank}` : ""}
${inputs.additionalPrompt ? `Additional direction: ${inputs.additionalPrompt}` : ""}

Write ONLY this chapter. Start with ## ${chapterTitle}. Do not include the book title or chapter number in the heading.`;

  return await callAI(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    Math.floor(maxWords * 1.8)
  );
}

export async function summarizeChapter(chapterTitle: string, chapterContent: string): Promise<string> {
  const prompt = `Summarize this chapter in 2-3 sentences for continuity tracking. Be specific about key ideas covered so future chapters don't repeat them.

Chapter: "${chapterTitle}"
Content (first 1000 chars): ${chapterContent.substring(0, 1000)}`;

  return await callAI([{ role: "user", content: prompt }], 200);
}

export async function generateCopyright(inputs: BookInputs): Promise<string> {
  const minimumWords = 60;
  const maxAttempts = 3;

  const isCopyrightComplete = (text: string): boolean => {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return false;

    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    if (wordCount < minimumWords) return false;

    const hasYear = new RegExp(String(new Date().getFullYear())).test(normalized);
    const hasRightsReserved = /all rights reserved/i.test(normalized);
    const hasDisclaimer = /(disclaimer|liable|liability|for informational purposes)/i.test(normalized);
    const hasReuseNote = /(similar books|same author|other works)/i.test(normalized);

    return hasYear && hasRightsReserved && hasDisclaimer && hasReuseNote;
  };

  const authorLine = inputs.authorName ? `\nAuthor: "${inputs.authorName}"` : "";
  const authorInstruction = inputs.authorName
    ? `Use "${inputs.authorName}" as the copyright holder / author name.`
    : `Use a generic placeholder for the author name.`;

  const prompt = `Generate a professional copyright page text for:
Title: "${inputs.title}"${authorLine}

Include: copyright year (${new Date().getFullYear()}), the author/holder name, rights reserved statement, disclaimer, and a note that it can be used for similar books by the same author.
NEVER truncate, abbreviate, or cut off the copyright text. Return the full, complete copyright section only.
The section must be fully complete and at least ${minimumWords} words. ${authorInstruction} Keep it concise and professional.`;

  let bestAttempt = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await callAI([{ role: "user", content: prompt }], 450);
    const cleaned = response.trim();
    if (cleaned.length > bestAttempt.length) bestAttempt = cleaned;
    if (isCopyrightComplete(cleaned)) {
      return cleaned;
    }
  }

  throw new Error(
    `Failed to generate a complete copyright section after ${maxAttempts} attempts. Last output length: ${bestAttempt.length} chars.`
  );
}

export async function assembleFinalBook(
  inputs: BookInputs,
  chapters: string[],
  tocParsed: string[],
  copyrightText: string
): Promise<string> {
  const tocMarkdown = tocParsed.map((ch, i) => `${i + 1}. ${ch}`).join("\n");
  let book = `# ${inputs.title}\n\n`;
  if (inputs.authorName) {
    book += `_by ${inputs.authorName}_\n\n`;
  }
  book += `## Copyright\n\n${copyrightText}\n\n`;
  book += `## Table of Contents\n\n${tocMarkdown}\n\n`;
  book += chapters.join("\n\n");
  return book;
}

export async function formatSection(
  bookTitle: string,
  sectionLabel: string,
  sectionContent: string,
  pageSize: string,
  sectionType: "intro" | "chapter" | "conclusion" | "backmatter"
): Promise<string> {
  const systemPrompt = `You are a premium manuscript formatter and polisher.
Your job: improve clarity, fix grammar/phrasing, ensure smooth flow, and structure the content professionally.
DO NOT rewrite or change the author's meaning.
DO NOT add new content beyond what is needed for flow.
Output clean Markdown.`;

  const userPrompt = `Format and polish this ${sectionType} section for the book "${bookTitle}" (target page size: ${pageSize}):

## ${sectionLabel}

${sectionContent}

Requirements:
- Fix any grammar or phrasing issues
- Improve sentence flow and transitions
- Ensure it reads professionally
- Keep the same structure and meaning
- Output ONLY the formatted section starting with ## ${sectionLabel}`;

  return await callAI(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    Math.max(2000, Math.floor(sectionContent.split(/\s+/).length * 1.3))
  );
}

export async function assembleFinalFormattedBook(
  bookTitle: string,
  copyright: string,
  dedication: string | undefined,
  formattedIntro: string,
  formattedChapters: string[],
  formattedConclusion: string,
  formattedBackMatter: string | undefined,
  chapterLabels: string[]
): Promise<string> {
  const tocMarkdown = chapterLabels.map((label, i) => `${i + 1}. ${label}`).join("\n");
  let book = `# ${bookTitle}\n\n`;
  book += `## Copyright\n\n${copyright}\n\n`;
  if (dedication) book += `## Dedication\n\n${dedication}\n\n`;
  book += `## Table of Contents\n\n${tocMarkdown}\n\n`;
  book += `${formattedIntro}\n\n`;
  book += formattedChapters.join("\n\n");
  book += `\n\n${formattedConclusion}`;
  if (formattedBackMatter) book += `\n\n${formattedBackMatter}`;
  return book;
}
