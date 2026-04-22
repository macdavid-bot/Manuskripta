import { db } from "@workspace/db";
import { sessionsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

export interface AuthRequest extends Request {
  user?: typeof usersTable.$inferSelect;
  token?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.substring(7);
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token))
    .limit(1);
  if (!sessions[0]) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, sessions[0].email))
    .limit(1);
  if (!users[0]) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  req.user = users[0];
  req.token = token;
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
