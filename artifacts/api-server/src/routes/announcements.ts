import { db } from "@workspace/db";
import { announcementsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import { requireAdmin, requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  try {
    const announcements = await db
      .select()
      .from(announcementsTable)
      .orderBy(desc(announcementsTable.createdAt));
    res.json({ announcements });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/", requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const { id, message, preview, createdAt } = _req.body as {
      id: string;
      message: string;
      preview: string;
      createdAt: number;
    };
    const ann = await db
      .insert(announcementsTable)
      .values({ id, message, preview, createdAt })
      .returning();
    res.json({ announcement: ann[0] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db
      .delete(announcementsTable)
      .where(eq(announcementsTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
