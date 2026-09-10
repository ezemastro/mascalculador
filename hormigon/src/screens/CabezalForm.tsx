// Módulo admin "Vigas de fundación para cabezales".
//
// Reutiliza el motor de base medianera + viga de fundación (designBase con
// type "medianera-y" y subType "viga-de-fundacion"): el cabezal se comporta
// como la base, la columna apoya en la medianera y Lcol ubica la columna que
// equilibra. Los guardados usan el tipo propio "cabezal" para no mezclarse
// con los de Bases.
import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { MainLayout, SavedBeams } from "@mascalculador/shared";
import {
  saveBeam,
  updateSave,
  listSaves,
  getSavedBeams,
  deleteSave,
  loadLastCabezalFormState,
  saveLastCabezalFormState,
  type CabezalFormState,
} from "../lib/storage";
import { pickObraIfNeeded } from "../components/ObraPicker";
import {
  suggestBaseDims,
  suggestBaseHeight,
  vuelos,
  type BaseInput,
} from "../lib/bases-calc";

function handleCommaKey(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === ",") {
    e.preventDefault();
    const input = e.currentTarget;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    input.value =
      input.value.substring(0, start) + "." + input.value.substring(end);
    input.setSelectionRange(start + 1, start + 1);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

/** Extract PD, PL, cx, cy from rc-columna saves with defensive typeof checks. */
function getSavedColumns(): Array<{
  id: string;
  name: string;
  PD: number;
  PL: number;
  cx: number;
  cy: number;
}> {
  return listSaves()
    .filter((s) => (s.type as string) === "rc-columna")
    .map((s) => {
      const d = s.data as Record<string, unknown>;
      return {
        id: s.id,
        name: s.name,
        PD: typeof d.PD === "number" ? d.PD : 0,
        PL: typeof d.PL === "number" ? d.PL : 0,
        cx: typeof d.cx === "number" ? d.cx : 0,
        cy: typeof d.cy === "number" ? d.cy : 0,
      };
    });
}

const initialState: CabezalFormState = {
  qa: 200,
  Df: 1,
  PD: 500,
  PL: 300,
  cx: 30,
  cy: 30,
  fc: 25,
  fy: 420,
  cover: 7,
};

/** Planta del cabezal: columna en la medianera (izq.) y columna que
 *  equilibra unida por la viga de fundación. */
function CabezalSketch() {
  const stroke = "var(--color-text-muted, #9ca3af)";
  const col = "var(--color-primary, #2563eb)";
  return (
    <svg width="72" height="40" viewBox="0 0 72 40" className="shrink-0">
      <rect
        x="4"
        y="6"
        width="28"
        height="28"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
      />
      <rect x="4" y="16" width="8" height="8" fill={col} />
      <line x1="12" y1="20" x2="58" y2="20" stroke={stroke} strokeWidth="1.5" />
      <rect x="54" y="16" width="8" height="8" fill={col} />
    </svg>
  );
}

export default function CabezalForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as
    | (CabezalFormState & {
        loadedSaveId?: string | null;
        loadedSaveName?: string | null;
      })
    | null;

  const [state, setState] = useState<CabezalFormState>(() => {
    if (locationState) {
      const s = {
        ...locationState,
        loadedSaveId: undefined,
        loadedSaveName: undefined,
      } as CabezalFormState;
      return s;
    }
    return loadLastCabezalFormState() ?? initialState;
  });

  const [loadedSaveId, setLoadedSaveId] = useState<string | null>(
    locationState?.loadedSaveId ?? null,
  );
  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(
    locationState?.loadedSaveName ?? null,
  );
  const [columnId, setColumnId] = useState<string | null>(
    locationState?.columnId ?? null,
  );
  const [columnName, setColumnName] = useState<string | null>(
    locationState?.columnName ?? null,
  );

  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    saveLastCabezalFormState({
      ...state,
      columnId: columnId ?? undefined,
      columnName: columnName ?? undefined,
    });
  }, [state, columnId, columnName]);

  // Vista previa: mismas sugerencias que el motor de bases.
  const geo = useMemo(() => {
    const input = {
      qa: state.qa > 0 ? state.qa : 200,
      Df: state.Df,
      PD: Math.max(0, state.PD),
      PL: Math.max(0, state.PL),
      cx: state.cx,
      cy: state.cy,
      fc: state.fc,
      fy: state.fy,
      type: "medianera-y" as const,
      subType: "viga-de-fundacion" as const,
      Lx: state.Lx,
      Ly: state.Ly,
      Lcol: state.Lcol,
      cover: state.cover ?? 7,
      includeSelfWeight: true,
    } as BaseInput;
    const dims = suggestBaseDims(input);
    const hgt = suggestBaseHeight(input, dims.Lx, dims.Ly);
    const { kx, ky } = vuelos(input, dims.Lx, dims.Ly);
    const kmin = Math.min(kx, ky);
    return {
      Lx: dims.Lx,
      Ly: dims.Ly,
      h: hgt.h,
      hTalon: Math.max(25, (state.h ?? hgt.h) - kmin),
    };
  }, [
    state.qa,
    state.Df,
    state.PD,
    state.PL,
    state.cx,
    state.cy,
    state.fc,
    state.fy,
    state.Lx,
    state.Ly,
    state.Lcol,
    state.cover,
    state.h,
  ]);

  const savedColumns = useMemo(() => getSavedColumns(), []);

  function handleLoadColumn(id: string) {
    const col = savedColumns.find((c) => c.id === id);
    if (!col) return;
    setState((prev) => ({
      ...prev,
      PD: col.PD || prev.PD,
      PL: col.PL || prev.PL,
      cx: col.cx || prev.cx,
      cy: col.cy || prev.cy,
    }));
    setColumnId(col.id);
    setColumnName(col.name);
  }

  function buildData(): Record<string, unknown> {
    return {
      ...state,
      columnId: columnId ?? undefined,
      columnName: columnName ?? undefined,
    };
  }

  async function handleSave() {
    const data = buildData();
    if (loadedSaveId) {
      updateSave(loadedSaveId, data);
      return;
    }
    const name = prompt("Nombre del cabezal:");
    if (!name) return;
    const target = await pickObraIfNeeded();
    if (target === null) return;
    try {
      const saved = saveBeam(name, "cabezal", data, target);
      setLoadedSaveId(saved.id);
      setLoadedSaveName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  function handleLoadCabezal(
    data: Record<string, unknown>,
    save: { id: string; name: string },
  ) {
    setLoadedSaveId(save.id);
    setLoadedSaveName(save.name);
    const d = data as Record<string, unknown>;
    // Los guardados desde resultados usan { input, result }; los hechos desde
    // el formulario guardan los campos en el nivel raíz.
    const f = (d.input && typeof d.input === "object" ? d.input : d) as Record<
      string,
      unknown
    >;
    setState((prev) => {
      const next = { ...prev };
      if (typeof f.qa === "number") next.qa = f.qa;
      if (typeof f.Df === "number") next.Df = f.Df;
      if (typeof f.PD === "number") next.PD = f.PD;
      if (typeof f.PL === "number") next.PL = f.PL;
      if (typeof f.cx === "number") next.cx = f.cx;
      if (typeof f.cy === "number") next.cy = f.cy;
      if (typeof f.fc === "number") next.fc = f.fc;
      if (typeof f.fy === "number") next.fy = f.fy;
      if (typeof f.Lx === "number") next.Lx = f.Lx;
      if (typeof f.Ly === "number") next.Ly = f.Ly;
      if (typeof f.h === "number") next.h = f.h;
      if (typeof f.hTalon === "number") next.hTalon = f.hTalon;
      if (typeof f.Lcol === "number") next.Lcol = f.Lcol;
      if (typeof f.bViga === "number") next.bViga = f.bViga;
      if (typeof f.hViga === "number") next.hViga = f.hViga;
      if (typeof f.cover === "number") next.cover = f.cover;
      if (typeof f.columnId === "string") setColumnId(f.columnId);
      if (typeof f.columnName === "string") setColumnName(f.columnName);
      return next;
    });
  }

  function handleNew() {
    setState(initialState);
    setLoadedSaveId(null);
    setLoadedSaveName(null);
    setColumnId(null);
    setColumnName(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate("/cabezales-results", {
      state: {
        input: {
          ...buildData(),
          type: "medianera-y",
          subType: "viga-de-fundacion",
          includeSelfWeight: true,
        },
        loadedSaveId: loadedSaveId ?? undefined,
        loadedSaveName: loadedSaveName ?? undefined,
      },
    });
  }

  return (
    <MainLayout>
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <CabezalSketch />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text">
            Vigas de fundación para cabezales
          </h1>
          {loadedSaveName ? (
            <span className="inline-flex items-center mt-1 text-sm font-semibold text-primary bg-primary/10 border border-primary/30 px-2.5 py-0.5 rounded-full">
              {loadedSaveName}
            </span>
          ) : (
            <span className="inline-flex items-center mt-1 text-sm font-semibold text-warning bg-warning/10 border border-warning/30 px-2.5 py-0.5 rounded-full">
              Sin guardar
            </span>
          )}
        </div>
        <span className="ml-auto text-xs text-text-muted">
          CIRSOC 201 — módulo admin
        </span>
        <button
          type="button"
          onClick={handleSave}
          className="text-sm bg-primary text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-hover transition-colors"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={handleNew}
          className="text-sm bg-surface-alt border border-border text-text-muted px-3 py-1.5 rounded-lg hover:bg-surface hover:text-text transition-colors"
        >
          + Nueva
        </button>
      </header>

      <SavedBeams
        app="concrete"
        type="cabezal"
        listSaves={() => getSavedBeams("cabezal")}
        deleteSave={(id) => deleteSave(id)}
        onLoad={handleLoadCabezal}
        label="Cabezales guardados"
      />

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const target = e.target as HTMLElement;
            if (
              target.tagName === "INPUT" &&
              typeof target.blur === "function"
            ) {
              target.blur();
            }
          }
        }}
        className="flex flex-col gap-6"
      >
        {/* ── Suelo ─────────────────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Suelo
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                σ<sub>adm</sub> (kN/m²)
              </span>
              <input
                type="number"
                step="1"
                min="0"
                value={state.qa || ""}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, qa: Number(e.target.value) }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                D<sub>f</sub> (m) — profundidad de la fundación
              </span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={state.Df || ""}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, Df: Number(e.target.value) }))
                }
              />
            </label>
          </div>
        </section>

        {/* ── Materiales ────────────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Materiales
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                f'<sub>c</sub> (MPa)
              </span>
              <select
                value={state.fc}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, fc: Number(e.target.value) }))
                }
              >
                <option value={20}>20 (H-20)</option>
                <option value={25}>25 (H-25)</option>
                <option value={30}>30 (H-30)</option>
                <option value={35}>35 (H-35)</option>
                <option value={40}>40 (H-40)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                f<sub>y</sub> (MPa)
              </span>
              <select
                value={state.fy}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, fy: Number(e.target.value) }))
                }
              >
                <option value={420}>420 (ADN 420)</option>
                <option value={500}>500 (ADN 500)</option>
              </select>
            </label>
          </div>
        </section>

        {/* ── Columna en medianera ──────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Columna que apoya en medianera
          </h2>
          <div className="mb-4">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-xs font-semibold text-text">Columna</span>
              <span className="text-xs text-text-muted">
                Cargar columna guardada
              </span>
            </div>
            <select
              className="w-full"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) handleLoadColumn(e.target.value);
              }}
            >
              <option value="" disabled>
                {savedColumns.length === 0
                  ? "No hay columnas guardadas"
                  : "Seleccionar columna guardada..."}
              </option>
              {savedColumns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — P<sub>D</sub>={c.PD.toFixed(2)}, P<sub>L</sub>=
                  {c.PL.toFixed(2)} kN, {c.cx}×{c.cy} cm
                </option>
              ))}
            </select>
            {columnName && (
              <p className="text-xs text-primary mt-1">
                Columna cargada: {columnName}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                P<sub>D</sub> (kN)
              </span>
              <input
                type="number"
                step="1"
                min="0"
                value={state.PD || ""}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, PD: Number(e.target.value) }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                P<sub>L</sub> (kN)
              </span>
              <input
                type="number"
                step="1"
                min="0"
                value={state.PL || ""}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, PL: Number(e.target.value) }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                c<sub>x</sub> (cm)
              </span>
              <input
                type="number"
                step="1"
                min="0"
                value={state.cx || ""}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, cx: Number(e.target.value) }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                c<sub>y</sub> (cm)
              </span>
              <input
                type="number"
                step="1"
                min="0"
                value={state.cy || ""}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, cy: Number(e.target.value) }))
                }
              />
            </label>
          </div>
        </section>

        {/* ── Cabezal ───────────────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Cabezal
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                L<sub>x</sub> (cm){" "}
                <span className="text-text-muted/60">(sug. {geo.Lx})</span>
              </span>
              <input
                type="number"
                step="1"
                min="0"
                value={state.Lx ?? ""}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    Lx: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                L<sub>y</sub> (cm){" "}
                <span className="text-text-muted/60">(sug. {geo.Ly})</span>
              </span>
              <input
                type="number"
                step="1"
                min="0"
                value={state.Ly ?? ""}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    Ly: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                h (cm){" "}
                <span className="text-text-muted/60">
                  (sug. {Math.round(geo.h)})
                </span>
              </span>
              <input
                type="number"
                step="1"
                min="0"
                value={state.h ?? ""}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    h: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Talón h<sub>t</sub> (cm){" "}
                <span className="text-text-muted/60">
                  (sug. {Math.round(geo.hTalon)})
                </span>
              </span>
              <input
                type="number"
                step="1"
                min="0"
                value={state.hTalon ?? ""}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    hTalon: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </label>
          </div>
          <p className="text-xs text-text-muted mt-2">
            Vacío = dimensión automática del motor. Sugerido: {geo.Lx}×{geo.Ly}×
            {Math.round(geo.h)} cm.
          </p>
        </section>

        {/* ── Viga de fundación ─────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Viga de fundación
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                b viga (cm) — vacío = máx(c<sub>y</sub>, 20)
              </span>
              <input
                type="number"
                step="1"
                min="0"
                value={state.bViga ?? ""}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    bViga: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                h viga (cm) — vacío = sugerida por flexión
              </span>
              <input
                type="number"
                step="1"
                min="0"
                value={state.hViga ?? ""}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    hViga: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Recubrimiento (cm)
              </span>
              <input
                type="number"
                step="1"
                min="0"
                value={state.cover ?? 7}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    cover: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </label>
          </div>
        </section>

        {/* ── Columna que equilibra ─────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Columna que equilibra
          </h2>
          <label className="flex flex-col gap-1 max-w-xs">
            <span className="text-xs text-text-muted">
              L<sub>col</sub> (cm) — distancia entre ejes de columnas
            </span>
            <input
              type="number"
              step="1"
              min="0"
              value={state.Lcol ?? ""}
              onKeyDown={handleCommaKey}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  Lcol: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />
          </label>
          <p className="text-xs text-text-muted mt-2">
            La viga re-centra la resultante: R<sub>u</sub> = P<sub>u</sub>·e /
            (L<sub>col</sub> − e).
          </p>
        </section>

        <button
          type="submit"
          className="self-center bg-primary text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-primary-hover transition-colors"
        >
          Dimensionar cabezal y viga
        </button>
      </form>
    </MainLayout>
  );
}
