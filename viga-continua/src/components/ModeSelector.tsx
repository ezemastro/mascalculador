/**
 * ModeSelector — segmented control for switching between the two analysis
 * modes offered by viga-continua: `Viga Continua` and `Pórtico`.
 *
 * The component is purely controlled: the parent owns the current `mode` and
 * decides what to do on `onChange`. Persistence is intentionally delegated —
 * the typical pattern is `mode === "portico" ? setSearchParams({ mode: "portico" }) : delete`.
 *
 * Token-only Tailwind (no inline colors) to match existing visual style.
 */

export type Mode = "viga-continua" | "portico";

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

const OPTIONS: ReadonlyArray<{ id: Mode; label: string }> = [
  { id: "viga-continua", label: "Viga Continua" },
  { id: "portico", label: "Pórtico" },
];

export default function ModeSelector({ mode, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Modo de análisis"
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
            onClick={() => onChange(opt.id)}
            className={
              "px-4 py-1.5 text-sm font-medium rounded-md transition-colors " +
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
