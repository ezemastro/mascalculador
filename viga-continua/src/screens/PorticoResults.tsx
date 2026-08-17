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
import { Coordinates, Mafs, Plot, Polygon, Text } from "mafs";
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

// ---- Estética de soporte ----

const SUPPORT_HALF_W = 0.18;
function hingeTriangle(cx: number, cy: number): [number, number][] {
  return [
    [cx, cy],
    [cx - SUPPORT_HALF_W, cy + SUPPORT_HALF_W * 1.5],
    [cx + SUPPORT_HALF_W, cy + SUPPORT_HALF_W * 1.5],
  ];
}
function fixedHatchBox(cx: number, cy: number): [number, number][] {
  const h = SUPPORT_HALF_W * 0.9;
  return [
    [cx - SUPPORT_HALF_W, cy],
    [cx + SUPPORT_HALF_W, cy],
    [cx + SUPPORT_HALF_W, cy + h * 2],
    [cx - SUPPORT_HALF_W, cy + h * 2],
  ];
}

// Exageraciones visuales.
const DEFORM_SCALE = 50;
const M_SCALE = 50;

interface BarSamplePoint {
  x: number;
  y: number;
}

function buildBarPolylines(
  porticoState: PorticoState,
  active: SolvedPortico,
): Array<{ barId: string; samples: BarSamplePoint[] }> {
  return active.bars
    .map((b) => {
      const bar = porticoState.bars.find((bb) => bb.id === b.barId);
      if (!bar) return null;
      const a = porticoState.nodes.find((n) => n.id === bar.fromNodeId);
      const c = porticoState.nodes.find((n) => n.id === bar.toNodeId);
      if (!a || !c) return null;
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const L = Math.hypot(dx, dy);
      if (L < 1e-9) return null;
      const meanM =
        b.forces.samples.reduce((s, p) => s + p.M, 0) /
        Math.max(1, b.forces.samples.length);
      const tensionedSign = meanM >= 0 ? 1 : -1;
      // Perpendicular local en Y-DOWN screen: (-sin α, cos α).
      const offX = -sinL(dy / L) * tensionedSign;
      const offY = cosL(dx / L) * tensionedSign;
      const samples: BarSamplePoint[] = b.forces.samples.map((s) => ({
        x: a.x + (s.s / L) * dx + offX * s.M * M_SCALE,
        y: a.y + (s.s / L) * dy + offY * s.M * M_SCALE,
      }));
      return { barId: b.barId, samples };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

const sinL = (x: number) => x;
const cosL = (x: number) =>
  Math.sqrt(Math.max(0, 1 - x * x)) * (x >= 0 ? 1 : -1);

export default function PorticoResults() {
  const navigate = useNavigate();
  const location = useLocation();
  const raw: unknown = location.state;

  const [envMode, setEnvMode] = useState<EnvMode>("envolvente");

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

  // ---- Geometría: Mafs viewBox ----
  const xs = porticoState.nodes.map((n) => n.x);
  const ys = porticoState.nodes.map((n) => n.y);
  const xMin = Math.min(...xs, -1);
  const xMax = Math.max(...xs, 1);
  const yMin = Math.min(...ys, -1);
  const yMax = Math.max(...ys, 1);
  const padX = Math.max(2, (xMax - xMin) * 0.18);
  const padY = Math.max(2, (yMax - yMin) * 0.18);
  const xLo = Math.floor(xMin - padX);
  const xHi = Math.ceil(xMax + padX);
  const yLo = Math.floor(yMin - padY);
  const yHi = Math.ceil(yMax + padY);

  // useMemo llamado siempre, ANTES del early-return para cumplir
  // rules-of-hooks.
  const barPolylines = useMemo<ReturnType<typeof buildBarPolylines>>(
    () => buildBarPolylines(porticoState, active),
    [porticoState, active],
  );
  const dispByNodeId = useMemo(
    () => new Map(active.displacements.map((d) => [d.nodeId, d])),
    [active],
  );

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
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Geometría + diagrama M+ (deformada ×50)
          </h3>
        </div>
        <div className="p-1">
          <Mafs
            viewBox={{
              x: [xLo, xHi],
              y: [yLo, yHi],
            }}
            height={400}
            preserveAspectRatio={false}
          >
            <Coordinates.Cartesian xAxis={{ lines: 4 }} yAxis={{ lines: 4 }} />

            {/* Barras indeformadas (Plot.OfX linear por barra) */}
            {porticoState.bars.map((b) => {
              const a = porticoState.nodes.find((n) => n.id === b.fromNodeId);
              const c = porticoState.nodes.find((n) => n.id === b.toNodeId);
              if (!a || !c) return null;
              return (
                <Plot.OfX
                  key={`bar-${b.id}`}
                  y={(t) => {
                    if (t < a.x || t > c.x) return a.y;
                    const u = (t - a.x) / (c.x - a.x || 1);
                    return a.y + u * (c.y - a.y);
                  }}
                  domain={[Math.min(a.x, c.x), Math.max(a.x, c.x)]}
                  color="#6b7280"
                />
              );
            })}

            {/* Diagrama M+ por barra (Plot.Parametric sobre la polilínea
                de samples precomputada). Plot.Parametric exige funciones
                x(t)/y(t) suaves, así que aproximamos la polilínea con
                una interpolación lineal por segmentos entre samples. */}
            {barPolylines.flatMap((pl) => {
              if (pl.samples.length < 2) return [];
              const segments: Array<{
                x0: number;
                x1: number;
                y0: number;
                y1: number;
              }> = [];
              for (let i = 0; i < pl.samples.length - 1; i++) {
                const p0 = pl.samples[i];
                const p1 = pl.samples[i + 1];
                segments.push({
                  x0: p0.x,
                  x1: p1.x,
                  y0: p0.y,
                  y1: p1.y,
                });
              }
              return segments.map((s, idx) => (
                <Plot.OfX
                  key={`m-${pl.barId}-${idx}`}
                  y={(t) => {
                    if (t < s.x0 || t > s.x1) return s.y0;
                    const u = (t - s.x0) / (s.x1 - s.x0 || 1);
                    return s.y0 + u * (s.y1 - s.y0);
                  }}
                  domain={[Math.min(s.x0, s.x1), Math.max(s.x0, s.x1)]}
                  color="#fbbf24"
                />
              ));
            })}

            {/* Geometría deformada ×50 (líneas azules) */}
            {porticoState.bars.map((b) => {
              const a = porticoState.nodes.find((n) => n.id === b.fromNodeId);
              const c = porticoState.nodes.find((n) => n.id === b.toNodeId);
              const disA = a ? dispByNodeId.get(a.id) : undefined;
              const disC = c ? dispByNodeId.get(c.id) : undefined;
              if (!a || !c || !disA || !disC) return null;
              return (
                <Polygon
                  key={`deform-${b.id}`}
                  points={[
                    [a.x + disA.u * DEFORM_SCALE, a.y + disA.v * DEFORM_SCALE],
                    [c.x + disC.u * DEFORM_SCALE, c.y + disC.v * DEFORM_SCALE],
                  ]}
                  color="#3b82f6"
                  fillOpacity={0}
                  strokeOpacity={1}
                />
              );
            })}

            {/* Glyphs de apoyo */}
            {porticoState.supports.map((sup) => {
              const n = porticoState.nodes.find((nn) => nn.id === sup.nodeId);
              if (!n) return null;
              const isHinge = sup.kind === "hinge";
              return (
                <Polygon
                  key={`sup-${sup.id}`}
                  points={
                    isHinge ? hingeTriangle(n.x, n.y) : fixedHatchBox(n.x, n.y)
                  }
                  color="#10b981"
                  fillOpacity={isHinge ? 1 : 0.2}
                  strokeOpacity={1}
                />
              );
            })}

            {/* Flechas de carga */}
            {porticoState.loads.map((l) => {
              const bar = porticoState.bars.find((b) => b.id === l.barId);
              const a = porticoState.nodes.find(
                (n) => n.id === bar?.fromNodeId,
              );
              const b = porticoState.nodes.find((n) => n.id === bar?.toNodeId);
              if (!a || !b || !bar) return null;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const L = Math.hypot(dx, dy);
              if (L < 1e-9) return null;
              const aPos = Math.max(0, Math.min(l.a, L));
              const x = a.x + (aPos / L) * dx;
              const y = a.y + (aPos / L) * dy;
              const angleRad = (l.angle * Math.PI) / 180;
              const fx = Math.cos(angleRad);
              const fy = Math.sin(angleRad);
              const len = Math.max(0.4, (xMax - xMin) * 0.07);
              const tailX = x - fx * len;
              const tailY = y - fy * len;
              const wing = len * 0.25;
              const wingX1 = tailX + -fy * wing;
              const wingY1 = tailY + fx * wing;
              const wingX2 = tailX - -fy * wing;
              const wingY2 = tailY - fx * wing;
              return (
                <g key={`load-${l.id}`}>
                  <Polygon
                    points={[
                      [x, y],
                      [tailX, tailY],
                      [wingX1, wingY1],
                      [wingX2, wingY2],
                    ]}
                    color="#f87171"
                    fillOpacity={1}
                  />
                  <Text
                    x={tailX - fx * len * 0.2}
                    y={tailY - fy * len * 0.2}
                    size={14}
                    color="#f87171"
                  >
                    {`${Math.round(l.D)}D+${Math.round(l.L)}L`}
                  </Text>
                </g>
              );
            })}

            <Plot.OfX y={() => 0} domain={[xLo, xHi]} color="#374151" />
          </Mafs>
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
