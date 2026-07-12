import { useState } from "react";
import { useNavigate } from "react-router";
import MainLayout from "../components/MainLayout";
import SavedBeams from "../components/SavedBeams";
import type { EdgeCondition, SlabInput } from "../lib/slab-calc";
import { DecimalInput } from "../hooks/useDecimalField";

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
  h: number;
  dBarX: number;
  dBarY: number;
  /** Id del guardado cargado, si viene de uno existente */
  loadedSaveId?: string | null;
  loadedSaveName?: string | null;
}

const EDGE_OPTIONS: { value: EdgeCondition; label: string }[] = [
  { value: "simple", label: "Apoyado" },
  { value: "continuo", label: "Continuo" },
];

export default function SlabForm() {
  const navigate = useNavigate();
  const [lx, setLx] = useState(4);
  const [ly, setLy] = useState(5);
  const [edgeX0, setEdgeX0] = useState<EdgeCondition>("simple");
  const [edgeXL, setEdgeXL] = useState<EdgeCondition>("simple");
  const [edgeY0, setEdgeY0] = useState<EdgeCondition>("simple");
  const [edgeYL, setEdgeYL] = useState<EdgeCondition>("simple");
  const [D, setD] = useState(1.5);
  const [L, setL] = useState(2.0);
  const [fc, setFc] = useState(25);
  const [fy, setFy] = useState(420);
  const [cover, setCover] = useState(20);
  const [h, setH] = useState(0);
  const [dBarX, setDBarX] = useState(10);
  const [dBarY, setDBarY] = useState(10);

  const [loadedSaveId, setLoadedSaveId] = useState<string | null>(null);
  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        h,
        dBarX,
        dBarY,
        loadedSaveId,
        loadedSaveName,
      } as SlabState,
    });
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
        <div>
          <h1 className="text-xl font-semibold text-text">Losa de H° A°</h1>
          <p className="text-sm text-text-muted">
            {loadedSaveName ? `Editando: ${loadedSaveName}` : "CIRSOC 201-05"}
          </p>
        </div>
      </header>

      <SavedBeams
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
          if (typeof input.h === "number") setH(input.h);
          if (typeof input.dBarX === "number") setDBarX(input.dBarX);
          if (typeof input.dBarY === "number") setDBarY(input.dBarY);
        }}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            Dimensiones
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Luz menor l<sub>x</sub> (m)
              </span>
              <DecimalInput value={lx} onChange={setLx} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Luz mayor l<sub>y</sub> (m)
              </span>
              <DecimalInput value={ly} onChange={setLy} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                h (mm, 0 = calcular)
              </span>
              <DecimalInput value={h} onChange={setH} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Recubrimiento (mm)
              </span>
              <DecimalInput value={cover} onChange={setCover} />
            </label>
          </div>
        </section>

        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            Condiciones de borde
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Borde izquierdo (Izquierdo)", val: edgeX0, set: setEdgeX0 },
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
          </div>
        </section>

        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            Cargas y materiales
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">D (kN/m²)</span>
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
          <div className="grid grid-cols-2 gap-3 mt-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Ø barra X (mm)</span>
              <select
                value={dBarX}
                onChange={(e) => setDBarX(Number(e.target.value))}
              >
                {[6, 8, 10, 12, 16].map((d) => (
                  <option key={d} value={d}>
                    Ø{d}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Ø barra Y (mm)</span>
              <select
                value={dBarY}
                onChange={(e) => setDBarY(Number(e.target.value))}
              >
                {[6, 8, 10, 12, 16].map((d) => (
                  <option key={d} value={d}>
                    Ø{d}
                  </option>
                ))}
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
