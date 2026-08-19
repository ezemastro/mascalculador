import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { SavedBeams } from "@mascalculador/shared";
import { saveBeam, updateSave } from "../lib/storage";
import { calculateBeam } from "@mascalculador/shared";
import { DecimalInput } from "@mascalculador/shared";

interface ConcreteLoad {
  id: string;
  type: "point" | "distributed";
  D: number;
  L: number;
  position?: number;
  start?: number;
  end?: number;
}

export interface ConcreteState {
  spans: number[];
  supportTypes: SupportType[];
  concreteLoads: ConcreteLoad[];
  bw: number;
  h: number;
  cover: number;
  fc: number;
  fy: number;
}

export default function ConcreteForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const saved = (location.state as ConcreteState | null) || undefined;

  const [spanCount, setSpanCount] = useState(saved?.spans?.length ?? 1);
  const [spanLengths, setSpanLengths] = useState<number[]>(saved?.spans ?? [6]);
  const [supportTypes, setSupportTypes] = useState<SupportType[]>(
    saved?.supportTypes ?? ["simple", "simple"],
  );
  const [concreteLoads, setConcreteLoads] = useState<ConcreteLoad[]>(
    saved?.concreteLoads ?? [],
  );
  const [bw, setBw] = useState(saved?.bw ?? 200);
  const [h, setH] = useState(saved?.h ?? 500);
  const [cover, setCover] = useState(saved?.cover ?? 30);
  const [fc, setFc] = useState(saved?.fc ?? 25);
  const [fy, setFy] = useState(saved?.fy ?? 420);

  const [loadedSaveId, setLoadedSaveId] = useState<string | null>(null);
  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(null);

  const totalLength = spanLengths.reduce((a, b) => a + b, 0);

  const ultimateLoads: Load[] = useMemo(
    () =>
      concreteLoads.map((cl) => ({
        id: cl.id,
        type: cl.type,
        magnitude: 1.2 * cl.D + 1.6 * cl.L,
        position: cl.position,
        start: cl.start,
        end: cl.end,
      })),
    [concreteLoads],
  );

  // Preview Mu/Vu
  const preview = useMemo(() => {
    if (
      ultimateLoads.length === 0 ||
      ultimateLoads.some((l) => (l.magnitude ?? 0) === 0)
    )
      return null;
    if (spanLengths.some((l) => l <= 0)) return null;
    const cfg: BeamConfig = { spans: spanLengths, supportTypes };
    try {
      const r = calculateBeam(cfg, ultimateLoads);
      let maxM = 0,
        maxV = 0;
      for (let k = 0; k <= 200; k++) {
        const x = (k / 200) * totalLength;
        maxM = Math.max(maxM, Math.abs(r.bendingMoment(x)));
        maxV = Math.max(maxV, Math.abs(r.shearForce(x)));
      }
      for (const x of r.criticalPoints) {
        maxM = Math.max(maxM, Math.abs(r.bendingMoment(x)));
        maxV = Math.max(maxV, Math.abs(r.shearForce(x)));
      }
      return { Mu: maxM, Vu: maxV };
    } catch {
      return null;
    }
  }, [spanLengths, supportTypes, ultimateLoads, totalLength]);

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
    setConcreteLoads([
      ...concreteLoads,
      {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        type: "point",
        D: 0,
        L: 0,
      },
    ]);
  }
  function removeLoad(id: string) {
    setConcreteLoads(concreteLoads.filter((l) => l.id !== id));
  }
  function updateLoad(id: string, patch: Partial<ConcreteLoad>) {
    setConcreteLoads(
      concreteLoads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  }

  function handleSave() {
    const data: Record<string, unknown> = {
      spans: spanLengths,
      supportTypes,
      concreteLoads,
      bw,
      h,
      cover,
      fc,
      fy,
    };

    if (loadedSaveId) {
      updateSave(loadedSaveId, data);
      return;
    }

    const name = prompt("Nombre para guardar esta viga:");
    if (!name) return;
    try {
      saveBeam(name, "hormigon", data);
      setLoadedSaveName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate("/concrete-results", {
      state: {
        spans: spanLengths,
        supportTypes,
        concreteLoads,
        bw,
        h,
        cover,
        fc,
        fy,
      } as ConcreteState,
    });
  }

  const valid =
    spanLengths.every((l) => l > 0) &&
    supportTypes.some((t) => t !== "free") &&
    concreteLoads.length > 0 &&
    concreteLoads.every((l) => l.D + l.L > 0);

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
            Viga de Hormigón Armado
          </h1>
          <p className="text-sm text-text-muted">
            {loadedSaveName ? `Editando: ${loadedSaveName}` : "CIRSOC 201-05"}
          </p>
        </div>
      </header>

      <SavedBeams
        app="concrete"
        type="hormigon"
        onLoad={(data, save) => {
          setLoadedSaveId(save.id);
          setLoadedSaveName(save.name);
          const d = data as Record<string, unknown>;
          if (d.spans) {
            setSpanCount((d.spans as number[]).length);
            setSpanLengths(d.spans as number[]);
          }
          if (d.supportTypes) setSupportTypes(d.supportTypes as SupportType[]);
          if (d.concreteLoads)
            setConcreteLoads(d.concreteLoads as typeof concreteLoads);
          if (typeof d.bw === "number") setBw(d.bw);
          if (typeof d.h === "number") setH(d.h);
          if (typeof d.cover === "number") setCover(d.cover);
          if (typeof d.fc === "number") setFc(d.fc);
          if (typeof d.fy === "number") setFy(d.fy);
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
                {[1, 2, 3, 4].map((n) => (
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
                + Añadir
              </button>
            </div>
            <p className="text-xs text-text-muted mb-2">U = 1.2·D + 1.6·L</p>
            {concreteLoads.length === 0 && (
              <p className="text-sm text-text-muted py-4 text-center">
                No hay cargas.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {concreteLoads.map((load) => (
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
                      value={load.D ?? 0}
                      onChange={(n) => updateLoad(load.id, { D: n })}
                      className="w-20"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-xs text-text-muted">
                      L (kN{load.type === "distributed" ? "/m" : ""})
                    </span>
                    <DecimalInput
                      value={load.L ?? 0}
                      onChange={(n) => updateLoad(load.id, { L: n })}
                      className="w-20"
                    />
                  </label>
                  <span className="text-xs text-text-muted pb-2">
                    U={(1.2 * load.D + 1.6 * load.L).toFixed(1)}
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

        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Sección
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                b<sub>w</sub> (mm)
              </span>
              <DecimalInput value={bw} onChange={setBw} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">h (mm)</span>
              <DecimalInput value={h} onChange={setH} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                Recubrimiento (mm)
              </span>
              <DecimalInput value={cover} onChange={setCover} />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">d = h − rec</span>
              <span className="text-sm font-semibold bg-surface-alt rounded px-2 py-1.5">
                {h - cover} mm
              </span>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                f'<sub>c</sub> (MPa)
              </span>
              <select
                value={fc}
                onChange={(e) => setFc(Number(e.target.value))}
              >
                <option value={20}>20 (H-20)</option>
                <option value={25}>25 (H-25)</option>
                <option value={30}>30 (H-30)</option>
                <option value={35}>35 (H-35)</option>
                <option value={40}>40 (H-40)</option>
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
                <option value={420}>420 (ADN 420)</option>
                <option value={500}>500 (ADN 500)</option>
              </select>
            </label>
            {preview && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">
                  M<sub>u</sub>
                </span>
                <span className="text-sm font-semibold text-primary bg-surface-alt rounded px-2 py-1.5">
                  {preview.Mu.toFixed(1)} kN·m
                </span>
              </div>
            )}
            {preview && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">
                  V<sub>u</sub>
                </span>
                <span className="text-sm font-semibold text-primary bg-surface-alt rounded px-2 py-1.5">
                  {preview.Vu.toFixed(1)} kN
                </span>
              </div>
            )}
          </div>
        </section>

        <div className="self-center flex gap-3">
          <button
            type="submit"
            disabled={!valid}
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
      </form>
    </MainLayout>
  );
}
