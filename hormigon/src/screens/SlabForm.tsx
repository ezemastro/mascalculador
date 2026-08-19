import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { SavedBeams } from "@mascalculador/shared";
import { predimCoef, unidirectionalSpan, validateSlabSupports, type EdgeCondition, type SlabInput } from "../lib/slab-calc";
import {
  saveLastSlabFormState,
  loadLastSlabFormState,
  saveSlabInput,
  updateSlabInput,
} from "../lib/storage";
import { DecimalInput } from "@mascalculador/shared";

export interface SlabState {
  lx: number;
  ly: number;
  edgeX0: EdgeCondition;
  edgeXL: EdgeCondition;
  edgeY0: EdgeCondition;
  edgeYL: EdgeCondition;
  D: number;
  L: number;
  fc: number;
  fy: number;
  cover: number;
  /**
   * Effective h the engine actually used, in mm. When the form re-renders
   * after a submit this is what the results page last computed (which is
   * `(hAdop > 0 ? hAdop : hPredim) * 10`).
   */
  h: number;
  /**
   * Adopted height in cm as set by the user in the form. `0` (or absent)
   * means "fall back to the live-predimensioned h". Optional because
   * navigation state written before this split only carried `h` (mm).
   */
  hAdop?: number;
  dBarX: number;
  dBarY: number;
  includeSelfWeight: boolean;
  /** Id del guardado cargado, si viene de uno existente */
  loadedSaveId?: string | null;
  loadedSaveName?: string | null;
}

const EDGE_OPTIONS: { value: EdgeCondition; label: string }[] = [
  { value: "simple", label: "Articulado" },
  { value: "continuo", label: "Continuo" },
  { value: "free", label: "Libre" },
];

export default function SlabForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as SlabState | null;

  // Init hierarchy: state > lastForm > defaults
  const lastForm = !state ? loadLastSlabFormState() : null;

  // hAdop is stored in cm. Prefer the new navigation field; fall back to
  // legacy `state.h` (mm) divided by 10, then to lastForm, then to 0.
  const initialHAdop =
    state?.hAdop ??
    (state && typeof state.h === "number" ? state.h / 10 : undefined) ??
    lastForm?.hAdop ??
    0;

  const [lx, setLx] = useState(state?.lx ?? lastForm?.lx ?? 4);
  const [ly, setLy] = useState(state?.ly ?? lastForm?.ly ?? 5);
  const [edgeX0, setEdgeX0] = useState<EdgeCondition>(
    (state?.edgeX0 as EdgeCondition) ??
      (lastForm?.edgeX0 as EdgeCondition) ??
      "simple",
  );
  const [edgeXL, setEdgeXL] = useState<EdgeCondition>(
    (state?.edgeXL as EdgeCondition) ??
      (lastForm?.edgeXL as EdgeCondition) ??
      "simple",
  );
  const [edgeY0, setEdgeY0] = useState<EdgeCondition>(
    (state?.edgeY0 as EdgeCondition) ??
      (lastForm?.edgeY0 as EdgeCondition) ??
      "simple",
  );
  const [edgeYL, setEdgeYL] = useState<EdgeCondition>(
    (state?.edgeYL as EdgeCondition) ??
      (lastForm?.edgeYL as EdgeCondition) ??
      "simple",
  );
  const [D, setD] = useState(state?.D ?? lastForm?.D ?? 1.5);
  const [L, setL] = useState(state?.L ?? lastForm?.L ?? 2.0);
  const [fc, setFc] = useState(state?.fc ?? lastForm?.fc ?? 25);
  const [fy, setFy] = useState(state?.fy ?? lastForm?.fy ?? 420);
  const [cover, setCover] = useState(state?.cover ?? lastForm?.cover ?? 15);
  const [hAdop, setHAdop] = useState<number>(initialHAdop);
  const [dBarX, setDBarX] = useState(state?.dBarX ?? lastForm?.dBarX ?? 10);
  const [dBarY, setDBarY] = useState(state?.dBarY ?? lastForm?.dBarY ?? 10);
  const [includeSelfWeight, setIncludeSelfWeight] = useState<boolean>(
    state?.includeSelfWeight ?? lastForm?.includeSelfWeight ?? true,
  );

  // Live-predimensioned h in cm, recomputed whenever any of the geometric
  // inputs or the cover change. Mirrors the engine's designSlab Step 1+2
  // algorithm but rounds to 0.5 cm (the engine rounds to 1 cm; the display
  // here is informational, and the value we pass to the engine is taken from
  // this hPredim when hAdop is 0).
  const hPredim = useMemo(() => {
    const edges = [edgeX0, edgeXL, edgeY0, edgeYL] as const;
    const minLuz = Math.min(lx, ly);
    const maxLuz = Math.max(lx, ly);
    const ratioOk = maxLuz > 0 ? minLuz / maxLuz > 0.5 : false;
    const supportedEdges = edges.filter((e) => e !== "free").length;
    const isCrossed = ratioOk && supportedEdges === 4;
    const fixedEdges = edges.filter((e) => e === "continuo").length;
    const coef = predimCoef(fixedEdges, isCrossed, supportedEdges === 1);
    const lightOrL = isCrossed ? minLuz : unidirectionalSpan(lx, ly, edges);
    const dMin = (lightOrL * 1000) / coef; // mm
    const hMinReg = 90; // mm
    const hPredimMm = Math.max(dMin + cover, hMinReg);
    return Math.ceil(hPredimMm / 10 / 0.5) * 0.5; // cm, rounded up to 0.5
  }, [lx, ly, edgeX0, edgeXL, edgeY0, edgeYL, cover]);

  // Engine-effective h in mm. User's adopted value wins; otherwise the live
  // predimensioned value. This is what the engine sees as `hInput`.
  const hEfectivoMm = (hAdop > 0 ? hAdop : hPredim) * 10;

  const [loadedSaveId, setLoadedSaveId] = useState<string | null>(
    state?.loadedSaveId ?? null,
  );
  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(
    state?.loadedSaveName ?? null,
  );
  const [supportError, setSupportError] = useState<string | null>(null);

  // Clear the support validation error whenever the edge conditions change
  useEffect(() => {
    setSupportError(null);
  }, [edgeX0, edgeXL, edgeY0, edgeYL]);

  // Guard: skip first auto-save to avoid overwriting valid state with defaults
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    saveLastSlabFormState({
      lx,
      ly,
      edgeX0,
      edgeXL,
      edgeY0,
      edgeYL,
      D,
      L,
      fc,
      fy,
      cover,
      hAdop,
      dBarX,
      dBarY,
      includeSelfWeight,
    });
  }, [
    lx,
    ly,
    edgeX0,
    edgeXL,
    edgeY0,
    edgeYL,
    D,
    L,
    fc,
    fy,
    cover,
    hAdop,
    dBarX,
    dBarY,
    includeSelfWeight,
  ]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateSlabSupports([edgeX0, edgeXL, edgeY0, edgeYL]);
    if (err) {
      setSupportError(err);
      return;
    }
    navigate("/slab-results", {
      state: {
        lx,
        ly,
        edgeX0,
        edgeXL,
        edgeY0,
        edgeYL,
        D,
        L,
        fc,
        fy,
        cover,
        h: hEfectivoMm,
        hAdop,
        dBarX,
        dBarY,
        includeSelfWeight,
        loadedSaveId,
        loadedSaveName,
      } as SlabState,
    });
  }

  function handleSaveData() {
    const slabInput: SlabInput = {
      lx,
      ly,
      edges: [edgeX0, edgeXL, edgeY0, edgeYL] as [
        EdgeCondition,
        EdgeCondition,
        EdgeCondition,
        EdgeCondition,
      ],
      D,
      L,
      fc,
      fy,
      cover,
      h: hEfectivoMm,
      dBarX,
      dBarY,
      includeSelfWeight,
    };
    if (loadedSaveId) {
      updateSlabInput(loadedSaveId, slabInput);
      return;
    }
    const name = prompt("Nombre para guardar los datos:");
    if (!name) return;
    try {
      const saved = saveSlabInput(name, slabInput);
      setLoadedSaveId(saved.id);
      setLoadedSaveName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

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
              d="M3 3h18v18H3z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-text flex items-center gap-3">
            Losa
            {loadedSaveName ? (
              <span className="text-sm font-normal text-text-muted bg-surface-alt border border-border px-2.5 py-0.5 rounded-full">
                {loadedSaveName}
              </span>
            ) : (
              <span className="text-sm font-normal text-warning bg-warning/10 border border-warning/30 px-2.5 py-0.5 rounded-full">
                Sin guardar
              </span>
            )}
          </h1>
          <p className="text-sm text-text-muted">CIRSOC 201-05</p>
        </div>
        <button
          type="button"
          onClick={handleSaveData}
          className="text-sm bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
        >
          Guardar datos
        </button>
        <button
          type="button"
          onClick={() => {
            setLx(4);
            setLy(5);
            setEdgeX0("simple");
            setEdgeXL("simple");
            setEdgeY0("simple");
            setEdgeYL("simple");
            setD(1.5);
            setL(2.0);
            setFc(25);
            setFy(420);
            setCover(15);
            setHAdop(0);
            setDBarX(10);
            setDBarY(10);
            setIncludeSelfWeight(true);
            setLoadedSaveId(null);
            setLoadedSaveName(null);
            localStorage.removeItem("mascalculador_last_slab_form");
          }}
          className="text-sm bg-surface-alt border border-border text-text-muted px-3 py-1.5 rounded-lg hover:bg-surface hover:text-text transition-colors"
        >
          + Nueva
        </button>
      </header>

      <SavedBeams
        app="concrete"
        type="losa"
        label="Losas guardadas"
        onLoad={(data, save) => {
          setLoadedSaveId(save.id);
          setLoadedSaveName(save.name);
          const input = (data as unknown as { input: SlabInput }).input;
          if (!input) return;
          if (typeof input.lx === "number") setLx(input.lx);
          if (typeof input.ly === "number") setLy(input.ly);
          if (input.edges) {
            setEdgeX0(input.edges[0]);
            setEdgeXL(input.edges[1]);
            setEdgeY0(input.edges[2]);
            setEdgeYL(input.edges[3]);
          }
          if (typeof input.D === "number") setD(input.D);
          if (typeof input.L === "number") setL(input.L);
          if (typeof input.fc === "number") setFc(input.fc);
          if (typeof input.fy === "number") setFy(input.fy);
          if (typeof input.cover === "number") setCover(input.cover);
          if (typeof input.h === "number") setHAdop(input.h / 10);
          if (typeof input.dBarX === "number") setDBarX(input.dBarX);
          if (typeof input.dBarY === "number") setDBarY(input.dBarY);
          if (typeof input.includeSelfWeight === "boolean")
            setIncludeSelfWeight(input.includeSelfWeight);
        }}
      />

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        className="flex flex-col gap-6"
      >
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            Dimensiones
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                L<sub>x</sub> (m)
              </span>
              <DecimalInput value={lx} onChange={setLx} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                L<sub>y</sub> (m)
              </span>
              <DecimalInput value={ly} onChange={setLy} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Recubrimiento (cm)
              </span>
              <DecimalInput
                value={cover / 10}
                onChange={(v) => setCover(v * 10)}
              />
            </label>
          </div>
        </section>

        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            Condiciones de borde
          </h2>
          {supportError && (
            <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2 mb-3">
              {supportError}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              {
                label: "Borde izquierdo (Izquierdo)",
                val: edgeX0,
                set: setEdgeX0,
              },
              { label: "Borde derecho (Derecho)", val: edgeXL, set: setEdgeXL },
              { label: "Borde superior (Arriba)", val: edgeY0, set: setEdgeY0 },
              { label: "Borde inferior (Abajo)", val: edgeYL, set: setEdgeYL },
            ].map((e) => (
              <label key={e.label} className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">{e.label}</span>
                <select
                  value={e.val}
                  onChange={(ev) => e.set(ev.target.value as EdgeCondition)}
                >
                  {EDGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <div className="col-span-2 sm:col-span-5 mt-2 flex flex-wrap items-center gap-4">
              <div className="text-sm text-text-muted">
                h predim (cm):{" "}
                <span className="font-semibold text-text">
                  {hPredim.toFixed(1)}
                </span>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">
                  h adop (cm) — 0 = usar predim
                </span>
                <DecimalInput value={hAdop} onChange={setHAdop} />
              </label>
            </div>
          </div>
        </section>

        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            Cargas y materiales
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex flex-row items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={includeSelfWeight}
                onChange={(e) => setIncludeSelfWeight(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-xs text-text-muted">
                Incluir peso propio
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                D (kN/m²){" "}
                <span className="text-text-muted/60">
                  —{" "}
                  {includeSelfWeight
                    ? "adicional, peso propio calculado"
                    : "peso propio ya incluido en D"}
                </span>
              </span>
              <DecimalInput value={D} onChange={setD} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">L (kN/m²)</span>
              <DecimalInput value={L} onChange={setL} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                f'<sub>c</sub> (MPa)
              </span>
              <select
                value={fc}
                onChange={(e) => setFc(Number(e.target.value))}
              >
                <option value={20}>20</option>
                <option value={25}>25</option>
                <option value={30}>30</option>
                <option value={35}>35</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                f<sub>y</sub> (MPa)
              </span>
              <select
                value={fy}
                onChange={(e) => setFy(Number(e.target.value))}
              >
                <option value={420}>420</option>
                <option value={500}>500</option>
              </select>
            </label>
          </div>
        </section>

        <button
          type="submit"
          className="self-center bg-primary text-white font-semibold px-8 py-3 rounded-lg hover:bg-primary-hover transition-colors"
        >
          Calcular
        </button>
      </form>
    </MainLayout>
  );
}
