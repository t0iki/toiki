import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { getLabelDef } from "../lib/labels";
import type { Goal, Measurement } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

type Props = {
  measurements: Measurement[];
  goal?: Goal;
  startWeight?: number | null;
  onPointClick?: (date: string) => void;
};

type Row = {
  date: string;
  weightKg?: number;
  idealWeight?: number;
  labels?: string[];
  bodyFatPct?: number;
  bmi?: number;
  muscleKg?: number;
  bmrKcal?: number;
  visceralFatLevel?: number;
  boneKg?: number;
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
  goal: Goal | undefined,
  startWeight: number | null | undefined,
): Row[] {
  const byDate = new Map(measurements.map((m) => [m.date, m]));

  if (goal) {
    const start = parseISO(goal.startDate);
    const end = parseISO(goal.endDate);
    if (start && end && end >= start) {
      const totalDays = Math.max(
        1,
        Math.round((end.getTime() - start.getTime()) / DAY_MS),
      );
      const rows: Row[] = [];
      for (let i = 0; i <= totalDays; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const dateStr = isoDate(d);
        const m = byDate.get(dateStr);
        const ideal =
          startWeight != null
            ? startWeight - goal.targetKg * (i / totalDays)
            : undefined;
        rows.push({
          date: dateStr,
          weightKg: m?.weightKg,
          idealWeight: ideal,
          labels: m?.labels,
          bodyFatPct: m?.bodyFatPct,
          bmi: m?.bmi,
          muscleKg: m?.muscleKg,
          bmrKcal: m?.bmrKcal,
          visceralFatLevel: m?.visceralFatLevel,
          boneKg: m?.boneKg,
        });
      }
      return rows;
    }
  }

  // 目標が無い、または期間が壊れている場合は測定日だけプロット
  return measurements.map((m) => ({
    date: m.date,
    weightKg: m.weightKg,
    labels: m.labels,
    bodyFatPct: m.bodyFatPct,
    bmi: m.bmi,
    muscleKg: m.muscleKg,
    bmrKcal: m.bmrKcal,
    visceralFatLevel: m.visceralFatLevel,
    boneKg: m.boneKg,
  }));
}

export function WeightChart({
  measurements,
  goal,
  startWeight,
  onPointClick,
}: Props) {
  const data = buildRows(measurements, goal, startWeight ?? null);

  if (data.length === 0 || measurements.length === 0) {
    return (
      <div className="empty">CSV をアップロードするとここにグラフが出ます。</div>
    );
  }

  const numeric: number[] = data.flatMap((r) => {
    const list: number[] = [];
    if (typeof r.weightKg === "number") list.push(r.weightKg);
    if (typeof r.idealWeight === "number") list.push(r.idealWeight);
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
          {/* 理想ペース線 */}
          <Line
            type="linear"
            dataKey="idealWeight"
            stroke="rgba(10,10,10,0.35)"
            strokeWidth={1}
            strokeDasharray="3 4"
            dot={false}
            activeDot={false}
            connectNulls
            isAnimationActive={false}
          />
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

  return (
    <g
      style={{ cursor: clickable ? "pointer" : "default" }}
      onClick={clickable ? () => onPointClick!(payload.date) : undefined}
    >
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={labels.length > 0 ? 3.5 : 2.5}
        fill="#0a0a0a"
      />
      {labels.map((id, i) => {
        const def = getLabelDef(id);
        if (!def) return null;
        return (
          <text
            key={id}
            x={cx}
            y={cy - 12 - i * 16}
            textAnchor="middle"
            fontSize={14}
            style={{ userSelect: "none" }}
          >
            {def.emoji}
          </text>
        );
      })}
    </g>
  );
}

function DetailTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]!.payload as Row;
  if (row.weightKg == null && row.idealWeight == null) return null;
  const rows: { label: string; value: string | undefined; unit?: string }[] = [];
  if (row.weightKg != null)
    rows.push({ label: "体重", value: fmt(row.weightKg, 1), unit: "kg" });
  if (row.idealWeight != null)
    rows.push({
      label: "ペース",
      value: fmt(row.idealWeight, 1),
      unit: "kg",
    });
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
    </div>
  );
}

function fmt(n: number | undefined, digits: number): string | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  return n.toFixed(digits);
}
