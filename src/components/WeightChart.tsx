import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { getLabelDef } from "../lib/labels";
import type { GoalProgress } from "../lib/stats";
import type { Goal, Measurement, Running } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

type Props = {
  measurements: Measurement[];
  goals?: Goal[];
  progresses?: GoalProgress[];
  onPointClick?: (date: string) => void;
};

type Row = {
  date: string;
  weightKg?: number;
  goalPaces?: { label: string; value: number }[];
  goalTargets?: { label: string; value: number }[];
  labels?: string[];
  note?: string;
  running?: Running;
  bodyFatPct?: number;
  bmi?: number;
  muscleKg?: number;
  bmrKcal?: number;
  visceralFatLevel?: number;
  boneKg?: number;
} & {
  [key: `idealWeight${number}`]: number | undefined;
  [key: `idealConnector${number}`]: number | undefined;
  [key: `targetWeight${number}`]: number | undefined;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISO(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildRows(
  measurements: Measurement[],
  goals: Goal[],
  progresses: GoalProgress[],
): Row[] {
  const byDate = new Map(measurements.map((m) => [m.date, m]));
  const dates = [
    ...measurements.map((m) => m.date),
    ...goals.flatMap((goal) => [goal.startDate, goal.endDate]),
  ];

  if (dates.length === 0) return [];
  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));
  const start = parseISO(minDate);
  const end = parseISO(maxDate);
  if (!start || !end || end < start) return [];

  const connectors = buildGoalConnectors(goals, progresses);

  const totalDays = Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / DAY_MS),
  );
  const rows: Row[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = isoDate(d);
    const m = byDate.get(dateStr);
    const row: Row = {
      date: dateStr,
      weightKg: m?.weightKg,
      labels: m?.labels,
      note: m?.note,
      running: m?.running,
      bodyFatPct: m?.bodyFatPct,
      bmi: m?.bmi,
      muscleKg: m?.muscleKg,
      bmrKcal: m?.bmrKcal,
      visceralFatLevel: m?.visceralFatLevel,
      boneKg: m?.boneKg,
    };
    goals.forEach((goal, index) => {
      const progress = progresses[index];
      if (dateStr < goal.startDate || dateStr > goal.endDate) return;
      const value = idealValueForDate(goal, progress, d);
      if (value != null) {
        const key = idealKey(index);
        row[key] = value;
        row.goalPaces = [
          ...(row.goalPaces ?? []),
          { label: `${index + 1}つ目の目標ペース`, value },
        ];
      }
      if (progress?.targetWeight != null) {
        const key = targetKey(index);
        row[key] = progress.targetWeight;
        row.goalTargets = [
          ...(row.goalTargets ?? []),
          { label: `${index + 1}つ目の目標体重`, value: progress.targetWeight },
        ];
      }
    });
    connectors.forEach((connector) => {
      if (dateStr === connector.startDate) {
        row[connector.key] = connector.startValue;
      }
      if (dateStr === connector.endDate) {
        row[connector.key] = connector.endValue;
      }
    });
    rows.push(row);
  }
  return rows;
}

type GoalConnector = {
  key: `idealConnector${number}`;
  startDate: string;
  endDate: string;
  startValue: number;
  endValue: number;
};

function buildGoalConnectors(
  goals: Goal[],
  progresses: GoalProgress[],
): GoalConnector[] {
  const connectors: GoalConnector[] = [];
  for (let index = 0; index < goals.length - 1; index += 1) {
    const currentGoal = goals[index]!;
    const nextGoal = goals[index + 1]!;
    const currentEnd = parseISO(currentGoal.endDate);
    const nextStart = parseISO(nextGoal.startDate);
    if (!currentEnd || !nextStart) continue;
    const diffMs = nextStart.getTime() - currentEnd.getTime();
    if (diffMs < 0 || diffMs > DAY_MS) continue;

    const startValue = idealValueForDate(
      currentGoal,
      progresses[index],
      currentEnd,
    );
    const endValue = idealValueForDate(
      nextGoal,
      progresses[index + 1],
      nextStart,
    );
    if (startValue == null || endValue == null) continue;
    connectors.push({
      key: connectorKey(index),
      startDate: currentGoal.endDate,
      endDate: nextGoal.startDate,
      startValue,
      endValue,
    });
  }
  return connectors;
}

function idealValueForDate(
  goal: Goal,
  progress: GoalProgress | undefined,
  date: Date,
): number | null {
  const goalStart = parseISO(goal.startDate);
  const goalEnd = parseISO(goal.endDate);
  if (!goalStart || !goalEnd || goalEnd < goalStart) return null;
  if (progress?.startWeight == null) return null;
  const goalTotalDays = Math.max(
    1,
    Math.round((goalEnd.getTime() - goalStart.getTime()) / DAY_MS),
  );
  const goalElapsedDays = Math.round(
    (date.getTime() - goalStart.getTime()) / DAY_MS,
  );
  return progress.startWeight - goal.targetKg * (goalElapsedDays / goalTotalDays);
}

export function WeightChart({
  measurements,
  goals = [],
  progresses = [],
  onPointClick,
}: Props) {
  const data = buildRows(measurements, goals, progresses);

  if (data.length === 0 || measurements.length === 0) {
    return (
      <div className="empty">CSV をアップロードするとここにグラフが出ます。</div>
    );
  }

  const numeric: number[] = data.flatMap((r) => {
    const list: number[] = [];
    if (typeof r.weightKg === "number") list.push(r.weightKg);
    goals.forEach((_, index) => {
      const value = r[idealKey(index)];
      if (typeof value === "number") list.push(value);
      const connectorValue = r[connectorKey(index)];
      if (typeof connectorValue === "number") list.push(connectorValue);
      const targetValue = r[targetKey(index)];
      if (typeof targetValue === "number") list.push(targetValue);
    });
    return list;
  });
  const min = Math.floor(Math.min(...numeric) - 0.5);
  const max = Math.ceil(Math.max(...numeric) + 0.5);

  return (
    <div style={{ width: "100%", height: 360 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid
            stroke="rgba(10,10,10,0.08)"
            strokeDasharray="0"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            stroke="rgba(10,10,10,0.35)"
            tick={{ fontSize: 10, fill: "#6e6c64" }}
            tickLine={false}
            axisLine={{ stroke: "rgba(10,10,10,0.2)" }}
            minTickGap={32}
            tickFormatter={(v: string) =>
              v.length >= 10 ? `${Number(v.substring(5, 7))}/${Number(v.substring(8, 10))}` : v
            }
          />
          <YAxis
            stroke="rgba(10,10,10,0.35)"
            tick={{ fontSize: 10, fill: "#6e6c64" }}
            tickLine={false}
            axisLine={false}
            domain={[min, max]}
            width={36}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            content={<DetailTooltip />}
            cursor={{ stroke: "rgba(10,10,10,0.2)", strokeDasharray: "2 4" }}
          />
          {progresses.map((progress) =>
            progress.achieved && progress.startDate && progress.endDate ? (
              <ReferenceArea
                key={`achieved-${progress.goalId ?? progress.startDate}`}
                x1={progress.startDate}
                x2={progress.endDate}
                fill="#dff3e4"
                fillOpacity={0.7}
                strokeOpacity={0}
              />
            ) : null,
          )}
          {goals.map((goal, index) => (
            <Line
              key={`target-${goal.id ?? `${goal.startDate}-${goal.endDate}`}`}
              type="linear"
              dataKey={targetKey(index)}
              stroke="#dc2626"
              strokeWidth={1.75}
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          {goals.map((goal, index) => (
            <Line
              key={goal.id ?? `${goal.startDate}-${goal.endDate}`}
              type="linear"
              dataKey={idealKey(index)}
              stroke={progresses[index]?.achieved ? "#177245" : "rgba(10,10,10,0.35)"}
              strokeWidth={1}
              strokeDasharray="3 4"
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          {goals.slice(0, -1).map((goal, index) => (
            <Line
              key={`connector-${goal.id ?? `${goal.startDate}-${goal.endDate}`}`}
              type="linear"
              dataKey={connectorKey(index)}
              stroke={progresses[index + 1]?.achieved ? "#177245" : "rgba(10,10,10,0.35)"}
              strokeWidth={1}
              strokeDasharray="3 4"
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
          {/* 実体重 */}
          <Line
            type="monotone"
            dataKey="weightKg"
            stroke="#0a0a0a"
            strokeWidth={1.5}
            dot={(props: DotProps) => (
              <CustomDot {...props} onPointClick={onPointClick} />
            )}
            activeDot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type DotProps = {
  cx?: number;
  cy?: number;
  payload?: Row;
  key?: string | number;
  index?: number;
};

function idealKey(index: number): `idealWeight${number}` {
  return `idealWeight${index}`;
}

function connectorKey(index: number): `idealConnector${number}` {
  return `idealConnector${index}`;
}

function targetKey(index: number): `targetWeight${number}` {
  return `targetWeight${index}`;
}

function CustomDot({
  cx,
  cy,
  payload,
  onPointClick,
}: DotProps & { onPointClick?: (date: string) => void }) {
  if (cx == null || cy == null || !payload || payload.weightKg == null) {
    return <g />;
  }
  const labels = payload.labels ?? [];
  const clickable = Boolean(onPointClick);
  const badges: { key: string; emoji: string }[] = [];
  labels.forEach((id) => {
    const def = getLabelDef(id);
    if (def) badges.push({ key: `l-${id}`, emoji: def.emoji });
  });
  if (payload.running) badges.push({ key: "run", emoji: "🏃" });

  return (
    <g
      style={{ cursor: clickable ? "pointer" : "default" }}
      onClick={clickable ? () => onPointClick!(payload.date) : undefined}
    >
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={badges.length > 0 ? 3.5 : 2.5}
        fill="#0a0a0a"
      />
      {badges.map((b, i) => (
        <text
          key={b.key}
          x={cx}
          y={cy - 12 - i * 16}
          textAnchor="middle"
          fontSize={14}
          style={{ userSelect: "none" }}
        >
          {b.emoji}
        </text>
      ))}
    </g>
  );
}

function DetailTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]!.payload as Row;
  const rows: { label: string; value: string | undefined; unit?: string }[] = [];
  if (row.weightKg != null)
    rows.push({ label: "体重", value: fmt(row.weightKg, 1), unit: "kg" });
  row.goalPaces?.forEach((pace) =>
    rows.push({
      label: pace.label,
      value: fmt(pace.value, 1),
      unit: "kg",
    }),
  );
  row.goalTargets?.forEach((target) =>
    rows.push({
      label: target.label,
      value: fmt(target.value, 1),
      unit: "kg",
    }),
  );
  if (rows.length === 0) return null;
  if (row.bodyFatPct != null)
    rows.push({ label: "体脂肪率", value: fmt(row.bodyFatPct, 1), unit: "%" });
  if (row.bmi != null) rows.push({ label: "BMI", value: fmt(row.bmi, 1) });
  if (row.muscleKg != null)
    rows.push({ label: "筋肉量", value: fmt(row.muscleKg, 1), unit: "kg" });
  if (row.bmrKcal != null)
    rows.push({ label: "基礎代謝", value: fmt(row.bmrKcal, 0), unit: "kcal" });
  if (row.visceralFatLevel != null)
    rows.push({ label: "内臓脂肪", value: fmt(row.visceralFatLevel, 0) });
  if (row.boneKg != null)
    rows.push({ label: "推定骨量", value: fmt(row.boneKg, 1), unit: "kg" });

  const labels = row.labels ?? [];

  return (
    <div className="tooltip">
      <div className="tooltip-date">{row.date}</div>
      {rows.map((r) => (
        <div className="tooltip-row" key={r.label}>
          <span className="label">{r.label}</span>
          <span>
            {r.value}
            {r.unit ? ` ${r.unit}` : ""}
          </span>
        </div>
      ))}
      {row.running && (
        <div className="tooltip-row" style={{ marginTop: 6 }}>
          <span className="label">🏃 ランニング</span>
          <span>{formatRunning(row.running)}</span>
        </div>
      )}
      {labels.length > 0 && (
        <div className="tooltip-row" style={{ marginTop: 6 }}>
          <span className="label">ラベル</span>
          <span>
            {labels
              .map((id) => {
                const def = getLabelDef(id);
                return def ? `${def.emoji} ${def.name}` : id;
              })
              .join(" / ")}
          </span>
        </div>
      )}
      {row.note && (
        <div className="tooltip-note">{row.note}</div>
      )}
    </div>
  );
}

function fmt(n: number | undefined, digits: number): string | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  return n.toFixed(digits);
}

function formatRunning(r: Running): string {
  const parts = [`${r.distanceKm.toFixed(2)} km`];
  if (r.durationMin != null) {
    const total = r.durationMin;
    const h = Math.floor(total / 60);
    const m = Math.round(total - h * 60);
    parts.push(h > 0 ? `${h}h${m}m` : `${m}分`);
    if (r.distanceKm > 0) {
      const paceMinPerKm = total / r.distanceKm;
      const paceMin = Math.floor(paceMinPerKm);
      const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
      parts.push(`${paceMin}'${String(paceSec).padStart(2, "0")}"/km`);
    }
  }
  return parts.join(" · ");
}
