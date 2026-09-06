import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import {
  getSavedCompats,
  getSavedSlabs,
  loadSlab,
  deleteCompat,
  getSavedSupports,
  saveSupport,
  deleteSupport,
  getCompatReinf,
  saveCompatReinf,
  type SavedCompatData,
  type SavedSupportData,
} from "../lib/storage";
import { pickObraIfNeeded } from "../components/ObraPicker";
import {
  designSupportMoment,
  type DirectionResult,
  type EdgeIndex,
} from "../lib/slab-calc";
import { computoApoyosObra } from "../lib/computo-obra";
import ComputoSection from "../components/ComputoSection";

const BAR_DIAMETERS = [6, 8, 10, 12, 16, 20];
const BAR_AREA: Record<number, number> = {
  6: 28.3,
  8: 50.3,
  10: 78.5,
  12: 113.1,
  16: 201.1,
  20: 314.2,
};

const EDGE_LABELS: Record<number, string> = {
  0: "Izquierdo",
  1: "Derecho",
  2: "Arriba",
  3: "Abajo",
};

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

type SavedListItem =
  | { kind: "individual"; data: SavedSupportData }
  | { kind: "compat"; data: SavedCompatData };

function CompatCard({
  data,
  supportDesign,
  onDelete,
  onSaved,
}: {
  data: SavedCompatData;
  supportDesign: DirectionResult | null;
  onDelete: (name: string) => void;
  /** Avisa al padre que se guardó armadura (refresca el cómputo de apoyos). */
  onSaved?: () => void;
}) {
  const initialReinf = useMemo(() => getCompatReinf(data.name), [data.name]);
  const [diam, setDiam] = useState(initialReinf?.diam ?? 10);
  const [sep, setSep] = useState(initialReinf?.sep ?? 150);
  const [savedReinf, setSavedReinf] =
    useState<typeof initialReinf>(initialReinf);

  const isSaved =
    savedReinf !== null && savedReinf.diam === diam && savedReinf.sep === sep;

  const requiredAs = supportDesign?.AsReq ?? 0;

  // Available from bent bars: 50% of adopted span As from each slab.
  // Guard: la losa puede no existir en esta obra o estar guardada sin resultados.
  const slabA = loadSlab(data.slabA.id);
  const slabB = loadSlab(data.slabB.id);
  const adoptedA = slabA?.result
    ? data.edgeA <= 1
      ? (slabA.result.adoptedAsX ?? 0)
      : (slabA.result.adoptedAsY ?? 0)
    : 0;
  const adoptedB = slabB?.result
    ? data.edgeB <= 1
      ? (slabB.result.adoptedAsX ?? 0)
      : (slabB.result.adoptedAsY ?? 0)
    : 0;
  const availableFromSpan = (adoptedA + adoptedB) / 2; // 50% de cada losa que comparte el apoyo
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
            {data.slabA.name} ({EDGE_LABELS[data.edgeA]}) ↔ {data.slabB.name} (
            {EDGE_LABELS[data.edgeB]})
          </p>
        </div>
        <button
          onClick={() => onDelete(data.name)}
          className="text-xs text-text-muted hover:text-warning px-2 py-1"
        >
          Eliminar
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-surface rounded p-2">
          <span className="text-text-muted">M_neg A</span>
          <p className="font-semibold text-text">
            {data.result.MnegA.toFixed(2)} kN·m/m
          </p>
        </div>
        <div className="bg-surface rounded p-2">
          <span className="text-text-muted">M_neg B</span>
          <p className="font-semibold text-text">
            {data.result.MnegB.toFixed(2)} kN·m/m
          </p>
        </div>
        <div className="bg-surface rounded p-2">
          <span className="text-text-muted">Ratio</span>
          <p className="font-semibold text-text">
            {data.result.ratio.toFixed(2)}
          </p>
        </div>
        <div className="bg-surface rounded p-2">
          <span className="text-text-muted">Veredicto</span>
          <p
            className={`font-semibold ${data.result.compatOK ? "text-success" : "text-warning"}`}
          >
            {data.result.compatOK ? "Compatible" : "No compatible"}
          </p>
        </div>
      </div>

      <div
        className={`mt-2 p-2 rounded text-xs ${data.result.compatOK ? "bg-success/5" : "bg-warning/5"}`}
      >
        <p className="text-text-muted">{data.result.message}</p>
        {data.result.Mcompat && (
          <p className="font-bold text-text mt-1">
            M_compat = {data.result.Mcompat.toFixed(2)} kN·m/m
          </p>
        )}
        {data.result.recalculatedSlab && (
          <p className="mt-1 text-text-muted">
            Losa {data.result.recalculatedSlab} recalculada con borde simple.
          </p>
        )}
      </div>

      {/* Support reinforcement designer */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mb-3">
          <div>
            <span className="text-text-muted">As apoyo necesario</span>
            <p className="font-bold text-primary">
              {(requiredAs / 100).toFixed(2)} cm²/m
            </p>
          </div>
          <div>
            <span className="text-text-muted">
              As disponible (barras dobladas)
            </span>
            <p className="font-bold text-text">
              {(availableFromSpan / 100).toFixed(2)} cm²/m
            </p>
            <span className="text-text-muted/60">
              = 50% × {(adoptedA / 100).toFixed(2)} + 50% ×{" "}
              {(adoptedB / 100).toFixed(2)} cm²/m
            </span>
          </div>
          <div>
            <span className="text-text-muted">As adicional</span>
            <p className="font-bold text-warning">
              {(additionalNeeded / 100).toFixed(2)} cm²/m
            </p>
            <span className="text-text-muted/60">= máx(0, nec − disp)</span>
          </div>
        </div>

        {supportDesign?.steps && (
          <details className="mt-3 pt-2 border-t border-border">
            <summary className="cursor-pointer text-xs text-text-muted hover:text-text">
              Ver cuentas
            </summary>
            <pre className="mt-2 p-2 bg-surface rounded text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto">
              {postSteps(supportDesign.steps).join("\n")}
            </pre>
          </details>
        )}

        <div className="flex gap-3 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Ø (mm)</span>
            <select
              value={diam}
              onChange={(e) => setDiam(Number(e.target.value))}
              className="w-20"
            >
              {BAR_DIAMETERS.map((d) => (
                <option key={d} value={d}>
                  Ø{d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Sep (cm)</span>
            <input
              type="number"
              min={1}
              max={50}
              step={1}
              value={sep ? sep / 10 : ""}
              onChange={(e) => {
                const num = parseFloat(e.target.value);
                if (isNaN(num)) {
                  setSep(0);
                  return;
                }
                // Entrada en cm → estado en mm (unidad del motor)
                setSep(Math.min(50, Math.max(1, Math.round(num))) * 10);
              }}
              className="w-20"
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Provisto</span>
            <p className="text-sm font-bold text-text">
              {(providedAs / 100).toFixed(2)} cm²/m
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Total</span>
            <p className="text-sm font-bold text-primary">
              {(totalAs / 100).toFixed(2)} cm²/m
            </p>
          </div>
          <span
            className={`text-sm font-semibold pb-1 ${ok ? "text-success" : "text-warning"}`}
          >
            {ok ? "✓" : "✗"}
          </span>
        </div>
        {additionalNeeded === 0 && (
          <p className="text-xs text-success mt-1">
            Cubierto con barras dobladas, no requiere adicionales.
          </p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => {
              saveCompatReinf(data.name, diam, sep);
              setSavedReinf({ compatName: data.name, diam, sep });
              onSaved?.();
            }}
            disabled={sep <= 0}
            className="text-xs bg-primary text-white font-semibold px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Guardar armadura
          </button>
          {isSaved && <span className="text-xs text-success">Guardado ✓</span>}
        </div>
      </div>
    </div>
  );
}

export default function CompatList() {
  const navigate = useNavigate();
  // Estado de navegación: SlabCompat redirige acá con loadCompat para abrir
  // directo el editor de armadura de la compatibilización guardada.
  const navState = useLocation().state as { loadCompat?: string } | null;
  const [compats, setCompats] = useState<SavedCompatData[]>(() =>
    getSavedCompats(),
  );
  const savedSlabs = useMemo(() => getSavedSlabs(), []);

  // Saved list state (misma lógica que Losas: sección colapsable arriba)
  const [listOpen, setListOpen] = useState(false);
  const [loadedCompatName, setLoadedCompatName] = useState<string | null>(
    navState?.loadCompat ?? null,
  );
  // Versión del armado de compats: fuerza recalcular el cómputo de apoyos
  const [reinfVersion, setReinfVersion] = useState(0);

  // Individual support designer state — oculto hasta tocar "+ Nuevo apoyo individual"
  const [individualOpen, setIndividualOpen] = useState(false);
  const [selectedSlabId, setSelectedSlabId] = useState("");
  const [selectedEdge, setSelectedEdge] = useState<EdgeIndex>(0);
  const [supDiam, setSupDiam] = useState(10);
  const [supSep, setSupSep] = useState(150);
  const [savedDesigns, setSavedDesigns] = useState<SavedSupportData[]>(() =>
    getSavedSupports(),
  );

  const slab = selectedSlabId ? loadSlab(selectedSlabId) : null;
  // Guard: la losa puede estar guardada solo con datos (sin resultados).
  const slabResult = slab?.result ?? null;
  const continuousEdges: EdgeIndex[] = slab
    ? ([0, 1, 2, 3] as EdgeIndex[]).filter(
        (i) => slab.input.edges[i] === "continuo",
      )
    : [];

  const supportEdge = continuousEdges.includes(selectedEdge)
    ? selectedEdge
    : continuousEdges[0];

  const designKey = `${selectedSlabId}:${supportEdge}`;
  const [appliedDesignKey, setAppliedDesignKey] = useState("");

  const currentDesign = savedDesigns.find(
    (d) => d.slabId === selectedSlabId && d.edge === supportEdge,
  );
  if (currentDesign && designKey !== appliedDesignKey) {
    setSupDiam(currentDesign.diam);
    setSupSep(currentDesign.sep);
    setAppliedDesignKey(designKey);
  }

  // Get Mneg for the selected edge
  const mneg =
    slabResult &&
    supportEdge !== undefined &&
    continuousEdges.includes(supportEdge)
      ? supportEdge <= 1
        ? supportEdge === 0
          ? slabResult.MnegIzq
          : slabResult.MnegDer
        : supportEdge === 2
          ? slabResult.MnegArr
          : slabResult.MnegAba
      : 0;

  const adoptedSpanAs = slabResult
    ? supportEdge <= 1
      ? (slabResult.adoptedAsX ?? 0)
      : (slabResult.adoptedAsY ?? 0)
    : 0;

  // Available from bent bars = 50% of adopted span As (from saved slab)
  const availableFromSpan = adoptedSpanAs / 2;

  // Required support As from Mneg
  const supportDesign =
    slab && slabResult && mneg !== 0
      ? designSupportMoment(
          Math.abs(mneg),
          slabResult.d,
          slabResult.h,
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

  // Listado unificado: individuales + compatibilizaciones, más nuevos primero
  const savedItems: SavedListItem[] = [
    ...savedDesigns.map((d) => ({ kind: "individual" as const, data: d })),
    ...compats.map((c) => ({ kind: "compat" as const, data: c })),
  ].sort((a, b) => b.data.savedAt.localeCompare(a.data.savedAt));

  // Cómputo de acero de apoyos (individuales + compats), al pie de la pantalla
  const apoyosComputo = useMemo(
    () => computoApoyosObra(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- savedDesigns/compats y reinfVersion reflejan cambios de guardado
    [savedDesigns, compats, reinfVersion],
  );

  const loadedCompat = loadedCompatName
    ? (compats.find((c) => c.name === loadedCompatName) ?? null)
    : null;
  const loadedCompatDesign = loadedCompat
    ? (() => {
        const supportMoment =
          loadedCompat.result.Mcompat ??
          Math.min(loadedCompat.result.MnegA, loadedCompat.result.MnegB);
        const refSlab = loadSlab(loadedCompat.slabA.id);
        return refSlab?.result
          ? designSupportMoment(
              Math.abs(supportMoment),
              refSlab.result.d,
              refSlab.result.h,
              refSlab.input.fc,
              refSlab.input.fy,
              1000,
              loadedCompat.edgeA <= 1
                ? refSlab.input.dBarX
                : refSlab.input.dBarY,
              supportMoment,
            )
          : null;
      })()
    : null;

  function handleDelete(name: string) {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    deleteCompat(name);
    setCompats(getSavedCompats());
    if (loadedCompatName === name) setLoadedCompatName(null);
  }

  async function handleSaveSupport() {
    if (!slab || supportEdge === undefined || supSep <= 0) return;
    const slabName =
      savedSlabs.find((s) => s.id === selectedSlabId)?.name || "Losa";
    const name = `${slabName} — Borde ${EDGE_LABELS[supportEdge]}`;
    const target = await pickObraIfNeeded();
    if (target === null) return;
    saveSupport(
      {
        name,
        slabId: selectedSlabId,
        slabName,
        edge: supportEdge,
        diam: supDiam,
        sep: supSep,
      },
      target,
    );
    setSavedDesigns(getSavedSupports());
  }

  function handleLoadItem(item: SavedListItem) {
    setListOpen(false);
    if (item.kind === "individual") {
      setLoadedCompatName(null);
      setIndividualOpen(true);
      setSelectedSlabId(item.data.slabId);
      setSelectedEdge(item.data.edge);
      setSupDiam(item.data.diam);
      setSupSep(item.data.sep);
      setAppliedDesignKey(`${item.data.slabId}:${item.data.edge}`);
    } else {
      setLoadedCompatName(item.data.name);
      setIndividualOpen(false);
    }
  }

  function handleNewIndividual() {
    setListOpen(false);
    setLoadedCompatName(null);
    setIndividualOpen(true);
    setSelectedSlabId("");
    setSelectedEdge(0);
    setSupDiam(10);
    setSupSep(150);
    setAppliedDesignKey("");
  }

  function handleDeleteItem(item: SavedListItem) {
    if (!confirm(`¿Eliminar "${item.data.name}"?`)) return;
    if (item.kind === "individual") {
      deleteSupport(item.data.name);
      setSavedDesigns(getSavedSupports());
    } else {
      deleteCompat(item.data.name);
      setCompats(getSavedCompats());
      if (loadedCompatName === item.data.name) setLoadedCompatName(null);
    }
  }

  return (
    <MainLayout>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">
            Dimensionado de apoyo en losas
          </h1>
          <p className="text-sm text-text-muted">
            {savedItems.length} apoyo
            {savedItems.length !== 1 ? "s" : ""} guardado
            {savedItems.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleNewIndividual}
            className="text-sm bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
          >
            + Nuevo apoyo individual
          </button>
          <button
            onClick={() => navigate("/slab-compat")}
            className="text-sm bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
          >
            + Nuevo apoyo compartido
          </button>
        </div>
      </header>

      {/* Saved list — misma lógica que Losas: colapsable, se cierra al cargar */}
      <section className="bg-surface rounded-xl border border-border p-4">
        <button
          type="button"
          onClick={() => setListOpen(!listOpen)}
          className="text-sm font-semibold text-text-muted uppercase tracking-wider w-full text-left"
        >
          {listOpen ? "▼" : "▶"} Apoyos guardados ({savedItems.length})
        </button>
        {listOpen && (
          <div className="mt-3 flex flex-col gap-2">
            {savedItems.length === 0 && (
              <p className="text-xs text-text-muted">
                No hay apoyos guardados.
              </p>
            )}
            {savedItems.map((item) => {
              const reinfChip =
                item.kind === "individual"
                  ? `Ø${item.data.diam} c/${(item.data.sep / 10).toFixed(0)}`
                  : (() => {
                      const r = getCompatReinf(item.data.name);
                      return r
                        ? `Ø${r.diam} c/${(r.sep / 10).toFixed(0)}`
                        : null;
                    })();
              return (
                <div
                  key={`${item.kind}:${item.data.name}`}
                  className="flex items-center gap-2 p-2 bg-surface-alt rounded-lg"
                >
                  <span className="text-sm flex-1">{item.data.name}</span>
                  {reinfChip ? (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        item.kind === "individual"
                          ? "text-primary bg-primary/10 border-primary/30"
                          : "text-warning bg-warning/10 border-warning/30"
                      }`}
                      title={
                        item.kind === "compat" && reinfChip
                          ? "Armadura adicional de apoyo"
                          : "Armadura de apoyo"
                      }
                    >
                      {reinfChip}
                    </span>
                  ) : (
                    <span className="text-xs text-warning font-semibold px-2 py-0.5 rounded-full bg-warning/10 border border-warning/30">
                      Sin armadura
                    </span>
                  )}
                  <span className="text-xs text-text-muted">
                    {item.kind === "individual"
                      ? "Individual"
                      : "Compatibilización"}
                  </span>
                  <span className="text-xs text-text-muted">
                    {new Date(item.data.savedAt).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLoadItem(item)}
                    className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                  >
                    {item.kind === "compat" ? "Armadura" : "Cargar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item)}
                    className="text-xs bg-danger/10 text-danger px-2 py-1 rounded"
                  >
                    Eliminar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Individual support designer — solo aparece al tocar "+ Nuevo apoyo individual" */}
      {individualOpen && !loadedCompat && (
        <section className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
              Diseñar apoyo individual
            </h2>
            <button
              type="button"
              onClick={() => setIndividualOpen(false)}
              className="text-xs text-text-muted hover:text-text px-2 py-1"
            >
              ✕ Cerrar
            </button>
          </div>
          {savedSlabs.length === 0 ? (
            <p className="text-sm text-text-muted">No hay losas guardadas.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Losa</span>
                  <select
                    value={selectedSlabId}
                    onChange={(e) => {
                      setSelectedSlabId(e.target.value);
                      setSelectedEdge(0);
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
                  <span className="text-xs text-text-muted">
                    Borde continuo
                  </span>
                  <select
                    value={supportEdge}
                    onChange={(e) => {
                      setSelectedEdge(Number(e.target.value) as EdgeIndex);
                    }}
                    disabled={continuousEdges.length === 0}
                  >
                    {continuousEdges.length === 0 ? (
                      <option value="">— Sin bordes continuos —</option>
                    ) : (
                      continuousEdges.map((e) => (
                        <option key={e} value={e}>
                          {EDGE_LABELS[e]}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>

              {slab && !slabResult && (
                <p className="text-sm text-warning bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
                  Esta losa está guardada sin resultados. Calculala desde Losas
                  y volvé a guardarla para poder diseñar el apoyo.
                </p>
              )}
              {slabResult && continuousEdges.length === 0 && (
                <p className="text-sm text-warning bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
                  Esta losa no tiene bordes continuos. Cambiá las condiciones de
                  borde en Losas para poder diseñar el apoyo.
                </p>
              )}

              {slab &&
                supportEdge !== undefined &&
                continuousEdges.includes(supportEdge) &&
                supportDesign && (
                  <div className="space-y-3">
                    {/* Summary */}
                    <div className="bg-surface-alt rounded-lg p-3 text-sm">
                      <p>
                        <span className="text-text-muted">Losa:</span>{" "}
                        <strong>
                          {slab.input.lx}×{slab.input.ly} m
                        </strong>{" "}
                        — Borde <strong>{EDGE_LABELS[supportEdge]}</strong>
                      </p>
                      <p className="mt-1">
                        <span className="text-text-muted">
                          M<sub>neg</sub> =
                        </span>{" "}
                        <strong className="text-primary">
                          {mneg.toFixed(2)} kN·m/m
                        </strong>
                      </p>
                    </div>

                    {/* Calculation steps */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bg-surface-alt rounded-lg p-3">
                        <span className="text-text-muted">
                          As apoyo necesario
                        </span>
                        <p className="text-lg font-bold text-primary">
                          {(supportAsReq / 100).toFixed(2)} cm²/m
                        </p>
                        <p className="text-text-muted/60">
                          s<sub>máx</sub> ={" "}
                          {(supportDesign.sMax / 10).toFixed(1)} cm
                        </p>
                      </div>
                      <div className="bg-surface-alt rounded-lg p-3">
                        <span className="text-text-muted">
                          As disponible (barras dobladas)
                        </span>
                        <p className="text-lg font-bold text-text mt-1">
                          {(availableFromSpan / 100).toFixed(2)} cm²/m
                        </p>
                        <p className="text-text-muted/60">
                          = 50% × {(adoptedSpanAs / 100).toFixed(2)} cm²/m
                          (adoptado)
                        </p>
                      </div>
                      <div className="bg-surface-alt rounded-lg p-3">
                        <span className="text-text-muted">
                          As adicional necesario
                        </span>
                        <p className="text-lg font-bold text-warning">
                          {(additionalAsNeeded / 100).toFixed(2)} cm²/m
                        </p>
                        <p className="text-text-muted/60">
                          = máx(0, nec − disp)
                        </p>
                      </div>
                    </div>

                    {supportDesign.steps && (
                      <details className="bg-surface-alt rounded-lg p-3">
                        <summary className="cursor-pointer text-xs text-text-muted hover:text-text">
                          Ver cuentas
                        </summary>
                        <pre className="mt-2 p-2 bg-surface rounded text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto">
                          {postSteps(supportDesign.steps).join("\n")}
                        </pre>
                      </details>
                    )}

                    {/* Additional bars selector */}
                    <div className="bg-surface-alt rounded-lg p-3">
                      <p className="text-sm font-semibold text-text mb-2">
                        Barras adicionales en apoyo
                        {additionalAsNeeded === 0 && (
                          <span className="text-success text-xs ml-2">
                            — Cubierto con barras dobladas
                          </span>
                        )}
                      </p>
                      <div className="flex gap-3 items-end">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-text-muted">
                            Ø (mm)
                          </span>
                          <select
                            value={supDiam}
                            onChange={(e) => setSupDiam(Number(e.target.value))}
                            className="w-20"
                          >
                            {BAR_DIAMETERS.map((d) => (
                              <option key={d} value={d}>
                                Ø{d}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-text-muted">
                            Sep (cm)
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            step={1}
                            value={supSep ? supSep / 10 : ""}
                            onChange={(e) => {
                              const num = parseFloat(e.target.value);
                              if (isNaN(num)) {
                                setSupSep(0);
                                return;
                              }
                              // Entrada en cm → estado en mm (unidad del motor)
                              setSupSep(
                                Math.min(50, Math.max(1, Math.round(num))) * 10,
                              );
                            }}
                            className="w-20"
                          />
                        </label>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-text-muted">
                            Provisto
                          </span>
                          <p className="text-sm font-bold text-text">
                            {(supProvided / 100).toFixed(2)} cm²/m
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-sm">
                          <span className="text-text-muted">Total apoyo:</span>{" "}
                          <strong className="text-primary">
                            {(totalSupportAs / 100).toFixed(2)} cm²/m
                          </strong>
                          <span
                            className={`text-xs ml-2 ${totalSupportAs >= supportAsReq ? "text-success" : "text-warning"}`}
                          >
                            {totalSupportAs >= supportAsReq
                              ? "✓ Cumple"
                              : "✗ No cumple"}
                          </span>
                        </p>
                        <button
                          onClick={handleSaveSupport}
                          disabled={supSep <= 0}
                          className="mt-3 text-sm bg-primary text-white font-semibold px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Guardar apoyo
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {slab && continuousEdges.length === 0 && (
                <p className="text-sm text-text-muted">
                  Esta losa no tiene bordes continuos.
                </p>
              )}
            </>
          )}
        </section>
      )}

      {/* Loaded compatibilization — solo la cargada, no se mantienen abiertas */}
      {loadedCompat && (
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
            Compatibilización cargada
          </h2>
          <CompatCard
            key={loadedCompat.name}
            data={loadedCompat}
            supportDesign={loadedCompatDesign}
            onDelete={handleDelete}
            onSaved={() => setReinfVersion((v) => v + 1)}
          />
        </section>
      )}

      {/* Cómputo de acero de apoyos — debajo de todo */}
      {(apoyosComputo.computo.acero.length > 0 ||
        apoyosComputo.failed.length > 0) && (
        <ComputoSection
          title="Cómputo — Apoyos losas (solo acero)"
          computo={apoyosComputo.computo}
          showConcrete={false}
          note={[
            "Largo = 1/3 de la luz de cada losa que apoya (borde compartido: 1/3 de luz por losa); cantidad según la menor luz perpendicular entre las losas del apoyo, una barra más por borde.",
            apoyosComputo.failed.length > 0
              ? `No computables: ${apoyosComputo.failed.join(", ")}.`
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      )}
    </MainLayout>
  );
}
