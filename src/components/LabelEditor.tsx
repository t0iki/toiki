import { useEffect, useState } from "react";
import { LABEL_DEFS } from "../lib/labels";

type Props = {
  date: string;
  initialLabels: string[];
  onSave: (labels: string[]) => void | Promise<void>;
  onClose: () => void;
};

export function LabelEditor({ date, initialLabels, onSave, onClose }: Props) {
  const [labels, setLabels] = useState<string[]>(initialLabels);
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
    setSaving(true);
    try {
      await onSave(labels);
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
          <h3>{date} のラベル</h3>
          <button className="ghost icon" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
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
