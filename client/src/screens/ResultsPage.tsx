import { useLocation, useNavigate } from "react-router";
import { Coordinates, Mafs, Plot, Text, Vector } from "mafs";
import MainLayout from "../components/MainLayout";
import { calculateBeam, formatForce, formatLength } from "../lib/beam-calculations";

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { loads?: Load[]; beamConfig?: BeamConfig } | null;

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
  const results = calculateBeam(beamConfig, loads);
  const { reactions, shearForce, bendingMoment, maxMoment, criticalPoints } =
    results;
  const [Ra, Rb] = reactions;
  const L = beamConfig.length;

  const maxLoad = Math.max(
    ...loads.map((l) => l.magnitude),
    Math.abs(Ra),
    Math.abs(Rb),
    1,
  );
  const maxMomentAbs = Math.max(Math.abs(maxMoment.value), 1);
  const xMin = -L * 0.1;
  const xMax = L * 1.1;

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
            <p className="text-sm text-text-muted">
              Viga de {formatLength(L)}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/")}
          className="text-sm bg-surface-alt border-border hover:bg-surface text-text-muted"
        >
          ← Volver
        </button>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            Reacción A
          </span>
          <p className="text-2xl font-bold text-primary mt-1">
            {formatForce(Ra)}
          </p>
          <span className="text-xs text-text-muted">
            x = {formatLength(beamConfig.supports[0].position)}
          </span>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            Reacción B
          </span>
          <p className="text-2xl font-bold text-primary mt-1">
            {formatForce(Rb)}
          </p>
          <span className="text-xs text-text-muted">
            x = {formatLength(beamConfig.supports[1].position)}
          </span>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            M máx
          </span>
          <p className="text-2xl font-bold text-warning mt-1">
            {(maxMoment.value / 1000).toFixed(2)} MN·m
          </p>
          <span className="text-xs text-text-muted">
            x = {formatLength(maxMoment.position)}
          </span>
        </div>
      </div>

      {/* Load Diagram */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Diagrama de Cargas
          </h2>
        </div>
        <div className="p-2">
          <Mafs
            viewBox={{ x: [xMin, xMax], y: [-maxLoad * 0.2, maxLoad * 1.3] }}
            height={260}
          >
            <Coordinates.Cartesian />
            {loads.map((load) => (
              <g key={load.id}>
                {load.type === "point" && (
                  <Vector
                    tip={[load.position ?? 0, 0]}
                    tail={[load.position ?? 0, load.magnitude]}
                  />
                )}
                {load.type === "distributed" && (
                  <>
                    <Plot.OfX
                      y={() => load.magnitude}
                      domain={[load.start ?? 0, load.end ?? 0]}
                    />
                    <Plot.OfY
                      x={() => load.start ?? 0}
                      domain={[0, load.magnitude]}
                    />
                    <Plot.OfY
                      x={() => load.end ?? 0}
                      domain={[0, load.magnitude]}
                    />
                  </>
                )}
              </g>
            ))}
            {beamConfig.supports.map((s, i) => (
              <Vector
                key={`support-${i}`}
                tip={[s.position, 0]}
                tail={[s.position, -(i === 0 ? Ra : Rb)]}
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
        </div>
        <div className="p-2">
          <Mafs
            viewBox={{
              x: [xMin, xMax],
              y: [-maxLoad * 1.3, maxLoad * 1.3],
            }}
            height={260}
          >
            <Coordinates.Cartesian />
            {criticalPoints.map((x, i) => {
              if (i === 0) return null;
              const xPrev = criticalPoints[i - 1];
              // Check if there's a discrete jump at xPrev (point load)
              const hasPointLoad = loads.some(
                (l) => l.type === "point" && (l.position ?? 0) === xPrev,
              );

              if (hasPointLoad) {
                const vBefore = shearForce(xPrev - 0.001);
                const vAfter = shearForce(xPrev + 0.001);
                return (
                  <g key={x}>
                    <Plot.OfY
                      x={() => xPrev}
                      domain={[
                        Math.min(vBefore, vAfter),
                        Math.max(vBefore, vAfter),
                      ]}
                      color="#f87171"
                    />
                    <Plot.OfX
                      y={(t) => {
                        // Linear between vAfter at xPrev and shearForce(x) at x
                        const slope =
                          (shearForce(x) - vAfter) / (x - xPrev);
                        return vAfter + slope * (t - xPrev);
                      }}
                      domain={[xPrev, x]}
                      color="#f87171"
                    />
                  </g>
                );
              }

              return (
                <Plot.OfX
                  key={x}
                  y={(t) => {
                    const vy = shearForce(t);
                    return vy;
                  }}
                  domain={[xPrev, x]}
                  color="#f87171"
                />
              );
            })}
          </Mafs>
        </div>
      </section>

      {/* Moment Diagram */}
      <section className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Momento Flector
          </h2>
        </div>
        <div className="p-2">
          <Mafs
            viewBox={{
              x: [xMin, xMax],
              y: [-maxMomentAbs * 1.2, maxMomentAbs * 1.2],
            }}
            height={260}
          >
            <Coordinates.Cartesian />
            {criticalPoints.map((x, i) => {
              if (i === 0) return null;
              const xPrev = criticalPoints[i - 1];
              return (
                <Plot.OfX
                  key={x}
                  y={(t) => {
                    // Plot inverted: positive moment below baseline
                    return -bendingMoment(t);
                  }}
                  domain={[xPrev, x]}
                  color="#fbbf24"
                />
              );
            })}
            <Text
              x={maxMoment.position}
              y={-maxMoment.value}
              attach="s"
              attachDistance={15}
              color="#fbbf24"
            >
              Mmax
            </Text>
          </Mafs>
        </div>
      </section>
    </MainLayout>
  );
}
