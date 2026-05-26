import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getFirebase } from "../firebase";
import type { Goal, Measurement, PageData } from "../types";

export function pageDocPath(pageId: string) {
  return ["pages", pageId] as const;
}

function readGoal(data: Record<string, unknown> | undefined): Goal | undefined {
  if (!data) return undefined;
  const g = data.goal as Partial<Goal> | undefined;
  if (
    g &&
    typeof g.startDate === "string" &&
    typeof g.endDate === "string" &&
    typeof g.targetKg === "number"
  ) {
    return { startDate: g.startDate, endDate: g.endDate, targetKg: g.targetKg };
  }
  return undefined;
}

export async function fetchPage(pageId: string): Promise<PageData | null> {
  const fb = getFirebase();
  if (!fb) return null;
  const pageRef = doc(fb.db, ...pageDocPath(pageId));
  const snap = await getDoc(pageRef);

  let ownerUid: string | undefined;
  let goal: Goal | undefined;
  if (snap.exists()) {
    const data = snap.data() as Record<string, unknown>;
    ownerUid = data.ownerUid as string | undefined;
    goal = readGoal(data);
  }

  const measurementsSnap = await getDocs(
    collection(fb.db, ...pageDocPath(pageId), "measurements"),
  );
  const measurements: Measurement[] = measurementsSnap.docs
    .map((d) => d.data() as Measurement)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return { pageId, ownerUid, goal, measurements };
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
        goal: readGoal(data),
      };
    } else {
      pageData = { ...pageData, ownerUid: undefined, goal: undefined };
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

export async function saveGoal(pageId: string, goal: Goal): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase is not configured");
  await setDoc(
    doc(fb.db, ...pageDocPath(pageId)),
    { goal, updatedAt: serverTimestamp() },
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

export async function saveMeasurementLabels(
  pageId: string,
  date: string,
  labels: string[],
): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase is not configured");
  const ref = doc(fb.db, ...pageDocPath(pageId), "measurements", date);
  await setDoc(ref, { date, labels }, { merge: true });
}
