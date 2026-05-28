import { useEffect, useState } from "react";
import { LABEL_DEFS } from "../lib/labels";
import type { Running } from "../types";

type Props = {
  date: string;
  initialLabels: string[];
  initialNote: string;
  initialRunning: Running | null;
  onSave: (data: {
    labels: string[];
    note: string;
    running: Running | null;
  }) => void | Promise<void>;
  onClose: () => void;
};

export function LabelEditor({
  date,
  initialLabels,
  initialNote,
  initialRunning,
  onSave,
  onClose,
}: Props) {
  const [labels, setLabels] = useState<string[]>(initialLabels);
  const [note, setNote] = useState<string>(initialNote);
  const [distance, setDistance] = useState<string>(
    initialRunning ? String(initialRunning.distanceKm) : "",
  );
  const [duration, setDuration] = useState<string>(
    initialRunning?.durationMin != null
      ? String(initialRunning.durationMin)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(id: string) {
    setLabels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    setErr(null);
    let running: Running | null = null;
    if (distance.trim() !== "") {
      const km = Number(distance);
      if (!Number.isFinite(km) || km < 0) {
        setErr("距離は 0 以上の数値で");
        return;
      }
      running = { distanceKm: km };
      if (duration.trim() !== "") {
        const min = Number(duration);
        if (!Number.isFinite(min) || min < 0) {
          setErr("時間は 0 以上の分数で");
          return;
        }
        running.durationMin = min;
      }
    } else if (duration.trim() !== "") {
      setErr("距離も入れてください");
      return;
    }

    setSaving(true);
    try {
      await onSave({ labels, note, running });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{date}</h3>
          <button className="ghost icon" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="modal-section">
          <div className="modal-section-label">ラベル</div>
          <div className="label-grid">
            {LABEL_DEFS.map((def) => {
              const active = labels.includes(def.id);
              return (
                <button
                  key={def.id}
                  type="button"
                  className={`label-chip${active ? " active" : ""}`}
                  onClick={() => toggle(def.id)}
                >
                  <span className="emoji">{def.emoji}</span>
                  <span>{def.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-section-label">ランニング</div>
          <div className="running-fields">
            <label>
              <span>距離 (km)</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              <span>時間 (分)</span>
              <input
                type="number"
                step="1"
                min="0"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="任意"
              />
            </label>
          </div>
        </div>

        <div className="modal-section">
          <label className="modal-section-label" htmlFor="note">
            メモ
          </label>
          <input
            id="note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="一言メモ"
            style={{ width: "100%", marginTop: 4 }}
            maxLength={200}
          />
        </div>

        {err && <div className="error" style={{ marginTop: 12 }}>{err}</div>}
        <div className="modal-footer">
          <button className="ghost" onClick={onClose} disabled={saving}>
            キャンセル
          </button>
          <button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
