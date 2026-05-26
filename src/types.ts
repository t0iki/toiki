export type Measurement = {
  /** YYYY-MM-DD */
  date: string;
  weightKg: number;
  bodyFatPct?: number;
  bmi?: number;
  muscleKg?: number;
  bmrKcal?: number;
  visceralFatLevel?: number;
  boneKg?: number;
  /** "外食" / "チートデー" 等のタグ id */
  labels?: string[];
  /** 一言メモ */
  note?: string;
};

export type Goal = {
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** 期間内に減らしたい kg (正の値) */
  targetKg: number;
};

export type PageData = {
  pageId: string;
  ownerUid?: string;
  goal?: Goal;
  measurements: Measurement[];
};
