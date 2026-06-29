import type { GoalProgress } from "../lib/stats";

type Props = {
  progresses: GoalProgress[];
};

export function GoalCard({ progresses }: Props) {
  const visible = progresses
    .filter((progress) => progress.hasGoal)
    .sort(compareNewestFirst);
  if (visible.length === 0) {
    return (
      <div className="card">
        <h2>目標</h2>
        <div className="empty" style={{ padding: "12px 0" }}>
          目標が未設定です。
        </div>
      </div>
    );
  }
  const latest = visible[0]!;
  const past = visible.slice(1);

  return (
    <div className="goal-cards">
      <GoalProgressCard progress={latest} />
      {past.length > 0 && (
        <details className="past-goals">
          <summary>過去の目標 {past.length}件</summary>
          <div className="goal-cards">
            {past.map((progress) => (
              <GoalProgressCard
                key={progress.goalId ?? `${progress.startDate}-${progress.endDate}`}
                progress={progress}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function compareNewestFirst(a: GoalProgress, b: GoalProgress): number {
  const aEnd = a.endDate ?? "";
  const bEnd = b.endDate ?? "";
  if (aEnd !== bEnd) return aEnd > bEnd ? -1 : 1;
  const aStart = a.startDate ?? "";
  const bStart = b.startDate ?? "";
  if (aStart !== bStart) return aStart > bStart ? -1 : 1;
  return 0;
}

function GoalProgressCard({ progress }: { progress: GoalProgress }) {
  const {
    startDate,
    endDate,
    targetKg,
    targetWeight,
    startWeight,
    latestWeight,
    bestWeight,
    achieved,
    achievedDate,
    achievedWeight,
    delta,
    remaining,
    totalDays,
    elapsedDays,
    periodProgress,
    onTrack,
  } = progress;

  return (
    <div className={`card goal-card${achieved ? " achieved" : ""}`}>
      <div className="goal-card-heading">
        <h2>
          {startDate} 〜 {endDate} の進捗（目標 -{targetKg} kg）
        </h2>
        {achieved && <span className="goal-badge">達成</span>}
      </div>
      <div className="goal-grid">
        <Stat label="開始時体重" value={fmtKg(startWeight)} />
        <Stat label="目標体重" value={fmtKg(targetWeight)} />
        <Stat label="期間内最終" value={fmtKg(latestWeight)} />
        <Stat label="期間内最小" value={fmtKg(bestWeight)} tone={achieved ? "ok" : undefined} />
        <Stat
          label="開始比"
          value={delta != null ? `${signed(delta)} kg` : "—"}
          tone={delta == null ? undefined : delta < 0 ? "ok" : "danger"}
        />
        <Stat
          label="目標まで"
          value={
            achieved
              ? achievedWeight != null
                ? `${achievedDate} に 達成(${achievedWeight.toFixed(1)} kg)`
                : "達成!"
              : remaining == null
                ? "—"
                : `あと ${remaining.toFixed(1)} kg`
          }
          tone={achieved ? "ok" : undefined}
        />
        <Stat
          label="経過"
          value={`${elapsedDays} / ${totalDays} 日 (${Math.round(periodProgress * 100)}%)`}
        />
        {onTrack === true && !achieved && (
          <Stat label="ペース" value="On track" tone="ok" />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "danger";
}) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span className={`value${tone ? ` ${tone}` : ""}`}>{value}</span>
    </div>
  );
}

function fmtKg(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toFixed(1)} kg`;
}

function signed(n: number): string {
  if (n > 0) return `+${n.toFixed(1)}`;
  return n.toFixed(1);
}
