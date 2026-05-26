import type { GoalProgress } from "../lib/stats";

type Props = {
  progress: GoalProgress;
};

export function GoalCard({ progress }: Props) {
  if (!progress.hasGoal) {
    return (
      <div className="card">
        <h2>目標</h2>
        <div className="empty" style={{ padding: "12px 0" }}>
          目標が未設定です。
        </div>
      </div>
    );
  }
  const {
    startDate,
    endDate,
    targetKg,
    startWeight,
    latestWeight,
    delta,
    remaining,
    totalDays,
    elapsedDays,
    daysLeft,
    periodProgress,
    onTrack,
  } = progress;

  return (
    <div className="card">
      <h2>
        {startDate} 〜 {endDate} の進捗（目標 -{targetKg} kg）
      </h2>
      <div className="goal-grid">
        <Stat label="開始時体重" value={fmtKg(startWeight)} />
        <Stat label="現在体重" value={fmtKg(latestWeight)} />
        <Stat
          label="開始比"
          value={delta != null ? `${signed(delta)} kg` : "—"}
          tone={delta == null ? undefined : delta < 0 ? "ok" : "danger"}
        />
        <Stat
          label={`目標まで`}
          value={
            remaining == null
              ? "—"
              : remaining <= 0
                ? "達成!"
                : `あと ${remaining.toFixed(1)} kg`
          }
          tone={remaining == null ? undefined : remaining <= 0 ? "ok" : undefined}
        />
        <Stat
          label="経過"
          value={`${elapsedDays} / ${totalDays} 日 (${Math.round(periodProgress * 100)}%)`}
        />
        <Stat
          label="残り"
          value={daysLeft > 0 ? `${daysLeft} 日` : "締切到達"}
        />
        {onTrack === true && (
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
