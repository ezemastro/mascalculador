import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import MainLayout from "../components/MainLayout";
import SlabPlan from "../components/SlabPlan";
import { designSlab, type DirectionResult } from "../lib/slab-calc";
import { saveSlab, updateSlab, saveSlabInput, updateSlabInput } from "../lib/storage";
import type { SlabInput } from "../lib/slab-calc";
import type { SlabState } from "./SlabForm";

function sanitizeDecimal(val: string): string {
  // Replace comma (both regular and numpad) with dot
  return val.replace(/,/g, ".");
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

function SupportSection({ label, dir }: { label: string; dir: DirectionResult }) {
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
        mín: {asMinCm} &middot; s<sub>máx</sub>: {dir.sMax} mm
      </p>
      <details className="mt-2 pt-2 border-t border-border">
        <summary className="cursor-pointer text-xs text-text-muted hover:text-text">
          Ver cuentas
        </summary>
        <div className="mt-2 p-2 bg-surface-alt rounded text-xs text-text-muted font-mono space-y-0.5">
          <p>M<sub>n</sub> = M<sub>u</sub> / φ = {(dir.Mu / 0.9).toFixed(2)} kN·m/m</p>
          <p>m<sub>n</sub> = {dir.mn.toFixed(4)}</p>
          <p>K<sub>a</sub> = {dir.Ka.toFixed(4)}</p>
          <p>K<sub>a,min</sub> = {dir.KaMin.toFixed(4)}</p>
          <p>K<sub>a,max</sub> = {dir.KaMax.toFixed(4)}</p>
          <p className="text-primary font-semibold">{dir.caseLabel}</p>
          <p>A<sub>s,req</sub> = {dir.AsReq} mm²/m = {asReqCm} cm²/m</p>
          <p>A<sub>s,mín</sub> = {dir.AsMin} mm²/m = {asMinCm} cm²/m</p>
          <p>A<sub>s,temp</sub> = {dir.AsTemp} mm²/m</p>
          <p>s<sub>máx</sub> = {dir.sMax} mm</p>
        </div>
      </details>
    </div>
  );
}

function DirSection({
  label,
  dir,
  dist,
  diam,
  setDiam,
  sep,
  setSep,
}: {
  label: string;
  dir: DirectionResult;
  dist: DirectionResult;
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
      <p className="text-sm mt-1">
        M<sub>u</sub> = {dir.Mu.toFixed(2)} kN·m/m
      </p>
      <p className="text-sm font-bold text-primary">
        A<sub>s</sub> req = {asReqCm} cm²/m
      </p>
      <p className="text-xs text-text-muted">
        mín: {asMinCm} &middot; s<sub>máx</sub>: {dir.sMax} mm
      </p>
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
        <span className="text-sm pb-2">→ {asProvided.toFixed(0)} mm²/m</span>
        <span
          className={`text-sm font-bold pb-2 ${asProvided >= dir.AsReq ? "text-success" : "text-danger"}`}
        >
          {asProvided >= dir.AsReq ? "✓" : "✗"}
        </span>
      </div>
      {dist.AsReq > 0 && (
        <div className="border-t border-border mt-2 pt-2">
          <span className="text-xs text-text-muted">
            Repartición: <strong>{(dist.AsReq / 100).toFixed(2)} cm²/m</strong> (s ≤ {dist.sMax}{" "}
            mm)
          </span>
        </div>
      )}
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
    loadedSaveId,
    loadedSaveName,
  } = s;
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
  });

  // Adopted reinforcement state (persisted when saving)
  // sep values are in cm
  const [diamX, setDiamX] = useState(10);
  const [sepX, setSepX] = useState(15);
  const [diamY, setDiamY] = useState(10);
  const [sepY, setSepY] = useState(15);
  const adoptedAsX = sepX > 0 ? Math.round((BAR_AREA[diamX] || 0) * 100 / sepX) : 0;
  const adoptedAsY = sepY > 0 ? Math.round((BAR_AREA[diamY] || 0) * 100 / sepY) : 0;

  // Track save state (starts from router state, updates on save)
  const [savedId, setSavedId] = useState<string | null>(loadedSaveId ?? null);
  const [savedName, setSavedName] = useState<string | null>(loadedSaveName ?? null);

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
            h = {result.h} mm &middot; d = {result.d} mm &middot; qu ={" "}
            {result.qu.toFixed(2)} kN/m²
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              const slabInput: SlabInput = { lx, ly, edges: [edgeX0, edgeXL, edgeY0, edgeYL], D, L, fc, fy, cover, h, dBarX, dBarY };
              if (savedId) {
                updateSlabInput(savedId, slabInput);
                return;
              }
              const name = prompt("Nombre para guardar los datos:");
              if (!name) return;
              try {
                const saved = saveSlabInput(name, slabInput);
                setSavedId(saved.id);
                setSavedName(name);
              } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error al guardar");
              }
            }}
            className="text-sm bg-primary/10 text-primary border border-primary/20 px-2.5 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
          >
            Guardar datos
          </button>
          <button
            type="button"
            onClick={() => {
              const slabInput: SlabInput = { lx, ly, edges: [edgeX0, edgeXL, edgeY0, edgeYL], D, L, fc, fy, cover, h, dBarX, dBarY };

              if (savedId) {
                updateSlab(savedId, slabInput, { ...result, adoptedAsX, adoptedAsY });
                return;
              }

              const name = prompt("Nombre para guardar los resultados:");
              if (!name) return;
              try {
                const saved = saveSlab(name, slabInput, { ...result, adoptedAsX, adoptedAsY });
                setSavedId(saved.id);
                setSavedName(name);
              } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error al guardar");
              }
            }}
            className="text-sm bg-primary text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-hover transition-colors"
          >
            Guardar resultados
          </button>
          <button
            onClick={() => navigate("/slab")}
            className="text-sm bg-surface-alt border border-border text-text-muted px-3 py-1.5 rounded-lg hover:bg-surface hover:text-text transition-colors"
          >
            ← Volver
          </button>
        </div>
      </header>

      <SlabPlan lx={lx} ly={ly} edges={[edgeX0, edgeXL, edgeY0, edgeYL]} slabType={
        (() => {
          const supEdges = [edgeX0, edgeXL, edgeY0, edgeYL].filter(e => e !== "free").length;
          const ratio = Math.min(lx, ly) / Math.max(lx, ly);
          // Cantilever: find which edge is the single support
          if (supEdges === 1) {
            if (edgeX0 !== "free") return "cantilever-right";
            if (edgeXL !== "free") return "cantilever-left";
            if (edgeY0 !== "free") return "cantilever-bottom";
            return "cantilever-top";
          }
          if (supEdges === 4 && ratio > 0.5) return "crossed";
          // One-way: armor direction = direction with 2+ supported edges
          const xSup = [edgeX0, edgeXL].filter(e => e !== "free").length;
          const ySup = [edgeY0, edgeYL].filter(e => e !== "free").length;
          if (xSup >= 2) return "oneway-x";
          if (ySup >= 2) return "oneway-y";
          // Fallback: use the direction with more supports
          return xSup >= ySup ? "oneway-x" : "oneway-y";
        })()
      } />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-surface rounded-xl border border-border p-3">
          <span className="text-xs text-text-muted">
            Izquierdo (R<sub>x</sub>)
          </span>
          <p className="text-sm font-bold">
            {result.RxIzq !== undefined ? result.RxIzq.toFixed(2) : "—"} kN/m
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-3">
          <span className="text-xs text-text-muted">
            Derecho (R<sub>x</sub>)
          </span>
          <p className="text-sm font-bold">
            {result.RxDer !== undefined ? result.RxDer.toFixed(2) : "—"} kN/m
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-3">
          <span className="text-xs text-text-muted">
            Arriba (R<sub>y</sub>)
          </span>
          <p className="text-sm font-bold">
            {result.RyArr !== undefined ? result.RyArr.toFixed(2) : "—"} kN/m
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-3">
          <span className="text-xs text-text-muted">
            Abajo (R<sub>y</sub>)
          </span>
          <p className="text-sm font-bold">
            {result.RyAba !== undefined ? result.RyAba.toFixed(2) : "—"} kN/m
          </p>
        </div>
      </div>

      {(edgeX0 === "continuo" || edgeXL === "continuo" || edgeY0 === "continuo" || edgeYL === "continuo") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {result.supportX0 && <SupportSection label="Izquierdo" dir={result.supportX0} />}
          {result.supportXL && <SupportSection label="Derecho" dir={result.supportXL} />}
          {result.supportY0 && <SupportSection label="Arriba" dir={result.supportY0} />}
          {result.supportYL && <SupportSection label="Abajo" dir={result.supportYL} />}
        </div>
      )}

      <DirSection label="Dirección X" dir={result.x} dist={result.distX} diam={diamX} setDiam={setDiamX} sep={sepX} setSep={setSepX} />
      <DirSection label="Dirección Y" dir={result.y} dist={result.distY} diam={diamY} setDiam={setDiamY} sep={sepY} setSep={setSepY} />

      <details className="bg-surface rounded-xl border border-border p-5">
        <summary className="cursor-pointer text-sm font-semibold text-text-muted uppercase tracking-wider">
          Ver cuentas completas
        </summary>
        <pre className="mt-3 p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto">
          {result.steps.join("\n")}
        </pre>
      </details>
    </MainLayout>
  );
}
