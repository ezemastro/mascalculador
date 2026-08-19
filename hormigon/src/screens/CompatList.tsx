import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { getSavedCompats, getSavedSlabs, loadSlab, deleteCompat, type SavedCompatData } from "../lib/storage";
import { designSupportMoment, type DirectionResult, type EdgeIndex } from "../lib/slab-calc";

const BAR_DIAMETERS = [6, 8, 10, 12, 16, 20];
const BAR_AREA: Record<number, number> = { 6: 28.3, 8: 50.3, 10: 78.5, 12: 113.1, 16: 201.1, 20: 314.2 };

const EDGE_LABELS: Record<number, string> = {
  0: "Izquierdo",
  1: "Derecho",
  2: "Arriba",
  3: "Abajo",
};

function CompatCard({ data, supportDesign, onDelete }: {
  data: SavedCompatData;
  supportDesign: DirectionResult | null;
  onDelete: (name: string) => void;
}) {
  const [diam, setDiam] = useState(10);
  const [sep, setSep] = useState(150);

  const requiredAs = supportDesign?.AsReq ?? 0;

  // Available from bent bars: 50% of adopted span As from each slab
  const slabA = loadSlab(data.slabA.id);
  const slabB = loadSlab(data.slabB.id);
  const adoptedA = slabA ? (data.edgeA <= 1 ? (slabA.result.adoptedAsX ?? 0) : (slabA.result.adoptedAsY ?? 0)) : 0;
  const adoptedB = slabB ? (data.edgeB <= 1 ? (slabB.result.adoptedAsX ?? 0) : (slabB.result.adoptedAsY ?? 0)) : 0;
  const availableFromSpan = (adoptedA + adoptedB) / 4; // 50% of avg adopted from both slabs
  const additionalNeeded = Math.max(0, requiredAs - availableFromSpan);

  const barArea = BAR_AREA[diam] || 0;
  const providedAs = sep > 0 ? Math.round((barArea * 1000) / sep) : 0;
  const totalAs = availableFromSpan + providedAs;
  const ok = totalAs >= requiredAs;

  return (
    <div className="bg-surface-alt rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-text text-sm">{data.name}</h3>
          <p className="text-xs text-text-muted">
            {data.slabA.name} ({EDGE_LABELS[data.edgeA]}) ↔ {data.slabB.name} ({EDGE_LABELS[data.edgeB]})
          </p>
        </div>
        <button onClick={() => onDelete(data.name)} className="text-xs text-text-muted hover:text-warning px-2 py-1">
          Eliminar
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-surface rounded p-2">
          <span className="text-text-muted">M_neg A</span>
          <p className="font-semibold text-text">{data.result.MnegA.toFixed(2)} kN·m/m</p>
        </div>
        <div className="bg-surface rounded p-2">
          <span className="text-text-muted">M_neg B</span>
          <p className="font-semibold text-text">{data.result.MnegB.toFixed(2)} kN·m/m</p>
        </div>
        <div className="bg-surface rounded p-2">
          <span className="text-text-muted">Ratio</span>
          <p className="font-semibold text-text">{data.result.ratio.toFixed(2)}</p>
        </div>
        <div className="bg-surface rounded p-2">
          <span className="text-text-muted">Veredicto</span>
          <p className={`font-semibold ${data.result.compatOK ? "text-success" : "text-warning"}`}>
            {data.result.compatOK ? "Compatible" : "No compatible"}
          </p>
        </div>
      </div>

      <div className={`mt-2 p-2 rounded text-xs ${data.result.compatOK ? "bg-success/5" : "bg-warning/5"}`}>
        <p className="text-text-muted">{data.result.message}</p>
        {data.result.Mcompat && (
          <p className="font-bold text-text mt-1">M_compat = {data.result.Mcompat.toFixed(2)} kN·m/m</p>
        )}
        {data.result.recalculatedSlab && (
          <p className="mt-1 text-text-muted">Losa {data.result.recalculatedSlab} recalculada con borde simple.</p>
        )}
      </div>

      {/* Support reinforcement designer */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mb-3">
          <div>
            <span className="text-text-muted">As apoyo necesario</span>
            <p className="font-bold text-primary">{requiredAs} mm²/m</p>
          </div>
          <div>
            <span className="text-text-muted">As disponible (barras dobladas)</span>
            <p className="font-bold text-text">{Math.round(availableFromSpan)} mm²/m</p>
            <span className="text-text-muted/60">= 50% × avg({adoptedA}, {adoptedB})</span>
          </div>
          <div>
            <span className="text-text-muted">As adicional</span>
            <p className="font-bold text-warning">{additionalNeeded} mm²/m</p>
            <span className="text-text-muted/60">= máx(0, nec − 50%·adopt)</span>
          </div>
        </div>

        <div className="flex gap-3 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Ø (mm)</span>
            <select value={diam} onChange={(e) => setDiam(Number(e.target.value))} className="w-20">
              {BAR_DIAMETERS.map((d) => (
                <option key={d} value={d}>Ø{d}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Sep (mm)</span>
            <input
              type="text"
              value={sep}
              onChange={(e) => setSep(Number(e.target.value) || 0)}
              className="w-20 bg-surface border border-border rounded px-2 py-1 text-text text-sm"
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Provisto</span>
            <p className="text-sm font-bold text-text">{providedAs} mm²/m</p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Total</span>
            <p className="text-sm font-bold text-primary">{totalAs} mm²/m</p>
          </div>
          <span className={`text-sm font-semibold pb-1 ${ok ? "text-success" : "text-warning"}`}>
            {ok ? "✓" : "✗"}
          </span>
        </div>
        {additionalNeeded === 0 && (
          <p className="text-xs text-success mt-1">Cubierto con barras dobladas, no requiere adicionales.</p>
        )}
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
  const [supDiam, setSupDiam] = useState(10);
  const [supSep, setSupSep] = useState(150);

  const slab = selectedSlabId ? loadSlab(selectedSlabId) : null;
  const continuousEdges: EdgeIndex[] = slab
    ? ([0, 1, 2, 3] as EdgeIndex[]).filter((i) => slab.input.edges[i] === "continuo")
    : [];

  const supportEdge = continuousEdges.includes(selectedEdge) ? selectedEdge : continuousEdges[0];

  // Get Mneg for the selected edge
  const mneg = slab && supportEdge !== undefined && continuousEdges.includes(supportEdge)
    ? (supportEdge <= 1
      ? (supportEdge === 0 ? slab.result.MnegIzq : slab.result.MnegDer)
      : (supportEdge === 2 ? slab.result.MnegArr : slab.result.MnegAba))
    : 0;

  const adoptedSpanAs = slab
    ? (supportEdge <= 1 ? (slab.result.adoptedAsX ?? 0) : (slab.result.adoptedAsY ?? 0))
    : 0;

  // Available from bent bars = 50% of adopted span As (from saved slab)
  const availableFromSpan = adoptedSpanAs / 2;

  // Required support As from Mneg
  const supportDesign = slab && mneg !== 0
    ? designSupportMoment(
        Math.abs(mneg),
        slab.result.d,
        slab.result.h,
        slab.input.fc,
        slab.input.fy,
        1000,
        supportEdge <= 1 ? slab.input.dBarX : slab.input.dBarY,
        mneg,
      )
    : null;

  const supportAsReq = supportDesign?.AsReq ?? 0;
  const additionalAsNeeded = Math.max(0, supportAsReq - availableFromSpan);

  // Additional bars provided
  const barArea = BAR_AREA[supDiam] || 0;
  const supProvided = supSep > 0 ? Math.round((barArea * 1000) / supSep) : 0;
  const totalSupportAs = availableFromSpan + supProvided;

  function handleDelete(name: string) {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    deleteCompat(name);
    setCompats(getSavedCompats());
  }

  return (
    <MainLayout>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Apoyos losas</h1>
          <p className="text-sm text-text-muted">
            {compats.length} compatibilizaci{compats.length !== 1 ? "ones" : "ón"} guardada{compats.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => navigate("/slab-compat")} className="text-sm bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
          + Nueva compatibilización
        </button>
      </header>

      {/* Individual support designer */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Diseñar apoyo individual</h2>
        {savedSlabs.length === 0 ? (
          <p className="text-sm text-text-muted">No hay losas guardadas.</p>
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
                  onChange={(e) => { setSelectedEdge(Number(e.target.value) as EdgeIndex); }}
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

            {slab && supportEdge !== undefined && continuousEdges.includes(supportEdge) && supportDesign && (
              <div className="space-y-3">
                {/* Summary */}
                <div className="bg-surface-alt rounded-lg p-3 text-sm">
                  <p>
                    <span className="text-text-muted">Losa:</span>{" "}
                    <strong>{slab.input.lx}×{slab.input.ly} m</strong> — Borde{" "}
                    <strong>{EDGE_LABELS[supportEdge]}</strong>
                  </p>
                  <p className="mt-1">
                    <span className="text-text-muted">M<sub>neg</sub> =</span>{" "}
                    <strong className="text-primary">{mneg.toFixed(2)} kN·m/m</strong>
                  </p>
                </div>

                {/* Calculation steps */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-surface-alt rounded-lg p-3">
                    <span className="text-text-muted">As apoyo necesario</span>
                    <p className="text-lg font-bold text-primary">{supportAsReq} mm²/m</p>
                    <p className="text-text-muted/60">s<sub>máx</sub> = {supportDesign.sMax} mm</p>
                  </div>
                  <div className="bg-surface-alt rounded-lg p-3">
                    <span className="text-text-muted">As disponible (barras dobladas)</span>
                    <p className="text-lg font-bold text-text mt-1">{Math.round(availableFromSpan)} mm²/m</p>
                    <p className="text-text-muted/60">
                      = 50% × {adoptedSpanAs} mm²/m (adoptado)
                    </p>
                  </div>
                  <div className="bg-surface-alt rounded-lg p-3">
                    <span className="text-text-muted">As adicional necesario</span>
                    <p className="text-lg font-bold text-warning">{additionalAsNeeded} mm²/m</p>
                    <p className="text-text-muted/60">= máx(0, nec − disp)</p>
                  </div>
                </div>

                {/* Additional bars selector */}
                <div className="bg-surface-alt rounded-lg p-3">
                  <p className="text-sm font-semibold text-text mb-2">
                    Barras adicionales en apoyo
                    {additionalAsNeeded === 0 && (
                      <span className="text-success text-xs ml-2">— Cubierto con barras dobladas</span>
                    )}
                  </p>
                  <div className="flex gap-3 items-end">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-text-muted">Ø (mm)</span>
                      <select value={supDiam} onChange={(e) => setSupDiam(Number(e.target.value))} className="w-20">
                        {BAR_DIAMETERS.map((d) => (
                          <option key={d} value={d}>Ø{d}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-text-muted">Sep (mm)</span>
                      <input
                        type="text"
                        value={supSep}
                        onChange={(e) => setSupSep(Number(e.target.value) || 0)}
                        className="w-20 bg-surface border border-border rounded px-2 py-1 text-text text-sm"
                      />
                    </label>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-text-muted">Provisto</span>
                      <p className="text-sm font-bold text-text">{supProvided} mm²/m</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-sm">
                      <span className="text-text-muted">Total apoyo:</span>{" "}
                      <strong className="text-primary">{totalSupportAs} mm²/m</strong>
                      <span className={`text-xs ml-2 ${totalSupportAs >= supportAsReq ? "text-success" : "text-warning"}`}>
                        {totalSupportAs >= supportAsReq ? "✓ Cumple" : "✗ No cumple"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
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
            {compats.map((c) => {
              const supportMoment = c.result.Mcompat ?? Math.min(c.result.MnegA, c.result.MnegB);
              // Load slab data for reinforcement design
              const refSlab = loadSlab(c.slabA.id);
              const supportDesign = refSlab
                ? designSupportMoment(
                    Math.abs(supportMoment),
                    refSlab.result.d,
                    refSlab.result.h,
                    refSlab.input.fc,
                    refSlab.input.fy,
                    1000,
                    c.edgeA <= 1 ? refSlab.input.dBarX : refSlab.input.dBarY,
                    supportMoment,
                  )
                : null;

              return (
                <CompatCard
                  key={c.name}
                  data={c}
                  supportDesign={supportDesign}
                  onDelete={handleDelete}
                />
              );
            })}
          </div>
        </section>
      )}
    </MainLayout>
  );
}
