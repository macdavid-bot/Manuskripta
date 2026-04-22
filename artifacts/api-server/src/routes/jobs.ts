import { db } from "@workspace/db";
import { jobsTable } from "@workspace/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { requireAdmin, requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { startJob, stopJob, isJobRunning } from "../lib/jobRunner.js";

const router = Router();

router.get("/all", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const jobs = await db.select().from(jobsTable).orderBy(desc(jobsTable.createdAt));
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const jobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.userEmail, req.user!.email))
      .orderBy(desc(jobsTable.createdAt));
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Create or upsert a job record (does NOT auto-start — call /start/:id to begin)
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const jobData = req.body as typeof jobsTable.$inferInsert;
    const job = await db
      .insert(jobsTable)
      .values({ ...jobData, userEmail: req.user!.email })
      .onConflictDoUpdate({
        target: jobsTable.id,
        set: { ...jobData, userEmail: req.user!.email },
      })
      .returning();
    res.json({ job: job[0] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Start server-side generation for a job (fire-and-forget on the server)
router.post("/start/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const rows = await db
      .select()
      .from(jobsTable)
      .where(
        req.user!.isAdmin
          ? eq(jobsTable.id, id)
          : and(eq(jobsTable.id, id), eq(jobsTable.userEmail, req.user!.email))
      )
      .limit(1);

    if (!rows[0]) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    if (isJobRunning(id)) {
      res.json({ ok: true, message: "Already running" });
      return;
    }

    const job = rows[0];
    if (job.status === "failed" || job.status === "completed") {
      const firstMissingChapter = Array.isArray(job.chapterContents)
        ? job.chapterContents.findIndex((chapter) => !chapter || chapter.length === 0)
        : -1;
      await db.update(jobsTable).set({
        status: "pending",
        errorMessage: null,
        progress: firstMissingChapter > 0 && Array.isArray(job.chapterContents) && job.chapterContents.length > 0
          ? Math.round((firstMissingChapter / job.chapterContents.length) * 90)
          : 0,
        currentChapter: firstMissingChapter > 0 ? firstMissingChapter : 0,
        chapterSummaries: Array.isArray(job.chapterSummaries) ? job.chapterSummaries : [],
        blueprint: "",
        logs: [],
        markdownContent: null,
        completedAt: null,
      }).where(eq(jobsTable.id, id));
    }

    // Fire-and-forget
    startJob(id).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Stop a running job
router.post("/stop/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    stopJob(id);
    await db.update(jobsTable)
      .set({ status: "failed", errorMessage: "Stopped by user" })
      .where(eq(jobsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body as Partial<typeof jobsTable.$inferInsert>;
    delete (updates as Record<string, unknown>).id;
    delete (updates as Record<string, unknown>).userEmail;

    const updated = await db
      .update(jobsTable)
      .set(updates)
      .where(and(eq(jobsTable.id, id), eq(jobsTable.userEmail, req.user!.email)))
      .returning();

    if (!updated[0]) {
      const adminCheck = req.user!.isAdmin
        ? await db.update(jobsTable).set(updates).where(eq(jobsTable.id, id)).returning()
        : [];
      if (!adminCheck[0]) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      res.json({ job: adminCheck[0] });
      return;
    }
    res.json({ job: updated[0] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    stopJob(id);
    await db
      .delete(jobsTable)
      .where(and(eq(jobsTable.id, id), eq(jobsTable.userEmail, req.user!.email)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
