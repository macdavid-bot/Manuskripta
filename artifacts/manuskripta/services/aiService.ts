// UPDATED: TOC now includes ALL sections + proper subsection handling

const NON_CHAPTER_PATTERN = /^(table of contents|contents)$/i;

function runParser(rawLines: string[], pattern: RegExp, extract: Extractor): { chapters: ParsedChapter[]; warnings: string[] } {
  const chapters: ParsedChapter[] = [];
  const warnings: string[] = [];
  let counter = 0;

  for (const raw of rawLines) {
    const line = cleanTocLine(raw);
    if (!line) continue;

    if (NON_CHAPTER_PATTERN.test(line)) continue;

    const m = line.match(pattern);

    if (m) {
      counter++;
      const { bareTitle } = extract(m, counter);
      chapters.push({
        title: `Chapter ${counter}: ${bareTitle}`,
        bareTitle,
        number: counter,
        subsections: [],
      });
      continue;
    }

    // 🔥 NEW: subsection-aware logic
    if (chapters.length === 0) {
      // First item becomes a section (e.g., Introduction)
      counter++;
      chapters.push({
        title: `Chapter ${counter}: ${line}`,
        bareTitle: line,
        number: counter,
        subsections: [],
      });
    } else {
      // Treat as subsection of the last section
      chapters[chapters.length - 1].subsections.push(line);
    }
  }

  return { chapters, warnings };
}

// rest of file unchanged
