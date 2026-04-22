import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { announcementsApi, authApi, jobsApi, usersApi, NetworkError, ApiError } from "@/lib/api";
import type { Announcement, BookJob, User, UserSettings } from "@/lib/types";

const SETTINGS_KEY = "msk_web_settings";
const LAST_READ_KEY = "msk_web_last_ann_read";
const CACHED_USER_KEY = "msk_cached_user";
const POLL_INTERVAL_MS = 5000;

const DEFAULT_SETTINGS: UserSettings = {
  theme: "dark",
  defaultCopyright: "",
  memoryBank: "",
  autoDownload: false,
  defaultTones: [],
};

interface AppContextType {
  user: User | null;
  settings: UserSettings;
  jobs: BookJob[];
  announcements: Announcement[];
  unreadAnnouncements: number;
  isLoggedIn: boolean;
  isLoading: boolean;
  isOffline: boolean;
  allUsers: User[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<void>;
  updateSettings: (updates: Partial<UserSettings>) => void;
  addJob: (job: BookJob) => void;
  updateJob: (id: string, updates: Partial<BookJob>) => void;
  removeJob: (id: string) => void;
  addLog: (jobId: string, log: { timestamp: number; message: string; type: "info" | "error" | "success" }) => void;
  startGeneration: (job: BookJob) => void;
  resumeGeneration: (jobId: string) => void;
  stopGeneration: (jobId: string) => void;
  markAnnouncementsRead: () => void;
  addAnnouncement: (announcement: Announcement) => void;
  removeAnnouncement: (id: string) => void;
  updateUser: (email: string, updates: Partial<User>) => Promise<void>;
  refreshJobs: () => Promise<void>;
  refreshAnnouncements: () => Promise<void>;
  refreshUsers: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [jobs, setJobs] = useState<BookJob[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [lastReadAt, setLastReadAt] = useState<number>(0);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoggedInRef = useRef(false);

  isLoggedInRef.current = isLoggedIn;

  useEffect(() => {
    const theme = settings.theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    document.body.style.backgroundColor = theme === "light" ? "#F5F5F0" : "#000000";
    document.body.style.color = theme === "light" ? "#111111" : "#E8E8E8";
  }, [settings.theme]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      const token = localStorage.getItem("msk_token");
      if (token && isLoggedInRef.current) {
        authApi.me()
          .then(({ user: me }) => {
            setUser(me);
            localStorage.setItem(CACHED_USER_KEY, JSON.stringify(me));
            loadServerData();
          })
          .catch(() => {});
      }
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(async () => {
      if (!isLoggedInRef.current) return;
      try {
        const { jobs: serverJobs } = await jobsApi.list();
        setJobs(serverJobs);
        const hasActive = serverJobs.some((j) => j.status === "processing" || j.status === "pending");
        if (!hasActive && pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      } catch {}
    }, POLL_INTERVAL_MS);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    if (storedSettings) setSettings(JSON.parse(storedSettings));
    const storedLastRead = localStorage.getItem(LAST_READ_KEY);
    if (storedLastRead) setLastReadAt(Number(storedLastRead));

    const token = localStorage.getItem("msk_token");
    if (!token) { setIsLoading(false); return; }

    authApi.me()
      .then(({ user: me }) => {
        setUser(me);
        setIsLoggedIn(true);
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(me));
        return loadServerData();
      })
      .catch((err) => {
        if (err instanceof NetworkError) {
          const cached = localStorage.getItem(CACHED_USER_KEY);
          if (cached) {
            try {
              setUser(JSON.parse(cached));
              setIsLoggedIn(true);
              setIsOffline(true);
            } catch {
              localStorage.removeItem("msk_token");
              localStorage.removeItem(CACHED_USER_KEY);
            }
          } else {
            localStorage.removeItem("msk_token");
          }
        } else if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          localStorage.removeItem("msk_token");
          localStorage.removeItem(CACHED_USER_KEY);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const loadServerData = async () => {
    try {
      const [{ jobs: serverJobs }, { announcements: serverAnns }] = await Promise.all([
        jobsApi.list(),
        announcementsApi.list(),
      ]);
      setJobs(serverJobs);
      setAnnouncements(serverAnns);
    } catch {}
  };

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: u } = await authApi.login(email, password);
    localStorage.setItem("msk_token", token);
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(u));
    setUser(u);
    setIsLoggedIn(true);
    await loadServerData();
    if (u.isAdmin) {
      try { const { users } = await usersApi.list(); setAllUsers(users); } catch {}
    }
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    stopPolling();
    localStorage.removeItem("msk_token");
    localStorage.removeItem(CACHED_USER_KEY);
    setUser(null);
    setIsLoggedIn(false);
    setJobs([]);
    setAllUsers([]);
    setAnnouncements([]);
  }, [stopPolling]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { token, user: u } = await authApi.register(name, email, password);
    localStorage.setItem("msk_token", token);
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(u));
    setUser(u);
    setIsLoggedIn(true);
  }, []);

  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addJob = useCallback((job: BookJob) => {
    setJobs((prev) => [job, ...prev]);
    jobsApi.upsert(job).catch(() => {});
  }, []);

  const updateJob = useCallback((id: string, updates: Partial<BookJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
  }, []);

  const removeJob = useCallback((id: string) => {
    jobsApi.stop(id).catch(() => {});
    setJobs((prev) => prev.filter((j) => j.id !== id));
    jobsApi.remove(id).catch(() => {});
  }, []);

  const addLog = useCallback((_jobId: string, _log: { timestamp: number; message: string; type: "info" | "error" | "success" }) => {
  }, []);

  const startGeneration = useCallback((job: BookJob) => {
    jobsApi.upsert(job)
      .then(() => jobsApi.start(job.id))
      .then(() => { startPolling(); })
      .catch((err) => {
        setJobs((prev) => prev.map((j) =>
          j.id === job.id
            ? { ...j, status: "failed" as const, errorMessage: `Failed to start: ${(err as Error).message}` }
            : j
        ));
      });
  }, [startPolling]);

  // Resume a failed job from the last saved chapter — does NOT upsert, preserves DB chapters
  const resumeGeneration = useCallback((jobId: string) => {
    setJobs((prev) => prev.map((j) =>
      j.id === jobId ? { ...j, status: "pending" as const, errorMessage: undefined, logs: [] } : j
    ));
    jobsApi.start(jobId)
      .then(() => { startPolling(); })
      .catch((err) => {
        setJobs((prev) => prev.map((j) =>
          j.id === jobId
            ? { ...j, status: "failed" as const, errorMessage: `Failed to resume: ${(err as Error).message}` }
            : j
        ));
      });
  }, [startPolling]);

  const stopGeneration = useCallback((jobId: string) => {
    jobsApi.stop(jobId).catch(() => {});
    setJobs((prev) => prev.map((j) =>
      j.id === jobId ? { ...j, status: "failed" as const, errorMessage: "Stopped by user" } : j
    ));
  }, []);

  const markAnnouncementsRead = useCallback(() => {
    const now = Date.now();
    setLastReadAt(now);
    localStorage.setItem(LAST_READ_KEY, String(now));
  }, []);

  const addAnnouncement = useCallback((announcement: Announcement) => {
    setAnnouncements((prev) => [announcement, ...prev]);
    announcementsApi.add(announcement).catch(() => {});
  }, []);

  const removeAnnouncement = useCallback((id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    announcementsApi.remove(id).catch(() => {});
  }, []);

  const updateUser = useCallback(async (email: string, updates: Partial<User>) => {
    const { user: updated } = await usersApi.update(email, updates);
    setAllUsers((prev) => prev.map((u) => u.email === email ? updated : u));
  }, []);

  const refreshJobs = useCallback(async () => {
    try { const { jobs: serverJobs } = await jobsApi.list(); setJobs(serverJobs); } catch {}
  }, []);

  const refreshAnnouncements = useCallback(async () => {
    try { const { announcements: serverAnns } = await announcementsApi.list(); setAnnouncements(serverAnns); } catch {}
  }, []);

  const refreshUsers = useCallback(async () => {
    try { const { users } = await usersApi.list(); setAllUsers(users); } catch {}
  }, []);

  useEffect(() => {
    if (isLoggedIn && user?.isAdmin) refreshUsers();
  }, [isLoggedIn, user?.isAdmin, refreshUsers]);

  const unreadAnnouncements = announcements.filter((a) => a.createdAt > lastReadAt).length;

  return (
    <AppContext.Provider value={{
      user, settings, jobs, announcements, unreadAnnouncements,
      isLoggedIn, isLoading, isOffline, allUsers,
      login, logout, register, updateSettings,
      addJob, updateJob, removeJob, addLog,
      startGeneration, resumeGeneration, stopGeneration,
      markAnnouncementsRead, addAnnouncement, removeAnnouncement,
      updateUser, refreshJobs, refreshAnnouncements, refreshUsers,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
