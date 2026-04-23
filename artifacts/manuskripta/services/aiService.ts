import type { BookInputs, JobLog } from "@/context/AppContext";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-reasoner";

function getApiKey(): string {
  return process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY ?? "";
}

function estimateWordsPerPage(pageSize: string): number {
  const smallSizes = ["5 x 8 in", "5.25 x 8 in", "5.5 x 8.5 in", "5.06 x 7.81 in", "6 x 9 in"];
  const isSmall = smallSizes.some((s) => pageSize.includes(s)) || pageSize === "Custom Size";
  return isSmall ? 250 : 350;
}

export function calculateWordTargets(inputs: BookInputs, chapterCount: number) {
  const wordsPerPage = estimateWordsPerPage(inputs.pageSize);
  const totalMinWords = inputs.minPages * wordsPerPage;
  const totalMaxWords = inputs.maxPages * wordsPerPage;
  const targetWords = Math.floor((totalMinWords + totalMaxWords) / 2);
  const wordsPerChapter = Math.floor(targetWords / chapterCount);
  const variation = Math.floor(wordsPerChapter * 0.1);
  return {
    minPerChapter: wordsPerChapter - variation,
    maxPerChapter: wordsPerChapter + variation,
    totalTarget: targetWords,
    totalMinWords,
    totalMaxWords,
    wordsPerPage,
  };
}

// ---------------------------------------------------------------------------
// STRICT, DETERMINISTIC TOC PARSER (mirror of api-server/src/lib/ai.ts)
// Only "Chapter N" / "Ch. N" lines count. Introduction/Conclusion excluded.
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
    .replace(/^[-\u2022\u25E6\u25AA\u25AB\u00B7*\u2013\u2014>]+\s*/, "")
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

// Convert a heading string to a Markdown-compatible anchor ID
function headingToAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-");
}

// Remove rogue title pages, copyright blocks, and ToC blocks that the AI
// may have injected into individual chapter output.
function cleanChapterContent(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let skipping = false;

  for (const line of lines) {
    // Drop any H1 line — the book title must not appear inside a chapter
    if (/^#\s+[^#]/.test(line)) continue;

    // Start skipping if the AI injected a ToC, Copyright, or Dedication section
    if (/^##\s+(table of contents|contents|copyright|dedication)/i.test(line)) {
      skipping = true;
      continue;
    }

    // Any other ## heading ends the skip block (new real section begins)
    if (/^##\s+/.test(line) && skipping) {
      skipping = false;
    }

    if (!skipping) result.push(line);
  }

  return result.join("\n").trim();
}

async function callDeepSeek(
  messages: { role: string; content: string }[],
  maxTokens = 4096
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "DeepSeek API key not configured. Please add EXPO_PUBLIC_DEEPSEEK_API_KEY in your environment settings."
    );
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content ?? "";
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

UNIVERSAL QUALITY STANDARDS TO PLAN FOR:
- Overall transformation arc: Awareness → Understanding → Solution → Application → Mastery
- Identify exactly 2–4 signature frameworks, methods, or named systems to introduce across the book (decide now which chapters they belong to)
- Plan a powerful early hook for Chapters 1–2 that creates immediate emotional or intellectual recognition
- Every chapter must end with actionable steps, reflection prompts, or exercises
- Authority positioning: content must feel like a structured, proven system — not advice
- No chapter may repeat ideas from a previous one; each must build progressively

Create a concise blueprint (max 800 words) covering:
1. Overall book objective and target audience
2. Tone strategy
3. Chapter-by-chapter breakdown: goal, key ideas, logical progression, and which signature framework (if any) lives in this chapter
4. How chapters connect to form a cohesive transformation journey

Be specific and strategic. This is for internal use only.`;

  return await callDeepSeek([{ role: "user", content: prompt }], 1500);
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
  const tones =
    inputs.tones.length > 0
      ? inputs.tones.join(", ")
      : "auto-determined based on content";

  const prevContext =
    previousSummaries.length > 0
      ? `Previous chapters summary: ${previousSummaries.slice(-3).join(" | ")}`
      : "This is the first chapter.";

  const chapterNum = chapterIndex + 1;
  // Strip any existing "Chapter N:" prefix so we can rebuild it cleanly
  const bareTitle = chapterTitle.replace(/^chapter\s+\d+[:\s-]*/i, "").trim();
  const fullChapterHeading = `Chapter ${chapterNum}: ${bareTitle}`;
const strictInstruction = `
CRITICAL REQUIREMENT — TABLE OF CONTENTS ENFORCEMENT:

You must generate content for EVERY section listed in the Table of Contents.

This includes ALL types of sections:
- Introduction
- Preface
- Foreword
- All chapters
- Conclusion
- Appendix
- Any front matter or back matter

NO section is optional.

DO NOT skip, merge, summarize, or ignore any section.

Each section must be fully written, detailed, and complete.

Even if a section is not labeled as "Chapter", it must be treated with equal importance and depth.

Failure to fully generate any section is NOT allowed.
`;

const systemPrompt = `${strictInstruction}

You are a world-class, elite-level writing intelligence producing a premium, KDP-ready book.

IDENTITY: You are a high-performance author who produces books that feel human-written, polished, and valuable.

CORE RULES:
- Write with clarity AND depth — never sacrifice one for the other
- Write naturally, varying sentence structures and rhythm
- NEVER repeat ideas from previous chapters
- NEVER use filler content — every paragraph must add new value
- Be assertive, confident, and direct
- ${inputs.allowStorytelling ? "Use meaningful stories, analogies, and examples that enhance understanding" : "Remain strictly informational and direct"}
- Maintain consistent tone throughout
...
`;
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

-----------------------------------
CHAPTER NUMBERING (ABSOLUTE RULE)
-----------------------------------

Every chapter output MUST begin with EXACTLY this heading format:
## Chapter N: Title

Where N is the sequential chapter number provided in the instruction.
NO chapter may omit the number. NO exceptions.

-----------------------------------
HEADING HIERARCHY & SUB-CHAPTER DETECTION
-----------------------------------

## Chapter N: Main Chapter Title     ← ONE per chapter, at the very start only
### Sub-Chapter Title                 ← Major division within the chapter (sub-chapter)
#### Chapter Focus: Topic Name        ← Deeper drill-down or focused subsection

DETECTION RULE:
- When content from the ToC sits between two numbered chapters, determine:
  → Major structural division → use ### (sub-chapter)
  → Focused topic or drill-down → use #### (chapter focus)
- Never promote a sub-chapter or chapter focus into a standalone chapter heading

-----------------------------------
ABSOLUTE PROHIBITIONS
-----------------------------------

DO NOT include in chapter output:
1. The book title as a # Heading
2. A Table of Contents section
3. A Copyright section
4. A Dedication section
5. Content duplicated from any previous chapter
6. Content belonging to a different chapter

-----------------------------------
STRUCTURE PER CHAPTER
-----------------------------------

- Strong, engaging opening
- Logically structured body with sub-chapters (###) and chapter focus sections (####)
- Actionable steps, real examples, execution blocks ("Do This Now", "Practical Example")
- Clear, memorable closing with takeaway

-----------------------------------
UNIVERSAL QUALITY ENHANCEMENT (MANDATORY — EVERY CHAPTER)
-----------------------------------

These rules apply to EVERY chapter generated, regardless of topic.

1. ELIMINATE STRUCTURAL ERRORS
   - Do NOT repeat the book title anywhere unnecessarily
   - Do NOT repeat the Table of Contents
   - All chapters are properly numbered and consistently formatted
   - Clean, professional heading hierarchy is always maintained

2. AUTHORITY & PROVEN POSITIONING
   - Present ideas as credible, structured systems — not random advice
   - Integrate recognizable psychological, behavioral, or logical principles where relevant
   - Use clear cause-and-effect explanations
   - Avoid vague claims — content must feel grounded and trustworthy

3. SIGNATURE FRAMEWORKS (MANDATORY)
   - If a signature framework is assigned to this chapter (per the Blueprint), introduce and fully explain it
   - Each framework must be: clearly named, step-by-step, memorable, and actionable
   - Frameworks simplify complex ideas into processes readers can immediately use
   - Name naturally (e.g. "The Clarity Loop", "The 3-Phase Reset System") — never template-sounding

4. STRONG EARLY HOOK (Chapters 1–2)
   - If this is Chapter 1 or 2: the opening MUST create immediate emotional or intellectual recognition
   - Make the reader feel deeply understood within the first paragraph
   - Clearly articulate the core problem in a way that feels precise and personal
   - No slow build-ups, no generic introductions

5. ACTIONABLE CHAPTER ENDINGS (MANDATORY)
   - Every chapter MUST end with at least one of:
     a) Practical steps the reader can take immediately
     b) Reflection prompts that deepen self-awareness
     c) A simple exercise to apply the chapter's core idea
   - The reader must be able to DO something after finishing the chapter

6. PROGRESSIVE TRANSFORMATION FLOW
   - This chapter must logically build on all previous ones
   - Follow the overall arc: Awareness → Understanding → Solution → Application → Mastery
   - No concept repetition — every chapter introduces something new and advances the reader

7. PREMIUM WRITING STANDARD
   - Clear, confident, and engaging language throughout
   - Zero fluff, zero filler, zero generic statements
   - Balance depth (insightful explanations) with simplicity (easy to grasp)
   - Write as an expert who is both knowledgeable and practical

8. READER OUTCOME FOCUS
   - Continuously reinforce what the reader is gaining from this chapter
   - Show how their situation improves as a result of the ideas here
   - Keep content results-driven, not just informative

FORMAT: Clean Markdown only. No HTML. No extra commentary.`;

  const userPrompt = `Write Chapter ${chapterNum} of ${totalChapters}: "${fullChapterHeading}"

Book: "${inputs.title}"
Full TOC: ${inputs.tableOfContents}
Tone(s): ${tones}

⚠️ MANDATORY WORD COUNT FOR THIS CHAPTER: ${minWords}–${maxWords} words
   You MUST write between ${minWords} and ${maxWords} words for THIS chapter.
   This is NOT a suggestion — it is a hard requirement enforced after generation.
   If short: add depth, examples, frameworks, and actionable steps.
   If long: trim redundancy and repetition while keeping every key insight.

${prevContext}

Relevant Blueprint Context:
${blueprint.substring(0, 600)}

${inputs.memoryBank ? `Author preferences: ${inputs.memoryBank}` : ""}
${inputs.additionalPrompt ? `Additional direction: ${inputs.additionalPrompt}` : ""}

-----------------------------------
INSTRUCTION
-----------------------------------

Write ONLY this chapter. Your output MUST begin with EXACTLY:
## ${fullChapterHeading}

Then write the full chapter content.
- Use ### for sub-chapters
- Use #### for chapter focus sections
- DO NOT include book title, table of contents, copyright, or any other chapter's content.

FINAL REMINDER: Your chapter MUST be ${minWords}–${maxWords} words. Count carefully.`;

  return await callDeepSeek(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    Math.floor(maxWords * 1.8)
  );
}

export async function summarizeChapter(
  chapterTitle: string,
  chapterContent: string
): Promise<string> {
  const prompt = `Summarize this chapter in 2-3 sentences for continuity tracking. Be specific about key ideas covered so future chapters don't repeat them.

Chapter: "${chapterTitle}"
Content (first 1000 chars): ${chapterContent.substring(0, 1000)}`;

  return await callDeepSeek([{ role: "user", content: prompt }], 200);
}

export async function generateCopyright(inputs: BookInputs): Promise<string> {
  const prompt = `Generate a professional copyright page text for:
Title: "${inputs.title}"

Include: copyright year (${new Date().getFullYear()}), rights reserved statement, disclaimer, and a note that it can be used for similar books by the same author. Keep it concise and professional.`;

  return await callDeepSeek([{ role: "user", content: prompt }], 300);
}

export async function assembleFinalBook(
  inputs: BookInputs,
  chapters: string[],
  tocParsed: string[],
  copyrightText: string
): Promise<string> {
  // Build clickable ToC with anchor links — one ToC, no duplicates
  const tocEntries = tocParsed.map((ch, i) => {
    const bare = ch.replace(/^chapter\s+\d+[:\s-]*/i, "").trim();
    const numbered = `Chapter ${i + 1}: ${bare}`;
    const anchor = headingToAnchor(numbered);
    return `${i + 1}. [${numbered}](#${anchor})`;
  });

  let book = `# ${inputs.title}\n\n`;
  book += `## Copyright\n\n${copyrightText}\n\n`;
  book += `## Table of Contents\n\n${tocEntries.join("\n")}\n\n`;
  book += chapters.map(cleanChapterContent).join("\n\n");
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

  return await callDeepSeek(
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
  // Build clickable ToC with anchor links
  const tocEntries = chapterLabels.map((label, i) => {
    const bare = label.replace(/^chapter\s+\d+[:\s-]*/i, "").trim();
    const numbered = `Chapter ${i + 1}: ${bare}`;
    const anchor = headingToAnchor(numbered);
    return `${i + 1}. [${numbered}](#${anchor})`;
  });

  let book = `# ${bookTitle}\n\n`;
  book += `## Copyright\n\n${copyright}\n\n`;
  if (dedication) book += `## Dedication\n\n${dedication}\n\n`;
  book += `## Table of Contents\n\n${tocEntries.join("\n")}\n\n`;
  book += `${cleanChapterContent(formattedIntro)}\n\n`;
  book += formattedChapters.map(cleanChapterContent).join("\n\n");
  book += `\n\n${cleanChapterContent(formattedConclusion)}`;
  if (formattedBackMatter) book += `\n\n${cleanChapterContent(formattedBackMatter)}`;
  return book;
}
