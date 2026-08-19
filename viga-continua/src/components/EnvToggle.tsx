/**
 * EnvToggle — selector Envolvente / Servicio compartido por beam y pórtico.
 *
 * Componente puro y controlado. El padre guarda `envMode` en estado y
 * decide qué `setEnvMode` hacer. Por defecto arrancamos en
 * `"envolvente"` (R-beam-env-toggle, R-portico-env-toggle-shared).
 *
 * Token-only Tailwind (sin colores inline) — matchea el patrón visual
 * del `ModeSelector` (PR1). Sólo dos opciones en español.
 */

export type EnvMode = "envolvente" | "servicio";

interface Props {
  envMode: EnvMode;
  setEnvMode: (m: EnvMode) => void;
}

const OPTIONS: ReadonlyArray<{ id: EnvMode; label: string }> = [
  { id: "envolvente", label: "Envolvente" },
  { id: "servicio", label: "Estado de servicio" },
];

export default function EnvToggle({ envMode, setEnvMode }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Modo de cálculo"
      className="inline-flex p-1 bg-surface-alt rounded-lg"
    >
      {OPTIONS.map((opt) => {
        const active = opt.id === envMode;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setEnvMode(opt.id)}
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
