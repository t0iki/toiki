import { useEffect, useState } from "react";
import type { Goal } from "../types";

type Props = {
  value?: Goal;
  onSave: (v: Goal) => void | Promise<void>;
  disabled?: boolean;
  title?: string;
  submitLabel?: string;
};

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export function GoalEditor({
  value,
  onSave,
  disabled,
  title = "目標期間",
  submitLabel = "保存",
}: Props) {
  const [startDate, setStartDate] = useState(value?.startDate ?? today());
  const [endDate, setEndDate] = useState(
    value?.endDate ?? addDays(today(), 30),
  );
  const [targetKg, setTargetKg] = useState(String(value?.targetKg ?? 2));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (value) {
      setStartDate(value.startDate);
      setEndDate(value.endDate);
      setTargetKg(String(value.targetKg));
    }
  }, [value]);

  return (
    <div className="card">
      <h2>{title}</h2>
      <div className="goal-editor" style={{ flexWrap: "wrap" }}>
        <label>
          <span>開始</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={disabled || saving}
          />
        </label>
        <label>
          <span>締切</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={disabled || saving}
          />
        </label>
        <label>
          <span>減量目標 (kg)</span>
          <input
            type="number"
            step="0.1"
            min="0"
            value={targetKg}
            onChange={(e) => setTargetKg(e.target.value)}
            disabled={disabled || saving}
            style={{ width: 96 }}
          />
        </label>
        <button
          disabled={disabled || saving}
          onClick={async () => {
            const kg = Number(targetKg);
            if (!Number.isFinite(kg) || kg < 0) {
              setErr("減量目標は 0 以上の数値で");
              return;
            }
            if (!startDate || !endDate) {
              setErr("開始日と締切を入れてください");
              return;
            }
            if (endDate < startDate) {
              setErr("締切は開始日以降にしてください");
              return;
            }
            setErr(null);
            setSaving(true);
            try {
              await onSave({ startDate, endDate, targetKg: kg });
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e));
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "保存中..." : submitLabel}
        </button>
        {disabled && (
          <span className="hint" style={{ color: "var(--muted)", fontSize: 11, letterSpacing: "0.1em" }}>
            ログインすると編集できます
          </span>
        )}
      </div>
      {err && <div className="error" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  );
}
