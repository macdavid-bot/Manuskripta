import { bigint, boolean, integer, jsonb, pgTable, text, varchar } from "drizzle-orm/pg-core";

export const usersTable = pgTable("msk_users", {
  email: varchar("email", { length: 255 }).primaryKey(),
  passwordHash: varchar("password_hash", { length: 128 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  googleId: varchar("google_id", { length: 255 }),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isApproved: boolean("is_approved").default(false).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  maxBooksPerMonth: integer("max_books_per_month").default(4).notNull(),
  limitExpiresAt: bigint("limit_expires_at", { mode: "number" }),
  limitSetAt: bigint("limit_set_at", { mode: "number" }),
  booksGenerated: integer("books_generated").default(0).notNull(),
  settings: jsonb("settings").default({}),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const sessionsTable = pgTable("msk_sessions", {
  token: varchar("token", { length: 128 }).primaryKey(),
  email: varchar("email", { length: 255 })
    .notNull()
    .references(() => usersTable.email, { onDelete: "cascade" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const jobsTable = pgTable("msk_jobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userEmail: varchar("user_email", { length: 255 })
    .notNull()
    .references(() => usersTable.email, { onDelete: "cascade" }),
  title: varchar("title", { length: 500 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  progress: integer("progress").default(0).notNull(),
  currentChapter: integer("current_chapter").default(0).notNull(),
  totalChapters: integer("total_chapters").default(0).notNull(),
  chapterContents: jsonb("chapter_contents").$type<string[]>().default([]),
  chapterSummaries: jsonb("chapter_summaries").$type<string[]>().default([]),
  blueprint: text("blueprint").default(""),
  tocParsed: jsonb("toc_parsed").$type<string[]>().default([]),
  inputs: jsonb("inputs").$type<Record<string, unknown>>().notNull(),
  logs: jsonb("logs").$type<unknown[]>().default([]),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  completedAt: bigint("completed_at", { mode: "number" }),
  markdownContent: text("markdown_content"),
  errorMessage: varchar("error_message", { length: 1000 }),
  retryCount: integer("retry_count").default(0).notNull(),
  mode: varchar("mode", { length: 10 }).default("create").notNull(),
});

export const announcementsTable = pgTable("msk_announcements", {
  id: varchar("id", { length: 64 }).primaryKey(),
  message: text("message").notNull(),
  preview: varchar("preview", { length: 300 }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
