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
import { MainLayout, formatMoment } from "@mascalculador/shared";
import { solvePortico } from "../lib/portico-analysis";
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

interface PorticoNavState {
  mode: "portico";
  state: PorticoState;
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

// ---- Estética de soporte (movida a PorticoDiagram.tsx) ----
// Las constantes SUPPORT_HALF_W, hingeTriangle, fixedHatchBox, DEFORM_SCALE,
// M_SCALE, buildBarPolylines, sinL, cosL y la interface BarSamplePoint
// ahora viven en PorticoDiagram. PorticoResults solo orquesta: state de
// modo + zoom + selector + componente de render.

export default function PorticoResults() {
  const navigate = useNavigate();
  const location = useLocation();
  const raw: unknown = location.state;

  const [envMode, setEnvMode] = useState<EnvMode>("envolvente");
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
            onClick={() => navigate("/viga-continua?mode=portico")}
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
          <h1 className="text-xl font-semibold text-text">Pórtico</h1>
          <p className="text-sm text-text-muted">
            {porticoState.nodes.length} nudos · {porticoState.bars.length}{" "}
            barras · {porticoState.supports.length} apoyos ·{" "}
            {porticoState.loads.length} cargas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EnvToggle envMode={envMode} setEnvMode={setEnvMode} />
          <button
            type="button"
            onClick={() => navigate("/viga-continua?mode=portico")}
            className="text-sm bg-surface-alt border border-border hover:bg-surface text-text-muted px-3 py-1.5 rounded-lg"
          >
            ← Volver
          </button>
        </div>
      </header>

      {/* Leyendas OBLIGATORIAS (top, sin scroll) */}
      <section className="bg-surface rounded-xl border border-border p-3 text-xs text-text-muted">
        <p>
          <strong className="text-text">M+:</strong> fibra inferior traccionada
          en vigas horizontales, vector momento apuntando a <code>+x</code>{" "}
          (mano derecha).
        </p>
        <p>
          <strong className="text-text">Y:</strong> positivo hacia abajo (igual
          que en pantalla). Vector momento horizontal va por <code>→ +x</code>.
        </p>
        <p>
          {envMode === "servicio"
            ? "Servicio — reacciones D y L por separado; envolvente = U = 1.2·D + 1.6·L."
            : "Envolvente — U = 1.2·D + 1.6·L."}
        </p>
      </section>

      {/* Reacciones */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Reacciones{" "}
          {envMode === "envolvente"
            ? "(U = 1.2·D + 1.6·L)"
            : "(D y L por separado)"}
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
            title={`Envolvente U = 1.2·D + 1.6·L`}
            rows={active.reactions}
            supports={porticoState.supports}
            nodes={porticoState.nodes}
          />
        )}
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

      {/* Resumen de momentos máximos por barra */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          {envMode === "servicio"
            ? "Momentos (D y L por separado)"
            : "Momentos U"}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {active.bars.map((b) => {
            const maxM = b.forces.samples.reduce(
              (m, s) => Math.max(m, Math.abs(s.M)),
              Math.max(Math.abs(b.forces.start.M), Math.abs(b.forces.end.M)),
            );
            return (
              <div
                key={`m-card-${b.barId}`}
                className="bg-surface rounded-xl border border-border p-3"
              >
                <p className="text-xs text-text-muted">Barra {b.barId}</p>
                <p className="text-sm">
                  |M|<sub>max</sub> ={" "}
                  <span className="font-semibold text-text">
                    {formatMoment(maxM)}
                  </span>
                </p>
              </div>
            );
          })}
        </div>
      </section>
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
                {sup.id} · nudo {n.id} ·{" "}
                {sup.kind === "hinge" ? "articulado" : "empotrado"}
              </p>
              <p className="text-text-muted">
                Fx = {r.Fx.toFixed(2)} kN · Fy = {r.Fy.toFixed(2)} kN · Mz ={" "}
                {r.Mz.toFixed(2)} kN·m
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
