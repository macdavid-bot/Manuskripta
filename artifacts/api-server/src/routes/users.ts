import { db } from "@workspace/db";
import { jobsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { requireAdmin, requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// List all users (admin only)
router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const users = await db.select().from(usersTable);
    const safe = users.map(({ passwordHash: _, ...u }) => u);
    res.json({ users: safe });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get a specific user's jobs (admin only - for Usage Monitor)
router.get("/:email/jobs", requireAuth, requireAdmin, async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const jobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.userEmail, email));
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Update a user (admin only)
router.put("/:email", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const updates = req.body as Record<string, unknown>;
    delete updates.passwordHash;
    delete updates.email;

    const updated = await db
      .update(usersTable)
      .set(updates as Partial<typeof usersTable.$inferInsert>)
      .where(eq(usersTable.email, email))
      .returning();

    if (!updated[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { passwordHash: _, ...safe } = updated[0];
    res.json({ user: safe });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
