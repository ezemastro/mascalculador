import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { SlabPlan } from "@mascalculador/shared";
import { PrintButton } from "@mascalculador/shared";
import {
  designSlab,
  unidirectionalDirection,
  validateSlabSupports,
  type DirectionResult,
} from "../lib/slab-calc";
import { hasSlabDL, slabReactionToBeamLoad } from "../lib/slab-to-beam";
import type { SlabEdge } from "../lib/slab-to-beam";
import { saveSlab, updateSlab } from "../lib/storage";
import type { SlabInput } from "../lib/slab-calc";
import type { SlabState } from "./SlabForm";

function sanitizeDecimal(val: string): string {
  // Replace comma (both regular and numpad) with dot
  return val.replace(/,/g, ".");
}

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

const BAR_DIAMETERS = [6, 8, 10, 12, 16, 20];
const BAR_AREA: Record<number, number> = {
  6: 28,
  8: 50,
  10: 79,
  12: 113,
  16: 201,
  20: 314,
};

function SupportSection({
  label,
  dir,
}: {
  label: string;
  dir: DirectionResult;
}) {
  const asReqCm = (dir.AsReq / 100).toFixed(2);
  const asMinCm = (dir.AsMin / 100).toFixed(2);
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
        Apoyo {label}
      </span>
      <p className="text-sm mt-1">
        M<sub>u</sub> = {dir.Mu.toFixed(2)} kN·m/m
      </p>
      <p className="text-sm font-bold text-primary">
        A<sub>s</sub> req = {asReqCm} cm²/m
      </p>
      <p className="text-xs text-text-muted">
        mín: {asMinCm} &middot; s<sub>máx</sub>: {(dir.sMax / 10).toFixed(1)} cm
      </p>
      <details className="mt-2 pt-2 border-t border-border">
        <summary className="cursor-pointer text-xs text-text-muted hover:text-text">
          Ver cuentas
        </summary>
        <div className="mt-2 p-2 bg-surface-alt rounded text-xs text-text-muted font-mono space-y-0.5">
          <p>
            M<sub>n</sub> = M<sub>u</sub> / φ = {(dir.Mu / 0.9).toFixed(2)}{" "}
            kN·m/m
          </p>
          <p>
            m<sub>n</sub> = {dir.mn.toFixed(4)}
          </p>
          <p>
            K<sub>a</sub> = {dir.Ka.toFixed(4)}
          </p>
          <p>
            K<sub>a,min</sub> = {dir.KaMin.toFixed(4)}
          </p>
          <p>
            K<sub>a,max</sub> = {dir.KaMax.toFixed(4)}
          </p>
          <p className="text-primary font-semibold">{dir.caseLabel}</p>
          <p>
            A<sub>s,req</sub> = {asReqCm} cm²/m
          </p>
          <p>
            A<sub>s,mín</sub> = {asMinCm} cm²/m
          </p>
          <p>
            A<sub>s,temp</sub> = {(dir.AsTemp / 100).toFixed(2)} cm²/m
          </p>
          <p>
            s<sub>máx</sub> = {(dir.sMax / 10).toFixed(1)} cm
          </p>
        </div>
      </details>
    </div>
  );
}

function DirSection({
  label,
  dir,
  principal,
  diam,
  setDiam,
  sep,
  setSep,
}: {
  label: string;
  dir: DirectionResult;
  /** true = armadura principal (a flexión); false = armadura de repartición */
  principal: boolean;
  diam: number;
  setDiam: (d: number) => void;
  sep: number;
  setSep: (s: number) => void;
}) {
  const areaBar = BAR_AREA[diam] || 0;
  // sep is in cm; convert to mm for the asProvided calculation:
  // areaBar (mm²) * 100 (cm/m) / sep (cm) = mm²/m
  const asProvided = sep > 0 ? Math.round((areaBar * 100) / sep) : 0;
  const asReqCm = (dir.AsReq / 100).toFixed(2);
  const asMinCm = (dir.AsMin / 100).toFixed(2);

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
        {label}
      </span>
      {principal ? (
        <>
          <p className="text-sm mt-1">
            M<sub>u</sub> = {dir.Mu.toFixed(2)} kN·m/m
          </p>
          <p className="text-sm font-bold text-primary">
            A<sub>s</sub> req = {asReqCm} cm²/m
          </p>
          <p className="text-xs text-text-muted">
            mín: {asMinCm} &middot; s<sub>máx</sub>:{" "}
            {(dir.sMax / 10).toFixed(1)} cm
          </p>
        </>
      ) : (
        <>
          <p className="text-sm mt-1 text-text-muted">
            Armadura de repartición
          </p>
          <p className="text-sm font-bold text-primary">
            A<sub>s</sub> repartición = {asReqCm} cm²/m
          </p>
          <p className="text-xs text-text-muted">
            s<sub>máx</sub>: {(dir.sMax / 10).toFixed(1)} cm &middot; min(3·h,
            30 cm)
          </p>
        </>
      )}
      <div className="border-t border-border mt-2 pt-2 flex gap-2 items-end">
        <label className="flex flex-col gap-0.5">
          <span className="text-xs text-text-muted">Ø</span>
          <select
            value={diam}
            onChange={(e) => setDiam(Number(e.target.value))}
            className="w-16"
          >
            {BAR_DIAMETERS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-xs text-text-muted">Sep (cm)</span>
          <input
            type="text"
            value={sep === 0 ? "" : sep}
            onChange={(e) => {
              const raw = sanitizeDecimal(e.target.value);
              const num = parseFloat(raw);
              setSep(isNaN(num) ? 0 : num);
            }}
            className="w-20"
          />
        </label>
        <span className="text-sm pb-2">
          → {(asProvided / 100).toFixed(2)} cm²/m
        </span>
        <span
          className={`text-sm font-bold pb-2 ${asProvided >= dir.AsReq ? "text-success" : "text-danger"}`}
        >
          {asProvided >= dir.AsReq ? "✓" : "✗"}
        </span>
      </div>
    </div>
  );
}

export default function SlabResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const s = location.state as SlabState | null;
  if (!s)
    return (
      <MainLayout>
        <p className="text-text-muted p-8">No hay datos.</p>
      </MainLayout>
    );

  const {
    lx,
    ly,
    edgeX0,
    edgeXL,
    edgeY0,
    edgeYL,
    D,
    L,
    fc,
    fy,
    cover,
    h,
    dBarX,
    dBarY,
    includeSelfWeight,
    loadedSaveId,
    loadedSaveName,
  } = s;

  const supportError = validateSlabSupports([edgeX0, edgeXL, edgeY0, edgeYL]);
  if (supportError) {
    return (
      <MainLayout>
        <div className="bg-surface rounded-xl border border-danger/30 p-6 text-center">
          <h1 className="text-lg font-semibold text-danger mb-2">
            Configuración de apoyos inválida
          </h1>
          <p className="text-sm text-text-muted">{supportError}</p>
          <button
            onClick={() => navigate("/slab")}
            className="mt-4 text-sm bg-surface-alt border border-border text-text-muted px-4 py-1.5 rounded-lg hover:bg-surface hover:text-text transition-colors"
          >
            ← Volver
          </button>
        </div>
      </MainLayout>
    );
  }

  // Slab typology, same rules as the engine: crossed needs 4 supported edges
  // with ratio > 0.5; otherwise unidirectional with a single spanning axis
  // (the other axis only carries repartición).
  const supEdges = [edgeX0, edgeXL, edgeY0, edgeYL].filter(
    (e) => e !== "free",
  ).length;
  const ratio = Math.min(lx, ly) / Math.max(lx, ly);
  const isCrossed = supEdges === 4 && ratio > 0.5;
  const spanningAxis: "X" | "Y" | null = isCrossed
    ? null
    : unidirectionalDirection(lx, ly, [edgeX0, edgeXL, edgeY0, edgeYL]);

  const result = designSlab({
    lx,
    ly,
    edges: [edgeX0, edgeXL, edgeY0, edgeYL],
    D,
    L,
    fc,
    fy,
    cover,
    h,
    dBarX,
    dBarY,
    includeSelfWeight,
  });

  // Reacciones por borde: factoradas (R) + D/L sin factorar (para envío a viga)
  const EDGE_REACTIONS: {
    label: string;
    sub: string;
    edge: SlabEdge;
    value: number;
    dead?: number;
    live?: number;
  }[] = [
    {
      label: "Izquierdo",
      sub: "x",
      edge: "izq",
      value: result.RxIzq,
      dead: result.RD_izq,
      live: result.RL_izq,
    },
    {
      label: "Derecho",
      sub: "x",
      edge: "der",
      value: result.RxDer,
      dead: result.RD_der,
      live: result.RL_der,
    },
    {
      label: "Arriba",
      sub: "y",
      edge: "arr",
      value: result.RyArr,
      dead: result.RD_arr,
      live: result.RL_arr,
    },
    {
      label: "Abajo",
      sub: "y",
      edge: "aba",
      value: result.RyAba,
      dead: result.RD_aba,
      live: result.RL_aba,
    },
  ];

  // Adopted reinforcement state (persisted when saving)
  // sep values are in cm
  const [diamX, setDiamX] = useState(6);
  const [sepX, setSepX] = useState(15);
  const [diamY, setDiamY] = useState(6);
  const [sepY, setSepY] = useState(15);
  const adoptedAsX =
    sepX > 0 ? Math.round(((BAR_AREA[diamX] || 0) * 100) / sepX) : 0;
  const adoptedAsY =
    sepY > 0 ? Math.round(((BAR_AREA[diamY] || 0) * 100) / sepY) : 0;

  // Track save state (starts from router state, updates on save)
  const [savedId, setSavedId] = useState<string | null>(loadedSaveId ?? null);
  const [savedName, setSavedName] = useState<string | null>(
    loadedSaveName ?? null,
  );

  return (
    <MainLayout>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text flex items-center gap-3">
            Losa {lx}×{ly} m
            {savedName ? (
              <span className="text-sm font-normal text-text-muted bg-surface-alt border border-border px-2.5 py-0.5 rounded-full">
                {savedName}
              </span>
            ) : (
              <span className="text-sm font-normal text-warning bg-warning/10 border border-warning/30 px-2.5 py-0.5 rounded-full">
                Sin guardar
              </span>
            )}
          </h1>
          <p className="text-sm text-text-muted">
            h = {(result.h / 10).toFixed(1)} cm &middot; d ={" "}
            {(result.d / 10).toFixed(1)} cm &middot; qu = {result.qu.toFixed(2)}{" "}
            kN/m²
          </p>
        </div>
        <div className="flex gap-1.5">
          <PrintButton />
          <button
            type="button"
            onClick={() => {
              const slabInput: SlabInput = {
                lx,
                ly,
                edges: [edgeX0, edgeXL, edgeY0, edgeYL],
                D,
                L,
                fc,
                fy,
                cover,
                h,
                dBarX,
                dBarY,
                includeSelfWeight,
              };
              if (savedId) {
                updateSlab(savedId, slabInput, {
                  ...result,
                  adoptedAsX,
                  adoptedAsY,
                });
                return;
              }
              const name = prompt("Nombre para guardar la losa:");
              if (!name) return;
              try {
                const saved = saveSlab(name, slabInput, {
                  ...result,
                  adoptedAsX,
                  adoptedAsY,
                });
                setSavedId(saved.id);
                setSavedName(name);
              } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error al guardar");
              }
            }}
            className="text-sm bg-primary text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-hover transition-colors"
          >
            Guardar
          </button>
          <button
            onClick={() =>
              navigate("/slab", {
                state: {
                  ...s,
                  loadedSaveId: savedId,
                  loadedSaveName: savedName,
                },
              })
            }
            className="text-sm bg-surface-alt border border-border text-text-muted px-3 py-1.5 rounded-lg hover:bg-surface hover:text-text transition-colors"
          >
            ← Volver
          </button>
        </div>
      </header>

      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Datos
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          <div>
            <span className="text-xs text-text-muted">Lx (m)</span>
            <p className="font-semibold">{lx}</p>
          </div>
          <div>
            <span className="text-xs text-text-muted">Ly (m)</span>
            <p className="font-semibold">{ly}</p>
          </div>
          <div>
            <span className="text-xs text-text-muted">Bordes</span>
            <p className="font-semibold">
              {[
                [edgeX0, "Izq"],
                [edgeXL, "Der"],
                [edgeY0, "Arr"],
                [edgeYL, "Aba"],
              ]
                .map(
                  ([e, s]) =>
                    `${s}: ${
                      e === "continuo"
                        ? "Cont."
                        : e === "simple"
                          ? "Art."
                          : "Libre"
                    }`,
                )
                .join(" · ")}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">D / L (kN/m²)</span>
            <p className="font-semibold">
              {D} / {L}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">f'c / fy (MPa)</span>
            <p className="font-semibold">
              {fc} / {fy}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">Rec. / h (cm)</span>
            <p className="font-semibold">
              {cover / 10} / {(result.h / 10).toFixed(1)}
            </p>
          </div>
        </div>
      </section>

      <SlabPlan
        lx={lx}
        ly={ly}
        edges={[edgeX0, edgeXL, edgeY0, edgeYL]}
        slabType={(() => {
          // Cantilever: find which edge is the single support
          if (supEdges === 1) {
            if (edgeX0 !== "free") return "cantilever-right";
            if (edgeXL !== "free") return "cantilever-left";
            if (edgeY0 !== "free") return "cantilever-bottom";
            return "cantilever-top";
          }
          if (isCrossed) return "crossed";
          return spanningAxis === "X" ? "oneway-x" : "oneway-y";
        })()}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {EDGE_REACTIONS.map(({ label, sub, edge, value, dead, live }) => {
          // El adapter define la carga transferible; null = borde sin reacción D/L
          const edgeLoad = hasSlabDL(result)
            ? slabReactionToBeamLoad(result, edge, 0, 0)
            : null;
          const zeroReaction = hasSlabDL(result) && edgeLoad === null;
          return (
            <div
              key={edge}
              className="bg-surface rounded-xl border border-border p-3 flex flex-col"
            >
              <span className="text-xs text-text-muted">
                {label} (R<sub>{sub}</sub>)
              </span>
              <p className="text-sm font-bold">
                {value !== undefined ? value.toFixed(2) : "—"} kN/m
              </p>
              {hasSlabDL(result) && (
                <details className="mt-2">
                  <summary className="text-xs text-text-muted cursor-pointer">
                    Ver D/L
                  </summary>
                  <div className="text-xs mt-1">D: {dead!.toFixed(2)} kN/m</div>
                  <div className="text-xs">L: {live!.toFixed(2)} kN/m</div>
                </details>
              )}
              <button
                type="button"
                disabled={!savedId || !hasSlabDL(result) || zeroReaction}
                onClick={() => {
                  if (!savedId || !edgeLoad) return;
                  navigate("/concrete", {
                    state: {
                      slabImport: {
                        slabId: savedId,
                        savedName: savedName ?? "",
                        edge,
                        deadLoad: edgeLoad.deadLoad ?? 0,
                        liveLoad: edgeLoad.liveLoad ?? 0,
                      },
                    },
                  });
                }}
                className="mt-auto pt-2 px-0 py-1 text-xs text-primary hover:text-primary-hover transition-colors self-start disabled:text-text-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Enviar a viga →
              </button>
              {!hasSlabDL(result) ? (
                <p className="mt-1 text-xs text-warning">
                  Recalcular primero — D/L no disponible
                </p>
              ) : zeroReaction ? (
                <p className="mt-1 text-xs text-warning">
                  Este borde no transfiere carga
                </p>
              ) : !savedId ? (
                <p className="mt-1 text-xs text-warning">
                  Guardar resultados primero
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {(edgeX0 === "continuo" ||
        edgeXL === "continuo" ||
        edgeY0 === "continuo" ||
        edgeYL === "continuo") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {result.supportX0 && (
            <SupportSection label="Izquierdo" dir={result.supportX0} />
          )}
          {result.supportXL && (
            <SupportSection label="Derecho" dir={result.supportXL} />
          )}
          {result.supportY0 && (
            <SupportSection label="Arriba" dir={result.supportY0} />
          )}
          {result.supportYL && (
            <SupportSection label="Abajo" dir={result.supportYL} />
          )}
        </div>
      )}

      <DirSection
        label="Dirección X"
        dir={spanningAxis === "Y" ? result.distX : result.x}
        principal={spanningAxis !== "Y"}
        diam={diamX}
        setDiam={setDiamX}
        sep={sepX}
        setSep={setSepX}
      />
      <DirSection
        label="Dirección Y"
        dir={spanningAxis === "X" ? result.distY : result.y}
        principal={spanningAxis !== "X"}
        diam={diamY}
        setDiam={setDiamY}
        sep={sepY}
        setSep={setSepY}
      />

      <details className="bg-surface rounded-xl border border-border p-5">
        <summary className="cursor-pointer text-sm font-semibold text-text-muted uppercase tracking-wider">
          Ver cuentas completas
        </summary>
        <pre className="mt-3 p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto">
          {postSteps(result.steps).join("\n")}
        </pre>
      </details>
    </MainLayout>
  );
}
