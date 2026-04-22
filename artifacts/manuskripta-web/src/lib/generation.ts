import type { BookJob, JobLog } from "./types";
import {
  assembleFinalBook,
  assembleFinalFormattedBook,
  calculateWordTargets,
  createBookBlueprint,
  formatSection,
  generateChapter,
  generateCopyright,
  parseTOCDetailed,
  stripRogueChapters,
  summarizeChapter,
} from "./ai";

export type UpdateJobFn = (id: string, updates: Partial<BookJob>) => void;
export type AddLogFn = (jobId: string, log: JobLog) => void;

const BOOK_TIMEOUT_MS = 7 * 60 * 60 * 1000;
const FORMAT_TIMEOUT_MS = 30 * 60 * 1000;
const activeJobs = new Map<string, AbortController>();

export function stopJob(jobId: string) {
  const ctrl = activeJobs.get(jobId);
  if (ctrl) { ctrl.abort(); activeJobs.delete(jobId); }
}

export function stopAllJobs() {
  for (const [, ctrl] of activeJobs) ctrl.abort();
  activeJobs.clear();
}

export async function runBookGeneration(job: BookJob, updateJob: UpdateJobFn, addLog: AddLogFn) {
  const controller = new AbortController();
  activeJobs.set(job.id, controller);
  const startTime = Date.now();

  const log = (message: string, type: JobLog["type"] = "info") =>
    addLog(job.id, { timestamp: Date.now(), message, type });

  try {
    log("Starting book generation pipeline", "info");
    const inputs = job.inputs;
    const parseResult = parseTOCDetailed(inputs.tableOfContents);
    const tocParsed = parseResult.chapters.map((c) => c.title);
    const totalChapters = tocParsed.length;
    if (totalChapters === 0) {
      log("No chapters detected. Use \"Chapter 1\", \"Chapter 2\" or \"1.\", \"2.\".", "error");
      updateJob(job.id, { status: "failed", errorMessage: "No chapters detected in Table of Contents" });
      return;
    }
    updateJob(job.id, { tocParsed, totalChapters, status: "processing" });
    log(`Detected ${totalChapters} chapters (parser: ${parseResult.mode})`, "info");
    for (const w of parseResult.warnings) log(`⚠ ${w}`, "info");

    const wordTargets = calculateWordTargets(inputs, totalChapters);
    log(`Word target per chapter: ${wordTargets.minPerChapter}–${wordTargets.maxPerChapter}`, "info");

    if (controller.signal.aborted) return;

    let blueprint = job.blueprint;
    if (!blueprint) {
      log("Creating Book Blueprint...", "info");
      blueprint = await retry(() => createBookBlueprint(inputs), 3, log);
      updateJob(job.id, { blueprint });
      log("Book Blueprint created", "success");
    }

    let copyrightText = "";
    if (inputs.copyrightOption === "generate") {
      log("Generating copyright text...", "info");
      copyrightText = await retry(() => generateCopyright(inputs), 3, log).catch(
        () => `Copyright © ${new Date().getFullYear()} ${inputs.title}. All rights reserved.`
      );
    } else {
      copyrightText = inputs.copyrightText ?? "";
    }

    const existingChapters = [...job.chapterContents];
    const existingSummaries = [...job.chapterSummaries];
    const startChapter = existingChapters.filter((c) => c.length > 0).length;

    for (let i = startChapter; i < totalChapters; i++) {
      if (Date.now() - startTime > BOOK_TIMEOUT_MS) {
        log("Book generation timed out after 7 hours", "error");
        updateJob(job.id, { status: "failed", errorMessage: "Book generation timed out after 7 hours" });
        return;
      }
      if (controller.signal.aborted) {
        log("Generation stopped", "info");
        updateJob(job.id, { status: "failed", errorMessage: "Stopped by user" });
        return;
      }

      const chapterTitle = tocParsed[i] ?? `Chapter ${i + 1}`;
      log(`Writing Chapter ${i + 1}: ${chapterTitle}`, "info");
      updateJob(job.id, { currentChapter: i + 1, progress: Math.round((i / totalChapters) * 90) });

      let chapterContent = "";
      let success = false;
      let attempts = 0;
      while (!success && attempts < 3) {
        try {
          chapterContent = await generateChapter(
            inputs, blueprint, chapterTitle, i, totalChapters,
            existingSummaries, wordTargets.minPerChapter, wordTargets.maxPerChapter
          );
          success = true;
        } catch (err) {
          attempts++;
          log(`Chapter ${i + 1} attempt ${attempts} failed: ${(err as Error).message}`, "error");
          if (attempts < 3) await sleep(2000 * attempts);
        }
      }
      if (!success) {
        updateJob(job.id, { status: "failed", errorMessage: `Failed to generate Chapter ${i + 1} after 3 attempts` });
        return;
      }

      const before = chapterContent.length;
      chapterContent = stripRogueChapters(chapterContent, i + 1);
      if (chapterContent.length < before) {
        log(`Chapter ${i + 1}: stripped rogue chapter heading injected by AI.`, "info");
      }

      const summary = await retry(() => summarizeChapter(chapterTitle, chapterContent), 2, log)
        .catch(() => `Chapter ${i + 1}: ${chapterTitle}`);

      existingChapters[i] = chapterContent;
      existingSummaries[i] = summary;
      updateJob(job.id, { chapterContents: [...existingChapters], chapterSummaries: [...existingSummaries] });
      log(`Chapter ${i + 1} complete`, "success");
    }

    log("Assembling final manuscript...", "info");
    const markdown = await assembleFinalBook(inputs, existingChapters, tocParsed, copyrightText);
    updateJob(job.id, { status: "completed", progress: 100, markdownContent: markdown, completedAt: Date.now() });
    log("Book generation complete!", "success");
  } catch (err) {
    const message = (err as Error).message;
    log(`Fatal error: ${message}`, "error");
    updateJob(job.id, { status: "failed", errorMessage: message });
  } finally {
    activeJobs.delete(job.id);
  }
}

export async function runFormatJob(job: BookJob, updateJob: UpdateJobFn, addLog: AddLogFn) {
  const controller = new AbortController();
  activeJobs.set(job.id, controller);
  const startTime = Date.now();

  const log = (message: string, type: JobLog["type"] = "info") =>
    addLog(job.id, { timestamp: Date.now(), message, type });

  try {
    log("Starting book formatting pipeline", "info");
    updateJob(job.id, { status: "processing", progress: 5 });

    const formatData = job.inputs.formatData;
    if (!formatData) throw new Error("No format data provided");

    const totalSections = 2 + formatData.chapters.length + 1 + (formatData.backMatter ? 1 : 0);
    let sectionsDone = 0;
    const progressAfter = () => { sectionsDone++; return Math.round(5 + (sectionsDone / totalSections) * 90); };

    log("Formatting introduction...", "info");
    const formattedIntro = await retry(
      () => formatSection(formatData.bookTitle, "Introduction", formatData.introduction, formatData.pageSize, "intro"),
      3, log
    );
    updateJob(job.id, { progress: progressAfter() });
    log("Introduction formatted", "success");

    const formattedChapters: string[] = [];
    for (let i = 0; i < formatData.chapters.length; i++) {
      if (Date.now() - startTime > FORMAT_TIMEOUT_MS) {
        log("Formatting timed out after 30 minutes", "error");
        updateJob(job.id, { status: "failed", errorMessage: "Formatting timed out after 30 minutes" });
        return;
      }
      if (controller.signal.aborted) {
        updateJob(job.id, { status: "failed", errorMessage: "Stopped by user" });
        return;
      }
      const ch = formatData.chapters[i];
      const label = ch.label || `Chapter ${i + 1}`;
      log(`Formatting Chapter ${i + 1}: ${label}...`, "info");
      updateJob(job.id, { currentChapter: i + 1, totalChapters: formatData.chapters.length });
      const formatted = await retry(
        () => formatSection(formatData.bookTitle, label, ch.content, formatData.pageSize, "chapter"),
        3, log
      );
      formattedChapters.push(formatted);
      updateJob(job.id, { progress: progressAfter() });
      log(`Chapter ${i + 1} formatted`, "success");
    }

    log("Formatting conclusion...", "info");
    const formattedConclusion = await retry(
      () => formatSection(formatData.bookTitle, "Conclusion", formatData.conclusion, formatData.pageSize, "conclusion"),
      3, log
    );
    updateJob(job.id, { progress: progressAfter() });
    log("Conclusion formatted", "success");

    let formattedBackMatter: string | undefined;
    if (formatData.backMatter) {
      if (controller.signal.aborted) {
        updateJob(job.id, { status: "failed", errorMessage: "Stopped by user" });
        return;
      }
      log("Formatting back matter...", "info");
      formattedBackMatter = await retry(
        () => formatSection(formatData.bookTitle, "Back Matter", formatData.backMatter!, formatData.pageSize, "backmatter"),
        3, log
      );
      updateJob(job.id, { progress: progressAfter() });
      log("Back matter formatted", "success");
    }

    log("Assembling final manuscript...", "info");
    const markdown = await assembleFinalFormattedBook(
      formatData.bookTitle, formatData.copyright, formatData.dedication,
      formattedIntro, formattedChapters, formattedConclusion, formattedBackMatter,
      formatData.chapters.map((c, i) => c.label || `Chapter ${i + 1}`)
    );
    updateJob(job.id, { status: "completed", progress: 100, markdownContent: markdown, completedAt: Date.now() });
    log("Book formatting complete!", "success");
  } catch (err) {
    const message = (err as Error).message;
    log(`Error: ${message}`, "error");
    updateJob(job.id, { status: "failed", errorMessage: message });
  } finally {
    activeJobs.delete(job.id);
  }
}

async function retry<T>(fn: () => Promise<T>, maxAttempts: number, log: (msg: string, type: JobLog["type"]) => void): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    try { return await fn(); }
    catch (err) {
      lastError = err as Error;
      log(`Retry ${i + 1}: ${lastError.message}`, "error");
      if (i < maxAttempts - 1) await sleep(1500 * (i + 1));
    }
  }
  throw lastError;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
