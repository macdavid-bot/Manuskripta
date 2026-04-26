import { db } from "@workspace/db";
import { jobsTable, usersTable } from "@workspace/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import type { BookInputs, FormatBookData } from "./ai.js";
import {
  assembleFinalBook,
  assembleFinalFormattedBook,
  buildTocEntriesFromTOC,
  calculateWordTargets,
  correctChapterWordCount,
  createBookBlueprint,
  formatSection,
  generateChapter,
  generateCopyright,
  parseTOCDetailed,
  stripRogueChapters,
  summarizeChapter,
} from "./ai.js";

const BOOK_TIMEOUT_MS = 7 * 60 * 60 * 1000;
const FORMAT_TIMEOUT_MS = 30 * 60 * 1000;

interface JobLog {
  timestamp: number;
  message: string;
  type: "info" | "error" | "success";
}

const activeControllers = new Map<string, AbortController>();

function mkLog(message: string, type: JobLog["type"] = "info"): JobLog {
  return { timestamp: Date.now(), message, type };
}

async function appendLog(jobId: string, log: JobLog) {
  try {
    const rows = await db.select({ logs: jobsTable.logs }).from(jobsTable).where(eq(jobsTable.id, jobId)).limit(1);
    const existing = (rows[0]?.logs ?? []) as JobLog[];
    await db.update(jobsTable).set({ logs: [...existing, log] }).where(eq(jobsTable.id, jobId));
  } catch {}
}

async function updateJob(jobId: string, updates: Partial<typeof jobsTable.$inferInsert>) {
  try {
    await db.update(jobsTable).set(updates).where(eq(jobsTable.id, jobId));
  } catch (err) {
    logger.error({ err }, "Failed to update job in DB");
  }
}

async function completeJobAndIncrementUser(
  jobId: string,
  userEmail: string,
  updates: Pick<typeof jobsTable.$inferInsert, "progress" | "markdownContent" | "completedAt">
) {
  try {
    await db.transaction(async (tx) => {
      const transitioned = await tx
        .update(jobsTable)
        .set({ status: "completed", ...updates })
        .where(and(eq(jobsTable.id, jobId), ne(jobsTable.status, "completed")))
        .returning({ id: jobsTable.id });

      // Increment usage only when this job transitions to completed for the first time.
      if (transitioned.length > 0) {
        await tx
          .update(usersTable)
          .set({ booksGenerated: sql`${usersTable.booksGenerated} + 1` })
          .where(eq(usersTable.email, userEmail));
      }
    });
  } catch (err) {
    logger.error({ err, jobId, userEmail }, "Failed to finalize completed job and increment usage");
  }
}

async function retry<T>(fn: () => Promise<T>, attempts: number, jobId: string, label: string): Promise<T> {
  let lastErr: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err as Error;
      await appendLog(jobId, mkLog(`${label} attempt ${i + 1} failed: ${lastErr.message}`, "error"));
      if (i < attempts - 1) await sleep(2000 * (i + 1));
    }
  }
  throw lastErr;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/** Count words in a string (handles markdown symbols well enough for enforcement). */
function countWords(text: string): number {
  return text
    .replace(/```[\s\S]*?```/g, " ")   // strip code blocks
    .replace(/[#*_`>~\[\]()]/g, " ")   // strip markdown symbols
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .length;
}

function extractChapterSubtitles(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^###\s+/.test(l))
    .map((l) => l.replace(/^###\s+/, "").trim())
    .filter(Boolean);
}

/**
 * After each chapter, redistribute the remaining word budget across the
 * remaining chapters so the overall book stays within the total page range.
 */
function adaptivePerChapterTarget(
  totalMinWords: number,
  totalMaxWords: number,
  wordsWrittenSoFar: number,
  chaptersRemaining: number
): { min: number; max: number } {
  if (chaptersRemaining <= 0) return { min: 0, max: 0 };
  const remainMin = Math.max(0, totalMinWords - wordsWrittenSoFar);
  const remainMax = Math.max(remainMin, totalMaxWords - wordsWrittenSoFar);
  const perMin = Math.floor(remainMin / chaptersRemaining);
  const perMax = Math.ceil(remainMax / chaptersRemaining);
  // Allow the AI a small ±10% tolerance around the per-chapter band
  return {
    min: Math.max(1, Math.floor(perMin * 0.9)),
    max: Math.ceil(perMax * 1.1),
  };
}

/** Tolerance window outside which we trigger a corrective AI pass. */
const WORD_COUNT_TOLERANCE = 0.15; // 15% over/under the target band triggers correction

export function isJobRunning(jobId: string) {
  return activeControllers.has(jobId);
}

export function stopJob(jobId: string) {
  activeControllers.get(jobId)?.abort();
  activeControllers.delete(jobId);
}

export async function startJob(jobId: string) {
  if (activeControllers.has(jobId)) return; // Already running

  const rows = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId)).limit(1);
  const job = rows[0];
  if (!job) throw new Error("Job not found");

  const controller = new AbortController();
  activeControllers.set(jobId, controller);

  const inputs = job.inputs as unknown as BookInputs;
  const resumeIndex = Array.isArray(job.chapterContents)
    ? job.chapterContents.findIndex((chapter: string) => !chapter || chapter.length === 0)
    : 0;

  if (job.mode === "format") {
    runFormat(job, inputs, controller).catch((err) => {
      logger.error({ err, jobId }, "Format job crashed");
    });
  } else {
    runCreate(job, inputs, controller, resumeIndex < 0 ? 0 : resumeIndex).catch((err) => {
      logger.error({ err, jobId }, "Create job crashed");
    });
  }
}

async function runCreate(
  job: typeof jobsTable.$inferSelect,
  inputs: BookInputs,
  controller: AbortController,
  resumeIndex = 0
) {
  const jobId = job.id;
  const startTime = Date.now();

  const log = async (message: string, type: JobLog["type"] = "info") => {
    await appendLog(jobId, mkLog(message, type));
  };

  try {
    await log("Server picked up job — generation starting", "info");
    await updateJob(jobId, { status: "processing" });

    await log("Parsing Table of Contents (strict deterministic parser)...", "info");

    // ── Diagnostic: log the raw TOC lines we received ──
    const rawTocLines = inputs.tableOfContents
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    await log(`Raw TOC: ${rawTocLines.length} non-empty lines`, "info");

    // ── Strict, rule-based parsing (NO AI) ──
    const parseResult = parseTOCDetailed(inputs.tableOfContents);
    const parsedChapters = parseResult.chapters;
    const totalChapters = parsedChapters.length;
    const tocParsed = parsedChapters.map((c) => c.title);
    const tocEntries = buildTocEntriesFromTOC(inputs.tableOfContents, parsedChapters);

    // ── Validation: refuse to generate on abnormal structure ──
    if (totalChapters === 0) {
      const msg = "Could not detect any chapters in the Table of Contents. Each chapter line should start with \"Chapter 1\", \"Chapter 2\" (or \"1.\", \"2.\" as a fallback). Introduction and Conclusion do not count as chapters.";
      await log(msg, "error");
      await updateJob(jobId, { status: "failed", errorMessage: msg });
      return;
    }
    if (totalChapters > 100) {
      const msg = `Detected ${totalChapters} chapters — that exceeds the safety cap of 100. Refusing to generate.`;
      await log(msg, "error");
      await updateJob(jobId, { status: "failed", errorMessage: msg });
      return;
    }

    // ── Sequential numbering check (warning only — never invents chapters) ──
    const expectedSeq = parsedChapters.map((c) => c.number);
    const isSequential = expectedSeq.every((n, i) => n === i + 1);
    if (!isSequential) {
      await log(`⚠ Chapter numbering is non-sequential (${expectedSeq.join(", ")}) — proceeding with detected order without inventing new chapters.`, "info");
    }
    for (const w of parseResult.warnings) {
      await log(`⚠ ${w}`, "info");
    }

    await updateJob(jobId, { tocParsed, totalChapters });
    await log(`Identified ${totalChapters} chapters (parser mode: ${parseResult.mode})`, "success");
    for (const ch of parsedChapters) {
      const subInfo = ch.subsections.length > 0
        ? ` — ${ch.subsections.length} subsection(s): ${ch.subsections.join(" | ")}`
        : "";
      await log(`  • ${ch.title}${subInfo}`, "info");
    }
    await log(`TOC assembly: ${tocEntries.length} section entries detected`, "info");
    for (const entry of tocEntries) {
      await log(`TOC + ${entry.depth === 1 ? "subsection" : "section"}: ${entry.label}`, "info");
    }

    const wordTargets = calculateWordTargets(inputs, totalChapters);
    const { totalMinWords, totalMaxWords, wordsPerPage } = wordTargets;
    await log(
      `Page target: ${inputs.minPages}–${inputs.maxPages} pages | ` +
      `Word target: ${totalMinWords.toLocaleString()}–${totalMaxWords.toLocaleString()} words total | ` +
      `Per chapter: ${wordTargets.minPerChapter}–${wordTargets.maxPerChapter} words`,
      "info"
    );

    // Blueprint
    let blueprint = (job.blueprint as string) ?? "";
    if (!blueprint) {
      await log("Creating Book Blueprint...", "info");
      blueprint = await retry(() => createBookBlueprint(inputs), 3, jobId, "Blueprint");
      await updateJob(jobId, { blueprint });
      await log("Book Blueprint created", "success");
    }

    // Copyright
    let copyrightText = "";
    if (inputs.copyrightOption === "generate") {
      await log("Generating copyright text...", "info");
      copyrightText = await retry(() => generateCopyright(inputs), 3, jobId, "Copyright")
        .catch(() => `Copyright © ${new Date().getFullYear()} ${inputs.title}. All rights reserved.`);
    } else {
      copyrightText = inputs.copyrightText ?? "";
    }

    const existingChapters: string[] = [...((job.chapterContents as string[]) ?? [])];
    const existingSummaries: string[] = [...((job.chapterSummaries as string[]) ?? [])];
    const startChapter = Math.max(0, resumeIndex);

    // Track cumulative word count for adaptive redistribution
    let totalWordsWritten = existingChapters
      .filter((c) => c.length > 0)
      .reduce((sum, c) => sum + countWords(c), 0);

    for (let i = startChapter; i < totalChapters; i++) {
      if (Date.now() - startTime > BOOK_TIMEOUT_MS) {
        await log("Book generation timed out after 7 hours", "error");
        await updateJob(jobId, { status: "failed", errorMessage: "Book generation timed out after 7 hours" });
        return;
      }
      if (controller.signal.aborted) {
        await log("Generation stopped by user or server", "info");
        await updateJob(jobId, { status: "failed", errorMessage: "Stopped" });
        return;
      }

      const chaptersRemaining = totalChapters - i;
      const chapterTarget = adaptivePerChapterTarget(
        totalMinWords, totalMaxWords, totalWordsWritten, chaptersRemaining
      );

      const chapter = parsedChapters[i];
      const chapterTitle = chapter?.bareTitle ?? `Chapter ${i + 1}`;
      const chapterSubsections = chapter?.subsections ?? [];
      await log(
        `Writing Chapter ${i + 1} of ${totalChapters}: ${chapterTitle} ` +
        `(target: ${chapterTarget.min}–${chapterTarget.max} words` +
        (chapterSubsections.length > 0 ? `, ${chapterSubsections.length} subsection(s)` : "") +
        `)`,
        "info"
      );
      await updateJob(jobId, { currentChapter: i + 1, progress: Math.round((i / totalChapters) * 90) });

      // ── Primary generation (up to 3 network-error retries) ──
      let chapterContent = "";
      let genSuccess = false;
      let genAttempts = 0;
      while (!genSuccess && genAttempts < 3) {
        try {
          chapterContent = await generateChapter(
            inputs, blueprint, chapterTitle, i, totalChapters,
            existingSummaries, chapterTarget.min, chapterTarget.max,
            chapterSubsections
          );
          genSuccess = true;
        } catch (err) {
          genAttempts++;
          await appendLog(jobId, mkLog(`Chapter ${i + 1} attempt ${genAttempts} failed: ${(err as Error).message}`, "error"));
          if (genAttempts < 3) await sleep(3000 * genAttempts);
        }
      }
      if (!genSuccess) {
        await updateJob(jobId, { status: "failed", errorMessage: `Failed to generate Chapter ${i + 1} after 3 attempts` });
        return;
      }

      // ── Post-process: strip any rogue "## Chapter N+1" headings ──
      const beforeLen = chapterContent.length;
      chapterContent = stripRogueChapters(chapterContent, i + 1);
      if (chapterContent.length < beforeLen) {
        await log(`Chapter ${i + 1}: stripped rogue chapter heading injected by AI.`, "info");
      }

      // ── Word count validation + corrective pass ──
      const wc = countWords(chapterContent);
      const underLimit = chapterTarget.min * (1 - WORD_COUNT_TOLERANCE);
      const overLimit  = chapterTarget.max * (1 + WORD_COUNT_TOLERANCE);

      if (wc < underLimit || wc > overLimit) {
        const direction = wc < underLimit ? "short" : "long";
        await log(
          `Chapter ${i + 1}: ${wc.toLocaleString()} words — ${direction} of target ` +
          `(${chapterTarget.min}–${chapterTarget.max}). Running corrective pass...`,
          "info"
        );
        try {
          const chapterHeading = `Chapter ${i + 1}: ${chapterTitle}`;
          const corrected = await correctChapterWordCount(
            chapterContent, chapterHeading, wc, chapterTarget.min, chapterTarget.max
          );
          const correctedWc = countWords(corrected);
          // Accept the corrected version if it's closer to the target midpoint
          const midpoint = (chapterTarget.min + chapterTarget.max) / 2;
          if (Math.abs(correctedWc - midpoint) < Math.abs(wc - midpoint)) {
            chapterContent = corrected;
            await log(
              `Chapter ${i + 1} word count corrected: ${wc.toLocaleString()} → ${correctedWc.toLocaleString()} words`,
              "success"
            );
          } else {
            await log(
              `Chapter ${i + 1}: corrective pass did not improve count (${correctedWc.toLocaleString()} words). Keeping original.`,
              "info"
            );
          }
        } catch {
          await log(`Chapter ${i + 1}: corrective pass failed — continuing with original.`, "info");
        }
      } else {
        await log(`Chapter ${i + 1}: ${wc.toLocaleString()} words — within target range.`, "info");
      }

      const finalWc = countWords(chapterContent);
      totalWordsWritten += finalWc;

      const summary = await retry(() => summarizeChapter(chapterTitle, chapterContent), 2, jobId, `Summary ch${i + 1}`)
        .catch(() => `Chapter ${i + 1}: ${chapterTitle}`);

      existingChapters[i] = chapterContent;
      existingSummaries[i] = summary;

      // Persist progress to DB after every chapter
      await updateJob(jobId, {
        chapterContents: existingChapters,
        chapterSummaries: existingSummaries,
      });
      await log(`Chapter ${i + 1} complete (running total: ${totalWordsWritten.toLocaleString()} words)`, "success");
    }

    // ── Final page count validation ──
    const estimatedPages = Math.round(totalWordsWritten / wordsPerPage);
    if (totalWordsWritten < totalMinWords || totalWordsWritten > totalMaxWords) {
      await log(
        `⚠ Final book: ${totalWordsWritten.toLocaleString()} words (~${estimatedPages} pages). ` +
        `Target was ${inputs.minPages}–${inputs.maxPages} pages. ` +
        `Difference: ${Math.abs(estimatedPages - Math.round((inputs.minPages + inputs.maxPages) / 2))} pages from midpoint.`,
        "info"
      );
    } else {
      await log(
        `✓ Final book: ${totalWordsWritten.toLocaleString()} words (~${estimatedPages} pages) — within ${inputs.minPages}–${inputs.maxPages} page range.`,
        "success"
      );
    }

    await log("Assembling final manuscript...", "info");
    const markdown = assembleFinalBook(inputs, existingChapters, tocEntries, copyrightText);
    await completeJobAndIncrementUser(jobId, job.userEmail, {
      progress: 100,
      markdownContent: markdown,
      completedAt: Date.now(),
    });
    await log("Book generation complete!", "success");
  } catch (err) {
    const message = (err as Error).message;
    await log(`Fatal error: ${message}`, "error");
    await updateJob(jobId, { status: "failed", errorMessage: message });
  } finally {
    activeControllers.delete(jobId);
  }
}

async function runFormat(
  job: typeof jobsTable.$inferSelect,
  inputs: BookInputs,
  controller: AbortController
) {
  const jobId = job.id;
  const startTime = Date.now();

  const log = async (message: string, type: JobLog["type"] = "info") => {
    await appendLog(jobId, mkLog(message, type));
  };

  try {
    await log("Server picked up formatting job", "info");
    await updateJob(jobId, { status: "processing", progress: 5 });

    const formatData = inputs.formatData as FormatBookData;
    if (!formatData) throw new Error("No format data provided");

    const totalSections = 2 + formatData.chapters.length + 1 + (formatData.backMatter ? 1 : 0);
    let sectionsDone = 0;
    const nextProgress = () => { sectionsDone++; return Math.round(5 + (sectionsDone / totalSections) * 90); };

    await log("Formatting introduction...", "info");
    const formattedIntro = await retry(
      () => formatSection(formatData.bookTitle, "Introduction", formatData.introduction, formatData.pageSize, "intro"),
      3, jobId, "Introduction"
    );
    await updateJob(jobId, { progress: nextProgress() });
    await log("Introduction formatted", "success");

    const formattedChapters: string[] = [];
    for (let i = 0; i < formatData.chapters.length; i++) {
      if (Date.now() - startTime > FORMAT_TIMEOUT_MS) {
        await log("Formatting timed out after 30 minutes", "error");
        await updateJob(jobId, { status: "failed", errorMessage: "Formatting timed out after 30 minutes" });
        return;
      }
      if (controller.signal.aborted) {
        await updateJob(jobId, { status: "failed", errorMessage: "Stopped" });
        return;
      }
      const ch = formatData.chapters[i];
      const label = ch.label || `Chapter ${i + 1}`;
      await log(`Formatting Chapter ${i + 1}: ${label}...`, "info");
      await updateJob(jobId, { currentChapter: i + 1, totalChapters: formatData.chapters.length });
      const formatted = await retry(
        () => formatSection(formatData.bookTitle, label, ch.content, formatData.pageSize, "chapter"),
        3, jobId, `Format ch${i + 1}`
      );
      formattedChapters.push(formatted);
      await updateJob(jobId, { progress: nextProgress() });
      await log(`Chapter ${i + 1} formatted`, "success");
    }

    await log("Formatting conclusion...", "info");
    const formattedConclusion = await retry(
      () => formatSection(formatData.bookTitle, "Conclusion", formatData.conclusion, formatData.pageSize, "conclusion"),
      3, jobId, "Conclusion"
    );
    await updateJob(jobId, { progress: nextProgress() });
    await log("Conclusion formatted", "success");

    let formattedBackMatter: string | undefined;
    if (formatData.backMatter) {
      if (controller.signal.aborted) {
        await updateJob(jobId, { status: "failed", errorMessage: "Stopped" });
        return;
      }
      await log("Formatting back matter...", "info");
      formattedBackMatter = await retry(
        () => formatSection(formatData.bookTitle, "Back Matter", formatData.backMatter!, formatData.pageSize, "backmatter"),
        3, jobId, "Back matter"
      );
      await updateJob(jobId, { progress: nextProgress() });
      await log("Back matter formatted", "success");
    }

    await log("Assembling final manuscript...", "info");
    const chapterSubtitles = formattedChapters.map(extractChapterSubtitles);
    const formatTocEntries = [
      ...(formatData.dedication ? ["Dedication"] : []),
      "Introduction",
      ...formatData.chapters.map((c, i) => c.label || `Chapter ${i + 1}`),
      "Conclusion",
      ...(formattedBackMatter ? ["Back Matter"] : []),
    ];
    for (const entry of formatTocEntries) {
      await log(`TOC + section: ${entry}`, "info");
    }
    for (const subs of chapterSubtitles) {
      for (const sub of subs) {
        await log(`TOC + subsection: ${sub}`, "info");
      }
    }
    const markdown = assembleFinalFormattedBook(
      formatData.bookTitle, formatData.copyright, formatData.dedication,
      formattedIntro, formattedChapters, formattedConclusion, formattedBackMatter,
      formatData.chapters.map((c, i) => c.label || `Chapter ${i + 1}`),
      chapterSubtitles
    );
    await completeJobAndIncrementUser(jobId, job.userEmail, { progress: 100, markdownContent: markdown, completedAt: Date.now() });
    await log("Book formatting complete!", "success");
  } catch (err) {
    const message = (err as Error).message;
    await log(`Error: ${message}`, "error");
    await updateJob(jobId, { status: "failed", errorMessage: message });
  } finally {
    activeControllers.delete(jobId);
  }
}

// Called on server startup — resume any jobs that were "processing" when server last stopped
export async function resumeInterruptedJobs() {
  try {
    const rows = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.status, "processing"));

    for (const job of rows) {
      logger.info({ jobId: job.id }, "Resuming interrupted job");
      await startJob(job.id);
    }
    if (rows.length > 0) {
      logger.info(`Resumed ${rows.length} interrupted job(s)`);
    }
  } catch (err) {
    logger.error({ err }, "Failed to resume interrupted jobs");
  }
}
