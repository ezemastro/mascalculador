import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { DecimalInput } from "@mascalculador/shared";
import { SavedBeams } from "@mascalculador/shared";
import {
  saveLastVigaContinuaFormState,
  loadLastVigaContinuaFormState,
  saveVigaContinuaInput,
  updateVigaContinuaInput,
} from "../lib/storage";
import type { AnalysisLoad, VigaContinuaState } from "../lib/viga-continua";
import ModeSelector, { type Mode } from "../components/ModeSelector";

function readMode(raw: string | null): Mode {
  return raw === "portico" ? "portico" : "viga-continua";
}

export default function VigaContinuaForm() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = readMode(searchParams.get("mode"));

  // Auto-restore last form state. Field initial values and save context are
  // both seeded from this. The save context MAY include loadedSaveId /
  // loadedSaveName so a reload after a successful first save continues in
  // edit mode; absent on a fresh user (anti BasesForm bug: auto-persist must
  // NEVER auto-promote into "edit existing" mode — see design.md §11).
  // Hydration priority: last-form (router state has no slots for the form) > defaults.
  const lastForm = loadLastVigaContinuaFormState();

  const [spanCount, setSpanCount] = useState(
    Array.isArray(lastForm?.spans) && lastForm.spans.length > 0
      ? lastForm.spans.length
      : 1,
  );
  const [spanLengths, setSpanLengths] = useState<number[]>(
    Array.isArray(lastForm?.spans) && lastForm.spans.length > 0
      ? lastForm.spans.filter((s): s is number => typeof s === "number")
      : [6],
  );
  const [supportTypes, setSupportTypes] = useState<SupportType[]>(
    Array.isArray(lastForm?.supportTypes) &&
      lastForm.supportTypes.every(
        (t) => t === "simple" || t === "fixed" || t === "free",
      )
      ? (lastForm.supportTypes as SupportType[])
      : ["simple", "simple"],
  );
  const [loads, setLoads] = useState<AnalysisLoad[]>(
    Array.isArray(lastForm?.loads)
      ? (
          lastForm.loads as Array<{
            type?: unknown;
            D?: unknown;
            L?: unknown;
            position?: unknown;
            start?: unknown;
            end?: unknown;
          }>
        ).map((l) => ({
          id: crypto.randomUUID(),
          type: l.type === "distributed" ? "distributed" : "point",
          D: typeof l.D === "number" ? l.D : 0,
          L: typeof l.L === "number" ? l.L : 0,
          position: typeof l.position === "number" ? l.position : 0,
          start: typeof l.start === "number" ? l.start : 0,
          end: typeof l.end === "number" ? l.end : 0,
        }))
      : [],
  );

  // Save context for the form/buttons.
  // [BasesForm-bug-free] MUST be set together in every code path that updates them.
  const [loadedSaveId, setLoadedSaveId] = useState<string | null>(
    lastForm?.loadedSaveId ?? null,
  );
  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(
    lastForm?.loadedSaveName ?? null,
  );

  const totalLength = spanLengths.reduce((a, b) => a + b, 0);

  // Auto-save form state on every change. Silent on quota.
  // Anti-regression: we save loadedSaveId / loadedSaveName if present, but
  // never invent them. The setXxx calls live only in handleSave and onLoad.
  useEffect(() => {
    saveLastVigaContinuaFormState({
      spans: spanLengths,
      supportTypes,
      loads,
      loadedSaveId: loadedSaveId ?? undefined,
      loadedSaveName: loadedSaveName ?? undefined,
    });
  }, [spanLengths, supportTypes, loads, loadedSaveId, loadedSaveName]);

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
      state: {
        spans: spanLengths,
        supportTypes,
        loads,
        loadedSaveId: loadedSaveId ?? undefined,
        loadedSaveName: loadedSaveName ?? undefined,
      } as VigaContinuaState,
    });
  }

  // [BasesForm-bug-free] handleSave: branches on loadedSaveId. The first-save
  // path sets BOTH loadedSaveId and loadedSaveName together. The re-save path
  // calls updateVigaContinuaInput silently (no duplicate-name error).
  function handleSave() {
    const input = { spans: spanLengths, supportTypes, loads };

    if (loadedSaveId) {
      // Already saved: re-prompt and overwrite silently.
      const name = prompt("Nombre para guardar corrección:");
      if (!name) return;
      try {
        updateVigaContinuaInput(loadedSaveId, { input });
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Error al guardar");
      }
      return;
    }

    const name = prompt("Nombre para guardar esta viga:");
    if (!name) return;
    try {
      const saved = saveVigaContinuaInput(name, { input });
      // [BasesForm-bug-free] both setters called together.
      setLoadedSaveId(saved.id);
      setLoadedSaveName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  function handleModeChange(next: Mode) {
    // Default mode drops the key from the URL to keep it tidy (R-routing-portico-routes).
    if (next === "viga-continua") {
      searchParams.delete("mode");
      setSearchParams(searchParams, { replace: true });
    } else {
      searchParams.set("mode", "portico");
      setSearchParams(searchParams, { replace: true });
    }
  }

  function handleNueva() {
    // R-beam-nueva / R-portico-nueva-shared: confirm before clobbering the
    // current beam state. PR3 will wire the pórtico equivalent on its own button.
    if (
      window.confirm(
        "¿Limpiar la viga y volver al ejemplo predeterminado (1 tramo, 1 m, sin cargas)?",
      )
    ) {
      setSpanCount(1);
      setSpanLengths([1]);
      setSupportTypes(["simple", "simple"]);
      setLoads([]);
      // Clear save context — the user is no longer editing a saved record.
      setLoadedSaveId(null);
      setLoadedSaveName(null);
    }
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
            {loadedSaveName
              ? `Editando: ${loadedSaveName}`
              : "Análisis estructural — envolvente de esfuerzos"}
          </p>
        </div>
      </header>

      <div className="flex justify-center">
        <ModeSelector mode={mode} onChange={handleModeChange} />
      </div>

      {mode === "portico" ? (
        <section className="bg-surface rounded-xl border border-border p-12 text-center text-text-muted">
          Modo Pórtico: completar en PR3.
        </section>
      ) : (
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
                  onChange={(e) =>
                    setSpanCountAndAdjust(Number(e.target.value))
                  }
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
                        setSpanLengths((p) =>
                          p.map((l, j) => (j === i ? n : l)),
                        )
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
                  const pos = spanLengths
                    .slice(0, i)
                    .reduce((a, b) => a + b, 0);
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
                          updateLoad(load.id, {
                            D: Math.round(n * 100) / 100,
                          })
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
                          updateLoad(load.id, {
                            L: Math.round(n * 100) / 100,
                          })
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
                          <span className="text-xs text-text-muted">
                            Inicio
                          </span>
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
              onClick={handleNueva}
              className="bg-surface-alt text-text border border-border hover:bg-surface px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Nueva
            </button>
            <button
              type="button"
              disabled={!valid}
              onClick={handleSubmit}
              className="bg-primary text-white font-semibold px-8 py-3 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors"
            >
              Calcular
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="bg-surface-alt border border-border text-text-muted font-semibold px-6 py-3 rounded-lg hover:bg-surface transition-colors"
            >
              {loadedSaveId ? "Guardar corrección" : "Guardar"}
            </button>
          </div>

          <SavedBeams
            app="concrete"
            type="viga-continua"
            label="Vigas continuas guardadas"
            onLoad={(data, save) => {
              // [BasesForm-bug-free] BOTH setters are called together — never one
              // without the other. See design.md §11.
              setLoadedSaveId(save.id);
              setLoadedSaveName(save.name);

              const input = (data as { input?: unknown }).input as
                | {
                    spans?: unknown;
                    supportTypes?: unknown;
                    loads?: unknown;
                  }
                | undefined;
              if (!input) return;

              if (
                Array.isArray(input.spans) &&
                input.spans.every((s) => typeof s === "number")
              ) {
                const lengths = input.spans as number[];
                setSpanLengths(lengths);
                setSpanCount(lengths.length);
              }
              if (
                Array.isArray(input.supportTypes) &&
                input.supportTypes.every(
                  (t) => t === "simple" || t === "fixed" || t === "free",
                )
              ) {
                setSupportTypes(input.supportTypes as SupportType[]);
              }
              if (Array.isArray(input.loads)) {
                // Reassign fresh ids on hydration (the saved state omits ids).
                const fresh: AnalysisLoad[] = (
                  input.loads as Array<{
                    type?: unknown;
                    D?: unknown;
                    L?: unknown;
                    position?: unknown;
                    start?: unknown;
                    end?: unknown;
                  }>
                ).map((l) => ({
                  id:
                    Math.random().toString(36).slice(2) +
                    Date.now().toString(36),
                  type: l.type === "distributed" ? "distributed" : "point",
                  D: typeof l.D === "number" ? l.D : 0,
                  L: typeof l.L === "number" ? l.L : 0,
                  position: typeof l.position === "number" ? l.position : 0,
                  start: typeof l.start === "number" ? l.start : 0,
                  end: typeof l.end === "number" ? l.end : 0,
                }));
                setLoads(fresh);
              }
            }}
          />
        </form>
      )}
    </MainLayout>
  );
}
