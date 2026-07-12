import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import MainLayout from "../components/MainLayout";
import { getSavedCompats, deleteCompat, type SavedCompatData } from "../lib/storage";

const EDGE_LABELS: Record<number, string> = {
  0: "Izquierdo",
  1: "Derecho",
  2: "Arriba",
  3: "Abajo",
};

export default function CompatList() {
  const navigate = useNavigate();
  const [compats, setCompats] = useState<SavedCompatData[]>(() => getSavedCompats());
  const grouped = useMemo(() => {
    const map = new Map<string, SavedCompatData[]>();
    for (const c of compats) {
      const key = `${c.slabA.id}-${c.slabB.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [compats]);

  function handleDelete(name: string) {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    deleteCompat(name);
    setCompats(getSavedCompats());
  }

  if (compats.length === 0) {
    return (
      <MainLayout>
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-text">Compatibilizaciones guardadas</h1>
          <button onClick={() => navigate("/slab-compat")} className="text-sm bg-surface-alt border-border hover:bg-surface text-text-muted">
            ← Volver
          </button>
        </header>
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <p className="text-text-muted">No hay compatibilizaciones guardadas.</p>
          <p className="text-sm text-text-muted mt-1">Realizá una compatibilización y guardala para verla acá.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Compatibilizaciones guardadas</h1>
          <p className="text-sm text-text-muted">{compats.length} guardada{compats.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => navigate("/slab-compat")} className="text-sm bg-surface-alt border-border hover:bg-surface text-text-muted">
          ← Volver
        </button>
      </header>

      <div className="space-y-4">
        {compats.map((c) => (
          <section key={c.name} className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-text">{c.name}</h3>
                <p className="text-xs text-text-muted">
                  {c.slabA.name} ({EDGE_LABELS[c.edgeA]}) ↔ {c.slabB.name} ({EDGE_LABELS[c.edgeB]})
                </p>
              </div>
              <button
                onClick={() => handleDelete(c.name)}
                className="text-xs text-text-muted hover:text-warning px-2 py-1"
              >
                Eliminar
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-surface-alt rounded p-2">
                <span className="text-text-muted">M_neg A</span>
                <p className="font-semibold text-text">{c.result.MnegA.toFixed(2)} kN·m/m</p>
              </div>
              <div className="bg-surface-alt rounded p-2">
                <span className="text-text-muted">M_neg B</span>
                <p className="font-semibold text-text">{c.result.MnegB.toFixed(2)} kN·m/m</p>
              </div>
              <div className="bg-surface-alt rounded p-2">
                <span className="text-text-muted">Ratio</span>
                <p className="font-semibold text-text">{c.result.ratio.toFixed(2)}</p>
              </div>
              <div className="bg-surface-alt rounded p-2">
                <span className="text-text-muted">Veredicto</span>
                <p className={`font-semibold ${c.result.compatOK ? "text-success" : "text-warning"}`}>
                  {c.result.compatOK ? "Compatible" : "No compatible"}
                </p>
              </div>
            </div>

            <div className={`mt-2 p-2 rounded text-xs ${c.result.compatOK ? "bg-success/5" : "bg-warning/5"}`}>
              <p className="text-text-muted">{c.result.message}</p>
              {c.result.Mcompat && (
                <p className="font-bold text-text mt-1">
                  M_compat = {c.result.Mcompat.toFixed(2)} kN·m/m
                </p>
              )}
              {c.result.supportDesign && (
                <div className="mt-1 text-text-muted">
                  <p>
                    Armadura de apoyo: A<sub>s</sub> = {c.result.supportDesign.AsReq} mm²/m
                    (mín: {c.result.supportDesign.AsMin}, s<sub>máx</sub>: {c.result.supportDesign.sMax} mm)
                  </p>
                </div>
              )}
              {c.result.recalculatedSlab && (
                <p className="mt-1 text-text-muted">
                  Losa {c.result.recalculatedSlab} recalculada con borde simple.
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </MainLayout>
  );
}
