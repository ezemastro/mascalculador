/**
 * DiagramModeToggle — selector de modo para PorticoDiagram.
 *
 * Tabs: Geometría / Deformada / Normales / Momentos / Corte.
 * Patrón visual mirror del EnvToggle (segmented control).
 */

import type { DiagramMode } from "./PorticoDiagram";

const OPTIONS: ReadonlyArray<{ id: DiagramMode; label: string }> = [
  { id: "geometria", label: "Geometría" },
  { id: "deformada", label: "Deformada" },
  { id: "normales", label: "Normales" },
  { id: "momentos", label: "Momentos" },
  { id: "corte", label: "Corte" },
];

export default function DiagramModeToggle({
  mode,
  setMode,
}: {
  mode: DiagramMode;
  setMode: (m: DiagramMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Modo de diagrama"
      className="inline-flex p-1 bg-surface-alt rounded-lg"
    >
      {OPTIONS.map((opt) => {
        const active = opt.id === mode;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setMode(opt.id)}
            className={
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors " +
              (active
                ? "bg-primary text-white shadow-sm"
                : "text-text-muted hover:text-text")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
