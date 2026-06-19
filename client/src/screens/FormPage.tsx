import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import MainLayout from "../components/MainLayout";
import SavedBeams from "../components/SavedBeams";
import { saveBeam } from "../lib/storage";
import { IPN_PROFILES } from "../lib/profiles";
import { ANGLE_PROFILES } from "../lib/angle-profiles";

function handleCommaKey(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === ",") {
    e.preventDefault();
    const input = e.currentTarget;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const before = input.value.substring(0, start);
    const after = input.value.substring(end);
    input.value = before + "." + after;
    input.setSelectionRange(start + 1, start + 1);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export default function FormPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    loads?: Load[];
    beamConfig?: BeamConfig;
    designParams?: SteelDesignParams;
    trussParams?: TrussDesignParams;
  } | null;
  const [spanCount, setSpanCount] = useState(state?.beamConfig?.spans?.length ?? 1);
  const [spanLengths, setSpanLengths] = useState<number[]>(
    state?.beamConfig?.spans ?? [6],
  );
  const [supportTypes, setSupportTypes] = useState<SupportType[]>(
    state?.beamConfig?.supportTypes ?? ["simple", "simple"],
  );
  const [loads, setLoads] = useState<Load[]>(state?.loads ?? []);
  const [profileName, setProfileName] = useState(
    state?.designParams?.profileName ?? "IPN 200",
  );
  const [Fy, setFy] = useState(state?.designParams?.Fy ?? 235);
  const [Lb, setLb] = useState(
    state?.designParams?.Lb ?? (state?.beamConfig?.spans ?? [6]).reduce((a, b) => a + b, 0) * 1000,
  );
  const [Cb, setCb] = useState(state?.designParams?.Cb ?? 1.0);
  const [deflectionLimit, setDeflectionLimit] = useState(
    state?.designParams?.deflectionLimit ?? 300,
  );

  const totalLength = spanLengths.reduce((a, b) => a + b, 0);

  const [trussEnabled, setTrussEnabled] = useState(
    state?.trussParams !== undefined,
  );
  const [trussHeight, setTrussHeight] = useState(
    state?.trussParams?.height ?? totalLength / 10,
  );
  const [trussPanelSpacing, setTrussPanelSpacing] = useState(
    state?.trussParams?.panelSpacing ?? 1.0,
  );
  const [topChordProfile, setTopChordProfile] = useState(
    state?.trussParams?.topChordProfile ?? 'L 2 1/2" x 1/4"',
  );
  const [botChordProfile, setBotChordProfile] = useState(
    state?.trussParams?.botChordProfile ?? 'L 2 1/2" x 1/4"',
  );
  const [diagProfile, setDiagProfile] = useState(
    state?.trussParams?.diagProfile ?? 'L 1 1/2" x 3/16"',
  );
  const [vertProfile, setVertProfile] = useState(
    state?.trussParams?.vertProfile ?? 'L 1 1/4" x 1/8"',
  );
  const [trussFy, setTrussFy] = useState(state?.trussParams?.Fy ?? 235);
  const [trussFu, setTrussFu] = useState(state?.trussParams?.Fu ?? 370);

  const supportPositions = spanLengths.reduce(
    (acc, len, i) => {
      acc.push(acc[i] + len);
      return acc;
    },
    [0],
  );

  function setSpanCountAndAdjust(count: number) {
    setSpanLengths((prev) => {
      if (count > prev.length) {
        return [...prev, ...Array(count - prev.length).fill(6)];
      }
      return prev.slice(0, count);
    });
    setSupportTypes((prev) => {
      if (count + 1 > prev.length) {
        return [...prev, ...Array(count + 1 - prev.length).fill("simple")];
      }
      return prev.slice(0, count + 1);
    });
    setSpanCount(count);
  }

  function setSpanLength(i: number, val: number) {
    setSpanLengths((prev) => prev.map((l, idx) => (idx === i ? val : l)));
  }

  function setSupportType(i: number, val: SupportType) {
    setSupportTypes((prev) => prev.map((t, idx) => (idx === i ? val : t)));
  }

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

  function handleSave() {
    const name = prompt("Nombre para guardar esta viga:");
    if (!name) return;
    saveBeam(name, "acero", {
      spans: spanLengths,
      supportTypes,
      loads,
      profileName, Fy, Lb, Cb, deflectionLimit,
      trussEnabled, trussHeight, trussPanelSpacing,
      topChordProfile, botChordProfile, diagProfile, vertProfile,
      trussFy, trussFu,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const beamConfig: BeamConfig = { spans: spanLengths, supportTypes };
    const designParams: SteelDesignParams = {
      profileName,
      Fy,
      Lb,
      Cb,
      deflectionLimit,
    };
    const trussParams: TrussDesignParams | undefined = trussEnabled
      ? {
          height: trussHeight,
          panelSpacing: trussPanelSpacing,
          topChordProfile,
          botChordProfile,
          diagProfile,
          vertProfile,
          Fy: trussFy,
          Fu: trussFu,
        }
      : undefined;
    navigate("/results", {
      state: { loads, beamConfig, designParams, trussParams },
    });
  }

  const valid =
    spanLengths.every((l) => l > 0) &&
    supportTypes.some((t) => t !== "free") &&
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

      <SavedBeams type="acero" onLoad={(data) => {
        const d = data as Record<string, number | number[] | SupportType[] | Load[] | string | boolean | undefined>;
        if (d.spans) { setSpanCount((d.spans as number[]).length); setSpanLengths(d.spans as number[]); }
        if (d.supportTypes) setSupportTypes(d.supportTypes as SupportType[]);
        if (d.loads) setLoads(d.loads as Load[]);
        if (typeof d.profileName === "string") setProfileName(d.profileName);
        if (typeof d.Fy === "number") setFy(d.Fy);
        if (typeof d.Lb === "number") setLb(d.Lb);
        if (typeof d.Cb === "number") setCb(d.Cb);
        if (typeof d.deflectionLimit === "number") setDeflectionLimit(d.deflectionLimit);
        if (typeof d.trussEnabled === "boolean") setTrussEnabled(d.trussEnabled);
        if (typeof d.trussHeight === "number") setTrussHeight(d.trussHeight);
        if (typeof d.trussPanelSpacing === "number") setTrussPanelSpacing(d.trussPanelSpacing);
        if (typeof d.topChordProfile === "string") setTopChordProfile(d.topChordProfile);
        if (typeof d.botChordProfile === "string") setBotChordProfile(d.botChordProfile);
        if (typeof d.diagProfile === "string") setDiagProfile(d.diagProfile);
        if (typeof d.vertProfile === "string") setVertProfile(d.vertProfile);
        if (typeof d.trussFy === "number") setTrussFy(d.trussFy);
        if (typeof d.trussFu === "number") setTrussFu(d.trussFu);
      }} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Beam config */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Configuración de la Viga
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
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={len || ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) => setSpanLength(i, Number(e.target.value))}
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              Luz total: {totalLength.toFixed(2)} m
            </p>
          </div>
        </section>

        {/* Supports */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Apoyos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {supportTypes.map((type, i) => {
              const isEnd = i === 0 || i === supportTypes.length - 1;
              const label =
                supportTypes.length === 2
                  ? i === 0
                    ? "Apoyo A"
                    : "Apoyo B"
                  : `Apoyo ${i + 1}`;
              return (
                <div
                  key={i}
                  className="flex flex-col gap-2 p-3 bg-surface-alt rounded-lg"
                >
                  <span className="text-xs text-text-muted font-medium">
                    {label}
                  </span>
                  <span className="text-xs text-text-muted">
                    x = {supportPositions[i].toFixed(2)} m
                  </span>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">Tipo</span>
                    <select
                      value={type}
                      onChange={(e) =>
                        setSupportType(i, e.target.value as SupportType)
                      }
                    >
                      <option value="simple">Articulado</option>
                      <option value="fixed">Empotrado</option>
                      {isEnd && <option value="free">Libre</option>}
                    </select>
                  </label>
                </div>
              );
            })}
          </div>
          {supportTypes.filter((t) => t !== "free").length === 0 && (
            <p className="text-danger text-xs mt-2">
              Al menos un apoyo debe ser articulado o empotrado
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
                className="flex flex-wrap items-end gap-3 p-3 bg-surface-alt rounded-lg"
              >
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Tipo</span>
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
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Magnitud (kN{load.type === "distributed" ? "/m" : ""})</span>
                  <input
                    type="number"
                    step="0.1"
                    value={load.magnitude || ""}
                    onKeyDown={handleCommaKey}
                    onChange={(e) =>
                      updateLoad(load.id, {
                        magnitude: Number(e.target.value),
                      })
                    }
                    className="w-32"
                  />
                </label>

                {load.type === "point" ? (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">Posición (m)</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max={totalLength}
                      value={load.position ?? ""}
                      onKeyDown={handleCommaKey}
                      onChange={(e) =>
                        updateLoad(load.id, {
                          position: Number(e.target.value),
                        })
                      }
                      className="w-32"
                    />
                  </label>
                ) : (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-text-muted">Inicio (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max={totalLength}
                        value={load.start ?? ""}
                        onKeyDown={handleCommaKey}
                        onChange={(e) =>
                          updateLoad(load.id, {
                            start: Number(e.target.value),
                          })
                        }
                        className="w-28"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-text-muted">Fin (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max={totalLength}
                        value={load.end ?? ""}
                        onKeyDown={handleCommaKey}
                        onChange={(e) =>
                          updateLoad(load.id, {
                            end: Number(e.target.value),
                          })
                        }
                        className="w-28"
                      />
                    </label>
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

        {/* Steel Design */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Dimensionamiento (CIRSOC 301-05)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Perfil</span>
              <select
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              >
                {IPN_PROFILES.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">F<sub>y</sub> (MPa)</span>
              <select
                value={Fy}
                onChange={(e) => setFy(Number(e.target.value))}
              >
                <option value={235}>235 (F-24)</option>
                <option value={275}>275 (F-28)</option>
                <option value={355}>355 (F-36)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">L<sub>b</sub> (mm)</span>
              <input
                type="number"
                step="100"
                min="0"
                value={Lb || ""}
                onKeyDown={handleCommaKey}
                onChange={(e) => setLb(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">C<sub>b</sub></span>
              <input
                type="number"
                step="0.1"
                min="1.0"
                value={Cb || ""}
                onKeyDown={handleCommaKey}
                onChange={(e) => setCb(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">δ<sub>adm</sub> = L /</span>
              <input
                type="number"
                step="50"
                min="100"
                value={deflectionLimit || ""}
                onKeyDown={handleCommaKey}
                onChange={(e) => setDeflectionLimit(Number(e.target.value))}
              />
            </label>
          </div>
        </section>

        {/* Truss Design */}
        <section className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={trussEnabled}
                onChange={(e) => setTrussEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
                Reticulado
              </h2>
            </label>
          </div>
          {trussEnabled && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Altura (m)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.2"
                  value={trussHeight || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) => setTrussHeight(Number(e.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Sep. montantes (m)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.2"
                  value={trussPanelSpacing || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) =>
                    setTrussPanelSpacing(Number(e.target.value))
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">F<sub>y</sub> (MPa)</span>
                <select
                  value={trussFy}
                  onChange={(e) => setTrussFy(Number(e.target.value))}
                >
                  <option value={235}>235 (F-24)</option>
                  <option value={275}>275 (F-28)</option>
                  <option value={355}>355 (F-36)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">F<sub>u</sub> (MPa)</span>
                <input
                  type="number"
                  step="1"
                  min="300"
                  value={trussFu || ""}
                  onKeyDown={handleCommaKey}
                  onChange={(e) => setTrussFu(Number(e.target.value))}
                />
              </label>
              <div />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Cordón superior</span>
                <select
                  value={topChordProfile}
                  onChange={(e) => setTopChordProfile(e.target.value)}
                >
                  {ANGLE_PROFILES.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Cordón inferior</span>
                <select
                  value={botChordProfile}
                  onChange={(e) => setBotChordProfile(e.target.value)}
                >
                  {ANGLE_PROFILES.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Diagonal</span>
                <select
                  value={diagProfile}
                  onChange={(e) => setDiagProfile(e.target.value)}
                >
                  {ANGLE_PROFILES.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">Montante</span>
                <select
                  value={vertProfile}
                  onChange={(e) => setVertProfile(e.target.value)}
                >
                  {ANGLE_PROFILES.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </section>

        <div className="self-center flex gap-3">
          <button type="submit" disabled={!valid}
            className="bg-primary text-white font-semibold px-8 py-3 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors">
            Calcular
          </button>
          <button type="button" onClick={handleSave}
            className="bg-surface-alt border border-border text-text-muted font-semibold px-6 py-3 rounded-lg hover:bg-surface transition-colors">
            Guardar
          </button>
        </div>
      </form>
    </MainLayout>
  );
}
