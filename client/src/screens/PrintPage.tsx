import { useState, useMemo } from "react";
import { listSaves, type SavedBeam } from "../lib/storage";
import { calculateBeam } from "../lib/beam-calculations";
import { designConcreteDetailed } from "../lib/concrete-design";

export default function PrintPage() {
  const [selected, setSelected] = useState<SavedBeam | null>(null);
  const saves = listSaves();

  const beam = selected;
  const d = (beam?.data || {}) as Record<string, unknown>;
  const isAcero = beam?.type === "acero";
  const spans = (d.spans as number[]) || [];
  const totalL = spans.reduce((a: number, b: number) => a + b, 0);

  // Recompute results from saved data
  const computed = useMemo(() => {
    if (!beam) return null;
    const supportTypes = (d.supportTypes || ["simple", "simple"]) as SupportType[];
    const cfg: BeamConfig = { spans, supportTypes };

    if (isAcero) {
      const loads = (d.loads || []) as Load[];
      if (loads.length === 0) return null;
      const r = calculateBeam(cfg, loads);
      let maxM = 0, maxV = 0;
      for (let k = 0; k <= 300; k++) {
        const x = (k / 300) * totalL;
        maxM = Math.max(maxM, Math.abs(r.bendingMoment(x)));
        maxV = Math.max(maxV, Math.abs(r.shearForce(x)));
      }
      return { Mu: maxM, Vu: maxV, reactions: r.reactions, type: "acero" as const };
    } else {
      const concreteLoads = (d.concreteLoads || []) as { D: number; L: number; type: string; position?: number; start?: number; end?: number }[];
      if (concreteLoads.length === 0) return null;
      const uls: Load[] = concreteLoads.map((cl) => ({
        id: "x", type: cl.type as "point" | "distributed",
        magnitude: 1.2 * cl.D + 1.6 * cl.L,
        position: cl.position, start: cl.start, end: cl.end,
      }));
      const r = calculateBeam(cfg, uls);
      let maxM = 0, maxV = 0;
      for (let k = 0; k <= 300; k++) {
        const x = (k / 300) * totalL;
        maxM = Math.max(maxM, Math.abs(r.bendingMoment(x)));
        maxV = Math.max(maxV, Math.abs(r.shearForce(x)));
      }
      const bw = (d.bw as number) || 200;
      const h = (d.h as number) || 500;
      const cover = (d.cover as number) || 30;
      const fc = (d.fc as number) || 25;
      const fy = (d.fy as number) || 420;
      const qu = concreteLoads.filter((l) => l.type === "distributed").reduce((s, l) => s + 1.2*l.D + 1.6*l.L, 0);
      const cRes = designConcreteDetailed({ bw, h, d: 0, dp: 0, cover, fc, fy, Mu: maxM, Vu: maxV, qu, c: 300, directSupport: true, As: 0, Av: 0, nLegs: 0, s: 0 });
      return { Mu: maxM, Vu: maxV, reactions: r.reactions, concrete: cRes, type: "hormigon" as const };
    }
  }, [beam]);

  function handlePrint() { window.print(); }

  return (
    <div className="min-h-screen bg-white text-black p-4 print:p-0">
      <style>{`@media print { .no-print { display: none !important; } body { font-size: 10px; } table { page-break-inside: avoid; } }`}</style>

      <div className="no-print max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Imprimir planilla</h1>
        {saves.length === 0 && <p className="text-gray-500">No hay vigas guardadas. Guardá una desde Viga Acero o Viga H°.</p>}
        <div className="grid gap-2 mb-6">
          {saves.map((s) => (
            <button key={s.id} onClick={() => setSelected(s)}
              className={`text-left p-3 rounded border ${selected?.id === s.id ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
              <span className="font-semibold">{s.name}</span>
              <span className="text-gray-500 ml-2">— {s.type === "acero" ? "Acero" : "H° A°"} — {s.date}</span>
            </button>
          ))}
        </div>
        {beam && <button onClick={handlePrint} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-blue-700">Imprimir</button>}
      </div>

      {beam && computed && (
        <div className="max-w-4xl mx-auto mt-4 print:mt-0">
          <div className="border-b-4 border-black pb-3 mb-4">
            <h1 className="text-xl font-bold">PLANILLA DE CÁLCULO</h1>
            <p className="text-sm text-gray-600">{isAcero ? "Viga de acero — CIRSOC 301-05" : "Viga de H° A° — CIRSOC 201-05"}</p>
          </div>

          <table className="w-full text-sm mb-4 border">
            <tbody>
              <tr><td className="font-bold p-1 border w-32">Obra / Viga:</td><td className="p-1 border">{beam.name}</td><td className="font-bold p-1 border w-20">Fecha:</td><td className="p-1 border w-36">{beam.date}</td></tr>
              <tr><td className="font-bold p-1 border">Tramos:</td><td className="p-1 border">{spans.length} ({spans.map((l: number) => l.toFixed(1) + "m").join(" + ")})</td><td className="font-bold p-1 border">Luz total:</td><td className="p-1 border">{totalL.toFixed(2)} m</td></tr>
              <tr><td className="font-bold p-1 border">Apoyos:</td><td className="p-1 border">{((d.supportTypes as string[]) || []).map((t: string) => t === "simple" ? "Articulado" : t === "fixed" ? "Empotrado" : "Libre").join(", ")}</td>
                <td className="font-bold p-1 border">Reacciones:</td><td className="p-1 border">{computed.reactions.map((r: number) => r.toFixed(1) + " kN").join(", ")}</td></tr>
              {isAcero && <tr><td className="font-bold p-1 border">Perfil:</td><td className="p-1 border">{(d.profileName as string) || "—"}</td><td className="font-bold p-1 border">F<sub>y</sub>:</td><td className="p-1 border">{d.Fy as number || "—"} MPa</td></tr>}
              {!isAcero && <tr><td className="font-bold p-1 border">Sección:</td><td className="p-1 border">b<sub>w</sub>={(d.bw as number) || "—"} mm, h={(d.h as number) || "—"} mm, rec={(d.cover as number) || "—"} mm</td><td className="font-bold p-1 border">f'<sub>c</sub> / f<sub>y</sub>:</td><td className="p-1 border">{d.fc as number || "—"} / {d.fy as number || "—"} MPa</td></tr>}
            </tbody>
          </table>

          {/* Solicitaciones */}
          <h3 className="font-bold text-sm mb-1">SOLICITACIONES</h3>
          <table className="w-full text-sm mb-4 border">
            <thead><tr className="bg-gray-100"><th className="p-1 border text-left">Carga</th><th className="p-1 border text-right">Tipo</th><th className="p-1 border text-right">D</th><th className="p-1 border text-right">L</th><th className="p-1 border text-right">U</th><th className="p-1 border text-right">Posición (m)</th></tr></thead>
            <tbody>
              {isAcero && (d.loads as Load[] || []).map((l: Load, i: number) => (
                <tr key={i}><td className="p-1 border">C{i+1}</td><td className="p-1 border text-right">{l.type === "point" ? "Puntual" : "Distrib."}</td><td className="p-1 border text-right">—</td><td className="p-1 border text-right">—</td><td className="p-1 border text-right">{l.magnitude.toFixed(1)} {l.type === "distributed" ? "kN/m" : "kN"}</td><td className="p-1 border text-right">{l.type === "point" ? (l.position ?? "—") : `${l.start ?? "—"} – ${l.end ?? "—"}`}</td></tr>
              ))}
              {!isAcero && (d.concreteLoads as { D: number; L: number; type: string; position?: number; start?: number; end?: number }[] || []).map((l, i: number) => (
                <tr key={i}><td className="p-1 border">C{i+1}</td><td className="p-1 border text-right">{l.type === "point" ? "Puntual" : "Distrib."}</td><td className="p-1 border text-right">{l.D.toFixed(1)}</td><td className="p-1 border text-right">{l.L.toFixed(1)}</td><td className="p-1 border text-right">{(1.2*l.D + 1.6*l.L).toFixed(1)} {l.type === "distributed" ? "kN/m" : "kN"}</td><td className="p-1 border text-right">{l.type === "point" ? (l.position ?? "—") : `${l.start ?? "—"} – ${l.end ?? "—"}`}</td></tr>
              ))}
            </tbody>
          </table>

          {/* Results */}
          <h3 className="font-bold text-sm mb-1">RESULTADOS DEL ANÁLISIS</h3>
          <table className="w-full text-sm mb-4 border">
            <tbody>
              <tr><td className="font-bold p-1 border w-40">M<sub>u</sub> máximo:</td><td className="p-1 border font-bold text-right w-32">{computed.Mu.toFixed(1)} kN·m</td><td className="font-bold p-1 border w-40">V<sub>u</sub> máximo:</td><td className="p-1 border font-bold text-right w-32">{computed.Vu.toFixed(1)} kN</td></tr>
            </tbody>
          </table>

          {/* Concrete design results */}
          {computed.type === "hormigon" && computed.concrete && (
            <>
              <h3 className="font-bold text-sm mb-1">DIMENSIONAMIENTO — ARMADURA DE FLEXIÓN</h3>
              <table className="w-full text-sm mb-4 border">
                <thead><tr className="bg-gray-100"><th className="p-1 border text-left">Parámetro</th><th className="p-1 border text-right">Valor</th><th className="p-1 border text-left">Parámetro</th><th className="p-1 border text-right">Valor</th></tr></thead>
                <tbody>
                  <tr><td className="p-1 border">K<sub>a</sub></td><td className="p-1 border text-right">{computed.concrete.Ka.toFixed(4)}</td><td className="p-1 border">K<sub>a</sub> min</td><td className="p-1 border text-right">{computed.concrete.KaMin.toFixed(4)}</td></tr>
                  <tr><td className="p-1 border">K<sub>a</sub> max</td><td className="p-1 border text-right">{computed.concrete.KaMax.toFixed(4)}</td><td className="p-1 border">Caso</td><td className="p-1 border text-right">{computed.concrete.caseLabel}</td></tr>
                  <tr className="font-bold"><td className="p-1 border">A<sub>s</sub> requerida</td><td className="p-1 border text-right">{computed.concrete.AsReq} mm²</td><td className="p-1 border">A<sub>s</sub> mínima</td><td className="p-1 border text-right">{computed.concrete.AsMin} mm²</td></tr>
                  {computed.concrete.AspReq > 0 && <tr><td className="p-1 border">A<sub>s</sub>' requerida</td><td className="p-1 border text-right">{computed.concrete.AspReq} mm²</td><td className="p-1 border"></td><td className="p-1 border text-right"></td></tr>}
                </tbody>
              </table>

              <h3 className="font-bold text-sm mb-1">ARMADURA DE CORTE</h3>
              <table className="w-full text-sm mb-4 border">
                <thead><tr className="bg-gray-100"><th className="p-1 border text-left">Parámetro</th><th className="p-1 border text-right">Valor</th><th className="p-1 border text-left">Parámetro</th><th className="p-1 border text-right">Valor</th></tr></thead>
                <tbody>
                  <tr><td className="p-1 border">V<sub>u</sub> sección crítica</td><td className="p-1 border text-right">{computed.concrete.VuCalc.toFixed(1)} kN</td><td className="p-1 border">V<sub>n</sub></td><td className="p-1 border text-right">{computed.concrete.Vn.toFixed(1)} kN</td></tr>
                  <tr><td className="p-1 border">V<sub>c</sub></td><td className="p-1 border text-right">{computed.concrete.Vc.toFixed(1)} kN</td><td className="p-1 border">V<sub>s</sub> requerido</td><td className="p-1 border text-right">{computed.concrete.VsReq.toFixed(1)} kN</td></tr>
                  <tr className="font-bold"><td className="p-1 border">A<sub>v</sub>/s mínimo</td><td className="p-1 border text-right">{computed.concrete.AvSMin.toFixed(1)} mm²/m</td><td className="p-1 border">s<sub>máx</sub></td><td className="p-1 border text-right">{computed.concrete.sMax} mm</td></tr>
                </tbody>
              </table>
            </>
          )}

          <p className="text-xs text-gray-500 mt-4 print:hidden">Usá Ctrl+P o el botón Imprimir para guardar como PDF.</p>
        </div>
      )}
    </div>
  );
}
