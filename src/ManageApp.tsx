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
  saveGoal,
  saveMeasurementMeta,
  saveMeasurements,
  subscribePage,
} from "./lib/store";
import { computeGoalProgress } from "./lib/stats";
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
    if (FIREBASE_ENABLED && user && isOwner) {
      await ensurePageOwner(pageId, user.uid);
      await saveGoal(pageId, goal);
    } else {
      setPage((prev) => ({ ...prev, goal }));
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

  const progress = useMemo(
    () => computeGoalProgress(page.measurements, page.goal),
    [page.measurements, page.goal],
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

      <GoalCard progress={progress} />

      <div className="card">
        <h2>体重の推移</h2>
        <WeightChart
          measurements={page.measurements}
          goal={page.goal}
          startWeight={progress.startWeight}
          onPointClick={isOwner ? setEditingDate : undefined}
        />
      </div>

      <GoalEditor
        value={page.goal}
        onSave={handleGoalSave}
        disabled={FIREBASE_ENABLED ? !isOwner : false}
      />

      <Uploader
        onImport={handleImport}
        disabled={FIREBASE_ENABLED ? !isOwner : false}
      />

      <footer>
        <div>
          {page.measurements.length} 件の測定値
          {progress.latestDate && ` · 最終更新 ${progress.latestDate}`}
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
