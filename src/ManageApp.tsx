import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PAGE_ID,
  FIREBASE_ENABLED,
  signInWithGoogle,
  signOutAll,
  watchAuth,
} from "./firebase";
import {
  ensurePageOwner,
  saveGoals,
  saveMeasurementMeta,
  saveMeasurements,
  subscribePage,
} from "./lib/store";
import { computeGoalProgresses } from "./lib/stats";
import { GoalCard } from "./components/GoalCard";
import { GoalEditor } from "./components/GoalEditor";
import { LabelEditor } from "./components/LabelEditor";
import { Uploader } from "./components/Uploader";
import { WeightChart } from "./components/WeightChart";
import type { Goal, Measurement, PageData, Running } from "./types";
import type { User } from "firebase/auth";

export default function ManageApp() {
  const pageId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("page") ?? DEFAULT_PAGE_ID;
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!FIREBASE_ENABLED);
  const [page, setPage] = useState<PageData>({
    pageId,
    measurements: [],
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);

  useEffect(() => {
    if (!FIREBASE_ENABLED) return;
    return watchAuth((u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!FIREBASE_ENABLED) return;
    return subscribePage(pageId, setPage);
  }, [pageId]);

  const isOwner = Boolean(
    FIREBASE_ENABLED && user && (!page.ownerUid || page.ownerUid === user.uid),
  );
  const goals = useMemo(
    () => page.goals ?? (page.goal ? [page.goal] : []),
    [page.goals, page.goal],
  );

  async function handleImport(measurements: Measurement[]) {
    if (FIREBASE_ENABLED && user && isOwner) {
      await ensurePageOwner(pageId, user.uid);
      await saveMeasurements(pageId, measurements);
    } else {
      setPage((prev) => ({
        ...prev,
        measurements: mergeMeasurements(prev.measurements, measurements),
      }));
    }
  }

  async function handleGoalSave(goal: Goal) {
    const nextGoals = [...goals, { ...goal, id: createGoalId() }];
    if (FIREBASE_ENABLED && user && isOwner) {
      await ensurePageOwner(pageId, user.uid);
      await saveGoals(pageId, nextGoals);
    } else {
      setPage((prev) => ({
        ...prev,
        goals: nextGoals,
        goal: nextGoals[nextGoals.length - 1],
      }));
    }
  }

  async function handleDaySave(
    date: string,
    data: { labels: string[]; note: string; running: Running | null },
  ) {
    if (FIREBASE_ENABLED && user && isOwner) {
      await saveMeasurementMeta(pageId, date, data);
    } else {
      const noteValue = data.note.trim() === "" ? undefined : data.note.trim();
      const runningValue = data.running ?? undefined;
      setPage((prev) => ({
        ...prev,
        measurements: prev.measurements.map((m) =>
          m.date === date
            ? { ...m, labels: data.labels, note: noteValue, running: runningValue }
            : m,
        ),
      }));
    }
  }

  const progresses = useMemo(
    () => computeGoalProgresses(page.measurements, goals),
    [page.measurements, goals],
  );
  const latestMeasurement = page.measurements[page.measurements.length - 1];
  const nextGoalDraft = useMemo(
    () => buildNextGoalDraft(goals),
    [goals],
  );

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>目標達成できなかったらハーフマラソンダイエット</h1>
          <div className="sub">
            <a href="/">閲覧ページへ戻る</a>
          </div>
        </div>
        <div>
          {!FIREBASE_ENABLED ? (
            <span className="sub">Firebase 未設定（ローカル表示のみ）</span>
          ) : !authReady ? (
            <span className="sub">…</span>
          ) : user ? (
            <button
              className="ghost"
              onClick={() => {
                setAuthError(null);
                signOutAll().catch((e) =>
                  setAuthError(e instanceof Error ? e.message : String(e)),
                );
              }}
            >
              {user.displayName ?? user.email ?? "サインアウト"}
            </button>
          ) : (
            <button
              onClick={() => {
                setAuthError(null);
                signInWithGoogle().catch((e) =>
                  setAuthError(e instanceof Error ? e.message : String(e)),
                );
              }}
            >
              Google でログイン
            </button>
          )}
        </div>
      </header>

      {authError && (
        <div className="error" style={{ marginBottom: 12 }}>
          {authError}
        </div>
      )}

      <GoalCard progresses={progresses} />

      <div className="card">
        <h2>体重の推移</h2>
        <WeightChart
          measurements={page.measurements}
          goals={goals}
          progresses={progresses}
          onPointClick={isOwner ? setEditingDate : undefined}
        />
      </div>

      <GoalEditor
        key={`${nextGoalDraft.startDate}-${nextGoalDraft.endDate}-${nextGoalDraft.targetKg}`}
        value={nextGoalDraft}
        onSave={handleGoalSave}
        disabled={FIREBASE_ENABLED ? !isOwner : false}
        title="次の目標を追加"
        submitLabel="追加"
      />

      <Uploader
        onImport={handleImport}
        disabled={FIREBASE_ENABLED ? !isOwner : false}
      />

      <footer>
        <div>
          {page.measurements.length} 件の測定値
          {latestMeasurement?.date && ` · 最終更新 ${latestMeasurement.date}`}
        </div>
      </footer>

      {editingDate && (() => {
        const m = page.measurements.find((x) => x.date === editingDate);
        return (
          <LabelEditor
            date={editingDate}
            initialLabels={m?.labels ?? []}
            initialNote={m?.note ?? ""}
            initialRunning={m?.running ?? null}
            onSave={(data) => handleDaySave(editingDate, data)}
            onClose={() => setEditingDate(null)}
          />
        );
      })()}
    </div>
  );
}

function buildNextGoalDraft(goals: Goal[]): Goal {
  const latest = goals[goals.length - 1];
  const todayDate = today();
  const nextStartDate = latest ? addDays(latest.endDate, 1) : todayDate;
  const startDate = nextStartDate < todayDate ? todayDate : nextStartDate;
  return {
    startDate,
    endDate: addDays(startDate, 30),
    targetKg: latest?.targetKg ?? 2,
  };
}

function createGoalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `goal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function today(): string {
  const d = new Date();
  return isoDate(d);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function mergeMeasurements(
  current: Measurement[],
  incoming: Measurement[],
): Measurement[] {
  const byDate = new Map<string, Measurement>();
  for (const m of current) byDate.set(m.date, m);
  for (const m of incoming) byDate.set(m.date, m);
  return Array.from(byDate.values()).sort((a, b) =>
    a.date < b.date ? -1 : 1,
  );
}
