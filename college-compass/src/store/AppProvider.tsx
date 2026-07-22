"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SEED_COLLEGES } from "@/data/seed-colleges";
import { SEED_STUDENT } from "@/data/seed-student";
import {
  clearLocal,
  loadLocal,
  loadRemote,
  saveLocal,
  saveRemoteProfile,
  syncRemoteCollections,
} from "@/lib/storage";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import type {
  ApplicationTask,
  College,
  SavedCollege,
  Scholarship,
  StudentProfile,
  TaskStatus,
} from "@/lib/types";
import { MAX_COMPARE } from "@/lib/types";

interface AppState {
  ready: boolean;
  guestMode: boolean;
  supabaseAvailable: boolean;
  userEmail: string | null;
  profile: StudentProfile;
  colleges: College[]; // seed + fetched, deduped by id (live never overwritten by sample)
  saved: SavedCollege[];
  tasks: ApplicationTask[];
  compareIds: string[];
  scholarships: Scholarship[];
  updateProfile: (patch: Partial<StudentProfile>) => void;
  addColleges: (incoming: College[]) => void;
  getCollege: (id: string) => College | undefined;
  isSaved: (id: string) => boolean;
  toggleSaved: (college: College) => void;
  updateSaved: (collegeId: string, patch: Partial<SavedCollege>) => void;
  toggleCompare: (id: string) => void;
  updateTask: (id: string, patch: Partial<ApplicationTask>) => void;
  addScholarship: (s: Omit<Scholarship, "id" | "isSample">) => void;
  updateScholarship: (id: string, patch: Partial<Scholarship>) => void;
  removeScholarship: (id: string) => void;
  signOut: () => Promise<void>;
  resetAll: () => void;
}

const Ctx = createContext<AppState | null>(null);

const TASK_TEMPLATE: { key: string; title: string }[] = [
  { key: "application", title: "Submit application" },
  { key: "fee", title: "Pay application fee or request waiver" },
  { key: "essay", title: "Personal essay" },
  { key: "supplemental_essays", title: "Supplemental essays" },
  { key: "transcript", title: "Send official transcript" },
  { key: "counselor", title: "Counselor report" },
  { key: "recommendations", title: "Teacher recommendations" },
  { key: "test_scores", title: "Send test scores (if applying with scores)" },
  { key: "portfolio", title: "Portfolio or audition (if applicable)" },
  { key: "interview", title: "Interview (if offered)" },
  { key: "fafsa", title: "File FAFSA" },
  { key: "css", title: "File CSS Profile (if required)" },
  { key: "scholarships", title: "Scholarship applications" },
];

function tasksForCollege(college: College): ApplicationTask[] {
  const regular = college.deadlines.find((d) => d.plan === "regular")?.dueDate ?? null;
  const fafsa = college.deadlines.find((d) => d.plan === "fafsa")?.dueDate ?? null;
  const css = college.deadlines.find((d) => d.plan === "css")?.dueDate ?? null;
  const reqKeys = new Set(college.requirements.map((r) => r.key));
  return TASK_TEMPLATE.map((t) => {
    const optionalNotListed =
      college.requirements.length > 0 &&
      !reqKeys.has(t.key) &&
      ["supplemental_essays", "portfolio", "interview", "css", "counselor", "recommendations"].includes(t.key);
    return {
      id: `${college.id}-${t.key}`,
      collegeId: college.id,
      taskKey: t.key,
      title: t.title,
      status: (optionalNotListed ? "n_a" : "not_started") as TaskStatus,
      dueDate: t.key === "fafsa" ? fafsa ?? regular : t.key === "css" ? css : regular,
      note: "",
      sourceUrl: college.admissionsUrl ?? college.website,
    };
  });
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfile>(SEED_STUDENT);
  const [fetched, setFetched] = useState<College[]>([]);
  const [saved, setSaved] = useState<SavedCollege[]>([]);
  const [tasks, setTasks] = useState<ApplicationTask[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const remoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colleges = useMemo(() => {
    const map = new Map<string, College>();
    for (const c of SEED_COLLEGES) map.set(c.id, c);
    for (const c of fetched) map.set(c.id, c); // live data never merged into sample records
    return Array.from(map.values());
  }, [fetched]);

  // ── Boot: auth session → remote load, else local guest state ──
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      // Restore cached live-college records first so saved/compare ids resolve
      // for both guests and signed-in users.
      const cached = loadLocal();
      if (cached?.pinnedColleges?.length && !cancelled) {
        setFetched(cached.pinnedColleges);
      }
      const sb = getSupabase();
      if (sb) {
        const { data } = await sb.auth.getSession();
        const session = data.session;
        if (session && !cancelled) {
          setUserId(session.user.id);
          setUserEmail(session.user.email ?? null);
          const remote = await loadRemote(session.user.id);
          if (remote && !cancelled) {
            if (remote.profile) setProfile(remote.profile);
            setSaved(remote.saved ?? []);
            setTasks(remote.tasks ?? []);
            setCompareIds(remote.compareIds ?? []);
            if (remote.scholarships?.length) setScholarships(remote.scholarships);
          }
          setReady(true);
          return;
        }
      }
      const local = loadLocal();
      if (local && !cancelled) {
        if (local.profile) setProfile(local.profile);
        setSaved(local.saved);
        setTasks(local.tasks);
        setCompareIds(local.compareIds);
        if (local.scholarships?.length) setScholarships(local.scholarships);
      }
      setReady(true);
    }
    boot();
    const sb = getSupabase();
    const sub = sb?.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
      setUserEmail(session?.user.email ?? null);
    });
    return () => {
      cancelled = true;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  // ── Reconcile: drop saved/compare ids whose college record can't be
  //    resolved (e.g. compared in an old session before records were cached),
  //    so counts always match what's actually on screen. ──
  useEffect(() => {
    if (!ready) return;
    const known = new Set(colleges.map((c) => c.id));
    setCompareIds((prev) => (prev.every((id) => known.has(id)) ? prev : prev.filter((id) => known.has(id))));
    setSaved((prev) => (prev.every((s) => known.has(s.collegeId)) ? prev : prev.filter((s) => known.has(s.collegeId))));
    setTasks((prev) => (prev.every((t) => known.has(t.collegeId)) ? prev : prev.filter((t) => known.has(t.collegeId))));
  }, [ready, colleges]);

  // ── Persist on change (local always; remote debounced when signed in) ──
  useEffect(() => {
    if (!ready) return;
    const pinnedIds = new Set<string>([...compareIds, ...saved.map((s) => s.collegeId)]);
    const pinnedColleges = colleges.filter((c) => pinnedIds.has(c.id) && !c.isSample);
    saveLocal({ profile, saved, tasks, compareIds, scholarships, pinnedColleges });
    if (userId) {
      if (remoteTimer.current) clearTimeout(remoteTimer.current);
      remoteTimer.current = setTimeout(() => {
        saveRemoteProfile(userId, profile).catch(() => {});
        syncRemoteCollections(userId, { saved, tasks, compareIds, scholarships, pinnedColleges }).catch(() => {});
      }, 1200);
    }
  }, [ready, userId, profile, saved, tasks, compareIds, scholarships, colleges]);

  const updateProfile = useCallback((patch: Partial<StudentProfile>) => {
    setProfile((p) => ({ ...p, ...patch, isSample: false }));
  }, []);

  const addColleges = useCallback((incoming: College[]) => {
    setFetched((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      for (const c of incoming) map.set(c.id, c);
      return Array.from(map.values());
    });
  }, []);

  const getCollege = useCallback(
    (id: string) => colleges.find((c) => c.id === id),
    [colleges],
  );

  const isSaved = useCallback(
    (id: string) => saved.some((s) => s.collegeId === id),
    [saved],
  );

  const toggleSaved = useCallback((college: College) => {
    // Register the record first so a college saved from outside the loaded
    // catalog (e.g. the advisor's nationwide scan) resolves and isn't pruned.
    if (!college.isSample) {
      setFetched((prev) => (prev.some((f) => f.id === college.id) ? prev : [...prev, college]));
    }
    setSaved((prev) => {
      if (prev.some((s) => s.collegeId === college.id)) {
        setTasks((t) => t.filter((task) => task.collegeId !== college.id));
        return prev.filter((s) => s.collegeId !== college.id);
      }
      setTasks((t) => [...t, ...tasksForCollege(college)]);
      return [
        ...prev,
        { collegeId: college.id, applicationPlan: null, notes: "", savedAt: new Date().toISOString() },
      ];
    });
  }, []);

  const updateSaved = useCallback((collegeId: string, patch: Partial<SavedCollege>) => {
    setSaved((prev) => prev.map((s) => (s.collegeId === collegeId ? { ...s, ...patch } : s)));
  }, []);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev; // hard cap
      return [...prev, id];
    });
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<ApplicationTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const addScholarship = useCallback((s: Omit<Scholarship, "id" | "isSample">) => {
    setScholarships((prev) => [
      ...prev,
      { ...s, id: `sch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, isSample: false },
    ]);
  }, []);

  const updateScholarship = useCallback((id: string, patch: Partial<Scholarship>) => {
    setScholarships((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const removeScholarship = useCallback((id: string) => {
    setScholarships((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
    setUserId(null);
    setUserEmail(null);
  }, []);

  const resetAll = useCallback(() => {
    clearLocal();
    setProfile(SEED_STUDENT);
    setSaved([]);
    setTasks([]);
    setCompareIds([]);
    setScholarships([]);
  }, []);

  const value: AppState = {
    ready,
    guestMode: !supabaseConfigured() || !userId,
    supabaseAvailable: supabaseConfigured(),
    userEmail,
    profile,
    colleges,
    saved,
    tasks,
    compareIds,
    scholarships,
    updateProfile,
    addColleges,
    getCollege,
    isSaved,
    toggleSaved,
    updateSaved,
    toggleCompare,
    updateTask,
    addScholarship,
    updateScholarship,
    removeScholarship,
    signOut,
    resetAll,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
