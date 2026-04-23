// UPDATED VERSION WITH SUBHEADING INJECTION
import type { BookInputs, BookJob, JobLog } from "@/context/AppContext";
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
} from "./aiService";

export type UpdateJobFn = (id: string, updates: Partial<BookJob>) => void;
export type AddLogFn = (jobId: string, log: JobLog) => void;

const BOOK_TIMEOUT_MS = 7 * 60 * 60 * 1000;
const activeJobs = new Map<string, AbortController>();

export async function runBookGeneration(
  job: BookJob,
  updateJob: UpdateJobFn,
  addLog: AddLogFn
) {
  const controller = new AbortController();
  activeJobs.set(job.id, controller);

  const log = (message: string, type: JobLog["type"] = "info") => {
    addLog(job.id, { timestamp: Date.now(), message, type });
  };

  try {
    log("Starting book generation pipeline", "info");

    const inputs = job.inputs;
    const parseResult = parseTOCDetailed(inputs.tableOfContents);

    const tocDetailed = parseResult.chapters;
    const totalSections = tocDetailed.length;

    if (totalSections === 0) {
      throw new Error("No sections detected in Table of Contents");
    }

    updateJob(job.id, {
      tocParsed: tocDetailed.map((c) => c.title),
      totalChapters: totalSections,
      status: "processing",
    });

    const wordTargets = calculateWordTargets(inputs, totalSections);

    let blueprint = await createBookBlueprint(inputs);

    const existingChapters: string[] = [];
    const existingSummaries: string[] = [];

    for (let i = 0; i < totalSections; i++) {
      const section = tocDetailed[i];
      const sectionTitle = section.title;
      const subsectionList = section.subsections || [];

      log(`Generating: ${sectionTitle}`, "info");

      let content = "";
      let attempts = 0;
      let success = false;

      while (!success && attempts < 3) {
        try {
          const enhancedInputs: BookInputs = {
            ...inputs,
            additionalPrompt: `${inputs.additionalPrompt || ""}\n\nMANDATORY SUBSECTIONS TO COVER (INSIDE THIS CHAPTER):\n\n${
              subsectionList.length > 0
                ? subsectionList.map((s, idx) => `${idx + 1}. ${s}`).join("\n")
                : "No subsections provided — structure intelligently."
            }\n\nRULES:\n- Every subsection MUST appear in this chapter\n- Use proper Markdown headings (### or ####)\n- Do NOT skip any subsection\n- Do NOT merge multiple subsections into one\n- Each subsection must contain meaningful, developed content\n`,
          } as BookInputs;

          content = await generateChapter(
            enhancedInputs,
            blueprint,
            sectionTitle,
            i,
            totalSections,
            existingSummaries,
            wordTargets.minPerChapter,
            wordTargets.maxPerChapter
          );

          if (!content || content.trim().length < 100) {
            throw new Error("Content too short");
          }

          success = true;
        } catch (err) {
          attempts++;
          log(`Retrying: ${sectionTitle} (attempt ${attempts})`, "error");
        }
      }

      if (!success) {
        throw new Error(`Failed to generate required section: ${sectionTitle}`);
      }

      content = stripRogueChapters(content, i + 1);

      const summary = await summarizeChapter(sectionTitle, content);

      existingChapters[i] = content;
      existingSummaries[i] = summary;

      updateJob(job.id, {
        chapterContents: [...existingChapters],
        chapterSummaries: [...existingSummaries],
      });

      log(`${sectionTitle} complete`, "success");
    }

    const markdown = await assembleFinalBook(
      inputs,
      existingChapters,
      tocDetailed.map((c) => c.title),
      ""
    );

    updateJob(job.id, {
      status: "completed",
      progress: 100,
      markdownContent: markdown,
      completedAt: Date.now(),
    });

    log("Book generation complete!", "success");
  } catch (err) {
    const message = (err as Error).message;
    log(`Fatal error: ${message}`, "error");
    updateJob(job.id, { status: "failed", errorMessage: message });
  } finally {
    activeJobs.delete(job.id);
  }
}
