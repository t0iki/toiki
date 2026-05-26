import type { Goal, Measurement } from "../types";

export type GoalProgress = {
  hasGoal: boolean;
  startDate: string | null;
  endDate: string | null;
  targetKg: number;
  startWeight: number | null;
  latestWeight: number | null;
  latestDate: string | null;
  /** 現在体重 - 開始体重 (負なら減量できている) */
  delta: number | null;
  /** 目標まで残り kg (正なら残り、負なら超過達成) */
  remaining: number | null;
  totalDays: number;
  elapsedDays: number;
  daysLeft: number;
  /** 経過率 0..1 */
  periodProgress: number;
  /** ペースに乗っているか */
  onTrack: boolean | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeGoalProgress(
  measurements: Measurement[],
  goal: Goal | undefined,
  now: Date = new Date(),
): GoalProgress {
  if (!goal) {
    return emptyProgress();
  }
  const start = parseISODate(goal.startDate);
  const end = parseISODate(goal.endDate);
  if (!start || !end) {
    return emptyProgress();
  }

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  const elapsedRaw = Math.floor((now.getTime() - start.getTime()) / DAY_MS) + 1;
  const elapsedDays = Math.min(totalDays, Math.max(0, elapsedRaw));
  const daysLeft = Math.max(0, totalDays - elapsedDays);
  const periodProgress = elapsedDays / totalDays;

  const startWeight = pickStartWeight(measurements, goal.startDate);
  const latest = measurements.length > 0 ? measurements[measurements.length - 1]! : null;
  const latestWeight = latest?.weightKg ?? null;
  const latestDate = latest?.date ?? null;

  const delta =
    startWeight != null && latestWeight != null
      ? round1(latestWeight - startWeight)
      : null;

  // 目標は「減量量(正)」として持つ。delta が負(減った) で targetKg が正なら
  // 残り = targetKg + delta
  const remaining = delta != null ? round1(goal.targetKg + delta) : null;

  const expectedDelta = -goal.targetKg * periodProgress;
  const onTrack =
    delta != null && goal.targetKg > 0 ? delta <= expectedDelta : null;

  return {
    hasGoal: true,
    startDate: goal.startDate,
    endDate: goal.endDate,
    targetKg: goal.targetKg,
    startWeight,
    latestWeight,
    latestDate,
    delta,
    remaining,
    totalDays,
    elapsedDays,
    daysLeft,
    periodProgress,
    onTrack,
  };
}

function pickStartWeight(
  measurements: Measurement[],
  startDate: string,
): number | null {
  if (measurements.length === 0) return null;
  // 開始日以降で最初の測定値を採用
  const onOrAfter = measurements.find((m) => m.date >= startDate);
  if (onOrAfter) return onOrAfter.weightKg;
  // 期間が未来 → 直近の値で代用
  return measurements[measurements.length - 1]!.weightKg;
}

function parseISODate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function emptyProgress(): GoalProgress {
  return {
    hasGoal: false,
    startDate: null,
    endDate: null,
    targetKg: 0,
    startWeight: null,
    latestWeight: null,
    latestDate: null,
    delta: null,
    remaining: null,
    totalDays: 0,
    elapsedDays: 0,
    daysLeft: 0,
    periodProgress: 0,
    onTrack: null,
  };
}
