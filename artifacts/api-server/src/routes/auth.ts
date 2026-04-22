import { db } from "@workspace/db";
import { sessionsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { generateToken, hashPassword } from "../lib/auth.js";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const ADMIN_EMAIL = "macdondavid565@gmail.com";
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// ─── Email/Password Register ───────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body as { name: string; email: string; password: string };
    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ error: "Name, email and password are required" });
      return;
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (existing[0]) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const now = Date.now();
    const user = await db
      .insert(usersTable)
      .values({
        email: email.toLowerCase(),
        passwordHash: hashPassword(password),
        name: name.trim(),
        isAdmin,
        isApproved: isAdmin,
        status: isAdmin ? "approved" : "pending",
        maxBooksPerMonth: isAdmin ? 999999 : 4,
        booksGenerated: 0,
        createdAt: now,
        settings: {},
      })
      .returning();

    const token = generateToken();
    await db.insert(sessionsTable).values({
      token,
      email: user[0].email,
      createdAt: now,
    });

    const { passwordHash: _, ...safeUser } = user[0];
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Email/Password Login ──────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    let users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (isAdmin && !users[0]) {
      const now = Date.now();
      const created = await db
        .insert(usersTable)
        .values({
          email: ADMIN_EMAIL.toLowerCase(),
          passwordHash: hashPassword(password),
          name: "Admin",
          isAdmin: true,
          isApproved: true,
          status: "approved",
          maxBooksPerMonth: 999999,
          booksGenerated: 0,
          createdAt: now,
          settings: {},
        })
        .returning();
      users = created;
    }

    if (!users[0]) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (isAdmin && users[0].email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      const now = Date.now();
      const token = generateToken();
      const userToReturn = { ...users[0], isAdmin: true, isApproved: true, maxBooksPerMonth: 999999 };
      await db.insert(sessionsTable).values({ token, email: users[0].email, createdAt: now });
      const { passwordHash: _, ...safeUser } = userToReturn;
      res.json({ token, user: safeUser });
      return;
    }

    if (users[0].passwordHash !== hashPassword(password)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (!isAdmin && !users[0].isApproved) {
      res.status(403).json({ error: "Account pending approval" });
      return;
    }

    const now = Date.now();
    const token = generateToken();
    await db.insert(sessionsTable).values({ token, email: users[0].email, createdAt: now });

    const userToReturn = isAdmin
      ? { ...users[0], isAdmin: true, isApproved: true, maxBooksPerMonth: 999999 }
      : users[0];

    const { passwordHash: _, ...safeUser } = userToReturn;
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Google OAuth Login ────────────────────────────────────────────────────
router.post("/google-login", async (req, res) => {
  try {
    const { idToken } = req.body as { idToken: string };
    if (!idToken) {
      res.status(400).json({ error: "Google ID token required" });
      return;
    }

    // Verify token via Google's tokeninfo endpoint
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!verifyRes.ok) {
      res.status(401).json({ error: "Invalid Google token" });
      return;
    }

    const payload = await verifyRes.json() as {
      sub: string;
      email: string;
      name: string;
      picture?: string;
      aud: string;
    };

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId && payload.aud !== clientId) {
      res.status(401).json({ error: "Token audience mismatch" });
      return;
    }

    const email = payload.email.toLowerCase();
    const isAdmin = email === ADMIN_EMAIL.toLowerCase();
    const now = Date.now();

    let users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!users[0]) {
      // Create new user from Google account
      const created = await db
        .insert(usersTable)
        .values({
          email,
          passwordHash: hashPassword(payload.sub),
          googleId: payload.sub,
          name: payload.name || email.split("@")[0],
          isAdmin,
          isApproved: isAdmin,
          status: isAdmin ? "approved" : "pending",
          maxBooksPerMonth: isAdmin ? 999999 : 4,
          booksGenerated: 0,
          createdAt: now,
          settings: {},
        })
        .returning();
      users = created;
    } else {
      // Update Google ID if not set
      if (!users[0].googleId) {
        await db.update(usersTable).set({ googleId: payload.sub }).where(eq(usersTable.email, email));
        users[0] = { ...users[0], googleId: payload.sub };
      }
    }

    const user = users[0];

    if (!isAdmin && !user.isApproved) {
      res.status(403).json({ error: "Account pending approval", status: user.status });
      return;
    }

    const token = generateToken();
    await db.insert(sessionsTable).values({ token, email: user.email, createdAt: now });

    const userToReturn = isAdmin
      ? { ...user, isAdmin: true, isApproved: true, maxBooksPerMonth: 999999 }
      : user;

    const { passwordHash: _, ...safeUser } = userToReturn;
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Logout ────────────────────────────────────────────────────────────────
router.post("/logout", requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.token) {
      await db.delete(sessionsTable).where(eq(sessionsTable.token, req.token));
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Me ────────────────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const { passwordHash: _, ...safeUser } = req.user!;
  const user = req.user!.isAdmin
    ? { ...safeUser, isAdmin: true, isApproved: true, maxBooksPerMonth: 999999 }
    : safeUser;
  res.json({ user });
});

export default router;
