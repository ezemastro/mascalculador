/**
 * PorticoResults — render del resultado del solver 2-D.
 *
 * Flow:
 *   1. Lee `location.state` esperando `{ mode: "portico", state }` (el
 *      payload del PorticoForm). Si falta, devuelve error estructurado.
 *   2. Resuelve UNA vez con `solvePortico(state, "uls")` y guarda el
 *      triple `{ uls, slsD, slsL }` en useMemo (la toggle selecciona
 *      el slice sin re-resolver).
 *   3. Muestra el slice activo (`envMode`):
 *        - envolvente → `result.uls` (U = 1.2·D + 1.6·L).
 *        - servicio   → dos cards: D (slsD) y L (slsL) por separado.
 *
 * Convenciones visuales:
 *   - Y positivo hacia abajo (coincide con Mafs / world).
 *   - M+ = fibra inferior traccionada en vigas horizontales; vector
 *     momento apuntando a +x (regla de la mano derecha).
 *
 * Diagrama Mafs:
 *   - Vista 400px alto.
 *   - Geometría indeformada: barras (Plot.OfX), nodos visibles como
 *     intersección de plots; glyphs de apoyo (triángulo = hinge,
 *     cuadrado hatch = fixed), flechas de carga como flechas de
 *     Pollígono, deformada polilínea (×50 exageración).
 *   - M+ por barra: Plot.Parametric con la polilínea offset sobre la
 *     fibra traccionada (perpendicular a +x̄_local según el signo de M).
 */

import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { solvePortico } from "../lib/portico-analysis";
import { savePorticoInput, updatePorticoInput } from "../lib/storage";
import type {
  PorticoNode,
  PorticoReaction,
  PorticoState,
  PorticoSupport,
  SolvedPortico,
} from "../lib/portico";
import EnvToggle, { type EnvMode } from "../components/EnvToggle";
import DiagramModeToggle from "../components/DiagramModeToggle";
import type { DiagramMode } from "../components/PorticoDiagram";
import PorticoDiagram, {
  COLOR_BAR,
  COLOR_DEFORM,
  COLOR_LOAD,
  COLOR_M,
  COLOR_N_COMPRESSION,
  COLOR_N_TENSION,
  COLOR_SUPPORT,
  COLOR_V,
} from "../components/PorticoDiagram";
import ZoomControls from "../components/ZoomControls";
import PrintSelection, {
  type PrintSelectionValue,
} from "../components/PrintSelection";

interface PorticoNavState {
  mode: "portico";
  state: PorticoState;
  loadedSaveId?: string;
  loadedSaveName?: string;
}

function isPorticoNavState(s: unknown): s is PorticoNavState {
  return (
    s !== null &&
    typeof s === "object" &&
    "mode" in s &&
    (s as { mode: unknown }).mode === "portico" &&
    "state" in s
  );
}

interface LoadResultant {
  Fx: number;
  Fy: number;
  Mz: number;
  momentTerms: MomentTerm[];
}

interface MomentTerm {
  label: string;
  value: number;
  nodeId?: string;
}

interface LoadAccounts {
  reference: PorticoNode | undefined;
  uls: LoadResultant;
  d: LoadResultant;
}

function calculateLoadResultant(
  state: PorticoState,
  dFactor: number,
  lFactor: number,
  reference: PorticoNode | undefined,
): LoadResultant {
  let Fx = 0;
  let Fy = 0;
  let Mz = 0;
  const momentTerms: MomentTerm[] = [];
  for (const load of state.loads) {
    const bar = state.bars.find((item) => item.id === load.barId);
    if (!bar) continue;
    const a = state.nodes.find((node) => node.id === bar.fromNodeId);
    const b = state.nodes.find((node) => node.id === bar.toNodeId);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-9) continue;
    const start = Math.max(0, Math.min(load.a, length));
    const end =
      load.kind === "distributed"
        ? Math.max(start, Math.min(load.b ?? length, length))
        : start;
    const magnitude = dFactor * load.D + lFactor * load.L;
    const total =
      load.kind === "distributed" ? magnitude * (end - start) : magnitude;
    const position = load.kind === "distributed" ? (start + end) / 2 : start;
    const x = a.x + (position / length) * dx;
    const y = a.y + (position / length) * dy;
    const angle = (load.angle * Math.PI) / 180;
    const fx = total * Math.cos(angle);
    const fy = total * Math.sin(angle);
    Fx += fx;
    Fy += fy;
    const moment =
      (x - (reference?.x ?? 0)) * fy - (y - (reference?.y ?? 0)) * fx;
    Mz += moment;
    momentTerms.push({ label: `Carga ${load.id}`, value: moment });
  }
  return { Fx, Fy, Mz, momentTerms };
}

function activeLoadResultant(
  accounts: LoadAccounts,
  envMode: EnvMode,
): LoadResultant {
  return envMode === "envolvente" ? accounts.uls : accounts.d;
}

function reactionMomentTerms(
  solved: SolvedPortico,
  state: PorticoState,
  reference: PorticoNode | undefined,
): MomentTerm[] {
  const referenceX = reference?.x ?? 0;
  const referenceY = reference?.y ?? 0;
  return solved.reactions.flatMap((reaction) => {
    const support = state.supports.find(
      (item) => item.id === reaction.supportId,
    );
    const node = support
      ? state.nodes.find((item) => item.id === support.nodeId)
      : undefined;
    if (!node) return [];
    return [
      {
        label: `Apoyo ${node.id}`,
        nodeId: node.id,
        value:
          (node.x - referenceX) * reaction.Fy -
          (node.y - referenceY) * reaction.Fx +
          reaction.Mz,
      },
    ];
  });
}

function signed(value: number): string {
  return `${value < 0 ? "−" : "+"} ${Math.abs(value).toFixed(3)}`;
}

function equilibriumValue(value: number): string {
  return Math.abs(value) < 0.0005 ? "0.000" : value.toFixed(3);
}

// ---- Estética de soporte (movida a PorticoDiagram.tsx) ----
// Las constantes SUPPORT_HALF_W, hingeTriangle, fixedHatchBox, DEFORM_SCALE,
// M_SCALE, buildBarPolylines, sinL, cosL y la interface BarSamplePoint
// ahora viven en PorticoDiagram. PorticoResults solo orquesta: state de
// modo + zoom + selector + componente de render.

export default function PorticoResults() {
  const navigate = useNavigate();
  const location = useLocation();
  const raw: unknown = location.state;
  const originalNavigationState = isPorticoNavState(raw) ? raw : null;

  const [envMode, setEnvMode] = useState<EnvMode>("envolvente");
  const [showPrintSelection, setShowPrintSelection] = useState(false);
  const [loadedSaveId, setLoadedSaveId] = useState<string | null>(() =>
    isPorticoNavState(raw) ? (raw.loadedSaveId ?? null) : null,
  );
  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(() =>
    isPorticoNavState(raw) ? (raw.loadedSaveName ?? null) : null,
  );
  const [diagramMode, setDiagramMode] = useState<DiagramMode>("geometria");
  const [viewBoxOverride, setViewBoxOverride] = useState<
    [number, number, number, number] | null
  >(null);

  // Resolver una sola vez (caller: PorticoForm / mode-selector). Memoiza
  // en raw para re-resolver sólo si cambia el payload (poco probable en la
  // práctica — al volver del form ya trae uno nuevo).
  const solved = useMemo<
    | {
        ok: true;
        porticoState: PorticoState;
        uls: SolvedPortico;
        slsD: SolvedPortico;
        slsL: SolvedPortico;
      }
    | { ok: false; error: string }
  >(() => {
    if (!isPorticoNavState(raw)) {
      return {
        ok: false,
        error: "No hay datos de pórtico — volvé al form y enviá de nuevo.",
      };
    }
    try {
      const out = solvePortico(raw.state, "uls");
      return {
        ok: true,
        porticoState: raw.state,
        uls: out.uls,
        slsD: out.slsD,
        slsL: out.slsL,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [raw]);

  // Derivados memoizados SIEMPRE (no en early return) para evitar
  // violación de rules-of-hooks. Si el solver falló, las slices quedan
  // vacías — pero no se renderizan gracias al early return siguiente.
  const fallback: SolvedPortico = {
    displacements: [],
    reactions: [],
    bars: [],
  };
  const uls = solved.ok ? solved.uls : fallback;
  const slsD = solved.ok ? solved.slsD : fallback;
  const slsL = solved.ok ? solved.slsL : fallback;
  const porticoState: PorticoState = useMemo(
    () =>
      solved.ok
        ? solved.porticoState
        : { nodes: [], bars: [], loads: [], supports: [] },
    [solved],
  );

  const active: SolvedPortico = envMode === "envolvente" ? uls : slsD;
  const loadAccounts: LoadAccounts = useMemo(() => {
    const reference =
      porticoState.nodes.find((node) => node.id === "A") ??
      porticoState.nodes[0];
    return {
      reference,
      uls: calculateLoadResultant(porticoState, 1.2, 1.6, reference),
      d: calculateLoadResultant(porticoState, 1, 0, reference),
    };
  }, [porticoState]);
  const activeReactionTotals = active.reactions.reduce(
    (totals, reaction) => ({
      Fx: totals.Fx + reaction.Fx,
      Fy: totals.Fy + reaction.Fy,
      Mz: totals.Mz + reaction.Mz,
    }),
    { Fx: 0, Fy: 0, Mz: 0 },
  );
  const activeLoads = activeLoadResultant(loadAccounts, envMode);
  const activeReactionMomentContributions = reactionMomentTerms(
    active,
    porticoState,
    loadAccounts.reference,
  );
  const activeMomentTotal =
    activeReactionMomentContributions.reduce(
      (sum, term) => sum + term.value,
      0,
    ) + activeLoads.Mz;

  function handleSave() {
    if (loadedSaveId) {
      try {
        updatePorticoInput(loadedSaveId, {
          name: loadedSaveName ?? "Sin nombre",
          input: porticoState,
        });
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Error al guardar");
      }
      return;
    }

    const name = prompt("Nombre para guardar este pórtico:");
    if (!name) return;
    try {
      const saved = savePorticoInput({ name, input: porticoState });
      setLoadedSaveId(saved.id);
      setLoadedSaveName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  function handlePrint(selection: PrintSelectionValue) {
    navigate("/viga-continua-print", {
      state: { ...selection, state: porticoState },
    });
  }
  // ---- Zoom helpers ----
  // Mantienen el centro del viewBox y escalan los spans. Cuando el override
  // es null, el diagrama usa fit-to-bbox automático.
  function zoomBy(factor: number) {
    setViewBoxOverride((cur) => {
      // Calcular bbox base desde los nodos (fit-to-bbox).
      const xs = porticoState.nodes.map((n) => n.x);
      const ys = porticoState.nodes.map((n) => n.y);
      const xMin = xs.length ? Math.min(...xs) : -1;
      const xMax = xs.length ? Math.max(...xs) : 1;
      const yMin = ys.length ? Math.min(...ys) : -1;
      const yMax = ys.length ? Math.max(...ys) : 1;
      const padX = Math.max(2, (xMax - xMin) * 0.18);
      const padY = Math.max(2, (yMax - yMin) * 0.18);
      const baseXLo = xMin - padX;
      const baseXHi = xMax + padX;
      const baseYLo = yMin - padY;
      const baseYHi = yMax + padY;
      const base: [number, number, number, number] = cur ?? [
        baseXLo,
        baseXHi,
        baseYLo,
        baseYHi,
      ];
      const cx = (base[0] + base[1]) / 2;
      const cy = (base[2] + base[3]) / 2;
      const halfW = ((base[1] - base[0]) * factor) / 2;
      const halfH = ((base[3] - base[2]) * factor) / 2;
      return [cx - halfW, cx + halfW, cy - halfH, cy + halfH];
    });
  }

  function zoomIn() {
    zoomBy(0.8);
  }
  function zoomOut() {
    zoomBy(1.25);
  }
  function zoomFit() {
    setViewBoxOverride(null);
  }

  // Errores tempranos: AHORA sí retornamos.
  if (!solved.ok) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-danger">{solved.error}</p>
          <button
            type="button"
            onClick={() =>
              navigate("/viga-continua?mode=portico", {
                state: originalNavigationState ?? undefined,
              })
            }
            className="bg-primary text-white hover:bg-primary-hover px-6 py-3 rounded-lg"
          >
            Volver
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Pórtico</h1>
          <p className="text-sm text-text-muted">
            {porticoState.nodes.length} nudos · {porticoState.bars.length}{" "}
            barras · {porticoState.supports.length} apoyos ·{" "}
            {porticoState.loads.length} cargas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              navigate("/viga-continua?mode=portico", {
                state: {
                  mode: "portico",
                  state: porticoState,
                  loadedSaveId: loadedSaveId ?? undefined,
                  loadedSaveName: loadedSaveName ?? undefined,
                },
              })
            }
            className="text-sm bg-surface-alt border border-border hover:bg-surface text-text-muted px-3 py-1.5 rounded-lg"
          >
            ← Volver
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="bg-primary text-white font-semibold px-4 py-1.5 rounded-lg hover:bg-primary-hover transition-colors"
          >
            {loadedSaveId ? "Guardar corrección" : "Guardar"}
          </button>
          <button
            type="button"
            className="bg-primary text-white font-semibold px-4 py-1.5 rounded-lg"
            onClick={() => setShowPrintSelection(true)}
          >
            Imprimir
          </button>
        </div>
      </header>

      {/* Env toggle in its own row, separated from the header actions. */}
      <div className="flex flex-col items-center gap-1">
        <EnvToggle envMode={envMode} setEnvMode={setEnvMode} />
        <p className="text-xs text-text-muted">
          Envolvente: U = 1.2·D + 1.6·L · Estado de servicio: D (sin mayorar)
        </p>
      </div>

      {/* Reacciones */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Reacciones
        </h2>
        {envMode === "servicio" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ReactionsTable
              title="Servicio D (sin factor)"
              rows={slsD.reactions}
              supports={porticoState.supports}
              nodes={porticoState.nodes}
            />
            <ReactionsTable
              title="Servicio L (sin factor)"
              rows={slsL.reactions}
              supports={porticoState.supports}
              nodes={porticoState.nodes}
            />
          </div>
        ) : (
          <ReactionsTable
            title="Envolvente"
            rows={active.reactions}
            supports={porticoState.supports}
            nodes={porticoState.nodes}
          />
        )}
      </section>

      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Equilibrio global
        </h2>
        <p className="text-xs text-text-muted mb-3">
          {envMode === "envolvente" ? "U = 1.2D + 1.6L" : "D (slsD)"} ·
          referencia: Nudo {loadAccounts.reference?.id ?? "A"}. Las fuerzas
          internas se cancelan por pares; esto verifica el equilibrio externo
          global.
        </p>
        <div className="grid grid-cols-1 gap-2 text-xs text-text-muted">
          <p>
            ΣRx + ΣFx(ext) = {signed(activeReactionTotals.Fx)}{" "}
            {signed(activeLoads.Fx)} ={" "}
            {equilibriumValue(activeReactionTotals.Fx + activeLoads.Fx)} kN
          </p>
          <p>
            ΣRy + ΣFy(ext) = {signed(activeReactionTotals.Fy)}{" "}
            {signed(activeLoads.Fy)} ={" "}
            {equilibriumValue(activeReactionTotals.Fy + activeLoads.Fy)} kN
          </p>
          <div>
            <p>ΣM{loadAccounts.reference?.id ?? "A"} =</p>
            <ul className="ml-3 mt-1 space-y-1 text-[11px]">
              {activeReactionMomentContributions.map((term) => (
                <li key={`reaction-${term.label}`}>
                  {term.label}: (x{term.nodeId}−x
                  {loadAccounts.reference?.id ?? "A"})·Ry − (y
                  {term.nodeId}−y{loadAccounts.reference?.id ?? "A"}
                  )·Rx + Mz = {signed(term.value)} kN·m
                </li>
              ))}
              {activeLoads.momentTerms.map((term) => (
                <li key={`load-${term.label}`}>
                  {term.label}: (x−x{loadAccounts.reference?.id ?? "A"})·Fy −
                  (y−y{loadAccounts.reference?.id ?? "A"})·Fx ={" "}
                  {signed(term.value)} kN·m
                </li>
              ))}
            </ul>
            <p className="mt-1">
              ΣM{loadAccounts.reference?.id ?? "A"} ={" "}
              {equilibriumValue(activeMomentTotal)} kN·m
            </p>
          </div>
        </div>
      </section>

      {/* Diagrama Mafs */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Diagrama
          </h3>
          <div className="flex items-center gap-2">
            <DiagramModeToggle mode={diagramMode} setMode={setDiagramMode} />
            <ZoomControls
              hasOverride={viewBoxOverride !== null}
              onIn={zoomIn}
              onOut={zoomOut}
              onFit={zoomFit}
            />
          </div>
        </div>
        <div className="p-1 w-full">
          <PorticoDiagram
            porticoState={porticoState}
            solved={active}
            mode={diagramMode}
            viewBoxOverride={viewBoxOverride ?? undefined}
            height={420}
          />
        </div>
        <div className="px-4 py-2 border-t border-border text-xs text-text-muted flex flex-wrap gap-3">
          {diagramMode === "geometria" && (
            <>
              <span>
                <span
                  className="inline-block w-3 h-3 rounded-full align-middle mr-1"
                  style={{ background: COLOR_BAR }}
                />
                Barras
              </span>
              <span>
                <span
                  className="inline-block w-3 h-3 rounded-full align-middle mr-1"
                  style={{ background: COLOR_DEFORM }}
                />
                Deformada ×50
              </span>
              <span>
                <span
                  className="inline-block w-3 h-3 rounded-full align-middle mr-1"
                  style={{ background: COLOR_SUPPORT }}
                />
                Apoyos
              </span>
              <span>
                <span
                  className="inline-block w-3 h-3 rounded-full align-middle mr-1"
                  style={{ background: COLOR_LOAD }}
                />
                Cargas
              </span>
            </>
          )}
          {diagramMode === "deformada" && (
            <span>
              <span
                className="inline-block w-3 h-3 rounded-full align-middle mr-1"
                style={{ background: COLOR_DEFORM }}
              />
              Deformada — escala gráfica automática
            </span>
          )}
          {diagramMode === "normales" && (
            <>
              <span>
                <span
                  className="inline-block w-3 h-3 rounded-full align-middle mr-1"
                  style={{ background: COLOR_N_TENSION }}
                />
                Tracción (+)
              </span>
              <span>
                <span
                  className="inline-block w-3 h-3 rounded-full align-middle mr-1"
                  style={{ background: COLOR_N_COMPRESSION }}
                />
                Compresión (−)
              </span>
            </>
          )}
          {diagramMode === "momentos" && (
            <span>
              <span
                className="inline-block w-3 h-3 rounded-full align-middle mr-1"
                style={{ background: COLOR_M }}
              />
              M+ (fibra inferior traccionada)
            </span>
          )}
          {diagramMode === "corte" && (
            <span>
              <span
                className="inline-block w-3 h-3 rounded-full align-middle mr-1"
                style={{ background: COLOR_V }}
              />
              V (signo derecho)
            </span>
          )}
        </div>
      </section>

      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Fuerzas por barra
        </h2>
        <p className="text-xs text-text-muted mb-3">
          Componentes N, V y M en el sistema local de cada barra ·{" "}
          {envMode === "envolvente" ? "U = 1.2D + 1.6L" : "D (slsD)"}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {active.bars.map((bar) => {
            const values = (key: "N" | "V" | "M") => [
              bar.forces.start[key],
              ...bar.forces.samples.map((sample) => sample[key]),
              bar.forces.end[key],
            ];
            const maxAbs = (key: "N" | "V" | "M") =>
              Math.max(...values(key).map((value) => Math.abs(value)));
            return (
              <div
                key={bar.barId}
                className="bg-surface-alt rounded-lg p-3 text-xs"
              >
                <p className="font-semibold text-text mb-1">
                  Barra {bar.barId}
                </p>
                <p>
                  Inicio: N={bar.forces.start.N.toFixed(3)} kN · V=
                  {bar.forces.start.V.toFixed(3)} kN · M=
                  {bar.forces.start.M.toFixed(3)} kN·m
                </p>
                <p>
                  Fin: N={bar.forces.end.N.toFixed(3)} kN · V=
                  {bar.forces.end.V.toFixed(3)} kN · M=
                  {bar.forces.end.M.toFixed(3)} kN·m
                </p>
                <p className="mt-1 font-medium text-text">
                  Máximos absolutos: |N|={maxAbs("N").toFixed(3)} kN · |V|=
                  {maxAbs("V").toFixed(3)} kN · |M|={maxAbs("M").toFixed(3)}{" "}
                  kN·m
                </p>
              </div>
            );
          })}
        </div>
      </section>
      {showPrintSelection && (
        <PrintSelection
          kind="portico"
          defaultEnvMode={envMode}
          onPrint={handlePrint}
          onCancel={() => setShowPrintSelection(false)}
        />
      )}
    </MainLayout>
  );
}

// ---- Tabla de reacciones reutilizable ----

function ReactionsTable({
  title,
  rows,
  supports,
  nodes,
}: {
  title: string;
  rows: PorticoReaction[];
  supports: PorticoSupport[];
  nodes: PorticoNode[];
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-3">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="flex flex-col gap-1.5">
        {supports.map((sup) => {
          const r = rows.find((row) => row.supportId === sup.id);
          const n = nodes.find((nn) => nn.id === sup.nodeId);
          if (!r || !n) return null;
          return (
            <div key={`${title}-${sup.id}`} className="text-xs">
              <p className="font-semibold text-text">
                Apoyo {n.id} ·{" "}
                {sup.kind === "hinge" ? "articulado" : "empotrado"}
              </p>
              <p className="text-text-muted">
                Rx = {r.Fx.toFixed(2)} kN · Ry = {r.Fy.toFixed(2)} kN · Mz ={" "}
                {r.Mz.toFixed(2)} kN·m
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
