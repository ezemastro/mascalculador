import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { getSavedSlabs, loadSlab, updateSlab, saveCompat, type SavedSlabData } from "../lib/storage";
import { detectSharedEdge, compatibilizeSlabs, type EdgeIndex, type CompatResult } from "../lib/slab-calc";

const EDGE_LABELS: Record<EdgeIndex, string> = {
  0: "Izquierdo",
  1: "Derecho",
  2: "Arriba",
  3: "Abajo",
};

export default function SlabCompat() {
  const navigate = useNavigate();
  const savedSlabs = useMemo(() => getSavedSlabs(), []);

  const [selectedA, setSelectedA] = useState<string>("");
  const [selectedB, setSelectedB] = useState<string>("");
  const [edgeA, setEdgeA] = useState<EdgeIndex>(0);
  const [edgeB, setEdgeB] = useState<EdgeIndex>(0);
  const [result, setResult] = useState<CompatResult | null>(null);

  const slabA: SavedSlabData | null = selectedA ? loadSlab(selectedA) : null;
  const slabB: SavedSlabData | null = selectedB ? loadSlab(selectedB) : null;

  const detection = useMemo(() => {
    if (!slabA || !slabB) return null;
    return detectSharedEdge(slabA.input, slabB.input);
  }, [slabA, slabB]);

  useEffect(() => {
    if (detection && !detection.ambiguous) {
      setEdgeA(detection.edgesA[0]);
      setEdgeB(detection.edgesB[0]);
    }
  }, [detection]);

  function handleCompat() {
    if (!slabA || !slabB) return;
    const r = compatibilizeSlabs(slabA, slabB, edgeA, edgeB);
    setResult(r);
  }

  function handleSaveRecalculated() {
    if (!result?.recalculatedResult || !result.recalculatedSlab) return;
    const slabId = result.recalculatedSlab === "A" ? selectedA : selectedB;
    const slab = result.recalculatedSlab === "A" ? slabA : slabB;
    if (!slabId || !slab) return;
    const newEdges = [...slab.input.edges] as [typeof slab.input.edges[0], typeof slab.input.edges[1], typeof slab.input.edges[2], typeof slab.input.edges[3]];
    const sharedEdge = result.recalculatedSlab === "A" ? edgeA : edgeB;
    newEdges[sharedEdge] = "simple";
    updateSlab(slabId, { ...slab.input, edges: newEdges }, result.recalculatedResult);
    alert(`Losa ${result.recalculatedSlab} guardada con borde articulado.`);
  }

  function handleSaveCompat() {
    if (!result || !slabA || !slabB) return;
    const nameA = savedSlabs.find(s => s.id === selectedA)?.name || "?";
    const nameB = savedSlabs.find(s => s.id === selectedB)?.name || "?";
    const name = `Apoyo ${nameA}-${nameB}`;
    try {
      saveCompat(name, { id: selectedA, name: nameA }, { id: selectedB, name: nameB }, edgeA, edgeB, result);
      alert(`Compatibilización "${name}" guardada.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  const canCompat = selectedA && selectedB && selectedA !== selectedB && !!detection;

  return (
    <MainLayout>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Compatibilizar Losas</h1>
          <p className="text-sm text-text-muted">CIRSOC 201-05 — Compatibilización de apoyos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate("/slab-compats")} className="text-sm bg-surface-alt border-border hover:bg-surface text-text-muted">
            Volver a Apoyos losas
          </button>
          <button onClick={() => navigate("/slab")} className="text-sm bg-surface-alt border-border hover:bg-surface text-text-muted">
            Calcular losas
          </button>
        </div>
      </header>

      {savedSlabs.length < 2 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <p className="text-text-muted">Se necesitan al menos 2 losas guardadas.</p>
          <p className="text-sm text-text-muted mt-1">Calculá y guardá losas desde la pantalla de Losas.</p>
        </div>
      ) : (
        <>
          <section className="bg-surface rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Seleccionar losas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Losa A</span>
                <select value={selectedA} onChange={(e) => { setSelectedA(e.target.value); setResult(null); }}>
                  <option value="">— Seleccionar —</option>
                  {savedSlabs.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Losa B</span>
                <select value={selectedB} onChange={(e) => { setSelectedB(e.target.value); setResult(null); }}>
                  <option value="">— Seleccionar —</option>
                  {savedSlabs.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {selectedA && selectedB && selectedA !== selectedB && !detection && (
            <section className="bg-surface rounded-xl border border-border p-5">
              <p className="text-sm text-warning">No se detectó un borde continuo compartido entre estas losas. Verificá que ambas tengan bordes enfrentados con condición "continuo".</p>
            </section>
          )}

          {detection && (
            <section className="bg-surface rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Detección de borde</h2>
              <p className="text-sm text-text-muted mb-3">{detection.message}</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Borde de Losa A</span>
                  <select value={edgeA} onChange={(e) => setEdgeA(Number(e.target.value) as EdgeIndex)}>
                    {detection.edgesA.map(e => (
                      <option key={e} value={e}>{EDGE_LABELS[e]}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Borde de Losa B</span>
                  <select value={edgeB} onChange={(e) => setEdgeB(Number(e.target.value) as EdgeIndex)}>
                    {detection.edgesB.map(e => (
                      <option key={e} value={e}>{EDGE_LABELS[e]}</option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          )}

          <button
            onClick={handleCompat}
            disabled={!canCompat}
            className="self-center bg-primary text-white font-semibold px-8 py-3 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
          >
            Compatibilizar
          </button>

          {result && (
            <section className="bg-surface rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Resultado</h2>
              <div className={`p-4 rounded-lg text-sm ${result.compatOK ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                <p className="font-bold">{result.message}</p>
                <div className="mt-2 text-text-muted text-xs space-y-1">
                  <p>M_neg A = {result.MnegA.toFixed(2)} kN·m/m</p>
                  <p>M_neg B = {result.MnegB.toFixed(2)} kN·m/m</p>
                  <p>Ratio = {result.ratio.toFixed(2)}</p>
                  {result.Mcompat && <p className="font-bold text-text">M_compat = {result.Mcompat.toFixed(2)} kN·m/m</p>}
                  {result.supportDesign && (
                    <div className="mt-2 p-2 bg-surface-alt rounded text-xs text-text-muted space-y-1">
                      <p className="font-semibold text-text">Armadura de apoyo:</p>
                      <p>A<sub>s</sub> req = {result.supportDesign.AsReq} mm²/m</p>
                      <p>mín: {result.supportDesign.AsMin} &middot; s<sub>máx</sub>: {result.supportDesign.sMax} mm</p>
                      <p className="text-text-muted/60">{result.supportDesign.caseLabel}</p>
                    </div>
                  )}
                  {result.recalculatedResult && (
                    <>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-text">Ver losa recalculada</summary>
                        <pre className="mt-2 p-2 bg-surface-alt rounded text-xs whitespace-pre-wrap">
                          {result.recalculatedResult.steps.join("\n")}
                        </pre>
                      </details>
                      <button
                        onClick={handleSaveRecalculated}
                        className="mt-3 text-sm bg-primary text-white font-semibold px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors"
                      >
                        Guardar losa {result.recalculatedSlab} corregida
                      </button>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={handleSaveCompat}
                className="mt-3 text-sm bg-primary text-white font-semibold px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors"
              >
                Guardar compatibilización
              </button>
            </section>
          )}
        </>
      )}
    </MainLayout>
  );
}
