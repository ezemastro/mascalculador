import { useState } from "react";
import type { EnvMode } from "./EnvToggle";

export type BeamPrintGraphic = "corte" | "momento";
export type PorticoPrintGraphic =
  | "geometria"
  | "deformada"
  | "normales"
  | "momentos"
  | "corte";

const beamOptions: Array<[BeamPrintGraphic, string]> = [
  ["corte", "Corte"],
  ["momento", "Momento"],
];
const porticoOptions: Array<[PorticoPrintGraphic, string]> = [
  ["geometria", "Geometría"],
  ["deformada", "Deformada"],
  ["normales", "Normales"],
  ["momentos", "Momentos"],
  ["corte", "Corte"],
];

const envModeOptions: Array<{ id: EnvMode; label: string }> = [
  { id: "envolvente", label: "Envolvente (U = 1.2D + 1.6L)" },
  { id: "servicio", label: "Servicio (D + L sin mayorar)" },
];

export type PrintSelectionValue = {
  kind: "beam" | "portico";
  graphics: string[];
  envMode: EnvMode;
};

export default function PrintSelection({
  kind,
  onPrint,
  onCancel,
  defaultEnvMode = "envolvente",
}: {
  kind: "beam" | "portico";
  onPrint: (selection: PrintSelectionValue) => void;
  onCancel: () => void;
  defaultEnvMode?: EnvMode;
}) {
  const options = kind === "beam" ? beamOptions : porticoOptions;
  const [selected, setSelected] = useState<string[]>([options[0][0]]);
  const [envMode, setEnvMode] = useState<EnvMode>(defaultEnvMode);

  function toggle(value: string) {
    setSelected((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  return (
    <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-text">
          Seleccionar gráficos
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Elegí los gráficos que querés incluir en la planilla. Podés imprimir
          sólo los resultados.
        </p>
        <fieldset className="mt-5 flex flex-col gap-3">
          <legend className="sr-only">Gráficos para imprimir</legend>
          {options.map(([value, label]) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-3 text-sm text-text"
            >
              <input
                type="checkbox"
                checked={selected.includes(value)}
                onChange={() => toggle(value)}
                className="h-4 w-4 accent-primary"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-text">
            Modo de cálculo
          </legend>
          <div className="mt-2 flex flex-col gap-3">
            {envModeOptions.map(({ id, label }) => (
              <label
                key={id}
                className="flex cursor-pointer items-center gap-3 text-sm text-text"
              >
                <input
                  type="radio"
                  name="envMode"
                  value={id}
                  checked={envMode === id}
                  onChange={() => setEnvMode(id)}
                  className="h-4 w-4 accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="border border-border text-text-muted"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="border border-border text-text-muted"
            onClick={() => onPrint({ kind, graphics: selected, envMode })}
          >
            Imprimir resultados
          </button>
        </div>
      </div>
    </div>
  );
}
