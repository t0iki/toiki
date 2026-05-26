import { useState } from "react";
import { parseOmronCsv } from "../lib/csv";
import type { Measurement } from "../types";

type Props = {
  onImport: (measurements: Measurement[]) => void | Promise<void>;
  disabled?: boolean;
};

export function Uploader({ onImport, disabled }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setStatus("読み込み中...");
    try {
      const result = await parseOmronCsv(file);
      if (result.measurements.length === 0) {
        setError(
          `CSV から測定値を取り出せませんでした。検出した列: ${result.detectedColumns.join(", ") || "(なし)"}`,
        );
        setStatus(null);
        return;
      }
      await onImport(result.measurements);
      const skipNote =
        result.skippedRows > 0 ? ` (${result.skippedRows} 行はスキップ)` : "";
      setStatus(`${result.measurements.length} 件を取り込みました${skipNote}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    }
  }

  return (
    <div className="card">
      <h2>CSV インポート</h2>
      <div className="uploader">
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={disabled}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) await handleFile(f);
            e.target.value = "";
          }}
        />
        <span className="hint">
          Omron connect のエクスポート CSV を選択
        </span>
      </div>
      {status && <div className="hint" style={{ marginTop: 8 }}>{status}</div>}
      {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
      {disabled && (
        <div className="hint" style={{ marginTop: 8 }}>
          ログインすると Firestore に保存できます。未ログインの場合はこのブラウザだけで一時的に表示します。
        </div>
      )}
    </div>
  );
}
