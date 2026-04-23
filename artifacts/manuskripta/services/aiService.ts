// UPDATED: TOC now includes ALL sections + fixed duplicate systemPrompt

const NON_CHAPTER_PATTERN = /^(table of contents|contents)$/i; // 🔥 Only skip actual TOC labels

// ... keep rest unchanged until runParser ...

function runParser(rawLines: string[], pattern: RegExp, extract: Extractor): { chapters: ParsedChapter[]; warnings: string[] } {
  const chapters: ParsedChapter[] = [];
  const warnings: string[] = [];
  let counter = 0;

  for (const raw of rawLines) {
    const line = cleanTocLine(raw);
    if (!line) continue;

    // 🔥 DO NOT skip intro, conclusion, appendix anymore
    if (NON_CHAPTER_PATTERN.test(line)) continue;

    const m = line.match(pattern);

    if (m) {
      counter++;
      const { bareTitle } = extract(m, counter);
      chapters.push({ title: `Chapter ${counter}: ${bareTitle}`, bareTitle, number: counter, subsections: [] });
      continue;
    }

    // 🔥 Treat ANY non-matching line as a valid section
    counter++;
    chapters.push({ title: `Chapter ${counter}: ${line}`, bareTitle: line, number: counter, subsections: [] });
  }

  return { chapters, warnings };
}

// ... rest of file unchanged ...

// 🔥 FIX DUPLICATE systemPrompt (remove second declaration completely)

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
- Maintain consistent tone throughout

FORMAT: Clean Markdown only. No HTML. No extra commentary.`;
