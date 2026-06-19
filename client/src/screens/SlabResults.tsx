import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import MainLayout from "../components/MainLayout";
import SlabPlan from "../components/SlabPlan";
import { designSlab, type DirectionResult } from "../lib/slab-calc";
import type { SlabState } from "./SlabForm";

const BAR_DIAMETERS = [6, 8, 10, 12, 16, 20];
const BAR_AREA: Record<number, number> = { 6: 28, 8: 50, 10: 79, 12: 113, 16: 201, 20: 314 };

function DirSection({ label, dir, dist }: { label: string; dir: DirectionResult; dist: DirectionResult }) {
  const [diam, setDiam] = useState(10);
  const [sep, setSep] = useState(150);
  const areaBar = BAR_AREA[diam] || 0;
  const asProvided = sep > 0 ? (areaBar * 1000) / sep : 0;

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">{label}</span>
      <p className="text-sm mt-1">M<sub>u</sub> = {dir.Mu.toFixed(2)} kN·m/m</p>
      <p className="text-sm font-bold text-primary">A<sub>s</sub> req = {dir.AsReq} mm²/m</p>
      <p className="text-xs text-text-muted">mín: {dir.AsMin} &middot; s<sub>máx</sub>: {dir.sMax} mm</p>
      <div className="border-t border-border mt-2 pt-2 flex gap-2 items-end">
        <label className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Ø</span>
          <select value={diam} onChange={e => setDiam(Number(e.target.value))} className="w-16">
            {BAR_DIAMETERS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5"><span className="text-xs text-text-muted">Sep (mm)</span>
          <input type="number" step="10" min="50" max="400" value={sep||""} onChange={e => setSep(Number(e.target.value))} className="w-20"/>
        </label>
        <span className="text-sm pb-2">→ {asProvided.toFixed(0)} mm²/m</span>
        <span className={`text-sm font-bold pb-2 ${asProvided >= dir.AsReq ? "text-success" : "text-danger"}`}>
          {asProvided >= dir.AsReq ? "✓" : "✗"}
        </span>
      </div>
      {dist.AsReq > 0 && (
        <div className="border-t border-border mt-2 pt-2">
          <span className="text-xs text-text-muted">Repartición: <strong>{dist.AsReq} mm²/m</strong> (s ≤ {dist.sMax} mm)</span>
        </div>
      )}
    </div>
  );
}

export default function SlabResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const s = location.state as SlabState | null;
  if (!s) return <MainLayout><p className="text-text-muted p-8">No hay datos.</p></MainLayout>;

  const { lx, ly, edgeX0, edgeXL, edgeY0, edgeYL, D, L, fc, fy, cover, h, dBarX, dBarY } = s;
  const result = designSlab({ lx, ly, edges: [edgeX0, edgeXL, edgeY0, edgeYL], D, L, fc, fy, cover, h, dBarX, dBarY });

  return (
    <MainLayout>
      <header className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold text-text">Losa {lx}×{ly} m</h1><p className="text-sm text-text-muted">h = {result.h} mm &middot; d = {result.d} mm &middot; qu = {result.qu.toFixed(2)} kN/m²</p></div>
        <button onClick={() => navigate("/slab")} className="text-sm bg-surface-alt border-border hover:bg-surface text-text-muted">← Volver</button>
      </header>

      <SlabPlan lx={lx} ly={ly} edges={[edgeX0, edgeXL, edgeY0, edgeYL]} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-surface rounded-xl border border-border p-3"><span className="text-xs text-text-muted">R<sub>x</sub></span><p className="text-sm font-bold">{result.Rx.toFixed(2)} kN/m</p></div>
        <div className="bg-surface rounded-xl border border-border p-3"><span className="text-xs text-text-muted">R<sub>y</sub></span><p className="text-sm font-bold">{result.Ry.toFixed(2)} kN/m</p></div>
      </div>

      <DirSection label="Dirección X" dir={result.x} dist={result.distX} />
      <DirSection label="Dirección Y" dir={result.y} dist={result.distY} />

      <details className="bg-surface rounded-xl border border-border p-5">
        <summary className="cursor-pointer text-sm font-semibold text-text-muted uppercase tracking-wider">Ver cuentas completas</summary>
        <pre className="mt-3 p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto">{result.steps.join("\n")}</pre>
      </details>
    </MainLayout>
  );
}
