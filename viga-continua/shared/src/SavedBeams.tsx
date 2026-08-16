/* eslint-disable react-hooks/set-state-in-effect -- baseline: refactor to useSyncExternalStore tracked in follow-up */
import { useState, useEffect } from "react";
import { listSaves, deleteSave, type SavedBeam, type App } from "./storage";

interface Props {
  app: App;
  type:
    | "acero"
    | "hormigon"
    | "bases"
    | "columna"
    | "cartel"
    | "losa"
    | "rc-columna"
    | "portico"
    | "viga-continua";
  onLoad: (data: Record<string, unknown>, save: SavedBeam) => void;
  onDelete?: (id: string) => void;
  label?: string;
}

/**
 * Compact one-line summary for a pórtico save. PR1 ships label + node/bar
 * counts only; full portico-render (editor pre-population, previews) lands in
 * PR3 alongside `PorticoForm`.
 */
function porticoSummary(
  data: Record<string, unknown>,
): { nodes: number; bars: number } | null {
  const input = data.input as { nodes?: unknown; bars?: unknown } | undefined;
  if (!input) return null;
  return {
    nodes: Array.isArray(input.nodes) ? input.nodes.length : 0,
    bars: Array.isArray(input.bars) ? input.bars.length : 0,
  };
}

/**
 * Compact one-line summary for a viga-continua save. The form persists
 * `{ input: { spans, supportTypes, loads, ... } }`, so the chip mirrors the
 * portico pattern (span/tramo and load counts).
 */
function vigaContinuaSummary(
  data: Record<string, unknown>,
): { spans: number; loads: number } | null {
  const input = data.input as { spans?: unknown; loads?: unknown } | undefined;
  if (!input) return null;
  return {
    spans: Array.isArray(input.spans) ? input.spans.length : 0,
    loads: Array.isArray(input.loads) ? input.loads.length : 0,
  };
}

export default function SavedBeams({
  app,
  type,
  onLoad,
  onDelete,
  label,
}: Props) {
  // eslint-disable react-hooks/set-state-in-effect -- baseline: refactor to useSyncExternalStore tracked in follow-up; setSaves() + setOpen() chain through event handlers too
  const [saves, setSaves] = useState<SavedBeam[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSaves(listSaves(app).filter((s) => s.type === type));
  }, [open, type, app]);

  function handleLoad(save: SavedBeam) {
    onLoad(save.data, save);
    setOpen(false);
  }

  function handleDelete(id: string) {
    if (onDelete) {
      onDelete(id);
    }
    deleteSave(app, id);
    setSaves((prev) => prev.filter((s) => s.id !== id));
  }

  const items = saves.filter((s) => s.type === type);
  const heading = label ?? "Vigas guardadas";

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-sm font-semibold text-text-muted uppercase tracking-wider w-full text-left"
      >
        {open ? "▼" : "▶"} {heading} ({items.length})
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {items.length === 0 && (
            <p className="text-xs text-text-muted">
              No hay {heading.toLowerCase()}.
            </p>
          )}
          {items.map((s) => {
            const porticoData =
              s.type === "portico" ? porticoSummary(s.data) : null;
            const vigaData =
              s.type === "viga-continua" ? vigaContinuaSummary(s.data) : null;
            return (
              <div
                key={s.id}
                className="flex items-center gap-2 p-2 bg-surface-alt rounded-lg"
              >
                <span className="text-sm flex-1">{s.name}</span>
                {porticoData && (
                  <span className="text-xs text-text-muted">
                    Pórtico · Nodos: {porticoData.nodes}, Barras:{" "}
                    {porticoData.bars}
                  </span>
                )}
                {vigaData && (
                  <span className="text-xs text-text-muted">
                    Viga · Tramos: {vigaData.spans}, Cargas: {vigaData.loads}
                  </span>
                )}
                <span className="text-xs text-text-muted">{s.date}</span>
                <button
                  type="button"
                  onClick={() => handleLoad(s)}
                  className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                >
                  Cargar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(s.id)}
                  className="text-xs bg-danger/10 text-danger px-2 py-1 rounded"
                >
                  Eliminar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
