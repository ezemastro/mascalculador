import { useLocation, useNavigate } from "react-router";
import { Coordinates, Mafs, Plot, Text, Vector } from "mafs";
import MainLayout from "../components/MainLayout";
import {
  calculateBeamDual,
  formatForce,
  formatLength,
} from "../lib/beam-calculations";
import { checkBeam } from "../lib/steel-design";
import { IPN_PROFILES } from "../lib/profiles";
import { ANGLE_PROFILES } from "../lib/angle-profiles";
import { computeTrussForces, designTrussMembers } from "../lib/truss-calc";

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    loads?: Load[];
    beamConfig?: BeamConfig;
    designParams?: SteelDesignParams;
    trussParams?: TrussDesignParams;
  } | null;

  if (!state?.loads || !state?.beamConfig) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-text-muted">No hay datos para mostrar.</p>
          <button
            onClick={() => navigate("/")}
            className="bg-primary text-white hover:bg-primary-hover"
          >
            Volver al formulario
          </button>
        </div>
      </MainLayout>
    );
  }

  const { loads, beamConfig } = state;
  const designParams = state.designParams;
  const trussParams = state.trussParams;
  const { spans, supportTypes } = beamConfig;
  const L = spans.reduce((a, b) => a + b, 0);

  const supportPositions: number[] = [0];
  for (const s of spans) {
    supportPositions.push(supportPositions[supportPositions.length - 1] + s);
  }
  const supports: Support[] = supportPositions.map((pos, i) => ({
    position: pos,
    type: supportTypes[i],
  }));

  const dual = calculateBeamDual(beamConfig, loads);
  const {
    d,
    l,
    shearForceU,
    bendingMomentU,
    maxMomentU,
    maxShearU,
    criticalPointsU,
  } = dual;

  const reactionsU = beamConfig.supportTypes.map(
    (_, i) => 1.2 * d.reactions[i] + 1.6 * l.reactions[i],
  );

  const maxLoad = Math.max(
    ...loads.map((ld) => (ld.deadLoad ?? 0) + (ld.liveLoad ?? 0)),
    ...reactionsU.map((r) => Math.abs(r)),
    1,
  );
  const maxMomentAbs = Math.max(Math.abs(maxMomentU.value), 1);
  const xMin = -L * 0.1;
  const xMax = L * 1.1;

  // Steel design check
  let designCheck: {
    profile: string;
    phiMn: number;
    Mu: number;
    ratioFlex: number;
    phiVn: number;
    Vu: number;
    ratioShear: number;
    limitingState: string;
    maxDeflection: number;
    allowableDeflection: number;
    deflectionOK: boolean;
    steps: string[];
  } | null = null;

  if (designParams) {
    const profile = IPN_PROFILES.find(
      (p) => p.name === designParams.profileName,
    );
    if (profile) {
      const totalBeamMm = L * 1000;
      const Mu = Math.abs(maxMomentU.value) * 1e6; // kN·m → N·mm (ultimate)
      const Vu = maxShearU * 1e3; // kN → N (ultimate)
      const serviceM = (d.maxMoment.value + l.maxMoment.value) * 1e6; // unfactored D+L

      const dr = checkBeam(
        profile,
        {
          Fy: designParams.Fy,
          Lb: designParams.Lb,
          Cb: designParams.Cb,
          deflectionLimit: designParams.deflectionLimit,
          beamLength: totalBeamMm,
        },
        serviceM,
      );

      designCheck = {
        profile: profile.name,
        phiMn: dr.phiMn,
        Mu,
        ratioFlex: Mu / dr.phiMn,
        phiVn: dr.phiVn,
        Vu,
        ratioShear: Vu / dr.phiVn,
        limitingState: dr.limitingState,
        maxDeflection: dr.maxDeflection,
        allowableDeflection: dr.allowableDeflection,
        deflectionOK: dr.deflectionOK,
        steps: dr.steps,
      };
    }
  }

  // Truss design
  let trussForces: ReturnType<typeof computeTrussForces> | null = null;
  let trussChecks: ReturnType<typeof designTrussMembers> | null = null;
  let trussError = "";
  if (trussParams) {
    trussForces = computeTrussForces(maxMomentU.value, maxShearU, reactionsU, {
      height: trussParams.height,
      panelSpacing: trussParams.panelSpacing,
    });
    const topA = ANGLE_PROFILES.find(
      (a) => a.name === trussParams.topChordProfile,
    );
    const botA = ANGLE_PROFILES.find(
      (a) => a.name === trussParams.botChordProfile,
    );
    const diagA = ANGLE_PROFILES.find(
      (a) => a.name === trussParams.diagProfile,
    );
    const vertA = ANGLE_PROFILES.find(
      (a) => a.name === trussParams.vertProfile,
    );
    if (topA && botA && diagA && vertA) {
      trussChecks = designTrussMembers(
        topA,
        botA,
        diagA,
        vertA,
        trussForces!,
        trussParams.Fy,
        trussParams.Fu,
      );
    } else {
      trussError = !topA
        ? `Cordón superior "${trussParams.topChordProfile}" no encontrado`
        : !botA
          ? `Cordón inferior "${trussParams.botChordProfile}" no encontrado`
          : !diagA
            ? `Diagonal "${trussParams.diagProfile}" no encontrada`
            : `Montante "${trussParams.vertProfile}" no encontrado`;
    }
  }

  return (
    <MainLayout>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text">Resultados</h1>
            <p className="text-sm text-text-muted">Viga de {formatLength(L)}</p>
          </div>
        </div>
        <button
          onClick={() =>
            navigate("/", {
              state: { loads, beamConfig, designParams, trussParams },
            })
          }
          className="text-sm bg-surface-alt border-border hover:bg-surface text-text-muted"
        >
          ← Volver
        </button>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {supports.map((s, i) => {
          const rD = d.reactions[i];
          const rL = l.reactions[i];
          const absM = Math.abs(d.supportMoments[i] + l.supportMoments[i]);
          const momentLabel =
            absM >= 1000
              ? `${((d.supportMoments[i] + l.supportMoments[i]) / 1000).toFixed(2)} MN·m`
              : `${(d.supportMoments[i] + l.supportMoments[i]).toFixed(2)} kN·m`;
          return (
            <div
              key={i}
              className="bg-surface rounded-xl border border-border p-4"
            >
              <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                {supportTypes.length === 2
                  ? `Reacción en Apoyo ${i === 0 ? "A" : "B"}`
                  : `Reacción en Apoyo ${i + 1}`}
              </span>
              {s.type === "free" ? (
                <p className="text-2xl font-bold text-primary mt-1">—</p>
              ) : (
                <div className="mt-1 space-y-0.5">
                  <p className="text-sm text-text-muted">
                    D:{" "}
                    <span className="font-semibold text-primary">
                      {formatForce(rD)}
                    </span>
                  </p>
                  <p className="text-sm text-text-muted">
                    L:{" "}
                    <span className="font-semibold text-primary">
                      {formatForce(rL)}
                    </span>
                  </p>
                  <p className="text-sm text-text-muted">
                    U:{" "}
                    <span className="font-bold text-warning">
                      {formatForce(1.2 * rD + 1.6 * rL)}
                    </span>
                  </p>
                </div>
              )}
              {s.type === "fixed" && (
                <p className="text-sm text-warning mt-0.5">M = {momentLabel}</p>
              )}
              <span className="text-xs text-text-muted">
                Tipo:{" "}
                {s.type === "simple"
                  ? "Articulado"
                  : s.type === "fixed"
                    ? "Empotrado"
                    : "Libre"}{" "}
                &middot; Posición: x = {formatLength(s.position)}
              </span>
            </div>
          );
        })}
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            Momento Flector Máximo
          </span>
          <p className="text-2xl font-bold text-warning mt-1">
            {(maxMomentU.value / 1000).toFixed(2)} MN·m
          </p>
          <span className="text-xs text-text-muted">
            Posición: x = {formatLength(maxMomentU.position)}
          </span>
        </div>
      </div>

      {/* Design Check */}
      {designCheck && (
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Verificación {designCheck.profile} &mdash; CIRSOC 301-05
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1 p-3 bg-surface-alt rounded-lg">
              <span className="text-xs text-text-muted">Flexión</span>
              <span className="text-sm font-semibold">
                φM<sub>n</sub> = {(designCheck.phiMn / 1e6).toFixed(1)} kN·m
              </span>
              <span className="text-sm">
                M<sub>u</sub> = {(designCheck.Mu / 1e6).toFixed(1)} kN·m
              </span>
              <span
                className={`text-sm font-bold ${designCheck.ratioFlex <= 1 ? "text-success" : "text-danger"}`}
              >
                {designCheck.ratioFlex <= 1 ? "✓" : "✗"} Ratio:{" "}
                {designCheck.ratioFlex.toFixed(2)}
              </span>
              <span className="text-xs text-text-muted">
                {designCheck.limitingState}
              </span>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-surface-alt rounded-lg">
              <span className="text-xs text-text-muted">Corte</span>
              <span className="text-sm font-semibold">
                φV<sub>n</sub> = {(designCheck.phiVn / 1000).toFixed(1)} kN
              </span>
              <span className="text-sm">
                V<sub>u</sub> = {(designCheck.Vu / 1000).toFixed(1)} kN
              </span>
              <span
                className={`text-sm font-bold ${designCheck.ratioShear <= 1 ? "text-success" : "text-danger"}`}
              >
                {designCheck.ratioShear <= 1 ? "✓" : "✗"} Ratio:{" "}
                {designCheck.ratioShear.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col gap-1 p-3 bg-surface-alt rounded-lg">
              <span className="text-xs text-text-muted">Deformación</span>
              <span className="text-sm">
                δ<sub>max</sub> = {designCheck.maxDeflection.toFixed(1)} mm
              </span>
              <span className="text-sm">
                δ<sub>adm</sub> = {designCheck.allowableDeflection.toFixed(1)}{" "}
                mm
              </span>
              <span
                className={`text-sm font-bold ${designCheck.deflectionOK ? "text-success" : "text-danger"}`}
              >
                {designCheck.deflectionOK ? "✓ Cumple" : "✗ No cumple"}
              </span>
            </div>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-text-muted font-semibold uppercase tracking-wider">
              Ver cuentas completas ▼
            </summary>
            <pre className="mt-2 p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto">
              {designCheck.steps.join("\n")}
            </pre>
          </details>
        </section>
      )}

      {/* Truss Results */}
      {trussForces && (
        <section className="bg-surface rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Reticulado &mdash; Fuerzas en barras
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="p-2 bg-surface-alt rounded text-xs">
              <span className="text-text-muted">Cordón sup.</span>
              <p className="font-bold text-danger">
                {trussForces.maxTopChord.toFixed(1)} kN
              </p>
            </div>
            <div className="p-2 bg-surface-alt rounded text-xs">
              <span className="text-text-muted">Cordón inf.</span>
              <p className="font-bold text-success">
                {trussForces.maxBottomChord.toFixed(1)} kN
              </p>
            </div>
            <div className="p-2 bg-surface-alt rounded text-xs">
              <span className="text-text-muted">Diagonal máx</span>
              <p className="font-bold">
                {trussForces.maxDiagonal.toFixed(1)} kN
              </p>
            </div>
            <div className="p-2 bg-surface-alt rounded text-xs">
              <span className="text-text-muted">Montante máx</span>
              <p className="font-bold">
                {trussForces.maxVertical.toFixed(1)} kN
              </p>
            </div>
          </div>
          {trussChecks ? (
            <>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Verificación
              </h3>
              <div className="flex flex-col gap-2">
                {trussChecks.map((check) => (
                  <div
                    key={check.memberType}
                    className="p-3 bg-surface-alt rounded-lg"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                      <span>{check.memberType}</span>
                      <span className="text-xs text-text-muted">
                        φP<sub>n</sub> = {check.phiPn.toFixed(1)} kN &middot; P
                        <sub>u</sub> = {check.force.toFixed(1)} kN
                      </span>
                      <span
                        className={`ml-auto text-sm font-bold ${check.passes ? "text-success" : "text-danger"}`}
                      >
                        {check.passes ? "✓" : "✗"} Ratio:{" "}
                        {check.ratio.toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t border-border pt-2 flex flex-col gap-0.5">
                      {check.steps.map((s, i) => (
                        <span
                          key={i}
                          className="text-xs text-text-muted font-mono"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-danger">{trussError}</p>
          )}
        </section>
      )}

      {/* Load Diagram */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Diagrama de Cargas
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Fuerzas externas aplicadas sobre la viga
          </p>
        </div>
        <div className="p-2">
          <Mafs
            viewBox={{ x: [xMin, xMax], y: [-maxLoad * 0.2, maxLoad * 1.3] }}
            height={400}
            preserveAspectRatio={false}
          >
            <Coordinates.Cartesian />
            <Plot.OfX y={() => 0} domain={[xMin, xMax]} color="#6b7280" />
            {loads.map((load) => (
              <g key={load.id}>
                {load.type === "point" && (
                  <Vector
                    tip={[load.position ?? 0, 0]}
                    tail={[
                      load.position ?? 0,
                      (load.deadLoad ?? 0) + (load.liveLoad ?? 0),
                    ]}
                  />
                )}
                {load.type === "distributed" && (
                  <>
                    <Plot.OfX
                      y={() => (load.deadLoad ?? 0) + (load.liveLoad ?? 0)}
                      domain={[load.start ?? 0, load.end ?? 0]}
                    />
                    <Plot.OfY
                      x={() => load.start ?? 0}
                      domain={[0, (load.deadLoad ?? 0) + (load.liveLoad ?? 0)]}
                    />
                    <Plot.OfY
                      x={() => load.end ?? 0}
                      domain={[0, (load.deadLoad ?? 0) + (load.liveLoad ?? 0)]}
                    />
                  </>
                )}
              </g>
            ))}
            {supports.map((s, i) => (
              <Vector
                key={`support-${i}`}
                tip={[s.position, 0]}
                tail={[s.position, -reactionsU[i]]}
                color="#4ade80"
              />
            ))}
          </Mafs>
        </div>
      </section>

      {/* Shear Diagram */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Esfuerzo Cortante
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Fuerza interna V(x) &mdash; integral del diagrama de cargas
          </p>
        </div>
        <div className="p-2">
          <Mafs
            viewBox={{
              x: [xMin, xMax],
              y: [-maxLoad * 1.3, maxLoad * 1.3],
            }}
            height={400}
            preserveAspectRatio={false}
          >
            <Coordinates.Cartesian />
            <Plot.OfX y={() => 0} domain={[xMin, xMax]} color="#6b7280" />
            {(() => {
              const eps = 0.001;
              const isJump = (pos: number) =>
                supports.some((s) => Math.abs(s.position - pos) < eps) ||
                loads.some(
                  (l) =>
                    l.type === "point" &&
                    Math.abs((l.position ?? 0) - pos) < eps,
                );

              const elements: React.ReactNode[] = [];

              for (let i = 1; i < criticalPointsU.length; i++) {
                const xPrev = criticalPointsU[i - 1];
                const x = criticalPointsU[i];
                const jumpAtPrev = isJump(xPrev);
                const jumpAtX = isJump(x);

                let startV: number;
                if (jumpAtPrev) {
                  const vBefore = shearForceU(xPrev - eps);
                  const vAfter = shearForceU(xPrev + eps);
                  elements.push(
                    <Plot.OfY
                      key={`jump-${xPrev}`}
                      x={() => xPrev}
                      domain={[
                        Math.min(vBefore, vAfter),
                        Math.max(vBefore, vAfter),
                      ]}
                      color="#f87171"
                    />,
                  );
                  startV = vAfter;
                } else {
                  startV = shearForceU(xPrev);
                }

                const endV = jumpAtX ? shearForceU(x - eps) : shearForceU(x);

                elements.push(
                  <Plot.OfX
                    key={`seg-${xPrev}-${x}`}
                    y={(t) => {
                      const slope = (endV - startV) / (x - xPrev);
                      return startV + slope * (t - xPrev);
                    }}
                    domain={[xPrev, x]}
                    color="#f87171"
                  />,
                );
              }

              // Jump at the last critical point (e.g. right support)
              const last = criticalPointsU[criticalPointsU.length - 1];
              if (isJump(last)) {
                const vBefore = shearForceU(last - eps);
                const vAfter = shearForceU(last + eps);
                elements.push(
                  <Plot.OfY
                    key={`jump-last`}
                    x={() => last}
                    domain={[
                      Math.min(vBefore, vAfter),
                      Math.max(vBefore, vAfter),
                    ]}
                    color="#f87171"
                  />,
                );
              }

              // Labels at critical points
              const labeled = new Set<number>();
              for (const cp of criticalPointsU) {
                if (labeled.has(cp)) continue;
                labeled.add(cp);
                if (isJump(cp)) {
                  const vb = shearForceU(cp - eps);
                  const va = shearForceU(cp + eps);
                  const attachVb = vb >= 0 ? "n" : "s";
                  const attachVa = va >= 0 ? "n" : "s";
                  elements.push(
                    <Text
                      key={`label-before-${cp}`}
                      x={cp}
                      y={vb}
                      attach={attachVb}
                      attachDistance={8}
                      color="#f87171"
                      size={9}
                    >
                      {formatForce(vb)}
                    </Text>,
                  );
                  elements.push(
                    <Text
                      key={`label-after-${cp}`}
                      x={cp}
                      y={va}
                      attach={attachVa}
                      attachDistance={8}
                      color="#f87171"
                      size={9}
                    >
                      {formatForce(va)}
                    </Text>,
                  );
                } else {
                  const v = shearForceU(cp);
                  elements.push(
                    <Text
                      key={`label-${cp}`}
                      x={cp}
                      y={v}
                      attach={v >= 0 ? "n" : "s"}
                      attachDistance={8}
                      color="#f87171"
                      size={9}
                    >
                      {formatForce(v)}
                    </Text>,
                  );
                }
              }

              return elements;
            })()}
          </Mafs>
        </div>
      </section>

      {/* Moment Diagram */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Momento Flector
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Momento interno M(x) &mdash; integral del esfuerzo cortante
          </p>
        </div>
        <div className="p-2">
          <Mafs
            viewBox={{
              x: [xMin, xMax],
              y: [-maxMomentAbs * 1.2, maxMomentAbs * 1.2],
            }}
            height={400}
            preserveAspectRatio={false}
          >
            <Coordinates.Cartesian />
            <Plot.OfX y={() => 0} domain={[xMin, xMax]} color="#6b7280" />
            {criticalPointsU.map((x, i) => {
              if (i === 0) return null;
              const xPrev = criticalPointsU[i - 1];
              return (
                <Plot.OfX
                  key={x}
                  y={(t) => {
                    // Plot inverted: positive moment below baseline
                    return -bendingMomentU(t);
                  }}
                  domain={[xPrev, x]}
                  color="#fbbf24"
                />
              );
            })}
            {criticalPointsU.map((cp) => {
              const m = bendingMomentU(cp);
              const absM = Math.abs(m);
              const label =
                absM >= 1000
                  ? `${(m / 1000).toFixed(2)} MN·m`
                  : absM >= 1
                    ? `${m.toFixed(2)} kN·m`
                    : `${(m * 1000).toFixed(2)} N·m`;
              return (
                <Text
                  key={`m-${cp}`}
                  x={cp}
                  y={-m}
                  attach={m >= 0 ? "s" : "n"}
                  attachDistance={8}
                  color="#fbbf24"
                  size={9}
                >
                  {label}
                </Text>
              );
            })}
            <Text
              x={maxMomentU.position}
              y={-maxMomentU.value}
              attach="s"
              attachDistance={15}
              color="#fbbf24"
              size={10}
            >
              Mmax
            </Text>
          </Mafs>
        </div>
      </section>
    </MainLayout>
  );
}
