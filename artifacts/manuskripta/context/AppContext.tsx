import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { announcementsApi, authApi, jobsApi, setApiToken, usersApi } from "@/services/apiService";

export interface UserSettings {
  theme: "dark" | "light";
  defaultCopyright: string;
  memoryBank: string;
  autoDownload: boolean;
  defaultTones: string[];
}

export interface BookJob {
  id: string;
  title: string;
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
}

export interface BookInputs {
  title: string;
  tableOfContents: string;
  minPages: number;
  maxPages: number;
  tones: string[];
  allowStorytelling: boolean;
  pageSize: string;
  customWidth?: number;
  customHeight?: number;
  useHeadingColor: boolean;
  copyrightOption: "generate" | "insert" | "default";
  copyrightText?: string;
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
}

interface AppContextType {
  user: User | null;
  settings: UserSettings;
  jobs: BookJob[];
  announcements: Announcement[];
  unreadAnnouncements: number;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  updateSettings: (updates: Partial<UserSettings>) => void;
  addJob: (job: BookJob) => void;
  updateJob: (id: string, updates: Partial<BookJob>) => void;
  removeJob: (id: string) => void;
  addLog: (jobId: string, log: JobLog) => void;
  markAnnouncementsRead: () => void;
  addAnnouncement: (announcement: Announcement) => void;
  removeAnnouncement: (id: string) => void;
  allUsers: User[];
  updateUser: (email: string, updates: Partial<User>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const TOKEN_KEY = "msk_auth_token";
const SETTINGS_KEY = "msk_settings";
const LAST_READ_KEY = "msk_last_ann_read";
const JOBS_CACHE_KEY = "msk_jobs_cache";
const ANNS_CACHE_KEY = "msk_anns_cache";

const DEFAULT_SETTINGS: UserSettings = {
  theme: "dark",
  defaultCopyright: "",
  memoryBank: "",
  autoDownload: false,
  defaultTones: [],
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [jobs, setJobs] = useState<BookJob[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [lastReadAt, setLastReadAt] = useState<number>(0);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const tokenRef = useRef<string | null>(null);

  const isApiAvailable = Boolean(process.env.EXPO_PUBLIC_API_BASE);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    const storedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
    if (storedSettings) setSettings(JSON.parse(storedSettings));
    const storedLastRead = await AsyncStorage.getItem(LAST_READ_KEY);
    if (storedLastRead) setLastReadAt(Number(storedLastRead));

    if (!isApiAvailable) {
      await loadFromLocalStorage();
      return;
    }

    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) {
      await loadCachedData();
      return;
    }

    setApiToken(token);
    tokenRef.current = token;

    try {
      const { user: me } = await authApi.me();
      setUser(me);
      setIsLoggedIn(true);
      await loadServerData();
    } catch {
      await AsyncStorage.removeItem(TOKEN_KEY);
      setApiToken(null);
      tokenRef.current = null;
      await loadCachedData();
    }
  };

  const loadServerData = async () => {
    try {
      const [{ jobs: serverJobs }, { announcements: serverAnns }] = await Promise.all([
        jobsApi.list(),
        announcementsApi.list(),
      ]);
      setJobs(serverJobs);
      setAnnouncements(serverAnns);
      await AsyncStorage.setItem(JOBS_CACHE_KEY, JSON.stringify(serverJobs));
      await AsyncStorage.setItem(ANNS_CACHE_KEY, JSON.stringify(serverAnns));
    } catch {
      await loadCachedData();
    }
  };

  const loadCachedData = async () => {
    const cachedJobs = await AsyncStorage.getItem(JOBS_CACHE_KEY);
    if (cachedJobs) setJobs(JSON.parse(cachedJobs));
    const cachedAnns = await AsyncStorage.getItem(ANNS_CACHE_KEY);
    if (cachedAnns) setAnnouncements(JSON.parse(cachedAnns));
  };

  const loadFromLocalStorage = async () => {
    const storedJobs = await AsyncStorage.getItem(JOBS_CACHE_KEY);
    if (storedJobs) setJobs(JSON.parse(storedJobs));
    const storedAnns = await AsyncStorage.getItem(ANNS_CACHE_KEY);
    if (storedAnns) setAnnouncements(JSON.parse(storedAnns));
    const storedUser = await AsyncStorage.getItem("msk_local_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsLoggedIn(true);
    }
  };

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (!isApiAvailable) {
      return localLogin(email, password);
    }
    try {
      const { token, user: u } = await authApi.login(email, password);
      setApiToken(token);
      tokenRef.current = token;
      await AsyncStorage.setItem(TOKEN_KEY, token);
      setUser(u);
      setIsLoggedIn(true);
      await loadServerData();
      if (u.isAdmin) {
        try {
          const { users } = await usersApi.list();
          setAllUsers(users);
        } catch {}
      }
      return true;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("pending") || msg.includes("approval")) {
        throw err;
      }
      return false;
    }
  }, [isApiAvailable]);

  const localLogin = async (email: string, password: string): Promise<boolean> => {
    const ADMIN_EMAIL = "macdondavid565@gmail.com";
    const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const stored = await AsyncStorage.getItem("msk_local_users");
    const users: { email: string; password: string; user: User }[] = stored ? JSON.parse(stored) : [];
    if (isAdmin) {
      const record = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const adminUser: User = {
        email: ADMIN_EMAIL,
        name: "Admin",
        isAdmin: true,
        isApproved: true,
        status: "approved",
        maxBooksPerMonth: 999999,
        booksGenerated: 0,
        createdAt: record?.user.createdAt ?? Date.now(),
      };
      if (!record) {
        const next = [...users, { email: ADMIN_EMAIL, password, user: adminUser }];
        await AsyncStorage.setItem("msk_local_users", JSON.stringify(next));
        setAllUsers(next.map((u) => u.user));
      } else if (record.password !== password) return false;
      setUser(adminUser);
      setIsLoggedIn(true);
      await AsyncStorage.setItem("msk_local_user", JSON.stringify(adminUser));
      return true;
    }
    const record = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!record || record.password !== password) return false;
    setUser(record.user);
    setIsLoggedIn(true);
    await AsyncStorage.setItem("msk_local_user", JSON.stringify(record.user));
    return true;
  };

  const register = useCallback(async (name: string, email: string, password: string): Promise<boolean> => {
    if (!isApiAvailable) {
      return localRegister(name, email, password);
    }
    try {
      const { token, user: u } = await authApi.register(name, email, password);
      setApiToken(token);
      tokenRef.current = token;
      await AsyncStorage.setItem(TOKEN_KEY, token);
      setUser(u);
      setIsLoggedIn(true);
      return true;
    } catch {
      return false;
    }
  }, [isApiAvailable]);

  const localRegister = async (name: string, email: string, password: string): Promise<boolean> => {
    const ADMIN_EMAIL = "macdondavid565@gmail.com";
    const stored = await AsyncStorage.getItem("msk_local_users");
    const users: { email: string; password: string; user: User }[] = stored ? JSON.parse(stored) : [];
    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) return false;
    const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const newUser: User = {
      email, name, isAdmin, isApproved: isAdmin,
      status: isAdmin ? "approved" : "pending",
      maxBooksPerMonth: isAdmin ? 999999 : 10,
      booksGenerated: 0, createdAt: Date.now(),
    };
    const next = [...users, { email, password, user: newUser }];
    await AsyncStorage.setItem("msk_local_users", JSON.stringify(next));
    setAllUsers(next.map((u) => u.user));
    setUser(newUser);
    setIsLoggedIn(true);
    await AsyncStorage.setItem("msk_local_user", JSON.stringify(newUser));
    return true;
  };

  const logout = useCallback(async () => {
    if (isApiAvailable && tokenRef.current) {
      try { await authApi.logout(); } catch {}
    }
    setApiToken(null);
    tokenRef.current = null;
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem("msk_local_user");
    setUser(null);
    setIsLoggedIn(false);
    setJobs([]);
    setAllUsers([]);
  }, [isApiAvailable]);

  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const syncJobToServer = useCallback((job: BookJob) => {
    if (!isApiAvailable || !tokenRef.current) return;
    jobsApi.upsert(job).catch(() => {});
  }, [isApiAvailable]);

  const addJob = useCallback((job: BookJob) => {
    setJobs((prev) => {
      const next = [job, ...prev];
      AsyncStorage.setItem(JOBS_CACHE_KEY, JSON.stringify(next));
      return next;
    });
    syncJobToServer(job);
  }, [syncJobToServer]);

  const updateJob = useCallback((id: string, updates: Partial<BookJob>) => {
    setJobs((prev) => {
      const next = prev.map((j) => (j.id === id ? { ...j, ...updates } : j));
      AsyncStorage.setItem(JOBS_CACHE_KEY, JSON.stringify(next));

      const shouldSync =
        isApiAvailable &&
        tokenRef.current &&
        (updates.status === "completed" ||
          updates.status === "failed" ||
          updates.chapterContents !== undefined ||
          updates.markdownContent !== undefined);

      if (shouldSync) {
        const updated = next.find((j) => j.id === id);
        if (updated) jobsApi.upsert(updated).catch(() => {});
      }
      return next;
    });
  }, [isApiAvailable]);

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => {
      const next = prev.filter((j) => j.id !== id);
      AsyncStorage.setItem(JOBS_CACHE_KEY, JSON.stringify(next));
      return next;
    });
    if (isApiAvailable && tokenRef.current) {
      jobsApi.remove(id).catch(() => {});
    }
  }, [isApiAvailable]);

  const addLog = useCallback((jobId: string, log: JobLog) => {
    setJobs((prev) => {
      const next = prev.map((j) =>
        j.id === jobId ? { ...j, logs: [...j.logs, log] } : j
      );
      AsyncStorage.setItem(JOBS_CACHE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const markAnnouncementsRead = useCallback(() => {
    const now = Date.now();
    setLastReadAt(now);
    AsyncStorage.setItem(LAST_READ_KEY, String(now));
  }, []);

  const addAnnouncement = useCallback((announcement: Announcement) => {
    setAnnouncements((prev) => {
      const next = [announcement, ...prev];
      AsyncStorage.setItem(ANNS_CACHE_KEY, JSON.stringify(next));
      return next;
    });
    if (isApiAvailable && tokenRef.current) {
      announcementsApi.add(announcement).catch(() => {});
    }
  }, [isApiAvailable]);

  const removeAnnouncement = useCallback((id: string) => {
    setAnnouncements((prev) => {
      const next = prev.filter((a) => a.id !== id);
      AsyncStorage.setItem(ANNS_CACHE_KEY, JSON.stringify(next));
      return next;
    });
    if (isApiAvailable && tokenRef.current) {
      announcementsApi.remove(id).catch(() => {});
    }
  }, [isApiAvailable]);

  const updateUser = useCallback(async (email: string, updates: Partial<User>): Promise<void> => {
    if (isApiAvailable && tokenRef.current) {
      const { user: updated } = await usersApi.update(email, updates);
      setAllUsers((prev) => prev.map((u) => (u.email === email ? updated : u)));
    } else {
      const stored = await AsyncStorage.getItem("msk_local_users");
      const users: { email: string; password: string; user: User }[] = stored ? JSON.parse(stored) : [];
      const next = users.map((u) =>
        u.email.toLowerCase() === email.toLowerCase()
          ? { ...u, user: { ...u.user, ...updates } }
          : u
      );
      await AsyncStorage.setItem("msk_local_users", JSON.stringify(next));
      setAllUsers(next.map((u) => u.user));
    }
  }, [isApiAvailable]);

  const loadAllUsers = useCallback(async () => {
    if (isApiAvailable && tokenRef.current && user?.isAdmin) {
      try {
        const { users } = await usersApi.list();
        setAllUsers(users);
      } catch {}
    }
  }, [isApiAvailable, user?.isAdmin]);

  useEffect(() => {
    if (isLoggedIn && user?.isAdmin) {
      loadAllUsers();
    }
  }, [isLoggedIn, user?.isAdmin, loadAllUsers]);

  const unreadAnnouncements = announcements.filter((a) => a.createdAt > lastReadAt).length;

  return (
    <AppContext.Provider
      value={{
        user,
        settings,
        jobs,
        announcements,
        unreadAnnouncements,
        isLoggedIn,
        login,
        logout,
        register,
        updateSettings,
        addJob,
        updateJob,
        removeJob,
        addLog,
        markAnnouncementsRead,
        addAnnouncement,
        removeAnnouncement,
        allUsers,
        updateUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
