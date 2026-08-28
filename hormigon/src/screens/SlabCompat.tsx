import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { PrintButton } from "@mascalculador/shared";
import {
  getSavedSlabs,
  loadSlab,
  updateSlab,
  saveCompat,
  type SavedSlabData,
} from "../lib/storage";
import { pickObraIfNeeded } from "../components/ObraPicker";
import {
  detectSharedEdge,
  compatibilizeSlabs,
  type EdgeIndex,
  type CompatResult,
} from "../lib/slab-calc";

const EDGE_LABELS: Record<EdgeIndex, string> = {
  0: "Izquierdo",
  1: "Derecho",
  2: "Arriba",
  3: "Abajo",
};

/** El borde compartido exige lados opuestos: Izquierdo↔Derecho, Arriba↔Abajo. */
const OPPOSITE_EDGE: Record<EdgeIndex, EdgeIndex> = { 0: 1, 1: 0, 2: 3, 3: 2 };

/** Convierte los pasos del motor (mm) a cm para su visualización.
 *  Solo se protegen los diámetros de barras (designación comercial en mm)
 *  y el ratio mm²/mm (el patrón mm²/m matchea dentro de "mm²/mm").
 *  La geometría lineal también pasa a cm. */
function postSteps(steps: string[]): string[] {
  const PROTECT_PATTERNS: RegExp[] = [
    /Ø\s*[\d.,]+\s*mm/g,
    /diámetro[^\n]*?mm/g,
    /[\d.,]+\s*mm²\/mm/g,
  ];

  return steps.map((line) => {
    const saved: string[] = [];
    let out = line;
    for (const re of PROTECT_PATTERNS) {
      out = out.replace(re, (m) => {
        saved.push(m);
        return `@@P${saved.length - 1}@@`;
      });
    }
    out = out
      .replace(
        /(\d+\.?\d*)\s*mm²\/m/g,
        (_m: string, n: string) => `${(Number(n) / 100).toFixed(2)} cm²/m`,
      )
      .replace(
        /(\d+\.?\d*)\s*mm²(?!\/)/g,
        (_m: string, n: string) => `${(Number(n) / 100).toFixed(2)} cm²`,
      )
      .replace(
        /(\d+\.?\d*)\s*mm(?!²)/g,
        (_m: string, n: string) => `${(Number(n) / 10).toFixed(1)} cm`,
      );
    // Restaurar los tokens protegidos
    for (let i = 0; i < saved.length; i++) {
      out = out.replace(`@@P${i}@@`, () => saved[i]);
    }
    return out;
  });
}

export default function SlabCompat() {
  const navigate = useNavigate();
  const savedSlabs = useMemo(() => getSavedSlabs(), []);

  const [selectedA, setSelectedA] = useState<string>("");
  const [selectedB, setSelectedB] = useState<string>("");
  const [edgeA, setEdgeA] = useState<EdgeIndex>(0);
  const [result, setResult] = useState<CompatResult | null>(null);

  const slabA: SavedSlabData | null = selectedA ? loadSlab(selectedA) : null;
  const slabB: SavedSlabData | null = selectedB ? loadSlab(selectedB) : null;

  const detection = useMemo(() => {
    if (!slabA || !slabB) return null;
    return detectSharedEdge(slabA.input, slabB.input);
  }, [slabA, slabB]);

  // Autodetección no ambigua: fijar el borde de A; el de B siempre es el opuesto.
  const detectedEdgeA =
    detection && !detection.ambiguous ? detection.edgesA[0] : null;
  if (detectedEdgeA !== null && edgeA !== detectedEdgeA) {
    setEdgeA(detectedEdgeA);
  }

  // El borde de B es el opuesto exacto del de A — no hay otra opción posible.
  const edgeB: EdgeIndex = OPPOSITE_EDGE[edgeA];

  // Momento negativo en los bordes elegidos: 0 → apoyo simple, no se avanza.
  // Una losa guardada solo con datos (sin resultados) no puede aportar Mneg.
  const MnegA = slabA?.result
    ? ((edgeA <= 1 ? slabA.result.x?.Mneg : slabA.result.y?.Mneg) ?? 0)
    : 0;
  const MnegB = slabB?.result
    ? ((edgeB <= 1 ? slabB.result.x?.Mneg : slabB.result.y?.Mneg) ?? 0)
    : 0;
  const zeroMoment = !!detection && (MnegA === 0 || MnegB === 0);

  function handleCompat() {
    if (!slabA || !slabB) return;
    if (zeroMoment) {
      setResult(null);
      return;
    }
    const r = compatibilizeSlabs(slabA, slabB, edgeA, edgeB);
    setResult(r);
  }

  function handleSaveRecalculated() {
    if (!result?.recalculatedResult || !result.recalculatedSlab) return;
    const slabId = result.recalculatedSlab === "A" ? selectedA : selectedB;
    const slab = result.recalculatedSlab === "A" ? slabA : slabB;
    if (!slabId || !slab) return;
    const newEdges = [...slab.input.edges] as [
      (typeof slab.input.edges)[0],
      (typeof slab.input.edges)[1],
      (typeof slab.input.edges)[2],
      (typeof slab.input.edges)[3],
    ];
    const sharedEdge = result.recalculatedSlab === "A" ? edgeA : edgeB;
    newEdges[sharedEdge] = "simple";
    updateSlab(
      slabId,
      { ...slab.input, edges: newEdges },
      result.recalculatedResult,
    );
    alert(`Losa ${result.recalculatedSlab} guardada con borde articulado.`);
  }

  async function handleSaveCompat() {
    if (!result || !slabA || !slabB) return;
    const nameA = savedSlabs.find((s) => s.id === selectedA)?.name || "?";
    const nameB = savedSlabs.find((s) => s.id === selectedB)?.name || "?";
    const name = `Apoyo ${nameA}-${nameB}`;
    const target = await pickObraIfNeeded();
    if (target === null) return;
    try {
      saveCompat(
        name,
        { id: selectedA, name: nameA },
        { id: selectedB, name: nameB },
        edgeA,
        edgeB,
        result,
        target,
      );
      alert(`Compatibilización "${name}" guardada.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  const canCompat =
    selectedA &&
    selectedB &&
    selectedA !== selectedB &&
    !!detection &&
    !zeroMoment;

  return (
    <MainLayout>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">
            Compatibilizar Losas
          </h1>
          <p className="text-sm text-text-muted">
            CIRSOC 201-05 — Compatibilización de apoyos
          </p>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          <button
            onClick={() => navigate("/slab-compats")}
            className="text-sm bg-surface-alt border-border hover:bg-surface text-text-muted"
          >
            Volver a Apoyos losas
          </button>
          <button
            onClick={() => navigate("/slab")}
            className="text-sm bg-surface-alt border-border hover:bg-surface text-text-muted"
          >
            Calcular losas
          </button>
        </div>
      </header>

      {savedSlabs.length < 2 ? (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <p className="text-text-muted">
            Se necesitan al menos 2 losas guardadas.
          </p>
          <p className="text-sm text-text-muted mt-1">
            Calculá y guardá losas desde la pantalla de Losas.
          </p>
        </div>
      ) : (
        <>
          <section className="bg-surface rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
              Seleccionar losas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Losa A</span>
                <select
                  value={selectedA}
                  onChange={(e) => {
                    setSelectedA(e.target.value);
                    setEdgeA(0);
                    setResult(null);
                  }}
                >
                  <option value="">— Seleccionar —</option>
                  {savedSlabs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Losa B</span>
                <select
                  value={selectedB}
                  onChange={(e) => {
                    setSelectedB(e.target.value);
                    setEdgeA(0);
                    setResult(null);
                  }}
                >
                  <option value="">— Seleccionar —</option>
                  {savedSlabs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {selectedA && selectedB && selectedA !== selectedB && !detection && (
            <section className="bg-surface rounded-xl border border-border p-5">
              <p className="text-sm text-warning">
                No se detectó un borde continuo compartido entre estas losas.
                Verificá que ambas tengan bordes enfrentados con condición
                "continuo".
              </p>
            </section>
          )}

          {detection && (
            <section className="bg-surface rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
                Detección de borde
              </h2>
              <p className="text-sm text-text-muted mb-3">
                {detection.message}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    Borde de Losa A
                  </span>
                  <select
                    value={edgeA}
                    onChange={(e) => {
                      setEdgeA(Number(e.target.value) as EdgeIndex);
                      setResult(null);
                    }}
                  >
                    {detection.edgesA.map((e) => (
                      <option key={e} value={e}>
                        {EDGE_LABELS[e]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    Borde de Losa B (opuesto)
                  </span>
                  <p className="text-sm font-semibold text-text border border-border rounded px-2 py-1.5 bg-surface-alt">
                    {EDGE_LABELS[edgeB]}
                  </p>
                </label>
              </div>
              <p className="text-xs text-text-muted mt-2">
                El borde compartido exige lados opuestos: Izquierdo ↔ Derecho y
                Arriba ↔ Abajo.
              </p>
            </section>
          )}

          {zeroMoment && (
            <section className="bg-surface rounded-xl border border-border p-5">
              <p className="text-sm text-warning">
                {MnegA === 0 && (
                  <>
                    El borde <strong>{EDGE_LABELS[edgeA]}</strong> de la Losa A
                    tiene M<sub>neg</sub> = 0 (apoyo simple). No se puede
                    compatibilizar este borde.
                  </>
                )}
                {MnegA !== 0 && MnegB === 0 && (
                  <>
                    El borde <strong>{EDGE_LABELS[edgeB]}</strong> de la Losa B
                    tiene M<sub>neg</sub> = 0 (apoyo simple). No se puede
                    compatibilizar este borde.
                  </>
                )}
              </p>
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
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
                Resultado
              </h2>
              <div
                className={`p-4 rounded-lg text-sm ${result.compatOK ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
              >
                <p className="font-bold">{result.message}</p>
                <div className="mt-2 text-text-muted text-xs space-y-1">
                  <p>M_neg A = {result.MnegA.toFixed(2)} kN·m/m</p>
                  <p>M_neg B = {result.MnegB.toFixed(2)} kN·m/m</p>
                  <p>Ratio = {result.ratio.toFixed(2)}</p>
                  {result.Mcompat && (
                    <p className="font-bold text-text">
                      M_compat = {result.Mcompat.toFixed(2)} kN·m/m
                    </p>
                  )}
                  {result.supportDesign && (
                    <div className="mt-2 p-2 bg-surface-alt rounded text-xs text-text-muted space-y-1">
                      <p className="font-semibold text-text">
                        Armadura de apoyo:
                      </p>
                      <p>
                        A<sub>s</sub> req ={" "}
                        {(result.supportDesign.AsReq / 100).toFixed(2)} cm²/m
                      </p>
                      <p>
                        mín: {(result.supportDesign.AsMin / 100).toFixed(2)}{" "}
                        &middot; s<sub>máx</sub>:{" "}
                        {(result.supportDesign.sMax / 10).toFixed(1)} cm
                      </p>
                      <p className="text-text-muted/60">
                        {result.supportDesign.caseLabel}
                      </p>
                    </div>
                  )}
                  {result.recalculatedResult && (
                    <>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-text">
                          Ver losa recalculada
                        </summary>
                        <pre className="mt-2 p-2 bg-surface-alt rounded text-xs whitespace-pre-wrap">
                          {postSteps(result.recalculatedResult.steps).join(
                            "\n",
                          )}
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
