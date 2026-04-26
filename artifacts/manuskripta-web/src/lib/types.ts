export interface UserSettings {
  theme: "dark" | "light";
  defaultCopyright: string;
  defaultAuthor: string;
  memoryBank: string;
  autoDownload: boolean;
  defaultTones: string[];
}

export interface BookJob {
  id: string;
  title: string;
  subtitle?: string;
  status: "processing" | "completed" | "failed" | "pending";
  progress: number;
  currentChapter: number;
  totalChapters: number;
  chapterContents: string[];
  chapterSummaries: string[];
  blueprint: string;
  tocParsed: string[];
  inputs: BookInputs;
  logs: JobLog[];
  createdAt: number;
  completedAt?: number;
  markdownContent?: string;
  errorMessage?: string;
  retryCount: number;
  mode: "create" | "format";
  userEmail?: string;
}

export interface HeadingColors {
  h1: string;
  h2: string;
  h3: string;
  h4: string;
}

export type HeadingCapitalization = "uppercase" | "titlecase" | "lowercase";

export interface BookInputs {
  title: string;
  subtitle?: string;
  tableOfContents: string;
  minPages: number;
  maxPages: number;
  tones: string[];
  allowStorytelling: boolean;
  pageSize: string;
  customWidth?: number;
  customHeight?: number;
  useHeadingColor: boolean;
  headingColors?: HeadingColors;
  headingCapitalization: HeadingCapitalization;
  copyrightOption: "generate" | "insert" | "default";
  copyrightText?: string;
  authorName?: string;
  additionalPrompt?: string;
  memoryBank?: string;
  mode: "create" | "format";
  formatData?: FormatBookData;
}

export interface FormatBookData {
  bookTitle: string;
  copyright: string;
  dedication?: string;
  introduction: string;
  chapters: { label: string; content: string }[];
  conclusion: string;
  backMatter?: string;
  pageSize: string;
  customWidth?: number;
  customHeight?: number;
}

export interface JobLog {
  timestamp: number;
  message: string;
  type: "info" | "error" | "success";
}

export interface Announcement {
  id: string;
  message: string;
  createdAt: number;
  preview: string;
}

export interface User {
  email: string;
  name: string;
  isAdmin: boolean;
  isApproved: boolean;
  status: "approved" | "pending" | "rejected";
  maxBooksPerMonth: number;
  limitExpiresAt?: number | null;
  limitSetAt?: number | null;
  booksGenerated: number;
  createdAt: number;
  settings?: Record<string, unknown>;
}
