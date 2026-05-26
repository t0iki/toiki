import Papa from "papaparse";
import type { Measurement } from "../types";

/**
 * Omron connect の CSV エクスポート列名のゆらぎを吸収するためのキー候補。
 * 実 CSV が手に入ったらここを直す前提。
 */
const FIELD_ALIASES: Record<
  keyof Omit<Measurement, "date" | "labels">,
  string[]
> = {
  weightKg: ["体重(kg)", "体重", "Weight(kg)", "Weight", "weight"],
  bodyFatPct: [
    "体脂肪(%)",
    "体脂肪率(%)",
    "体脂肪率",
    "Body Fat(%)",
    "BodyFat(%)",
  ],
  bmi: ["BMI", "bmi"],
  muscleKg: [
    "骨格筋量(kg)",
    "骨格筋率(%)",
    "筋肉量(kg)",
    "Muscle Mass(kg)",
    "SkeletalMuscle(%)",
  ],
  bmrKcal: ["基礎代謝(kcal)", "基礎代謝量(kcal)", "BMR(kcal)", "BMR"],
  visceralFatLevel: ["内臓脂肪レベル", "Visceral Fat Level", "VisceralFat"],
  boneKg: ["推定骨量(kg)", "骨量(kg)", "Bone Mass(kg)"],
};

const DATE_KEYS = [
  "日時",
  "測定日時",
  "測定日",
  "日付",
  "date",
  "Date",
  "DateTime",
  "Measurement Date",
];

function normalizeHeader(h: string): string {
  return h.replace(/﻿/g, "").trim();
}

function pickValue(
  row: Record<string, string>,
  candidates: string[],
): string | undefined {
  for (const key of candidates) {
    const exact = row[key];
    if (exact != null && exact !== "") return exact;
  }
  // ヘッダの末尾の単位やスペース揺らぎを吸収（緩い一致）
  const lower = candidates.map((c) => c.toLowerCase().replace(/\s+/g, ""));
  for (const [k, v] of Object.entries(row)) {
    const nk = k.toLowerCase().replace(/\s+/g, "");
    if (lower.some((c) => nk === c)) return v;
  }
  return undefined;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // ありそうなフォーマット:
  //  2025/05/26, 2025-05-26, 2025/05/26 07:23, 2025-05-26T07:23:00, 2025/5/26
  const m = trimmed.match(
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2}))?/,
  );
  if (!m) {
    // Date コンストラクタにフォールバック
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${y}-${mo}-${da}`;
    }
    return null;
  }
  const [, y, mo, da] = m;
  return `${y}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}`;
}

function parseNumber(raw: string | undefined): number | undefined {
  if (raw == null || raw === "") return undefined;
  const cleaned = raw.replace(/[, ]/g, "").replace(/[^\d.+\-eE]/g, "");
  if (cleaned === "") return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

export type CsvParseResult = {
  measurements: Measurement[];
  skippedRows: number;
  detectedColumns: string[];
};

export async function parseOmronCsv(file: File): Promise<CsvParseResult> {
  const text = await readAsTextWithFallback(file);
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  });

  const detectedColumns = parsed.meta.fields ?? [];

  const byDate = new Map<string, Measurement>();
  let skipped = 0;

  for (const row of parsed.data) {
    const dateRaw = pickValue(row, DATE_KEYS);
    const date = dateRaw ? parseDate(dateRaw) : null;
    const weight = parseNumber(pickValue(row, FIELD_ALIASES.weightKg));
    if (!date || weight == null) {
      skipped += 1;
      continue;
    }
    const m: Measurement = {
      date,
      weightKg: weight,
      bodyFatPct: parseNumber(pickValue(row, FIELD_ALIASES.bodyFatPct)),
      bmi: parseNumber(pickValue(row, FIELD_ALIASES.bmi)),
      muscleKg: parseNumber(pickValue(row, FIELD_ALIASES.muscleKg)),
      bmrKcal: parseNumber(pickValue(row, FIELD_ALIASES.bmrKcal)),
      visceralFatLevel: parseNumber(
        pickValue(row, FIELD_ALIASES.visceralFatLevel),
      ),
      boneKg: parseNumber(pickValue(row, FIELD_ALIASES.boneKg)),
    };
    // 同一日付は後勝ち（CSV は通常古い順なので、最新の測定が残る想定）
    byDate.set(date, m);
  }

  const measurements = Array.from(byDate.values()).sort((a, b) =>
    a.date < b.date ? -1 : 1,
  );

  return { measurements, skippedRows: skipped, detectedColumns };
}

async function readAsTextWithFallback(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  if (looksGarbled(utf8)) {
    try {
      const sjis = new TextDecoder("shift_jis", { fatal: false }).decode(buf);
      return sjis;
    } catch {
      return utf8;
    }
  }
  return utf8;
}

function looksGarbled(text: string): boolean {
  // UTF-8 で読んだ結果に U+FFFD が一定数含まれていれば文字化けの可能性が高い
  const sampled = text.slice(0, 2000);
  const replacements = (sampled.match(/�/g) ?? []).length;
  return replacements > 3;
}
