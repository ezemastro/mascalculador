import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { SavedBeams } from "@mascalculador/shared";
import { DecimalInput } from "@mascalculador/shared";
import {
  saveBeam,
  updateSave,
  listSaves,
  getSavedBeams,
  deleteSave,
  loadLastBasesFormState,
  saveLastBasesFormState,
  type BasesFormState,
} from "../lib/storage";
import { pickObraIfNeeded } from "../components/ObraPicker";
import {
  suggestBaseDims,
  suggestBaseHeight,
  vuelos,
  type BaseInput,
} from "../lib/bases-calc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const initialState: BasesFormState = {
  qa: 200,
  Df: 1,
  PD: 500,
  PL: 300,
  cx: 30,
  cy: 30,
  fc: 25,
  fy: 420,
  type: "centrada",
  cover: 7,
  includeSelfWeight: true,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Migración de guardados viejos: qa se guardaba en kN/cm², Df en cm,
// los lados eran B/L y el tipo legado era "medianera" (excentricidad en X).
function normalizeState(s: BasesFormState): BasesFormState {
  const next = { ...s };
  if (next.qa > 0 && next.qa < 1) next.qa *= 100;
  if (next.Df >= 5) next.Df /= 100;
  if (next.type === "medianera") next.type = "medianera-y";
  return next;
}

// B/L viejos → Lx/Ly (B era el ancho X, L el largo Y)
function normalizeSides(s: BasesFormState): BasesFormState {
  const next = { ...s };
  if (next.Lx === undefined && next.B !== undefined) next.Lx = next.B;
  if (next.Ly === undefined && next.L !== undefined) next.Ly = next.L;
  return next;
}

/** Croquis en planta de cada tipo de base (la columna en azul). */
function BasePlanSketch({ type }: { type: string }) {
  const stroke = "var(--color-text-muted, #9ca3af)";
  const col = "var(--color-primary, #2563eb)";
  if (type === "centrada") {
    return (
      <svg width="56" height="40" viewBox="0 0 56 40" className="shrink-0">
        <rect
          x="13"
          y="5"
          width="30"
          height="30"
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
        />
        <rect x="24" y="16" width="8" height="8" fill={col} />
      </svg>
    );
  }
  if (type === "medianera-x") {
    return (
      <svg width="56" height="40" viewBox="0 0 56 40" className="shrink-0">
        <rect
          x="3"
          y="10"
          width="50"
          height="20"
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
        />
        <rect x="24" y="22" width="8" height="8" fill={col} />
      </svg>
    );
  }
  if (type === "medianera-y") {
    return (
      <svg width="56" height="40" viewBox="0 0 56 40" className="shrink-0">
        <rect
          x="18"
          y="3"
          width="20"
          height="34"
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
        />
        <rect x="18" y="16" width="8" height="8" fill={col} />
      </svg>
    );
  }
  // esquina
  return (
    <svg width="56" height="40" viewBox="0 0 56 40" className="shrink-0">
      <rect
        x="13"
        y="5"
        width="30"
        height="30"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
      />
      <rect x="13" y="5" width="8" height="8" fill={col} />
    </svg>
  );
}

export default function BasesForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as
    | (BasesFormState & {
        /** Id del guardado cargado, si viene de uno existente */
        loadedSaveId?: string | null;
        loadedSaveName?: string | null;
      })
    | null;

  const [state, setState] = useState<BasesFormState>(() => {
    if (locationState) {
      // La identidad del guardado se maneja aparte (loadedSaveId/Name):
      // no debe mezclarse con los campos del formulario que se persisten.
      const s = {
        ...locationState,
        loadedSaveId: undefined,
        loadedSaveName: undefined,
      } as BasesFormState;
      return normalizeSides(normalizeState(s));
    }
    const saved = loadLastBasesFormState();
    if (saved) return normalizeSides(normalizeState(saved));
    return initialState;
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

  // Guard: skip first auto-save using ref (no re-render)
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    saveLastBasesFormState({
      ...state,
      columnId: columnId ?? undefined,
      columnName: columnName ?? undefined,
    });
  }, [state, columnId, columnName]);

  // ------------------------------------------------------------------
  // Auto geometry preview (usa el motor)
  // ------------------------------------------------------------------
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
      type: state.type,
      subType: state.subType,
      Lx: state.Lx,
      Ly: state.Ly,
      Lcol: state.Lcol,
      LcolX: state.LcolX,
      LcolY: state.LcolY,
      cover: state.cover ?? 7,
      includeSelfWeight: state.includeSelfWeight,
    } as BaseInput;
    const dims = suggestBaseDims(input);
    const hgt = suggestBaseHeight(input, dims.Lx, dims.Ly);
    const { kx, ky } = vuelos(input, dims.Lx, dims.Ly);
    const kmin = Math.min(kx, ky);
    return {
      Areq: dims.Areq,
      Lx: dims.Lx,
      Ly: dims.Ly,
      bx: dims.bx,
      by: dims.by,
      hSug: hgt.h,
      dSug: hgt.d,
      dRig: hgt.dRig,
      dFlex: hgt.dFlex,
      hTalonSug: Math.max(25, (state.h ?? hgt.h) - kmin),
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
    state.type,
    state.subType,
    state.Lx,
    state.Ly,
    state.Lcol,
    state.LcolX,
    state.LcolY,
    state.cover,
    state.h,
  ]);
  const savedColumns = useMemo(() => getSavedColumns(), []);

  function handleLoadColumn(colId: string) {
    const col = savedColumns.find((c) => c.id === colId);
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

  // ------------------------------------------------------------------
  // Save / Load
  // ------------------------------------------------------------------
  async function handleSave() {
    // El payload incluye la vinculación con la columna cargada, para que
    // sobreviva al round-trip (guardar -> cargar -> guardar).
    const data = {
      ...state,
      columnId: columnId ?? undefined,
      columnName: columnName ?? undefined,
    } as Record<string, unknown>;
    // Si venimos de una base guardada, actualizamos la misma (mismo id/nombre)
    if (loadedSaveId) {
      updateSave(loadedSaveId, data);
      return;
    }
    const name = prompt("Nombre de la base:");
    if (!name) return;
    const target = await pickObraIfNeeded();
    if (target === null) return;
    try {
      const saved = saveBeam(name, "bases", data, target);
      setLoadedSaveId(saved.id);
      setLoadedSaveName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  function handleLoadBases(
    data: Record<string, unknown>,
    save: { id: string; name: string },
  ) {
    setLoadedSaveId(save.id);
    setLoadedSaveName(save.name);
    const d = data as Record<string, unknown>;
    // Los guardados hechos desde resultados usan { input, result };
    // los hechos desde el formulario guardan los campos en el nivel raíz.
    const f = (d.input && typeof d.input === "object" ? d.input : d) as Record<
      string,
      unknown
    >;
    setState((prev) => {
      const next = normalizeSides(normalizeState(prev));
      if (typeof f.qa === "number") next.qa = f.qa;
      if (typeof f.Df === "number") next.Df = f.Df;
      if (typeof f.PD === "number") next.PD = f.PD;
      if (typeof f.PL === "number") next.PL = f.PL;
      if (typeof f.cx === "number") next.cx = f.cx;
      if (typeof f.cy === "number") next.cy = f.cy;
      if (typeof f.fc === "number") next.fc = f.fc;
      if (typeof f.fy === "number") next.fy = f.fy;
      if (
        typeof f.type === "string" &&
        (f.type === "centrada" ||
          f.type === "medianera" ||
          f.type === "medianera-x" ||
          f.type === "medianera-y" ||
          f.type === "esquina")
      ) {
        next.type = f.type;
      }
      if (
        typeof f.subType === "string" &&
        (f.subType === "viga-de-fundacion" ||
          f.subType === "viga-de-equilibrio" ||
          f.subType === "tensor")
      ) {
        next.subType = f.subType;
      }
      if (typeof f.Lx === "number") next.Lx = f.Lx;
      if (typeof f.Ly === "number") next.Ly = f.Ly;
      if (typeof f.h === "number") next.h = f.h;
      if (typeof f.hTalon === "number") next.hTalon = f.hTalon;
      if (typeof f.Lcol === "number") next.Lcol = f.Lcol;
      if (typeof f.LcolX === "number") next.LcolX = f.LcolX;
      if (typeof f.LcolY === "number") next.LcolY = f.LcolY;
      if (typeof f.H === "number") next.H = f.H;
      if (typeof f.Hx === "number") next.Hx = f.Hx;
      if (typeof f.Hy === "number") next.Hy = f.Hy;
      if (typeof f.mu === "number") next.mu = f.mu;
      if (typeof f.cover === "number") next.cover = f.cover;
      if (typeof f.columnName === "string") setColumnName(f.columnName);
      if (typeof f.columnId === "string") setColumnId(f.columnId);
      return next;
    });
  }

  // ------------------------------------------------------------------
  // Reset (Nueva)
  // ------------------------------------------------------------------
  function handleNew() {
    setState(initialState);
    setLoadedSaveId(null);
    setLoadedSaveName(null);
    setColumnId(null);
    setColumnName(null);
  }

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate("/bases-results", {
      state: {
        input: {
          ...state,
          columnId: columnId ?? undefined,
          columnName: columnName ?? undefined,
        },
        loadedSaveId: loadedSaveId ?? undefined,
        loadedSaveName: loadedSaveName ?? undefined,
      },
    });
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <MainLayout>
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text">
            Dimensionado de Bases
          </h1>
          {loadedSaveName ? (
            <span className="inline-flex items-center mt-1 text-sm font-semibold text-primary bg-primary/10 border border-primary/30 px-2.5 py-0.5 rounded-full">
              {/^\d+$/.test(loadedSaveName)
                ? `Base Nº ${loadedSaveName}`
                : loadedSaveName}
            </span>
          ) : (
            <span className="inline-flex items-center mt-1 text-sm font-semibold text-warning bg-warning/10 border border-warning/30 px-2.5 py-0.5 rounded-full">
              Sin guardar
            </span>
          )}
        </div>
        <span className="ml-auto text-xs text-text-muted">CIRSOC 201</span>
        <button
          type="button"
          onClick={handleNew}
          className="text-sm bg-surface-alt border border-border text-text-muted px-3 py-1.5 rounded-lg hover:bg-surface hover:text-text transition-colors"
        >
          + Nueva
        </button>
      </header>

      {/* Load saved bases */}
      <SavedBeams
        app="concrete"
        type="bases"
        listSaves={() => getSavedBeams("bases")}
        deleteSave={(id) => deleteSave(id)}
        onLoad={handleLoadBases}
        label="Bases guardadas"
      />

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // Commit and exit the field instead of submitting (calculating).
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
        {/* ── 1. Suelo ──────────────────────────────────────── */}
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

        {/* ── 2. Materiales ─────────────────────────────────── */}
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

        {/* ── 3. Cargas ─────────────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Cargas
          </h2>

          {/* Column load dropdown */}
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

          {/* Manual / readonly inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                P<sub>D</sub> (kN) {columnName && "(columna)"}
              </span>
              <DecimalInput
                value={state.PD || 0}
                onChange={(n) =>
                  setState((prev) => ({ ...prev, PD: Math.max(0, n) }))
                }
                decimals={2}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                P<sub>L</sub> (kN) {columnName && "(columna)"}
              </span>
              <DecimalInput
                value={state.PL || 0}
                onChange={(n) =>
                  setState((prev) => ({ ...prev, PL: Math.max(0, n) }))
                }
                decimals={2}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.includeSelfWeight !== false}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  includeSelfWeight: e.target.checked,
                }))
              }
            />
            <span className="text-xs text-text-muted">
              Incluir peso propio de la base y del suelo (+10% en el área
              requerida)
            </span>
          </label>
        </section>

        {/* ── 4. Tipo de base ───────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Tipo de base
          </h2>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  state.type === "centrada"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-surface-alt"
                }`}
              >
                <BasePlanSketch type="centrada" />
                <span className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="baseType"
                    value="centrada"
                    checked={state.type === "centrada"}
                    onChange={() =>
                      setState((prev) => ({
                        ...prev,
                        type: "centrada",
                        subType: undefined,
                      }))
                    }
                  />
                  <span className="text-sm text-text">Centrada</span>
                </span>
              </label>
              <label
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  state.type === "medianera-x"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-surface-alt"
                }`}
              >
                <BasePlanSketch type="medianera-x" />
                <span className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="baseType"
                    value="medianera-x"
                    checked={state.type === "medianera-x"}
                    onChange={() =>
                      setState((prev) => ({
                        ...prev,
                        type: "medianera-x",
                        subType:
                          prev.subType === "viga-de-fundacion" ||
                          prev.subType === "tensor"
                            ? prev.subType
                            : "viga-de-fundacion",
                      }))
                    }
                  />
                  <span className="text-sm text-text">Medianera X</span>
                </span>
              </label>
              <label
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  state.type === "medianera-y"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-surface-alt"
                }`}
              >
                <BasePlanSketch type="medianera-y" />
                <span className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="baseType"
                    value="medianera-y"
                    checked={state.type === "medianera-y"}
                    onChange={() =>
                      setState((prev) => ({
                        ...prev,
                        type: "medianera-y",
                        subType:
                          prev.subType === "viga-de-fundacion" ||
                          prev.subType === "tensor"
                            ? prev.subType
                            : "viga-de-fundacion",
                      }))
                    }
                  />
                  <span className="text-sm text-text">Medianera Y</span>
                </span>
              </label>
              <label
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  state.type === "esquina"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-surface-alt"
                }`}
              >
                <BasePlanSketch type="esquina" />
                <span className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="baseType"
                    value="esquina"
                    checked={state.type === "esquina"}
                    onChange={() =>
                      setState((prev) => ({
                        ...prev,
                        type: "esquina",
                        subType: "viga-de-equilibrio",
                      }))
                    }
                  />
                  <span className="text-sm text-text">Esquina</span>
                </span>
              </label>
            </div>

            {/* Sistema de equilibrio (medianeras y esquina) */}
            {(state.type === "medianera-x" ||
              state.type === "medianera-y" ||
              state.type === "esquina") && (
              <div className="mt-2 flex flex-col gap-3">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="equilibrio"
                      value="viga"
                      checked={
                        state.subType === "viga-de-fundacion" ||
                        state.subType === "viga-de-equilibrio"
                      }
                      onChange={() =>
                        setState((prev) => ({
                          ...prev,
                          subType:
                            prev.type === "esquina"
                              ? "viga-de-equilibrio"
                              : "viga-de-fundacion",
                        }))
                      }
                    />
                    <span className="text-sm text-text">
                      {state.type === "esquina"
                        ? "Viga de equilibrio"
                        : "Viga de fundación"}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="equilibrio"
                      value="tensor"
                      checked={state.subType === "tensor"}
                      onChange={() =>
                        setState((prev) => ({
                          ...prev,
                          subType: "tensor",
                        }))
                      }
                    />
                    <span className="text-sm text-text">Tensor</span>
                  </label>
                </div>

                {state.type === "esquina" && state.subType === "tensor" ? (
                  <p className="text-xs text-text-muted">
                    Los datos de los tensores X e Y (altura al fondo de la base
                    y sección) se cargan en la hoja de resultados.
                  </p>
                ) : state.type === "esquina" &&
                  state.subType === "viga-de-equilibrio" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-text-muted">
                        L<sub>colX</sub> (cm) — luz entre ejes de columnas (X)
                      </span>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={state.LcolX ?? ""}
                        onKeyDown={handleCommaKey}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            LcolX: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-text-muted">
                        L<sub>colY</sub> (cm) — luz entre ejes de columnas (Y)
                      </span>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={state.LcolY ?? ""}
                        onKeyDown={handleCommaKey}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            LcolY: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }))
                        }
                      />
                    </label>
                  </div>
                ) : state.subType === "tensor" ? (
                  <p className="text-xs text-text-muted">
                    Los datos del tensor (altura al fondo de la base y sección)
                    se cargan en la hoja de resultados.
                  </p>
                ) : (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-text-muted">
                        L<sub>col</sub> (cm) — luz entre ejes de columnas
                      </span>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={state.Lcol ?? ""}
                        onKeyDown={handleCommaKey}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            Lcol: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-text-muted">
                        Ancho viga b (cm){" "}
                        {state.bViga === undefined &&
                          `(auto: ${state.type === "medianera-x" ? Math.max(state.cx, 20) : Math.max(state.cy, 20)})`}
                      </span>
                      <DecimalInput
                        value={
                          state.bViga ??
                          (state.type === "medianera-x"
                            ? Math.max(state.cx, 20)
                            : Math.max(state.cy, 20))
                        }
                        onChange={(n) =>
                          setState((prev) => ({
                            ...prev,
                            bViga: n > 0 ? n : undefined,
                          }))
                        }
                        decimals={1}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-text-muted">
                        Alto viga h (cm) {state.hViga === undefined && "(auto)"}
                      </span>
                      <DecimalInput
                        value={state.hViga ?? 0}
                        onChange={(n) =>
                          setState((prev) => ({
                            ...prev,
                            hViga: n > 0 ? n : undefined,
                          }))
                        }
                        decimals={1}
                      />
                    </label>
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── 5. Geometría ───────────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Geometría
          </h2>

          {/* Auto-predim preview */}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg mb-4">
            <span className="text-xs text-text-muted">
              Predimensionado automático (A<sub>req</sub> = (P<sub>D</sub>+P
              <sub>L</sub>)·1.10 / σ<sub>adm</sub>)
            </span>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
              <span className="text-text-muted">
                A<sub>req</sub> = {geo.Areq.toFixed(0)} cm²
              </span>
              <span className="font-semibold text-primary">
                Base sugerida: L<sub>x</sub> {geo.Lx} × L<sub>y</sub> {geo.Ly}{" "}
                cm
              </span>
              <span className="text-text-muted">
                d: rigidez {geo.dRig.toFixed(1)} cm · flexión{" "}
                {geo.dFlex.toFixed(1)} cm
              </span>
              <span className="text-text-muted">
                h sugerida: {geo.hSug.toFixed(1)} cm
              </span>
              <span className="text-text-muted">
                b<sub>x</sub> {geo.bx} · b<sub>y</sub> {geo.by} cm
              </span>
              <span className="text-text-muted">
                Talón sugerido: {geo.hTalonSug.toFixed(0)} cm
              </span>
            </div>
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                L<sub>x</sub> (cm, horizontal){" "}
                {state.Lx === undefined && `(auto: ${geo.Lx})`}
              </span>
              <input
                type="number"
                step="5"
                min="20"
                value={state.Lx ?? ""}
                onKeyDown={handleCommaKey}
                placeholder={String(geo.Lx)}
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
                L<sub>y</sub> (cm, vertical){" "}
                {state.Ly === undefined && `(auto: ${geo.Ly})`}
              </span>
              <input
                type="number"
                step="5"
                min="20"
                value={state.Ly ?? ""}
                onKeyDown={handleCommaKey}
                placeholder={String(geo.Ly)}
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
                c<sub>x</sub> (cm) {columnName && "(columna)"}
              </span>
              <input
                type="number"
                step="1"
                min="1"
                value={state.cx || ""}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, cx: Number(e.target.value) }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                c<sub>y</sub> (cm) {columnName && "(columna)"}
              </span>
              <input
                type="number"
                step="1"
                min="1"
                value={state.cy || ""}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, cy: Number(e.target.value) }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                b<sub>x</sub> (cm) — apoyo tronco
              </span>
              <input value={geo.bx} readOnly className="bg-surface-alt" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                b<sub>y</sub> (cm) — apoyo tronco
              </span>
              <input value={geo.by} readOnly className="bg-surface-alt" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Altura útil d (cm)
              </span>
              <input
                value={
                  (state.h ?? 0) > 0
                    ? ((state.h ?? 0) - (state.cover ?? 7)).toFixed(1)
                    : geo.dSug.toFixed(1)
                }
                readOnly
                className="bg-surface-alt"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                h (cm, altura total){" "}
                {state.h === undefined && `(auto: ${geo.hSug.toFixed(1)})`}
              </span>
              <input
                type="number"
                step="any"
                min="20"
                value={state.h ?? ""}
                onKeyDown={handleCommaKey}
                placeholder={geo.hSug.toFixed(1)}
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
                h<sub>talón</sub> (cm) — espesor del borde{" "}
                {state.hTalon === undefined &&
                  `(auto: ${geo.hTalonSug.toFixed(0)})`}
              </span>
              <input
                type="number"
                step="any"
                min="1"
                value={state.hTalon ?? ""}
                onKeyDown={handleCommaKey}
                placeholder={String(geo.hTalonSug)}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    hTalon: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Recubrimiento (cm, default 7)
              </span>
              <input
                type="number"
                step="0.5"
                min="1"
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

        {/* ── Actions ────────────────────────────────────────── */}
        <div className="self-center flex gap-3">
          <button
            type="submit"
            className="bg-primary text-white font-semibold px-8 py-3 rounded-lg hover:bg-primary-hover transition-colors"
          >
            Calcular
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="bg-surface-alt border border-border text-text-muted font-semibold px-6 py-3 rounded-lg hover:bg-surface transition-colors"
          >
            Guardar
          </button>
        </div>
      </form>
    </MainLayout>
  );
}
