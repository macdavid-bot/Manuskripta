const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

export interface BookInputs {
  title: string;
  tableOfContents: string;
  minPages: number;
  maxPages: number;
  tones: string[];
  allowStorytelling: boolean;
  pageSize: string;
  copyrightOption: "generate" | "insert" | "default";
  copyrightText?: string;
  additionalPrompt?: string;
  memoryBank?: string;
  mode: "create" | "format";
  formatData?: FormatBookData;
}

export interface FormatBookData {
  bookTitle: string;
  copyright: string;
  dedication?: string;
  introduction: string;
  chapters: { label: string; content: string }[];
  conclusion: string;
  backMatter?: string;
  pageSize: string;
}

async function callAI(
  messages: { role: string; content: string }[],
  maxTokens = 4096
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("AI service not configured — EXPO_PUBLIC_DEEPSEEK_API_KEY missing");

  const res = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-reasoner",
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${text}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}

// ---------------------------------------------------------------------------
// STRICT, DETERMINISTIC TABLE-OF-CONTENTS PARSER
// ---------------------------------------------------------------------------
// This parser is the SINGLE SOURCE OF TRUTH for chapter detection.
// It is purely rule-based — NO LLM is involved at any step.
//
// Rules:
//   * A "chapter" is ONLY a line that explicitly starts with "Chapter N" or
//     "Ch. N" (case-insensitive, optional punctuation). Nothing else.
//   * Introduction / Conclusion / Preface / Foreword / Appendix / etc. are
//     NOT chapters and are EXCLUDED from the chapter list entirely.
//   * Every other non-skip line is attached to the most recent chapter as
//     a subsection (so user intent is preserved without inflating the count).
//   * Page numbers, dot leaders, and decorative formatting are stripped.
// ---------------------------------------------------------------------------

export interface ParsedChapter {
  /** Numbered display title, e.g. "Chapter 1: The Hook". */
  title: string;
  /** Bare title without the "Chapter N:" prefix. */
  bareTitle: string;
  /** 1-based chapter number. */
  number: number;
  /** Lines from the TOC that belong inside this chapter. */
  subsections: string[];
}

/** Items that must NEVER be counted as chapters. */
const NON_CHAPTER_PATTERN = /^(table of contents|contents|copyright|dedication|foreword|preface|introduction|conclusion|epilogue|prologue|index|bibliography|references|glossary|appendix(\s+\w+)?|about the author|acknowledgements?|afterword)$/i;

/** STRICT: only "Chapter N", "Ch. N", "Part N", "Lesson N", "Step N". */
const STRICT_CHAPTER_PATTERN = /^(chapter|ch\.?|part|lesson|step)\s*(\d+)\b\s*[:\-\.\)]?\s*(.*)$/i;
/** FLEX fallback: numeric prefixes like "1. Title" or "1) Title". */
const FLEX_CHAPTER_PATTERN = /^(\d+)\s*[\.\)]\s+(.+)$/;

/** Strip page numbers, dot leaders, and trailing decorative noise. */
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
      if (declared !== counter) {
        warnings.push(`Numbering hint: line says "${declared}" but sequential position is ${counter} — using ${counter}.`);
      }
      chapters.push({
        title: `Chapter ${counter}: ${bareTitle}`,
        bareTitle,
        number: counter,
        subsections: [],
      });
      blankRun = 0;
      continue;
    }

    // Subsection safety: no orphan attachment, no bleed across blank-line gaps.
    if (chapters.length === 0) {
      warnings.push(`Orphan line discarded (appears before first chapter): "${line}"`);
      blankRun = 0;
      continue;
    }
    if (blankRun >= 2) {
      warnings.push(`Loose line skipped (separated by blank lines from previous chapter): "${line}"`);
      blankRun = 0;
      continue;
    }

    chapters[chapters.length - 1].subsections.push(line);
    blankRun = 0;
  }

  return { chapters, warnings };
}

/** Try to parse a structured JSON TOC: `[{title, subs?}, ...]`. */
function tryParseJsonToc(toc: string): ParsedChapter[] | null {
  const trimmed = toc.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const chapters = arr
      .map((it: any, i: number) => {
        const num = i + 1;
        const rawTitle = String(it?.title ?? "").trim();
        const cleaned = rawTitle.replace(/^chapter\s+\d+[:\s-]*/i, "").trim();
        const bareTitle = cleaned.length > 0 ? cleaned : `Chapter ${num}`;
        const subs = Array.isArray(it?.subs)
          ? it.subs.map((s: any) => String(s).trim()).filter((s: string) => s.length > 0)
          : [];
        return {
          title: `Chapter ${num}: ${bareTitle}`,
          bareTitle,
          number: num,
          subsections: subs,
        };
      })
      .filter((c) => c.bareTitle.length > 0);
    return chapters.length > 0 ? chapters : null;
  } catch {
    return null;
  }
}

/**
 * Detailed parse: returns chapters, the mode used, and any warnings.
 * Order: JSON bypass → STRICT → FLEX fallback (only if STRICT yields 0).
 */
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

/** Back-compat: returns just the chapter list. */
export function parseTOCStrict(toc: string): ParsedChapter[] {
  return parseTOCDetailed(toc).chapters;
}

/**
 * Strip any rogue chapter headings the AI may have emitted beyond the one
 * we asked for (e.g. "## Chapter N+1: ..."). Keeps the legitimate first
 * `## Chapter N` heading; everything from a subsequent numbered chapter
 * heading onward is dropped.
 */
export function stripRogueChapters(content: string, currentChapterNumber: number): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let seenSelf = false;

  for (const line of lines) {
    const m = line.match(/^##\s+chapter\s+(\d+)\b/i);
    if (m) {
      const num = parseInt(m[1], 10);
      if (!seenSelf && num === currentChapterNumber) {
        seenSelf = true;
        out.push(line);
        continue;
      }
      // Any other numbered chapter heading is rogue — stop output here.
      break;
    }
    out.push(line);
  }

  return out.join("\n").trim();
}

/**
 * BACK-COMPAT WRAPPER. Returns just the numbered titles for callers that
 * only need the title list. NO LLM, NO AI — purely deterministic.
 */
export function identifyChapters(toc: string): string[] {
  return parseTOCStrict(toc).map((c) => c.title);
}

/** @deprecated Use parseTOCStrict() instead. Kept for callers that import it. */
export function parseTOC(toc: string): string[] {
  return identifyChapters(toc);
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

// Remove rogue title pages, copyright blocks, ToC blocks, and extra chapter
// headings that the AI may have injected into individual chapter output.
function cleanChapterContent(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let skipping = false;
  let seenChapterHeading = false;

  for (const line of lines) {
    // Drop any H1 line — the book title must not appear inside a chapter
    if (/^#\s+[^#]/.test(line)) continue;

    // Start skipping if the AI injected a ToC, Copyright, or Dedication section
    if (/^##\s+(table of contents|contents|copyright|dedication)/i.test(line)) {
      skipping = true;
      continue;
    }

    // Any ## heading is a potential chapter-level heading
    const isH2Heading = /^##\s+[^#]/.test(line);

    if (isH2Heading) {
      if (!seenChapterHeading) {
        // This is the correct chapter heading — keep it and stop skipping
        seenChapterHeading = true;
        skipping = false;
        result.push(line);
        continue;
      } else {
        // Check if this is another top-level chapter heading (Chapter N: ... or known section names)
        const isAnotherChapterStart = /^##\s+(chapter\s+\d+|introduction|conclusion|epilogue|prologue)/i.test(line);
        if (isAnotherChapterStart) {
          // AI started writing the next chapter — stop here
          break;
        }
        // Otherwise it's a sub-section within this chapter — keep it
        if (skipping) skipping = false;
        result.push(line);
        continue;
      }
    }

    // Any heading that ends a skip block (new real section begins)
    if (/^##/.test(line) && skipping) {
      skipping = false;
    }

    if (!skipping) result.push(line);
  }

  return result.join("\n").trim();
}

export function calculateWordTargets(inputs: BookInputs, chapterCount: number) {
  const smallSizes = ["5 x 8 in", "5.25 x 8 in", "5.5 x 8.5 in", "5.06 x 7.81 in", "6 x 9 in"];
  const isSmall = smallSizes.some((s) => inputs.pageSize.includes(s)) || inputs.pageSize === "Custom Size";
  const wordsPerPage = isSmall ? 250 : 350;
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

// One corrective AI pass: expand or trim a chapter that missed its word target.
// Returns the corrected chapter (or throws so the caller can fall back).
export async function correctChapterWordCount(
  chapterContent: string,
  chapterTitle: string,
  actualWords: number,
  targetMin: number,
  targetMax: number
): Promise<string> {
  const targetMid = Math.floor((targetMin + targetMax) / 2);
  const isShort = actualWords < targetMin;
  const wordDiff = isShort ? targetMin - actualWords : actualWords - targetMax;

  const directive = isShort
    ? `The chapter is ${actualWords} words but must be at least ${targetMin} words (target: ${targetMid}). You are ${wordDiff} words short. Expand it — add more depth, specific examples, execution steps, case insights, and analysis. Every added sentence must deliver real value. NO filler. NO padding. NO repetition.`
    : `The chapter is ${actualWords} words but must be at most ${targetMax} words (target: ${targetMid}). You are ${wordDiff} words over the limit. Trim it — remove redundancies, over-explained points, and repetition. Preserve all key insights and actionable content intact.`;

  const prompt = `You are revising a book chapter to meet strict page-count requirements.

${directive}

STRICT RULES:
- Your output MUST be between ${targetMin} and ${targetMax} words
- Start with EXACTLY: ## ${chapterTitle}
- Output ONLY the revised chapter — no commentary before or after
- The revision must read naturally; no abrupt cuts or padded sentences
- All sub-chapters (###) and chapter focus sections (####) must be preserved

CHAPTER TO REVISE:
${chapterContent}`;

  return callAI([{ role: "user", content: prompt }], Math.floor(targetMax * 2.2));
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

  return callAI([{ role: "user", content: prompt }], 1500);
}

export async function generateChapter(
  inputs: BookInputs,
  blueprint: string,
  chapterTitle: string,
  chapterIndex: number,
  totalChapters: number,
  previousSummaries: string[],
  minWords: number,
  maxWords: number,
  subsections: string[] = []
): Promise<string> {
  const tones = inputs.tones.length > 0 ? inputs.tones.join(", ") : "auto-determined based on content";
  const prevContext =
    previousSummaries.length > 0
      ? `Previous chapters summary: ${previousSummaries.slice(-3).join(" | ")}`
      : "This is the first chapter.";

  const chapterNum = chapterIndex + 1;
  // Strip any existing "Chapter N:" prefix from the title so we can rebuild it cleanly
  const bareTitle = chapterTitle.replace(/^chapter\s+\d+[:\s-]*/i, "").trim();
  const fullChapterHeading = `Chapter ${chapterNum}: ${bareTitle}`;

  const systemPrompt = `-----------------------------------
SYSTEM PURPOSE (MANDATORY CONTEXT)
-----------------------------------

This prompt is the core writing intelligence for Manuskripta.

Every time the API is called to generate a book, the system MUST send:

1. This full system prompt
2. All user inputs from the configuration page, including:
   - Book Title
   - Table of Contents (STRICT STRUCTURE)
   - Page Count Range
   - Selected Tone(s)
   - Storytelling setting
   - Page size
   - Copyright option
   - Additional Prompt (if provided)
3. The user's Memory Bank (if available)

You must process ALL of these together and generate the book accordingly.

-----------------------------------
IDENTITY
-----------------------------------

You are a world-class, elite-level writing intelligence.

You write like a hybrid of:
- A strategist (clear thinking)
- A practitioner (real execution)
- A teacher (clarity and transfer of knowledge)

You do NOT sound like an AI.
You sound like a high-level operator who has done this in the real world.

-----------------------------------
CORE MISSION
-----------------------------------

Your mission is to generate a complete, high-quality, KDP-ready book that:

- Strictly follows the provided Table of Contents (NO deviation)
- Stays within the defined page count range
- Delivers BOTH insight AND execution
- Feels immediately actionable and valuable
- Is publishable AND competitive in its niche

-----------------------------------
NON-NEGOTIABLE STRUCTURE RULE
-----------------------------------

The Table of Contents is FINAL.

You MUST:
- Follow it exactly
- Not add, remove, or rearrange chapters
- Fully deliver on each chapter's promise

-----------------------------------
CHAPTER NUMBERING (ABSOLUTE RULE)
-----------------------------------

Every chapter MUST begin with EXACTLY this heading format:
## Chapter N: Title

Where N is the sequential chapter number.

Example: ## Chapter 1: Introduction
         ## Chapter 5: Advanced Strategies
         ## Chapter 12: Final Implementation

NO chapter may omit the number. NO exceptions.

-----------------------------------
HEADING HIERARCHY & SUB-CHAPTER DETECTION
-----------------------------------

Within each chapter, classify content from the Table of Contents or natural content flow:

## Chapter N: Main Chapter Title     ← ONE per chapter, at the very start
### Sub-Chapter Title                 ← Major division within the chapter (sub-chapter)
#### Chapter Focus: Topic Name        ← Deeper drill-down (chapter focus subsection)

DETECTION RULE:
- If an item in the ToC sits between two chapter headings and is NOT itself a numbered chapter, examine it:
  → If it represents a major structural division → use ### (sub-chapter)
  → If it represents a focused topic or drill-down within a section → use #### (chapter focus)
- Never turn a sub-chapter or chapter focus into a standalone chapter

-----------------------------------
ABSOLUTE PROHIBITIONS (NON-NEGOTIABLE)
-----------------------------------

DO NOT include ANY of the following in chapter output:
1. The book title as a # Heading
2. A Table of Contents section
3. A Copyright section
4. A Dedication section
5. Content that duplicates or repeats any previous chapter
6. Content that belongs to a different chapter

Each chapter output MUST contain ONLY the content of that specific chapter.

-----------------------------------
CRITICAL UPGRADE: EXECUTION LAYER (MANDATORY)
-----------------------------------

Every chapter MUST include:

1. Actionable Steps
2. Real or Realistic Examples
3. Application Blocks:
   - "Do This Now"
   - "Execution Breakdown"
   - "Practical Example"

A book that only explains but does not show execution is LOW QUALITY.

-----------------------------------
ANTI-THEORY ENFORCEMENT
-----------------------------------

After every major concept, ask:

→ "How would someone actually use this?"

Then SHOW it.

-----------------------------------
READABILITY OPTIMIZATION
-----------------------------------

- Moderate paragraph length
- Clear spacing
- Use subsections
- Avoid dense blocks

-----------------------------------
CLARITY + DEPTH BALANCE
-----------------------------------

- Keep it simple but meaningful
- Avoid unnecessary complexity

-----------------------------------
ANTI-REPETITION & COMPRESSION CONTROL (UPGRADED)
-----------------------------------

- Do NOT repeat concepts across chapters unless adding NEW insight
- Avoid reusing the same phrasing
- Each explanation must feel fresh and progressive

-----------------------------------
ASSERTIVE & AUTHORITATIVE VOICE
-----------------------------------

- Be confident
- Take clear positions
- Avoid passive language

-----------------------------------
REALISM INJECTION
-----------------------------------

Use grounded language:

- "In real scenarios…"
- "Most people fail here because…"
- "A common mistake is…"

-----------------------------------
PROOF & CREDIBILITY INJECTION
-----------------------------------

Where appropriate, include:

- Realistic case studies
- Scenario-based outcomes
- Observed patterns from real-world behavior

This must make the content feel tested, not theoretical.

-----------------------------------
VISUAL THINKING
-----------------------------------

Present ideas as:

- Frameworks
- Systems
- Step flows
- Simple tables (Markdown)

Readers should be able to SEE the logic.

-----------------------------------
CREATIVITY ENHANCEMENT
-----------------------------------

- Use fresh analogies, metaphors, and comparisons
- Avoid generic phrasing
- Make explanations memorable and distinct
- Write with originality and variation

The book must feel uniquely written, not templated.

-----------------------------------
STORYTELLING SYSTEM
-----------------------------------

${inputs.allowStorytelling
    ? `Storytelling is ENABLED:
- Use meaningful, relevant stories
- Keep them concise
- Tie directly to lessons`
    : `Storytelling is DISABLED:
- Stay direct and practical
- No stories or anecdotes`}

-----------------------------------
STRUCTURAL INTEGRITY
-----------------------------------

Each chapter must:

- Start strong
- Deliver structured content
- End with a takeaway

-----------------------------------
CONSISTENCY RULE
-----------------------------------

Maintain the SAME quality across all chapters.

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

-----------------------------------
PAGE COUNT CONTROL (ABSOLUTE RULE)
-----------------------------------

WORD COUNT IS NON-NEGOTIABLE.

The target word count for THIS chapter is given in the user instruction.

You MUST:
- Write AT LEAST the minimum word count specified
- Write AT MOST the maximum word count specified
- Stay within the ±10% tolerance band

You MUST NOT:
- Under-write (too short = incomplete chapter, content was cut off)
- Over-write (too long = padding, repetition, or scope creep)
- Add filler sentences to hit the count
- Cut important content to reduce the count

If you are running short: add more depth, examples, execution steps, case studies, frameworks.
If you are running long: trim redundancies and over-explained points naturally.

The word count is enforced and verified AFTER generation. Chapters that miss the target will be flagged and corrected.

-----------------------------------
INPUT PRIORITY RULE
-----------------------------------

1. System rules
2. User inputs
3. Additional Prompt & Memory Bank

-----------------------------------
FORMATTING RULE
-----------------------------------

Output in clean Markdown:

- ## Chapter N: Title  ← mandatory numbered heading (ONLY at the very top of this chapter)
- ### Sub-Chapter Title  ← major sections within the chapter
- #### Chapter Focus: Topic  ← focused drill-down subsections
- **Bold** for key terms
- Tables and bullet lists where helpful

DO NOT output a # H1 heading. DO NOT output Table of Contents. DO NOT output Copyright.

-----------------------------------
QUALITY STANDARD
-----------------------------------

The final book must:

- Be readable
- Be actionable
- Be insightful
- Be engaging
- Feel like a premium paid product

-----------------------------------
EXECUTION MINDSET
-----------------------------------

Think before writing.

You are building a product, not generating text.

Depth + clarity + execution > speed.`;

  const subsectionsBlock = subsections.length > 0
    ? `\nSUBSECTIONS (these belong INSIDE this chapter — expand each as ### or #### within this chapter, do NOT turn them into new chapters):\n${subsections.map((s) => `- ${s}`).join("\n")}\n`
    : "";

  const userPrompt = `-----------------------------------
USER INPUTS
-----------------------------------

Book Title: "${inputs.title}"
This Chapter: "${fullChapterHeading}" (Chapter ${chapterNum} of ${totalChapters})

⚠️ ABSOLUTE RULE: You are writing ONLY Chapter ${chapterNum}. Do NOT create new chapters. Do NOT write Chapter ${chapterNum + 1} or beyond. Do NOT add Introduction or Conclusion. The chapter list is FINAL — there are exactly ${totalChapters} chapters in this book and your job is just this one.

⚠️ Under no condition should you create a new chapter, a section titled "Chapter", or any numbered section outside the one provided. Subsections (### or ####) MUST remain inside this chapter. Any "## Chapter ${chapterNum + 1}" or higher will be stripped from your output.
${subsectionsBlock}
Table of Contents (STRICT — follow exactly):
${inputs.tableOfContents}

Tone(s): ${tones}
Storytelling: ${inputs.allowStorytelling ? "Enabled" : "Disabled"}
Page Size: ${inputs.pageSize}
Page Count Range: ${inputs.minPages}–${inputs.maxPages} pages
⚠️ MANDATORY WORD COUNT FOR THIS CHAPTER: ${minWords}–${maxWords} words
   You MUST write between ${minWords} and ${maxWords} words for THIS chapter.
   This is NOT a suggestion — it is a hard requirement enforced after generation.
   If short: deepen content, add examples, frameworks, and actionable steps.
   If long: trim redundancy and repetition while keeping every key insight.

${inputs.additionalPrompt ? `Additional Prompt: ${inputs.additionalPrompt}` : ""}
${inputs.memoryBank ? `Memory Bank: ${inputs.memoryBank}` : ""}

-----------------------------------
CONTINUITY CONTEXT
-----------------------------------

${prevContext}

Blueprint Reference:
${blueprint.substring(0, 600)}

-----------------------------------
INSTRUCTION
-----------------------------------

Write ONLY this chapter now.

Your output MUST begin with EXACTLY this line:
## ${fullChapterHeading}

Then write the full chapter content using ### for sub-chapters and #### for chapter focus sections.

DO NOT include: book title, table of contents, copyright, dedication, or any content from other chapters.

FINAL REMINDER: Your chapter MUST be ${minWords}–${maxWords} words. Count carefully.`;

  return callAI(
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

  return callAI([{ role: "user", content: prompt }], 200);
}

export async function generateCopyright(inputs: BookInputs): Promise<string> {
  const prompt = `Generate a professional copyright page text for:
Title: "${inputs.title}"

Include: copyright year (${new Date().getFullYear()}), rights reserved statement, disclaimer, and a note that it can be used for similar books by the same author. Keep it concise and professional.`;

  return callAI([{ role: "user", content: prompt }], 300);
}

export function assembleFinalBook(
  inputs: BookInputs,
  chapters: string[],
  tocParsed: string[],
  copyrightText: string
): string {
  // Ensure every entry has "Chapter N:" prefix for the clickable ToC
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

  return callAI(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    Math.max(2000, Math.floor(sectionContent.split(/\s+/).length * 1.3))
  );
}

export function assembleFinalFormattedBook(
  bookTitle: string,
  copyright: string,
  dedication: string | undefined,
  formattedIntro: string,
  formattedChapters: string[],
  formattedConclusion: string,
  formattedBackMatter: string | undefined,
  chapterLabels: string[]
): string {
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
