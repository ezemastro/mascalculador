import { useState } from "react";
import { useNavigate } from "react-router";
import MainLayout from "../components/MainLayout";

export default function FormPage() {
  const navigate = useNavigate();
  const [length, setLength] = useState(6);
  const [support1Pos, setSupport1Pos] = useState(0);
  const [support1Type, setSupport1Type] = useState<SupportType>("simple");
  const [support2Pos, setSupport2Pos] = useState(6);
  const [support2Type, setSupport2Type] = useState<SupportType>("simple");
  const [loads, setLoads] = useState<Load[]>([]);

  function addLoad() {
    setLoads([
      ...loads,
      { id: Math.random().toString(36).slice(2) + Date.now().toString(36), type: "point", magnitude: 0 },
    ]);
  }

  function removeLoad(id: string) {
    setLoads(loads.filter((l) => l.id !== id));
  }

  function updateLoad(id: string, patch: Partial<Load>) {
    setLoads(loads.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const beamConfig: BeamConfig = {
      length,
      supports: [
        { position: support1Pos, type: support1Type },
        { position: support2Pos, type: support2Type },
      ],
    };
    navigate("/results", { state: { loads, beamConfig } });
  }

  const valid =
    length > 0 &&
    support1Pos !== support2Pos &&
    loads.length > 0 &&
    loads.every((l) => l.magnitude !== 0);

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
              d="M9 7h6m-6 4h6m-6 4h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text">
            Calculadora de Vigas
          </h1>
          <p className="text-sm text-text-muted">
            Definí la viga y sus cargas
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Beam config */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Configuración de la Viga
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-text-muted font-medium">
                Luz total (m)
              </span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={length || ""}
                onChange={(e) => setLength(Number(e.target.value))}
                className="w-full"
              />
            </label>
          </div>
        </section>

        {/* Supports */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Apoyos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2 p-3 bg-surface-alt rounded-lg">
              <span className="text-xs text-text-muted font-medium">
                Apoyo A
              </span>
              <div className="flex gap-2">
                <select
                  value={support1Type}
                  onChange={(e) =>
                    setSupport1Type(e.target.value as SupportType)
                  }
                >
                  <option value="simple">Simple</option>
                  <option value="fixed">Empotrado</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={length}
                  placeholder="Posición"
                  value={support1Pos ?? ""}
                  onChange={(e) => setSupport1Pos(Number(e.target.value))}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 p-3 bg-surface-alt rounded-lg">
              <span className="text-xs text-text-muted font-medium">
                Apoyo B
              </span>
              <div className="flex gap-2">
                <select
                  value={support2Type}
                  onChange={(e) =>
                    setSupport2Type(e.target.value as SupportType)
                  }
                >
                  <option value="simple">Simple</option>
                  <option value="fixed">Empotrado</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={length}
                  placeholder="Posición"
                  value={support2Pos ?? ""}
                  onChange={(e) => setSupport2Pos(Number(e.target.value))}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          {support1Pos === support2Pos && (
            <p className="text-danger text-xs mt-2">
              Los apoyos deben estar en posiciones distintas
            </p>
          )}
        </section>

        {/* Loads */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
              Cargas
            </h2>
            <button
              type="button"
              onClick={addLoad}
              className="text-sm bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
            >
              + Añadir carga
            </button>
          </div>

          {loads.length === 0 && (
            <p className="text-sm text-text-muted py-4 text-center">
              No hay cargas definidas. Agregá al menos una.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {loads.map((load) => (
              <div
                key={load.id}
                className="flex flex-wrap items-center gap-2 p-3 bg-surface-alt rounded-lg"
              >
                <select
                  value={load.type}
                  onChange={(e) =>
                    updateLoad(load.id, {
                      type: e.target.value as "point" | "distributed",
                    })
                  }
                  className="w-32"
                >
                  <option value="point">Puntual</option>
                  <option value="distributed">Distribuida</option>
                </select>

                <input
                  type="number"
                  step="0.1"
                  placeholder="Magnitud (kN)"
                  value={load.magnitude || ""}
                  onChange={(e) =>
                    updateLoad(load.id, {
                      magnitude: Number(e.target.value),
                    })
                  }
                  className="w-32"
                />

                {load.type === "point" ? (
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={length}
                    placeholder="Posición (m)"
                    value={load.position ?? ""}
                    onChange={(e) =>
                      updateLoad(load.id, {
                        position: Number(e.target.value),
                      })
                    }
                    className="w-32"
                  />
                ) : (
                  <>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={length}
                      placeholder="Inicio (m)"
                      value={load.start ?? ""}
                      onChange={(e) =>
                        updateLoad(load.id, {
                          start: Number(e.target.value),
                        })
                      }
                      className="w-28"
                    />
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={length}
                      placeholder="Fin (m)"
                      value={load.end ?? ""}
                      onChange={(e) =>
                        updateLoad(load.id, {
                          end: Number(e.target.value),
                        })
                      }
                      className="w-28"
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={() => removeLoad(load.id)}
                  className="ml-auto text-danger hover:bg-danger/10 border-danger/20 text-sm px-2 py-1"
                  title="Eliminar carga"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={!valid}
          className="self-center bg-primary text-white font-semibold px-8 py-3 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
        >
          Calcular
        </button>
      </form>
    </MainLayout>
  );
}
