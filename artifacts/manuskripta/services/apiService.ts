import type { BookJob, User, Announcement } from "@/context/AppContext";

function resolveApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_BASE) {
    return process.env.EXPO_PUBLIC_API_BASE.replace(/\/$/, "");
  }
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}/api-server`;
  }
  return "";
}

const API_BASE = resolveApiBase();

let _authToken: string | null = null;

export function setApiToken(token: string | null) {
  _authToken = token;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/api${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (_authToken) headers["Authorization"] = `Bearer ${_authToken}`;
  if (options?.headers) {
    Object.assign(headers, options.headers);
  }
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await res.json().catch(() => ({ error: "" }));
      throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
    }
    const text = (await res.text().catch(() => "")).trim();
    throw new Error(text || `HTTP ${res.status}`);
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

  logout: () =>
    request<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  me: () => request<{ user: User }>("/auth/me"),
};

export const jobsApi = {
  list: () => request<{ jobs: BookJob[] }>("/jobs"),

  upsert: (job: BookJob) =>
    request<{ job: BookJob }>("/jobs", {
      method: "POST",
      body: JSON.stringify(job),
    }),

  update: (id: string, updates: Partial<BookJob>) =>
    request<{ job: BookJob }>(`/jobs/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),

  remove: (id: string) =>
    request<{ ok: boolean }>(`/jobs/${encodeURIComponent(id)}`, { method: "DELETE" }),

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
    request<{ ok: boolean }>(`/announcements/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export const usersApi = {
  list: () => request<{ users: User[] }>("/users"),

  update: (email: string, updates: Partial<User>) =>
    request<{ user: User }>(`/users/${encodeURIComponent(email)}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),
};
