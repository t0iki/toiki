import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PAGE_ID, FIREBASE_ENABLED } from "./firebase";
import { subscribePage } from "./lib/store";
import { computeGoalProgresses } from "./lib/stats";
import { GoalCard } from "./components/GoalCard";
import { WeightChart } from "./components/WeightChart";
import type { PageData } from "./types";

export default function ViewerApp() {
  const pageId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("page") ?? DEFAULT_PAGE_ID;
  }, []);

  const [page, setPage] = useState<PageData>({
    pageId,
    measurements: [],
  });

  useEffect(() => {
    if (!FIREBASE_ENABLED) return;
    return subscribePage(pageId, setPage);
  }, [pageId]);

  const goals = useMemo(
    () => page.goals ?? (page.goal ? [page.goal] : []),
    [page.goals, page.goal],
  );
  const progresses = useMemo(
    () => computeGoalProgresses(page.measurements, goals),
    [page.measurements, goals],
  );
  const latestMeasurement = page.measurements[page.measurements.length - 1];

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>目標達成できなかったらハーフマラソンダイエット</h1>
        </div>
      </header>

      <GoalCard progresses={progresses} />

      <div className="card">
        <h2>体重の推移</h2>
        <WeightChart
          measurements={page.measurements}
          goals={goals}
          progresses={progresses}
        />
      </div>

      <footer>
        <div>
          {page.measurements.length} 件の測定値
          {latestMeasurement?.date && ` · 最終更新 ${latestMeasurement.date}`}
        </div>
      </footer>
    </div>
  );
}
