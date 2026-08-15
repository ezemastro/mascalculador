import { useState } from "react";
import { useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { DecimalInput } from "@mascalculador/shared";
import type { AnalysisLoad, VigaContinuaState } from "../lib/viga-continua";

export default function VigaContinuaForm() {
  const navigate = useNavigate();

  const [spanCount, setSpanCount] = useState(1);
  const [spanLengths, setSpanLengths] = useState<number[]>([6]);
  const [supportTypes, setSupportTypes] = useState<SupportType[]>([
    "simple",
    "simple",
  ]);
  const [loads, setLoads] = useState<AnalysisLoad[]>([]);

  const totalLength = spanLengths.reduce((a, b) => a + b, 0);

  function setSpanCountAndAdjust(count: number) {
    setSpanLengths((prev) =>
      count > prev.length
        ? [...prev, ...Array(count - prev.length).fill(6)]
        : prev.slice(0, count),
    );
    setSupportTypes((prev) =>
      count + 1 > prev.length
        ? [...prev, ...Array(count + 1 - prev.length).fill("simple")]
        : prev.slice(0, count + 1),
    );
    setSpanCount(count);
  }

  function addLoad() {
    setLoads([
      ...loads,
      {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        type: "point",
        D: 0,
        L: 0,
      },
    ]);
  }

  function removeLoad(id: string) {
    setLoads(loads.filter((l) => l.id !== id));
  }

  function updateLoad(id: string, patch: Partial<AnalysisLoad>) {
    setLoads(loads.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function handleSubmit() {
    navigate("/viga-continua-results", {
      state: { spans: spanLengths, supportTypes, loads } as VigaContinuaState,
    });
  }

  const valid =
    spanLengths.every((l) => l > 0) &&
    supportTypes.some((t) => t !== "free") &&
    loads.some((l) => l.D + l.L > 0);

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
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-text">Viga Continua</h1>
          <p className="text-sm text-text-muted">
            Análisis estructural — envolvente de esfuerzos
          </p>
        </div>
      </header>

      <form
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        className="flex flex-col gap-6"
      >
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Viga
          </h2>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-text-muted font-medium">
                Cantidad de tramos
              </span>
              <select
                value={spanCount}
                onChange={(e) => setSpanCountAndAdjust(Number(e.target.value))}
                className="w-40"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {spanLengths.map((len, i) => (
                <label key={i} className="flex flex-col gap-1.5">
                  <span className="text-xs text-text-muted font-medium">
                    Tramo {i + 1} (m)
                  </span>
                  <DecimalInput
                    value={len}
                    onChange={(n) =>
                      setSpanLengths((p) => p.map((l, j) => (j === i ? n : l)))
                    }
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              Luz total: {totalLength.toFixed(2)} m
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-surface rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
              Apoyos
            </h2>
            <div className="flex flex-col gap-2">
              {supportTypes.map((type, i) => {
                const isEnd = i === 0 || i === supportTypes.length - 1;
                const pos = spanLengths.slice(0, i).reduce((a, b) => a + b, 0);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 bg-surface-alt rounded-lg"
                  >
                    <span className="text-xs text-text-muted w-16">
                      {supportTypes.length === 2
                        ? i === 0
                          ? "Ap. A"
                          : "Ap. B"
                        : `Ap. ${i + 1}`}
                    </span>
                    <span className="text-xs text-text-muted">
                      x={pos.toFixed(1)}
                    </span>
                    <select
                      value={type}
                      onChange={(e) =>
                        setSupportTypes((p) =>
                          p.map((t, j) =>
                            j === i ? (e.target.value as SupportType) : t,
                          ),
                        )
                      }
                      className="flex-1"
                    >
                      <option value="simple">Articulado</option>
                      <option value="fixed">Empotrado</option>
                      {isEnd && <option value="free">Libre</option>}
                    </select>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-surface rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
                Cargas D + L → U
              </h2>
              <button
                type="button"
                onClick={addLoad}
                className="text-sm bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
              >
                + Añadir carga
              </button>
            </div>
            <p className="text-xs text-text-muted mb-2">U = 1.2·D + 1.6·L</p>
            {loads.length === 0 && (
              <p className="text-sm text-text-muted py-4 text-center">
                No hay cargas.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {loads.map((load) => (
                <div
                  key={load.id}
                  className="flex flex-wrap items-end gap-2 p-2 bg-surface-alt rounded-lg"
                >
                  <label className="flex flex-col gap-0.5">
                    <span className="text-xs text-text-muted">Tipo</span>
                    <select
                      value={load.type}
                      onChange={(e) =>
                        updateLoad(load.id, {
                          type: e.target.value as "point" | "distributed",
                        })
                      }
                      className="w-24"
                    >
                      <option value="point">Puntual</option>
                      <option value="distributed">Distribuida</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-xs text-text-muted">
                      D (kN{load.type === "distributed" ? "/m" : ""})
                    </span>
                    <DecimalInput
                      value={load.D}
                      onChange={(n) =>
                        updateLoad(load.id, { D: Math.round(n * 100) / 100 })
                      }
                      className="w-20"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-xs text-text-muted">
                      L (kN{load.type === "distributed" ? "/m" : ""})
                    </span>
                    <DecimalInput
                      value={load.L}
                      onChange={(n) =>
                        updateLoad(load.id, { L: Math.round(n * 100) / 100 })
                      }
                      className="w-20"
                    />
                  </label>
                  <span className="text-xs text-text-muted pb-2">
                    U={(1.2 * load.D + 1.6 * load.L).toFixed(2)}
                  </span>
                  {load.type === "point" ? (
                    <label className="flex flex-col gap-0.5">
                      <span className="text-xs text-text-muted">Pos (m)</span>
                      <DecimalInput
                        value={load.position ?? 0}
                        onChange={(n) => updateLoad(load.id, { position: n })}
                        className="w-20"
                      />
                    </label>
                  ) : (
                    <>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-xs text-text-muted">Inicio</span>
                        <DecimalInput
                          value={load.start ?? 0}
                          onChange={(n) => updateLoad(load.id, { start: n })}
                          className="w-20"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-xs text-text-muted">Fin</span>
                        <DecimalInput
                          value={load.end ?? 0}
                          onChange={(n) => updateLoad(load.id, { end: n })}
                          className="w-20"
                        />
                      </label>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => removeLoad(load.id)}
                    className="ml-auto text-danger hover:bg-danger/10 border-danger/20 text-sm px-2 py-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="self-center flex gap-3">
          <button
            type="button"
            disabled={!valid}
            onClick={handleSubmit}
            className="bg-primary text-white font-semibold px-8 py-3 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
          >
            Calcular
          </button>
        </div>
      </form>
    </MainLayout>
  );
}
