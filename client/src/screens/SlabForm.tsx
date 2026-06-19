import { useState } from "react";
import { useNavigate } from "react-router";
import MainLayout from "../components/MainLayout";
import type { EdgeCondition } from "../lib/slab-calc";

function handleCommaKey(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === ",") {
    e.preventDefault();
    const t = e.currentTarget;
    const s = t.selectionStart ?? 0, end = t.selectionEnd ?? 0;
    t.value = t.value.substring(0, s) + "." + t.value.substring(end);
    t.setSelectionRange(s + 1, s + 1);
    t.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export interface SlabState {
  lx: number; ly: number;
  edgeX0: EdgeCondition; edgeXL: EdgeCondition;
  edgeY0: EdgeCondition; edgeYL: EdgeCondition;
  D: number; L: number;
  fc: number; fy: number; cover: number; h: number;
  dBarX: number; dBarY: number;
}

const EDGE_OPTIONS: { value: EdgeCondition; label: string }[] = [
  { value: "simple", label: "Apoyado" },
  { value: "empotrado", label: "Empotrado" },
  { value: "continuo", label: "Continuo" },
];

export default function SlabForm() {
  const navigate = useNavigate();
  const [lx, setLx] = useState(4);
  const [ly, setLy] = useState(5);
  const [edgeX0, setEdgeX0] = useState<EdgeCondition>("simple");
  const [edgeXL, setEdgeXL] = useState<EdgeCondition>("simple");
  const [edgeY0, setEdgeY0] = useState<EdgeCondition>("simple");
  const [edgeYL, setEdgeYL] = useState<EdgeCondition>("simple");
  const [D, setD] = useState(1.5);
  const [L, setL] = useState(2.0);
  const [fc, setFc] = useState(25);
  const [fy, setFy] = useState(420);
  const [cover, setCover] = useState(20);
  const [h, setH] = useState(0);
  const [dBarX, setDBarX] = useState(10);
  const [dBarY, setDBarY] = useState(10);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate("/slab-results", { state: { lx, ly, edgeX0, edgeXL, edgeY0, edgeYL, D, L, fc, fy, cover, h, dBarX, dBarY } as SlabState });
  }

  return (
    <MainLayout>
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v18H3z"/></svg>
        </div>
        <div><h1 className="text-xl font-semibold text-text">Losa de H° A°</h1><p className="text-sm text-text-muted">CIRSOC 201-05</p></div>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Dimensiones</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">Luz menor l<sub>x</sub> (m)</span><input type="number" step="0.1" min="1" value={lx||""} onKeyDown={handleCommaKey} onChange={e=>setLx(Number(e.target.value))}/></label>
            <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">Luz mayor l<sub>y</sub> (m)</span><input type="number" step="0.1" min="1" value={ly||""} onKeyDown={handleCommaKey} onChange={e=>setLy(Number(e.target.value))}/></label>
            <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">h (mm, 0 = calcular)</span><input type="number" step="10" min="0" value={h||""} onKeyDown={handleCommaKey} onChange={e=>setH(Number(e.target.value))}/></label>
            <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">Recubrimiento (mm)</span><input type="number" step="5" min="15" value={cover||""} onKeyDown={handleCommaKey} onChange={e=>setCover(Number(e.target.value))}/></label>
          </div>
        </section>

        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Condiciones de borde</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Borde X=0", val: edgeX0, set: setEdgeX0 },
              { label: "Borde X=L", val: edgeXL, set: setEdgeXL },
              { label: "Borde Y=0", val: edgeY0, set: setEdgeY0 },
              { label: "Borde Y=L", val: edgeYL, set: setEdgeYL },
            ].map((e) => (
              <label key={e.label} className="flex flex-col gap-1">
                <span className="text-xs text-text-muted">{e.label}</span>
                <select value={e.val} onChange={ev => e.set(ev.target.value as EdgeCondition)}>
                  {EDGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            ))}
          </div>
        </section>

        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Cargas y materiales</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">D (kN/m²)</span><input type="number" step="0.1" min="0" value={D||""} onKeyDown={handleCommaKey} onChange={e=>setD(Number(e.target.value))}/></label>
            <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">L (kN/m²)</span><input type="number" step="0.1" min="0" value={L||""} onKeyDown={handleCommaKey} onChange={e=>setL(Number(e.target.value))}/></label>
            <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">f'<sub>c</sub> (MPa)</span><select value={fc} onChange={e=>setFc(Number(e.target.value))}><option value={20}>20</option><option value={25}>25</option><option value={30}>30</option><option value={35}>35</option></select></label>
            <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">f<sub>y</sub> (MPa)</span><select value={fy} onChange={e=>setFy(Number(e.target.value))}><option value={420}>420</option><option value={500}>500</option></select></label>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">Ø barra X (mm)</span><select value={dBarX} onChange={e=>setDBarX(Number(e.target.value))}>{[6,8,10,12,16].map(d=><option key={d} value={d}>Ø{d}</option>)}</select></label>
            <label className="flex flex-col gap-1"><span className="text-xs text-text-muted">Ø barra Y (mm)</span><select value={dBarY} onChange={e=>setDBarY(Number(e.target.value))}>{[6,8,10,12,16].map(d=><option key={d} value={d}>Ø{d}</option>)}</select></label>
          </div>
        </section>

        <button type="submit" className="self-center bg-primary text-white font-semibold px-8 py-3 rounded-lg hover:bg-primary-hover transition-colors">Calcular</button>
      </form>
    </MainLayout>
  );
}
