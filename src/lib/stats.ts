import type { Goal, Measurement } from "../types";

export type GoalProgress = {
  hasGoal: boolean;
  goalId: string | null;
  startDate: string | null;
  endDate: string | null;
  targetKg: number;
  targetWeight: number | null;
  startWeight: number | null;
  latestWeight: number | null;
  latestDate: string | null;
  bestWeight: number | null;
  achieved: boolean;
  achievedDate: string | null;
  achievedWeight: number | null;
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

export function computeGoalProgresses(
  measurements: Measurement[],
  goals: Goal[] | undefined,
  now: Date = new Date(),
): GoalProgress[] {
  return (goals ?? []).map((goal) =>
    computeGoalProgress(measurements, goal, now),
  );
}

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

  const periodMeasurements = measurements.filter(
    (m) => m.date >= goal.startDate && m.date <= goal.endDate,
  );
  const startWeight = pickStartWeight(measurements, goal, now);
  const latest =
    periodMeasurements.length > 0
      ? periodMeasurements[periodMeasurements.length - 1]!
      : goal.startDate > isoDate(now) && measurements.length > 0
        ? measurements[measurements.length - 1]!
        : null;
  const latestWeight = latest?.weightKg ?? null;
  const latestDate = latest?.date ?? null;
  const targetWeight =
    startWeight != null ? round1(startWeight - goal.targetKg) : null;
  const best = pickBestWeight(periodMeasurements);
  const bestWeight = best?.weightKg ?? null;
  const achievedMeasurement =
    targetWeight == null
      ? null
      : periodMeasurements.find((m) => m.weightKg <= targetWeight) ?? null;

  const delta =
    startWeight != null && latestWeight != null
      ? round1(latestWeight - startWeight)
      : null;

  const weightForRemaining = bestWeight ?? latestWeight;
  const remaining =
    targetWeight != null && weightForRemaining != null
      ? round1(weightForRemaining - targetWeight)
      : null;

  const expectedDelta = -goal.targetKg * periodProgress;
  const onTrack =
    delta != null && goal.targetKg > 0 ? delta <= expectedDelta : null;

  return {
    hasGoal: true,
    goalId: goal.id ?? null,
    startDate: goal.startDate,
    endDate: goal.endDate,
    targetKg: goal.targetKg,
    targetWeight,
    startWeight,
    latestWeight,
    latestDate,
    bestWeight,
    achieved: Boolean(achievedMeasurement),
    achievedDate: achievedMeasurement?.date ?? null,
    achievedWeight: achievedMeasurement?.weightKg ?? null,
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
  goal: Goal,
  now: Date,
): number | null {
  if (measurements.length === 0) return null;
  // 期間内で最初の測定値を採用
  const onOrAfter = measurements.find(
    (m) => m.date >= goal.startDate && m.date <= goal.endDate,
  );
  if (onOrAfter) return onOrAfter.weightKg;
  // 期間が未来 → 直近の値で代用
  if (goal.startDate > isoDate(now)) {
    return measurements[measurements.length - 1]!.weightKg;
  }
  return null;
}

function pickBestWeight(measurements: Measurement[]): Measurement | null {
  if (measurements.length === 0) return null;
  return measurements.reduce((best, current) =>
    current.weightKg < best.weightKg ? current : best,
  );
}

function parseISODate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function emptyProgress(): GoalProgress {
  return {
    hasGoal: false,
    goalId: null,
    startDate: null,
    endDate: null,
    targetKg: 0,
    targetWeight: null,
    startWeight: null,
    latestWeight: null,
    latestDate: null,
    bestWeight: null,
    achieved: false,
    achievedDate: null,
    achievedWeight: null,
    delta: null,
    remaining: null,
    totalDays: 0,
    elapsedDays: 0,
    daysLeft: 0,
    periodProgress: 0,
    onTrack: null,
  };
}
