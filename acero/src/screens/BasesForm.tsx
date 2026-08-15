import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { SavedBeams } from "@mascalculador/shared";
import {
  saveBeam,
  listSaves,
  loadLastBasesFormState,
  saveLastBasesFormState,
  type BasesFormState,
} from "../lib/storage";

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
  qa: 0.02,
  Df: 100,
  PD: 500,
  PL: 300,
  cx: 30,
  cy: 30,
  fc: 25,
  fy: 420,
  type: "centrada",
  cover: 5,
  rebD: 12,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BasesForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as BasesFormState | null;

  const [state, setState] = useState<BasesFormState>(() => {
    if (locationState) return locationState;
    const saved = loadLastBasesFormState();
    if (saved) return saved;
    return initialState;
  });

  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(null);
  const [columnId, setColumnId] = useState<string | null>(null);
  const [columnName, setColumnName] = useState<string | null>(null);

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
  // Auto geometry preview (centrada)
  // ------------------------------------------------------------------
  const geoPreview = useMemo(() => {
    const qa = state.qa > 0 ? state.qa : 0.02;
    const loads = Math.max(0, state.PD + state.PL);
    const Areq = (loads * 1.1) / qa;
    const side = Math.max(20, Math.ceil(Math.sqrt(Areq) / 5) * 5);
    return { Areq, side };
  }, [state.qa, state.PD, state.PL]);

  // ------------------------------------------------------------------
  // Column dropdown
  // ------------------------------------------------------------------
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
  function handleSave() {
    const name = prompt("Nombre de la base:");
    if (!name) return;
    try {
      saveBeam(name, "bases", state as unknown as Record<string, unknown>);
      setLoadedSaveName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  function handleLoadBases(data: Record<string, unknown>) {
    setLoadedSaveName("");
    const d = data as Record<string, unknown>;
    setState((prev) => {
      const next = { ...prev };
      if (typeof d.qa === "number") next.qa = d.qa;
      if (typeof d.Df === "number") next.Df = d.Df;
      if (typeof d.PD === "number") next.PD = d.PD;
      if (typeof d.PL === "number") next.PL = d.PL;
      if (typeof d.cx === "number") next.cx = d.cx;
      if (typeof d.cy === "number") next.cy = d.cy;
      if (typeof d.fc === "number") next.fc = d.fc;
      if (typeof d.fy === "number") next.fy = d.fy;
      if (
        typeof d.type === "string" &&
        (d.type === "centrada" || d.type === "medianera")
      ) {
        next.type = d.type;
      }
      if (
        typeof d.subType === "string" &&
        (d.subType === "viga-de-fundacion" || d.subType === "tensor")
      ) {
        next.subType = d.subType;
      }
      if (typeof d.B === "number") next.B = d.B;
      if (typeof d.L === "number") next.L = d.L;
      if (typeof d.h === "number") next.h = d.h;
      if (typeof d.Lcol === "number") next.Lcol = d.Lcol;
      if (typeof d.H === "number") next.H = d.H;
      if (typeof d.mu === "number") next.mu = d.mu;
      if (typeof d.cover === "number") next.cover = d.cover;
      if (typeof d.rebD === "number") next.rebD = d.rebD;
      if (typeof d.columnName === "string") setColumnName(d.columnName);
      if (typeof d.columnId === "string") setColumnId(d.columnId);
      return next;
    });
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
        name: loadedSaveName ?? undefined,
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
          <p className="text-sm text-text-muted">
            {loadedSaveName
              ? `Editando: ${loadedSaveName}`
              : "CIRSOC 201 — Base de hormigón armado"}
          </p>
        </div>
      </header>

      {/* Load saved bases */}
      <SavedBeams app="concrete" type="bases" onLoad={handleLoadBases} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* ── 1. Suelo ──────────────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Suelo
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                q<sub>a</sub> (kN/cm²)
              </span>
              <input
                type="number"
                step="0.001"
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
                D<sub>f</sub> (cm)
              </span>
              <input
                type="number"
                step="1"
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

        {/* ── 3. Columna ────────────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Columna
          </h2>

          {/* Column load dropdown */}
          <div className="mb-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Cargar columna guardada
              </span>
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
                    {c.name} — P<sub>D</sub>={c.PD.toFixed(1)}, P<sub>L</sub>=
                    {c.PL.toFixed(1)} kN, {c.cx}×{c.cy} cm
                  </option>
                ))}
              </select>
            </label>
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
              <input
                type="number"
                step="0.1"
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
                P<sub>L</sub> (kN) {columnName && "(columna)"}
              </span>
              <input
                type="number"
                step="0.1"
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
          </div>
        </section>

        {/* ── 4. Tipo de base ───────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Tipo de base
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
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
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="baseType"
                  value="medianera"
                  checked={state.type === "medianera"}
                  onChange={() =>
                    setState((prev) => ({
                      ...prev,
                      type: "medianera",
                      subType: prev.subType ?? "viga-de-fundacion",
                    }))
                  }
                />
                <span className="text-sm text-text">Medianera</span>
              </label>
            </div>

            {/* Medianera sub-selector */}
            {state.type === "medianera" && (
              <div className="mt-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    Sistema de equilibrio
                  </span>
                  <select
                    value={state.subType ?? "viga-de-fundacion"}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        subType: e.target.value as
                          | "viga-de-fundacion"
                          | "tensor",
                      }))
                    }
                    className="w-64"
                  >
                    <option value="viga-de-fundacion">Viga de fundación</option>
                    <option value="tensor">Tensor</option>
                  </select>
                </label>
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
              <sub>L</sub>)·1.10 / q<sub>a</sub>)
            </span>
            <div className="flex flex-wrap gap-4 mt-2">
              <span className="text-xs text-text-muted">
                A<sub>req</sub> = {geoPreview.Areq.toFixed(0)} cm²
              </span>
              <span className="text-xs font-semibold text-primary">
                Base sugerida: {geoPreview.side} × {geoPreview.side} cm
              </span>
            </div>
          </div>

          {/* Override inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                B (cm, ancho X){" "}
                {state.B === undefined && `(auto: ${geoPreview.side})`}
              </span>
              <input
                type="number"
                step="5"
                min="20"
                value={state.B ?? ""}
                onKeyDown={handleCommaKey}
                placeholder={String(geoPreview.side)}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    B: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                L (cm, largo Y){" "}
                {state.L === undefined && `(auto: ${geoPreview.side})`}
              </span>
              <input
                type="number"
                step="5"
                min="20"
                value={state.L ?? ""}
                onKeyDown={handleCommaKey}
                placeholder={String(geoPreview.side)}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    L: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                h (cm, altura total) {state.h === undefined && "(auto)"}
              </span>
              <input
                type="number"
                step="5"
                min="20"
                value={state.h ?? ""}
                onKeyDown={handleCommaKey}
                placeholder="Auto"
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    h: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </label>
          </div>
        </section>

        {/* ── 6. Detalles medianera ──────────────────────────── */}
        {state.type === "medianera" && (
          <section className="bg-surface rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
              Detalles medianera
            </h2>

            {state.subType === "viga-de-fundacion" && (
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
                      Lcol: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </label>
            )}

            {state.subType === "tensor" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    H (cm) — altura centro tensor a fondo zapata
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={state.H ?? ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        H: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    μ — coeficiente de fricción (default 0.5)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="1"
                    value={state.mu ?? 0.5}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        mu: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                  />
                </label>
              </div>
            )}
          </section>
        )}

        {/* ── 7. Armado ──────────────────────────────────────── */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Armado
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Recubrimiento (cm, default 5)
              </span>
              <input
                type="number"
                step="0.5"
                min="1"
                value={state.cover ?? 5}
                onKeyDown={handleCommaKey}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    cover: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Ø barra (mm, default 12)
              </span>
              <select
                value={state.rebD ?? 12}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    rebD: Number(e.target.value),
                  }))
                }
              >
                {[8, 10, 12, 16, 20, 25].map((d) => (
                  <option key={d} value={d}>
                    Ø{d}
                  </option>
                ))}
              </select>
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
            Guardar datos
          </button>
        </div>
      </form>
    </MainLayout>
  );
}
