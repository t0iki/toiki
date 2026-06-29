import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getFirebase } from "../firebase";
import type { Goal, Measurement, PageData, Running } from "../types";

export function pageDocPath(pageId: string) {
  return ["pages", pageId] as const;
}

function normalizeGoal(g: Partial<Goal> | undefined): Goal | undefined {
  if (
    g &&
    typeof g.startDate === "string" &&
    typeof g.endDate === "string" &&
    typeof g.targetKg === "number"
  ) {
    const goal = {
      id: typeof g.id === "string" && g.id !== "" ? g.id : undefined,
      startDate: g.startDate,
      endDate: g.endDate,
      targetKg: g.targetKg,
    };
    return { ...goal, id: goal.id ?? stableGoalId(goal) };
  }
  return undefined;
}

function stableGoalId(goal: Pick<Goal, "startDate" | "endDate" | "targetKg">) {
  return `goal-${goalSignature(goal)}`
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-");
}

function goalSignature(goal: Pick<Goal, "startDate" | "endDate" | "targetKg">) {
  return `${goal.startDate}-${goal.endDate}-${goal.targetKg}`;
}

function sortGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
    if (a.endDate !== b.endDate) return a.endDate < b.endDate ? -1 : 1;
    return a.targetKg - b.targetKg;
  });
}

function dedupeGoals(goals: Goal[]): Goal[] {
  const byId = new Map<string, Goal>();
  const seenSignatures = new Set<string>();
  for (const goal of goals) {
    const signature = goalSignature(goal);
    if (seenSignatures.has(signature)) continue;
    seenSignatures.add(signature);
    byId.set(goal.id ?? stableGoalId(goal), goal);
  }
  return sortGoals(Array.from(byId.values()));
}

function readGoals(data: Record<string, unknown> | undefined): Goal[] {
  if (!data) return [];
  const goals = Array.isArray(data.goals)
    ? data.goals
        .map((g) => normalizeGoal(g as Partial<Goal> | undefined))
        .filter((g): g is Goal => Boolean(g))
    : [];
  const legacyGoal = normalizeGoal(data.goal as Partial<Goal> | undefined);
  return dedupeGoals(legacyGoal ? [...goals, legacyGoal] : goals);
}

function latestGoal(goals: Goal[]): Goal | undefined {
  return goals.length > 0 ? goals[goals.length - 1] : undefined;
}

export async function fetchPage(pageId: string): Promise<PageData | null> {
  const fb = getFirebase();
  if (!fb) return null;
  const pageRef = doc(fb.db, ...pageDocPath(pageId));
  const snap = await getDoc(pageRef);

  let ownerUid: string | undefined;
  let goals: Goal[] = [];
  if (snap.exists()) {
    const data = snap.data() as Record<string, unknown>;
    ownerUid = data.ownerUid as string | undefined;
    goals = readGoals(data);
  }

  const measurementsSnap = await getDocs(
    collection(fb.db, ...pageDocPath(pageId), "measurements"),
  );
  const measurements: Measurement[] = measurementsSnap.docs
    .map((d) => d.data() as Measurement)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return { pageId, ownerUid, goals, goal: latestGoal(goals), measurements };
}

export function subscribePage(
  pageId: string,
  cb: (page: PageData) => void,
): () => void {
  const fb = getFirebase();
  if (!fb) return () => {};
  const pageRef = doc(fb.db, ...pageDocPath(pageId));
  const measurementsCol = collection(
    fb.db,
    ...pageDocPath(pageId),
    "measurements",
  );

  let pageData: PageData = {
    pageId,
    measurements: [],
  };
  let pageLoaded = false;
  let measurementsLoaded = false;

  const emit = () => {
    if (pageLoaded && measurementsLoaded) cb(pageData);
  };

  const unsubPage = onSnapshot(pageRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data() as Record<string, unknown>;
      pageData = {
        ...pageData,
        ownerUid: data.ownerUid as string | undefined,
        goals: readGoals(data),
      };
      pageData = { ...pageData, goal: latestGoal(pageData.goals ?? []) };
    } else {
      pageData = {
        ...pageData,
        ownerUid: undefined,
        goals: [],
        goal: undefined,
      };
    }
    pageLoaded = true;
    emit();
  });

  const unsubMeasurements = onSnapshot(measurementsCol, (snap) => {
    const measurements: Measurement[] = snap.docs
      .map((d) => d.data() as Measurement)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    pageData = { ...pageData, measurements };
    measurementsLoaded = true;
    emit();
  });

  return () => {
    unsubPage();
    unsubMeasurements();
  };
}

export async function ensurePageOwner(
  pageId: string,
  uid: string,
): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase is not configured");
  const pageRef = doc(fb.db, ...pageDocPath(pageId));
  const snap = await getDoc(pageRef);
  if (!snap.exists()) {
    await setDoc(pageRef, {
      ownerUid: uid,
      updatedAt: serverTimestamp(),
    });
  }
}

export async function saveGoals(pageId: string, goals: Goal[]): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase is not configured");
  const normalized = dedupeGoals(
    goals.map((goal) => ({ ...goal, id: goal.id ?? stableGoalId(goal) })),
  );
  const latest = latestGoal(normalized);
  await setDoc(
    doc(fb.db, ...pageDocPath(pageId)),
    {
      goals: normalized,
      goal: latest ?? deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveMeasurements(
  pageId: string,
  measurements: Measurement[],
): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase is not configured");
  for (let i = 0; i < measurements.length; i += 400) {
    const batch = writeBatch(fb.db);
    const chunk = measurements.slice(i, i + 400);
    for (const m of chunk) {
      const ref = doc(fb.db, ...pageDocPath(pageId), "measurements", m.date);
      // merge: true で既存の labels 等を保持
      batch.set(ref, m, { merge: true });
    }
    await batch.commit();
  }
}

export async function saveMeasurementMeta(
  pageId: string,
  date: string,
  meta: { labels: string[]; note: string; running: Running | null },
): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase is not configured");
  const ref = doc(fb.db, ...pageDocPath(pageId), "measurements", date);
  const trimmed = meta.note.trim();
  const payload: Record<string, unknown> = {
    date,
    labels: meta.labels,
    note: trimmed === "" ? deleteField() : trimmed,
    running: meta.running == null ? deleteField() : meta.running,
  };
  await setDoc(ref, payload, { merge: true });
}
