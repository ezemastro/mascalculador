import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import MainLayout from "../components/MainLayout";
import { getSavedCompats, getSavedSlabs, loadSlab, deleteCompat, type SavedCompatData } from "../lib/storage";
import { designSupportMoment, type DirectionResult, type EdgeIndex } from "../lib/slab-calc";

const EDGE_LABELS: Record<number, string> = {
  0: "Izquierdo",
  1: "Derecho",
  2: "Arriba",
  3: "Abajo",
};

function SupportDesignCard({ mu, d, h, fc, fy, dB, label }: { mu: number; d: number; h: number; fc: number; fy: number; dB: number; label: string }) {
  const sd = designSupportMoment(Math.abs(mu), d, h, fc, fy, 1000, dB, mu);
  return (
    <div className="bg-surface-alt rounded p-3 text-xs">
      <p className="font-semibold text-text">{label}: M = {mu.toFixed(2)} kN·m/m</p>
      <div className="mt-1 text-text-muted space-y-0.5">
        <p>A<sub>s</sub> req = {sd.AsReq} mm²/m</p>
        <p>A<sub>s</sub> mín = {sd.AsMin} &middot; s<sub>máx</sub> = {sd.sMax} mm</p>
        <p className="text-text-muted/60">{sd.caseLabel}</p>
      </div>
    </div>
  );
}

export default function CompatList() {
  const navigate = useNavigate();
  const [compats, setCompats] = useState<SavedCompatData[]>(() => getSavedCompats());
  const savedSlabs = useMemo(() => getSavedSlabs(), []);

  // Individual support designer state
  const [selectedSlabId, setSelectedSlabId] = useState("");
  const [selectedEdge, setSelectedEdge] = useState<EdgeIndex>(0);

  const slab = selectedSlabId ? loadSlab(selectedSlabId) : null;
  const continuousEdges: EdgeIndex[] = slab
    ? ([0, 1, 2, 3] as EdgeIndex[]).filter((i) => slab.input.edges[i] === "continuo")
    : [];

  const supportEdge = continuousEdges.includes(selectedEdge) ? selectedEdge : continuousEdges[0];

  function handleDelete(name: string) {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    deleteCompat(name);
    setCompats(getSavedCompats());
  }

  return (
    <MainLayout>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Armaduras de apoyo</h1>
          <p className="text-sm text-text-muted">
            {compats.length} compatibilizaci{compats.length !== 1 ? "ones" : "ón"} guardada{compats.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => navigate("/slab-compat")} className="text-sm bg-surface-alt border-border hover:bg-surface text-text-muted">
          ← Volver
        </button>
      </header>

      {/* Individual support designer */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Diseñar apoyo individual</h2>
        {savedSlabs.length === 0 ? (
          <p className="text-sm text-text-muted">No hay losas guardadas. Guardá una losa desde la calculadora.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Losa</span>
                <select
                  value={selectedSlabId}
                  onChange={(e) => { setSelectedSlabId(e.target.value); setSelectedEdge(0); }}
                >
                  <option value="">— Seleccionar —</option>
                  {savedSlabs.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Borde continuo</span>
                <select
                  value={supportEdge}
                  onChange={(e) => setSelectedEdge(Number(e.target.value) as EdgeIndex)}
                  disabled={continuousEdges.length === 0}
                >
                  {continuousEdges.length === 0 ? (
                    <option value="">— Sin bordes continuos —</option>
                  ) : (
                    continuousEdges.map((e) => (
                      <option key={e} value={e}>{EDGE_LABELS[e]}</option>
                    ))
                  )}
                </select>
              </label>
            </div>

            {slab && supportEdge !== undefined && continuousEdges.includes(supportEdge) && (
              <SupportDesignCard
                mu={supportEdge <= 1
                  ? (supportEdge === 0 ? slab.result.MnegIzq : slab.result.MnegDer)
                  : (supportEdge === 2 ? slab.result.MnegArr : slab.result.MnegAba)}
                d={slab.result.d}
                h={slab.result.h}
                fc={slab.input.fc}
                fy={slab.input.fy}
                dB={supportEdge <= 1 ? slab.input.dBarX : slab.input.dBarY}
                label={`${slab.input.lx}×${slab.input.ly} m — ${EDGE_LABELS[supportEdge]}`}
              />
            )}

            {slab && continuousEdges.length === 0 && (
              <p className="text-sm text-text-muted">Esta losa no tiene bordes continuos.</p>
            )}
          </>
        )}
      </section>

      {/* Saved compatibilizations */}
      {compats.length > 0 && (
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Compatibilizaciones guardadas</h2>
          <div className="space-y-4">
            {compats.map((c) => (
              <div key={c.name} className="bg-surface-alt rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-text text-sm">{c.name}</h3>
                    <p className="text-xs text-text-muted">
                      {c.slabA.name} ({EDGE_LABELS[c.edgeA]}) ↔ {c.slabB.name} ({EDGE_LABELS[c.edgeB]})
                    </p>
                  </div>
                  <button onClick={() => handleDelete(c.name)} className="text-xs text-text-muted hover:text-warning px-2 py-1">
                    Eliminar
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-surface rounded p-2">
                    <span className="text-text-muted">M_neg A</span>
                    <p className="font-semibold text-text">{c.result.MnegA.toFixed(2)} kN·m/m</p>
                  </div>
                  <div className="bg-surface rounded p-2">
                    <span className="text-text-muted">M_neg B</span>
                    <p className="font-semibold text-text">{c.result.MnegB.toFixed(2)} kN·m/m</p>
                  </div>
                  <div className="bg-surface rounded p-2">
                    <span className="text-text-muted">Ratio</span>
                    <p className="font-semibold text-text">{c.result.ratio.toFixed(2)}</p>
                  </div>
                  <div className="bg-surface rounded p-2">
                    <span className="text-text-muted">Veredicto</span>
                    <p className={`font-semibold ${c.result.compatOK ? "text-success" : "text-warning"}`}>
                      {c.result.compatOK ? "Compatible" : "No compatible"}
                    </p>
                  </div>
                </div>

                <div className={`mt-2 p-2 rounded text-xs ${c.result.compatOK ? "bg-success/5" : "bg-warning/5"}`}>
                  <p className="text-text-muted">{c.result.message}</p>
                  {c.result.Mcompat && (
                    <p className="font-bold text-text mt-1">M_compat = {c.result.Mcompat.toFixed(2)} kN·m/m</p>
                  )}
                  {c.result.supportDesign && (
                    <div className="mt-1 text-text-muted">
                      <p>A<sub>s</sub> apoyo = {c.result.supportDesign.AsReq} mm²/m
                        (mín: {c.result.supportDesign.AsMin}, s<sub>máx</sub>: {c.result.supportDesign.sMax} mm)</p>
                    </div>
                  )}
                  {c.result.recalculatedSlab && (
                    <p className="mt-1 text-text-muted">Losa {c.result.recalculatedSlab} recalculada con borde simple.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </MainLayout>
  );
}
