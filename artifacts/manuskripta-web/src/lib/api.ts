import type { BookJob, User, Announcement } from "./types";

const API_BASE = "";

export class NetworkError extends Error {
  constructor(message = "Network unavailable") {
    super(message);
    this.name = "NetworkError";
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem("msk_token");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
  } catch {
    throw new NetworkError();
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    if (contentType.includes("application/json")) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status);
    }
    throw new ApiError(`HTTP ${res.status}`, res.status);
  }
  if (!contentType.includes("application/json")) {
    throw new Error("Server returned non-JSON response");
  }
  return res.json() as Promise<T>;
}

export const authApi = {
  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  googleLogin: (idToken: string) =>
    request<{ token: string; user: User }>("/auth/google-login", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    }),

  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  me: () => request<{ user: User }>("/auth/me"),
};

export const jobsApi = {
  list: () => request<{ jobs: BookJob[] }>("/jobs"),

  upsert: (job: BookJob) =>
    request<{ job: BookJob }>("/jobs", {
      method: "POST",
      body: JSON.stringify(job),
    }),

  start: (id: string) =>
    request<{ ok: boolean }>(`/jobs/start/${encodeURIComponent(id)}`, {
      method: "POST",
    }),

  stop: (id: string) =>
    request<{ ok: boolean }>(`/jobs/stop/${encodeURIComponent(id)}`, {
      method: "POST",
    }),

  update: (id: string, updates: Partial<BookJob>) =>
    request<{ job: BookJob }>(`/jobs/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),

  remove: (id: string) =>
    request<{ ok: boolean }>(`/jobs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  listAll: () => request<{ jobs: BookJob[] }>("/jobs/all"),
};

export const announcementsApi = {
  list: () => request<{ announcements: Announcement[] }>("/announcements"),

  add: (announcement: Announcement) =>
    request<{ announcement: Announcement }>("/announcements", {
      method: "POST",
      body: JSON.stringify(announcement),
    }),

  remove: (id: string) =>
    request<{ ok: boolean }>(`/announcements/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

export const usersApi = {
  list: () => request<{ users: User[] }>("/users"),

  update: (email: string, updates: Partial<User>) =>
    request<{ user: User }>(`/users/${encodeURIComponent(email)}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),

  getUserJobs: (email: string) =>
    request<{ jobs: BookJob[] }>(`/users/${encodeURIComponent(email)}/jobs`),
};

export const aiApi = {
  complete: (messages: { role: string; content: string }[], maxTokens = 4096) =>
    request<{ choices: { message: { content: string } }[] }>("/ai/complete", {
      method: "POST",
      body: JSON.stringify({ messages, max_tokens: maxTokens, temperature: 0.7 }),
    }),
};
