import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { Coordinates, Mafs, Plot, Text } from "mafs";
import { MainLayout } from "@mascalculador/shared";
import { calculateBeam, formatForce } from "../lib/beam-calculations";
import { designConcreteDetailed } from "../lib/concrete-design";
import type { ConcreteState } from "./ConcreteForm";

function sanitizeDecimal(val: string): string {
  // Replace comma (both regular and numpad) with dot
  return val.replace(/,/g, ".");
}

const BAR_DIAMETERS = [6, 8, 10, 12, 16, 20, 25];
const BAR_AREA: Record<number, number> = {
  6: 28,
  8: 50,
  10: 79,
  12: 113,
  16: 201,
  20: 314,
  25: 491,
};

export default function ConcreteResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const s = location.state as ConcreteState | null;

  const [barQty, setBarQty] = useState(3);
  const [barDiam, setBarDiam] = useState(16);
  const [stirrupLegs, setStirrupLegs] = useState(2);
  const [stirrupDiam, setStirrupDiam] = useState(8);
  const [stirrupSpacing, setStirrupSpacing] = useState(200);
  const [supportWidths, setSupportWidths] = useState<number[]>([]);
  const [directSupport, setDirectSupport] = useState(true);
  const [flexChecked, setFlexChecked] = useState(false);
  const [shearChecked, setShearChecked] = useState(false);

  if (!s) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-text-muted">No hay datos.</p>
          <button
            onClick={() => navigate("/concrete")}
            className="bg-primary text-white hover:bg-primary-hover"
          >
            Volver
          </button>
        </div>
      </MainLayout>
    );
  }

  const { spans, supportTypes, concreteLoads, bw, h, cover, fc, fy } = s;
  const beamConfig: BeamConfig = { spans, supportTypes };
  const L = spans.reduce((a, b) => a + b, 0);

  const ultimateLoads: Load[] = concreteLoads.map((cl) => ({
    id: cl.id,
    type: cl.type,
    magnitude: 1.2 * cl.D + 1.6 * cl.L,
    position: cl.position,
    start: cl.start,
    end: cl.end,
  }));

  const supportPositions: number[] = [0];
  for (const sp of spans)
    supportPositions.push(supportPositions[supportPositions.length - 1] + sp);
  const supports: Support[] = supportPositions.map((pos, i) => ({
    position: pos,
    type: supportTypes[i],
  }));

  // Init support widths
  if (supportWidths.length !== supports.length) {
    setSupportWidths(new Array(supports.length).fill(300));
  }

  const results = calculateBeam(beamConfig, ultimateLoads);
  const { reactions, shearForce, bendingMoment, criticalPoints } = results;

  let maxM = 0,
    maxV2 = 0;
  for (let k = 0; k <= 500; k++) {
    const x = (k / 500) * L;
    maxM = Math.max(maxM, Math.abs(bendingMoment(x)));
    maxV2 = Math.max(maxV2, Math.abs(shearForce(x)));
  }
  for (const x of criticalPoints) {
    maxM = Math.max(maxM, Math.abs(bendingMoment(x)));
    maxV2 = Math.max(maxV2, Math.abs(shearForce(x)));
  }
  const maxMomentAbs = Math.max(maxM, 1);
  const Mu = maxM;
  const xMin = -L * 0.08,
    xMax = L * 1.08;

  // Uniform load (for shear reduction)
  const qu = concreteLoads
    .filter((l) => l.type === "distributed")
    .reduce((sum, l) => sum + 1.2 * l.D + 1.6 * l.L, 0);

  // Find critical support (max shear)
  let VuSupport = 0,
    critIdx = 0;
  for (let i = 0; i < supports.length; i++) {
    const v = Math.abs(shearForce(supportPositions[i] + 0.001));
    if (v > VuSupport) {
      VuSupport = v;
      critIdx = i;
    }
  }
  const c = supportWidths[critIdx] || 300;

  const crReq = designConcreteDetailed({
    bw,
    h,
    d: 0,
    dp: 0,
    cover,
    fc,
    fy,
    Mu,
    Vu: VuSupport,
    qu,
    c,
    directSupport,
    As: 0,
    Av: 0,
    nLegs: 0,
    s: 0,
  });
  const As = barQty * (BAR_AREA[barDiam] || 0);
  const Av1 = BAR_AREA[stirrupDiam] || 0;

  const flexResult = useMemo(() => {
    if (!flexChecked) return null;
    return designConcreteDetailed({
      bw,
      h,
      d: 0,
      dp: 0,
      cover,
      fc,
      fy,
      Mu,
      Vu: VuSupport,
      qu,
      c,
      directSupport,
      As,
      Av: Av1,
      nLegs: stirrupLegs,
      s: stirrupSpacing,
    });
  }, [flexChecked, As, Av1, stirrupLegs, stirrupSpacing]);

  const shearResult = shearChecked
    ? designConcreteDetailed({
        bw,
        h,
        d: 0,
        dp: 0,
        cover,
        fc,
        fy,
        Mu,
        Vu: VuSupport,
        qu,
        c,
        directSupport,
        As: 0,
        Av: Av1,
        nLegs: stirrupLegs,
        s: stirrupSpacing,
      })
    : null;

  return (
    <MainLayout>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Viga H° A°</h1>
          <p className="text-sm text-text-muted">
            {bw}×{h} mm &middot; f'c={fc} MPa &middot; L={L} m
          </p>
        </div>
        <button
          onClick={() => navigate("/concrete", { state: s })}
          className="text-sm bg-surface-alt border-border hover:bg-surface text-text-muted"
        >
          ← Volver
        </button>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-surface rounded-xl border border-border p-3">
          <span className="text-xs text-text-muted">
            M<sub>u</sub>
          </span>
          <p className="text-sm font-bold text-primary">{Mu.toFixed(1)} kN·m</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-3">
          <span className="text-xs text-text-muted">
            V<sub>u</sub> apoyo
          </span>
          <p className="text-sm font-bold text-primary">
            {VuSupport.toFixed(1)} kN
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-3">
          <span className="text-xs text-text-muted">
            A<sub>s</sub> req
          </span>
          <p className="text-sm font-bold text-warning">{crReq.AsReq} mm²</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-3">
          <span className="text-xs text-text-muted">
            A<sub>s</sub> mín
          </span>
          <p className="text-sm font-bold">{crReq.AsMin} mm²</p>
        </div>
      </div>

      {/* Support widths */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Anchos de apoyo (mm)
        </h2>
        <div className="flex flex-wrap gap-2 items-end">
          {supports.map((_sup, i) => (
            <label key={i} className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">
                {supportTypes.length === 2
                  ? i === 0
                    ? "Ap. A"
                    : "Ap. B"
                  : `Ap. ${i + 1}`}
              </span>
              <input
                type="text"
                defaultValue={supportWidths[i] ?? 300}
                key={`cr-sup-${i}-${supportWidths[i]}`}
                onChange={(e) => {
                  const raw = sanitizeDecimal(e.target.value);
                  const num = parseFloat(raw);
                  const nw = [...supportWidths];
                  nw[i] = isNaN(num) ? 0 : num;
                  setSupportWidths(nw);
                }}
                className="w-20"
              />
            </label>
          ))}
          <label className="flex items-center gap-1 pb-2 ml-4">
            <input
              type="checkbox"
              checked={directSupport}
              onChange={(e) => setDirectSupport(e.target.checked)}
            />
            <span className="text-xs text-text-muted">Apoyo directo</span>
          </label>
        </div>
      </section>

      {/* Reactions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {supports.map((sup, i) => (
          <div
            key={i}
            className="bg-surface rounded-xl border border-border p-3"
          >
            <span className="text-xs text-text-muted">
              {supportTypes.length === 2
                ? i === 0
                  ? "Apoyo A"
                  : "Apoyo B"
                : `Apoyo ${i + 1}`}
            </span>
            <p className="text-sm font-bold text-primary">
              {sup.type === "free" ? "—" : formatForce(reactions[i])}
            </p>
          </div>
        ))}
      </div>

      {/* Armadura longitudinal */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Armadura longitudinal
        </h2>
        <p className="text-xs text-text-muted mb-2">
          Necesaria: <strong>{crReq.AsReq} mm²</strong> (mín: {crReq.AsMin} mm²)
          {crReq.AspReq > 0 && (
            <span>
              {" "}
              + A<sub>s</sub>' = {crReq.AspReq} mm²
            </span>
          )}
        </p>
        <div className="flex gap-3 items-end mb-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Cantidad</span>
            <input
              type="text"
              defaultValue={barQty ?? ""}
              key={`cr-barqty-${barQty}`}
              onChange={(e) => {
                const raw = sanitizeDecimal(e.target.value);
                const num = parseFloat(raw);
                setBarQty(isNaN(num) ? 0 : num);
              }}
              className="w-20"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Diámetro</span>
            <select
              value={barDiam}
              onChange={(e) => setBarDiam(Number(e.target.value))}
            >
              {BAR_DIAMETERS.map((d) => (
                <option key={d} value={d}>
                  Ø{d} ({BAR_AREA[d]} mm²)
                </option>
              ))}
            </select>
          </label>
          <span className="text-sm pb-2">
            = <strong>{As} mm²</strong>
          </span>
          <button
            type="button"
            onClick={() => setFlexChecked(true)}
            className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover"
          >
            Comprobar
          </button>
        </div>
        {flexResult && (
          <div
            className={`p-3 rounded-lg text-sm font-bold ${flexResult.AsOK ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
          >
            {flexResult.AsOK ? "✓ Verifica" : "✗ No verifica"} — {As} mm² vs{" "}
            {Math.max(crReq.AsReq, crReq.AsMin)} mm² necesarios
          </div>
        )}
      </section>

      {/* Estribos */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Estribos
        </h2>
        <p className="text-xs text-text-muted mb-2">
          V<sub>u</sub> apoyo = {VuSupport.toFixed(1)} kN &middot; V<sub>c</sub>{" "}
          = {crReq.Vc.toFixed(1)} kN &middot; V<sub>s</sub> req ={" "}
          {crReq.VsReq.toFixed(1)} kN &middot; A<sub>v</sub>/s mín ={" "}
          {crReq.AvSMin.toFixed(1)} mm²/m &middot; s<sub>máx</sub> ={" "}
          {crReq.sMax} mm
        </p>
        <div className="flex gap-3 items-end mb-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Ramas</span>
            <input
              type="text"
              defaultValue={stirrupLegs ?? ""}
              key={`cr-legs-${stirrupLegs}`}
              onChange={(e) => {
                const raw = sanitizeDecimal(e.target.value);
                const num = parseFloat(raw);
                setStirrupLegs(isNaN(num) ? 0 : num);
              }}
              className="w-16"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Diámetro</span>
            <select
              value={stirrupDiam}
              onChange={(e) => setStirrupDiam(Number(e.target.value))}
            >
              {BAR_DIAMETERS.filter((d) => d <= 12).map((d) => (
                <option key={d} value={d}>
                  Ø{d} ({BAR_AREA[d]} mm²)
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">Separación (mm)</span>
            <input
              type="text"
              defaultValue={stirrupSpacing ?? ""}
              key={`cr-spacing-${stirrupSpacing}`}
              onChange={(e) => {
                const raw = sanitizeDecimal(e.target.value);
                const num = parseFloat(raw);
                setStirrupSpacing(isNaN(num) ? 0 : num);
              }}
              className="w-24"
            />
          </label>
          <span className="text-sm pb-2">
            A<sub>v</sub>/s ={" "}
            <strong>
              {((stirrupLegs * Av1 * 1000) / stirrupSpacing).toFixed(1)} mm²/m
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setShearChecked(true)}
            className="text-sm bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover"
          >
            Comprobar
          </button>
        </div>
        {shearResult && (
          <div
            className={`p-3 rounded-lg text-sm font-bold ${shearResult.shearOK ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
          >
            {shearResult.shearOK ? "✓ Verifica corte" : "✗ No verifica corte"}{" "}
            &middot; V<sub>s</sub> colocado = {shearResult.VsProv.toFixed(1)} kN
          </div>
        )}
      </section>

      {/* Steps */}
      <details className="bg-surface rounded-xl border border-border p-5">
        <summary className="cursor-pointer text-sm font-semibold text-text-muted uppercase tracking-wider">
          Ver cuentas completas
        </summary>
        <pre className="mt-3 p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto">
          {(shearResult || crReq).steps.join("\n")}
        </pre>
      </details>

      {/* Diagrams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Cortante
            </h3>
          </div>
          <div className="p-1">
            <Mafs
              viewBox={{ x: [xMin, xMax], y: [-maxV2 * 1.15, maxV2 * 1.15] }}
              height={200}
              preserveAspectRatio={false}
            >
              <Coordinates.Cartesian xAxis={{ lines: 4 }} yAxis={false} />
              <Plot.OfX y={() => 0} domain={[xMin, xMax]} color="#6b7280" />
              {(() => {
                const yVals = [-maxV2, -maxV2 / 2, 0, maxV2 / 2, maxV2];
                const els: React.ReactNode[] = [];
                yVals.forEach((yv, i) => {
                  els.push(
                    <Plot.OfX
                      key={`yline-v-${i}`}
                      y={() => yv}
                      domain={[xMin, xMax]}
                      color="#ffffff10"
                    />,
                  );
                  els.push(
                    <Text
                      key={`ytxt-v-${i}`}
                      x={xMax}
                      y={yv}
                      attach="e"
                      size={9}
                      color="#6b7280"
                    >
                      {yv.toFixed(1)}
                    </Text>,
                  );
                });
                return els;
              })()}
              <Text
                x={xMin + L * 0.02}
                y={maxV2 * 1.05}
                attach="w"
                color="#f87171"
                size={10}
              >
                V_max = {maxV2.toFixed(1)} kN
              </Text>
              <Text
                x={xMin + L * 0.02}
                y={maxV2 * 1.05}
                attach="w"
                color="#f87171"
                size={10}
              >
                V_max = {maxV2.toFixed(1)} kN
              </Text>
              {(() => {
                const eps = 0.001;
                const isJump = (pos: number) =>
                  supports.some((x) => Math.abs(x.position - pos) < eps) ||
                  ultimateLoads.some(
                    (l) =>
                      l.type === "point" &&
                      Math.abs((l.position ?? 0) - pos) < eps,
                  );
                const els: React.ReactNode[] = [];
                for (let i = 1; i < criticalPoints.length; i++) {
                  const px = criticalPoints[i - 1],
                    cx = criticalPoints[i];
                  let sv: number;
                  if (isJump(px)) {
                    const vb = shearForce(px - eps),
                      va = shearForce(px + eps);
                    els.push(
                      <Plot.OfY
                        key={`vj-${px}`}
                        x={() => px}
                        domain={[Math.min(vb, va), Math.max(vb, va)]}
                        color="#f87171"
                      />,
                    );
                    sv = va;
                  } else sv = shearForce(px);
                  const ev = isJump(cx) ? shearForce(cx - eps) : shearForce(cx);
                  els.push(
                    <Plot.OfX
                      key={`vs-${px}-${cx}`}
                      y={(t) => sv + ((ev - sv) / (cx - px)) * (t - px)}
                      domain={[px, cx]}
                      color="#f87171"
                    />,
                  );
                }
                const last = criticalPoints[criticalPoints.length - 1];
                if (isJump(last)) {
                  const vb = shearForce(last - eps),
                    va = shearForce(last + eps);
                  els.push(
                    <Plot.OfY
                      key="vj-last"
                      x={() => last}
                      domain={[Math.min(vb, va), Math.max(vb, va)]}
                      color="#f87171"
                    />,
                  );
                }
                return els;
              })()}
            </Mafs>
          </div>
        </section>
        <section className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Momento
            </h3>
          </div>
          <div className="p-1">
            <Mafs
              viewBox={{
                x: [xMin, xMax],
                y: [-maxMomentAbs * 1.15, maxMomentAbs * 1.15],
              }}
              height={200}
              preserveAspectRatio={false}
            >
              <Coordinates.Cartesian xAxis={{ lines: 4 }} yAxis={false} />
              <Plot.OfX y={() => 0} domain={[xMin, xMax]} color="#6b7280" />
              {(() => {
                const yVals = [
                  -maxMomentAbs,
                  -maxMomentAbs / 2,
                  0,
                  maxMomentAbs / 2,
                  maxMomentAbs,
                ];
                const els: React.ReactNode[] = [];
                yVals.forEach((yv, i) => {
                  els.push(
                    <Plot.OfX
                      key={`ylm-${i}`}
                      y={() => yv}
                      domain={[xMin, xMax]}
                      color="#ffffff10"
                    />,
                  );
                  els.push(
                    <Text
                      key={`ytm-${i}`}
                      x={xMax}
                      y={yv}
                      attach="e"
                      size={9}
                      color="#6b7280"
                    >
                      {yv.toFixed(1)}
                    </Text>,
                  );
                });
                return els;
              })()}
              <Text
                x={xMin + L * 0.02}
                y={maxMomentAbs * 1.05}
                attach="w"
                color="#fbbf24"
                size={10}
              >
                M_max = {maxM.toFixed(1)} kN·m
              </Text>
              {criticalPoints.map((x, i) => {
                if (i === 0) return null;
                return (
                  <Plot.OfX
                    key={x}
                    y={(t) => -bendingMoment(t)}
                    domain={[criticalPoints[i - 1], x]}
                    color="#fbbf24"
                  />
                );
              })}
            </Mafs>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
