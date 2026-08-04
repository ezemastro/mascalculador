import { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { SavedBeams } from "@mascalculador/shared";
import { saveBeam, updateSave, saveLastFormState, loadLastFormState } from "../lib/storage";
import { IPN_PROFILES } from "../lib/profiles";
import { UPN_PROFILES } from "../lib/upn-profiles";
import { calculateBeamDual, migrateLoads } from "../lib/beam-calculations";
import { DecimalInput } from "@mascalculador/shared";

export default function FormPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    loads?: Load[];
    beamConfig?: BeamConfig;
    designParams?: SteelDesignParams;
  } | null;

  // Auto-restore last form state when no navigation state is present
  const lastForm = !state ? loadLastFormState() : null;

  const [spanCount, setSpanCount] = useState(
    state?.beamConfig?.spans?.length ?? lastForm?.spanCount ?? 1,
  );
  const [spanLengths, setSpanLengths] = useState<number[]>(
    state?.beamConfig?.spans ?? lastForm?.spanLengths ?? [6],
  );
  const [supportTypes, setSupportTypes] = useState<SupportType[]>(
    state?.beamConfig?.supportTypes ??
      (lastForm?.supportTypes as SupportType[]) ?? ["simple", "simple"],
  );
  const [loads, setLoads] = useState<Load[]>(
    state?.loads ?? lastForm?.loads ?? [],
  );
  const [migrated, setMigrated] = useState(false);
  const [profileName, setProfileName] = useState(
    state?.designParams?.profileName ?? lastForm?.profileName ?? "IPN 200",
  );
  const [profileType, setProfileType] = useState<"IPN" | "UPN">(
    state?.designParams?.profileType ?? (lastForm?.profileType as "IPN" | "UPN") ?? "IPN",
  );
  const [Fy, setFy] = useState(
    state?.designParams?.Fy ?? lastForm?.Fy ?? 235,
  );
  const totalLength = spanLengths.reduce((a, b) => a + b, 0);

  // L = luz total (auto-calculado), siempre en cm para el form
  const Lb = totalLength * 100; // cm

  const [Lb1, setLb1] = useState(
    // Navigation state comes in mm (×10 in handleSubmit); convert back to cm
    state?.designParams?.Lb1 != null ? state.designParams.Lb1 / 10 : (lastForm?.Lb1 ?? Lb),
  );
  const [Lb2, setLb2] = useState(
    state?.designParams?.Lb2 != null ? state.designParams.Lb2 / 10 : (lastForm?.Lb2 ?? Lb),
  );
  const [Cb, setCb] = useState(state?.designParams?.Cb ?? lastForm?.Cb ?? 1.0);
  const [deflectionLimit, setDeflectionLimit] = useState(
    state?.designParams?.deflectionLimit ?? lastForm?.deflectionLimit ?? 300,
  );
  const [loadPosition, setLoadPosition] = useState<
    "top" | "shear" | "bottom"
  >(state?.designParams?.loadPosition ?? (lastForm?.loadPosition as "top" | "shear" | "bottom") ?? "top");

  // Id del elemento cargado (null = nuevo, sin guardar)
  const [loadedSaveId, setLoadedSaveId] = useState<string | null>(null);
  // Nombre del elemento cargado (para mostrar)
  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(null);

  // Auto-save form state to localStorage on every change
  useEffect(() => {
    saveLastFormState({
      spanCount,
      spanLengths,
      supportTypes,
      loads,
      profileName,
      profileType,
      Fy,
      Lb,
      Lb1,
      Lb2,
      Cb,
      deflectionLimit,
      loadPosition,
    });
  }, [
    spanCount, spanLengths, supportTypes, loads,
    profileName, profileType, Fy, Lb1, Lb2, Cb, deflectionLimit, loadPosition,
  ]);

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
      {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        type: "point",
        deadLoad: 0,
        liveLoad: 0,
      },
    ]);
  }

  function removeLoad(id: string) {
    setLoads(loads.filter((l) => l.id !== id));
  }

  function updateLoad(id: string, patch: Partial<Load>) {
    setLoads(loads.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function handleSave() {
    const loadForSave = loads.map((l) => ({
      ...l,
      magnitude: (l.deadLoad ?? 0) + (l.liveLoad ?? 0),
    }));
    const data = {
      spans: spanLengths,
      supportTypes,
      loads: loadForSave,
      profileName,
      profileType,
      Fy,
      Lb,
      Lb1,
      Lb2,
      Cb,
      deflectionLimit,
      loadPosition,
    };

    if (loadedSaveId) {
      // Ya fue guardado antes: corregir sin cambiar el número/id
      updateSave(loadedSaveId, data);
      return;
    }

    const name = prompt("Nombre para guardar esta viga:");
    if (!name) return;
    try {
      saveBeam(name, "acero", data);
      setLoadedSaveName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const beamConfig: BeamConfig = { spans: spanLengths, supportTypes };
    const designParams: SteelDesignParams = {
      profileName,
      profileType,
      Fy,
      Lb: Lb * 10, // cm→mm, auto = luz total
      Lb1: Lb1 * 10,
      Lb2: Lb2 * 10,
      Cb,
      deflectionLimit,
      loadPosition,
    };
    navigate("/results", {
      state: { loads, beamConfig, designParams },
    });
  }

  const valid =
    spanLengths.every((l) => l > 0) &&
    supportTypes.some((t) => t !== "free") &&
    loads.length > 0 &&
    loads.every((l) => (l.deadLoad ?? 0) > 0 || (l.liveLoad ?? 0) > 0);

  // Zx_req preview (task 1.10): derived from Mu (kN·m) → cm³
  const Zx_req = useMemo<number | null>(() => {
    if (!valid) return null;
    try {
      const beamConfig: BeamConfig = { spans: spanLengths, supportTypes };
      const dual = calculateBeamDual(beamConfig, loads);
      // Mu (kN·m) × 1e6 → N·mm, / (0.9·Fy) → mm³, / 1000 → cm³
      const Zx_req_cm3 =
        (Math.abs(dual.maxMomentU.value) * 1e6) / (0.9 * Fy) / 1000;
      return Zx_req_cm3;
    } catch {
      return null;
    }
  }, [spanLengths, supportTypes, loads, Fy, valid]);

  const selectedProfile = profileType === "UPN"
    ? UPN_PROFILES.find((p) => p.name === profileName)
    : IPN_PROFILES.find((p) => p.name === profileName);
  // For Zx comparison, get Zx from the appropriate profile
  const selectedProfileZx = profileType === "UPN"
    ? (UPN_PROFILES.find((p) => p.name === profileName)?.Zx ?? 0)
    : (IPN_PROFILES.find((p) => p.name === profileName)?.Zx ?? 0);
  // Soft-warn when selected profile Zx < Zx_req (task 1.11)
  const showZxWarning =
    Zx_req !== null && selectedProfileZx < Zx_req;

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
            {loadedSaveName ? `Editando: ${loadedSaveName}` : "Definí la viga y sus cargas"}
          </p>
        </div>
      </header>

      <SavedBeams
        app="steel"
        type="acero"
        onLoad={(data, save) => {
          setLoadedSaveId(save.id);
          setLoadedSaveName(save.name);
          const d = data as Record<
            string,
            | number
            | number[]
            | SupportType[]
            | Record<string, unknown>[]
            | string
            | boolean
            | undefined
          >;
          if (d.spans) {
            setSpanCount((d.spans as number[]).length);
            setSpanLengths(d.spans as number[]);
          }
          if (d.supportTypes) setSupportTypes(d.supportTypes as SupportType[]);
          if (d.loads) {
            const raw = d.loads as Record<string, unknown>[];
            const { loads: migratedLoads, migrated: wasMigrated } =
              migrateLoads(raw);
            setLoads(migratedLoads);
            setMigrated(wasMigrated);
          } else {
            setMigrated(false);
          }
          if (typeof d.profileName === "string") setProfileName(d.profileName);
          if (typeof d.profileType === "string") setProfileType(d.profileType as "IPN" | "UPN");
          if (typeof d.Fy === "number") setFy(d.Fy);
          if (typeof d.Lb1 === "number") setLb1(d.Lb1);
          else if (typeof d.Lb === "number") setLb1(d.Lb);
          if (typeof d.Lb2 === "number") setLb2(d.Lb2);
          else if (typeof d.Lb === "number") setLb2(d.Lb);
          if (typeof d.Cb === "number") setCb(d.Cb);
          if (typeof d.deflectionLimit === "number")
            setDeflectionLimit(d.deflectionLimit);
          if (typeof d.loadPosition === "string")
            setLoadPosition(d.loadPosition as "top" | "shear" | "bottom");
        }}
      />

      {migrated && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-sm text-warning">
          Cargas migradas: magnitudes previas asignadas a D; ajustá L si
          corresponde.
        </div>
      )}

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
                    Luz tramo {i + 1} (m)
                  </span>
                  <DecimalInput
                    value={len}
                    onChange={(n) => setSpanLength(i, n)}
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
                  <span className="text-xs text-text-muted">
                    D (kN{load.type === "distributed" ? "/m" : ""})
                  </span>
                  <DecimalInput
                    value={load.deadLoad ?? 0}
                    onChange={(n) => updateLoad(load.id, { deadLoad: n })}
                    className="w-28"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    L (kN{load.type === "distributed" ? "/m" : ""})
                  </span>
                  <DecimalInput
                    value={load.liveLoad ?? 0}
                    onChange={(n) => updateLoad(load.id, { liveLoad: n })}
                    className="w-28"
                  />
                </label>

                {load.type === "point" ? (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted">
                      Posición (m)
                    </span>
                    <DecimalInput
                      value={load.position ?? 0}
                      onChange={(n) => updateLoad(load.id, { position: n })}
                      className="w-32"
                    />
                  </label>
                ) : (
                  <>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-text-muted">
                        Inicio (m)
                      </span>
                      <DecimalInput
                        value={load.start ?? 0}
                        onChange={(n) => updateLoad(load.id, { start: n })}
                        className="w-28"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-text-muted">Fin (m)</span>
                      <DecimalInput
                        value={load.end ?? 0}
                        onChange={(n) => updateLoad(load.id, { end: n })}
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
          {Zx_req !== null && (
            <div className="mb-4 p-3 bg-surface-alt rounded-lg text-sm">
              <span className="text-text-muted">
                Z<sub>x,req</sub> = {Zx_req.toFixed(0)} cm³
                {" · "}F<sub>y</sub> = {Fy} MPa
              </span>
              {selectedProfile && (
                <span className="ml-2 text-text-muted">
                  · Perfil {selectedProfile.name}: Z<sub>x</sub> ={" "}
                  {selectedProfileZx.toFixed(0)} cm³
                </span>
              )}
            </div>
          )}
          {showZxWarning && (
            <div className="mb-4 p-3 border border-warning/30 rounded-lg bg-warning/10 text-sm text-warning">
              Perfil bajo: Z<sub>x</sub> = {selectedProfileZx.toFixed(0)} cm³,
              necesario ≥ {Zx_req!.toFixed(0)} cm³
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Tipo</span>
              <select
                value={profileType}
                onChange={(e) => {
                  const newType = e.target.value as "IPN" | "UPN";
                  setProfileType(newType);
                  // Reset profile to first of the new type
                  if (newType === "IPN") setProfileName("IPN 200");
                  else setProfileName("UPN 200");
                }}
              >
                <option value="IPN">IPN (Doble T)</option>
                <option value="UPN">UPN (Canal)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Perfil</span>
              <select
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              >
                {(profileType === "UPN" ? UPN_PROFILES : IPN_PROFILES).map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                F<sub>y</sub> (MPa)
              </span>
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
              <span className="text-xs text-text-muted">
                L<sub>1</sub> (cm)
              </span>
              <DecimalInput value={Lb1} onChange={setLb1} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                L<sub>2</sub> (cm)
              </span>
              <DecimalInput value={Lb2} onChange={setLb2} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                C<sub>b</sub>
                <span
                  className="ml-1 cursor-help"
                  title="Cb = 1.0 para momentos uniformes. Para vigas simplemente apoyadas con carga uniforme usar 1.14. Para voladizos usar 1.0. Valores mayores indican diagrama de momentos más favorable."
                >
                  ⓘ
                </span>
              </span>
              <DecimalInput value={Cb} onChange={setCb} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                δ<sub>adm</sub> = L /
              </span>
              <DecimalInput value={deflectionLimit} onChange={setDeflectionLimit} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">Carga aplicada en</span>
              <select
                value={loadPosition}
                onChange={(e) =>
                  setLoadPosition(
                    e.target.value as "top" | "shear" | "bottom",
                  )
                }
              >
                <option value="top">Ala superior</option>
                <option value="shear">Centro de corte</option>
                <option value="bottom">Ala inferior</option>
              </select>
            </label>
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
