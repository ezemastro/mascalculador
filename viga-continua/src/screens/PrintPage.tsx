import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { calculateBeamEnvelope } from "../lib/beam-envelope";
import type { VigaContinuaState } from "../lib/viga-continua";
import { solvePortico } from "../lib/portico-analysis";
import type { PorticoState, PorticoReaction } from "../lib/portico";
import BeamDiagrams from "../components/BeamDiagrams";
import PorticoDiagram, { type DiagramMode } from "../components/PorticoDiagram";
import type { EnvMode } from "../components/EnvToggle";
import type {
  BeamPrintGraphic,
  PorticoPrintGraphic,
} from "../components/PrintSelection";

type PrintState =
  | {
      kind: "beam";
      state: VigaContinuaState;
      graphics: BeamPrintGraphic[];
      envMode?: EnvMode;
    }
  | {
      kind: "portico";
      state: PorticoState;
      graphics: PorticoPrintGraphic[];
      envMode?: EnvMode;
    };

function isPrintState(value: unknown): value is PrintState {
  return (
    value !== null &&
    typeof value === "object" &&
    "kind" in value &&
    "state" in value &&
    "graphics" in value
  );
}

export default function PrintPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const payload = location.state;
  const result = useMemo(() => {
    if (!isPrintState(payload)) return null;
    try {
      return payload.kind === "beam"
        ? {
            payload,
            solved: calculateBeamEnvelope(
              payload.state.spans,
              payload.state.supportTypes,
              payload.state.loads,
              0,
              payload.envMode === "servicio" ? "service" : "envelope",
            ),
          }
        : { payload, solved: solvePortico(payload.state, "uls") };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [payload]);

  if (!result)
    return (
      <PrintError
        message="No hay una planilla de impresión disponible. Volvé a los resultados y elegí Imprimir resultados."
        onBack={() => navigate(-1)}
      />
    );
  if ("error" in result)
    return (
      <PrintError
        message={`No se pudo preparar la impresión: ${result.error}`}
        onBack={() => navigate(-1)}
      />
    );

  const { payload: data } = result;
  const date = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(
    new Date(),
  );

  return (
    <main className="print-page mx-auto max-w-5xl bg-white p-6 text-black">
      <div className="no-print mb-5 flex justify-end gap-3">
        <button
          type="button"
          className="bg-primary text-white"
          onClick={() => window.print()}
        >
          Imprimir
        </button>
        <button
          type="button"
          className="border border-border text-text-muted"
          onClick={() => navigate(-1)}
        >
          Volver
        </button>
      </div>
      <header className="print-card border-b-2 border-black pb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-600">
          MasCalculador · Informe estructural
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          {data.kind === "beam" ? "Viga Continua" : "Pórtico"}
        </h1>
        <p className="mt-1 text-sm text-gray-600">Fecha: {date}</p>
      </header>
      {data.kind === "beam" ? (
        <BeamPrint
          data={data}
          solved={result.solved as ReturnType<typeof calculateBeamEnvelope>}
        />
      ) : (
        <PorticoPrint
          data={data}
          solved={result.solved as ReturnType<typeof solvePortico>}
        />
      )}
    </main>
  );
}

function BeamPrint({
  data,
  solved,
}: {
  data: Extract<PrintState, { kind: "beam" }>;
  solved: ReturnType<typeof calculateBeamEnvelope>;
}) {
  return (
    <>
      <section className="print-card mt-5 rounded border border-gray-300 p-4">
        <h2 className="text-lg font-bold">Datos de entrada y cálculo</h2>
        <p className="mt-2 text-sm">
          Luces:{" "}
          {data.state.spans.map((span) => `${span.toFixed(2)} m`).join(" · ")}
        </p>
        <p className="text-sm">
          Cargas consideradas: {data.state.loads.length} · Combinación:{" "}
          {data.envMode === "servicio"
            ? "Servicio — D + L sin mayorar"
            : "Envolvente — U = 1.2·D + 1.6·L"}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {solved.reactionsD.map((reaction, index) => (
            <div key={index} className="rounded border border-gray-200 p-2">
              <b>Apoyo {index + 1}</b>
              <br />
              D: {reaction.toFixed(2)}
              <br />
              L: {solved.reactionsL[index].toFixed(2)}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm">
          Resultados máximos: V = {solved.shearMax(0).toFixed(2)} kN (referencia
          inicial), M⁺ por tramo:{" "}
          {solved.spanMuPos.map((m) => `${m.toFixed(2)} kN·m`).join(" · ")}
        </p>
      </section>
      {data.graphics.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-3 text-lg font-bold">Diagramas seleccionados</h2>
          <BeamDiagrams
            spans={data.state.spans}
            supportTypes={data.state.supportTypes}
            envelope={solved}
            selected={data.graphics}
          />
        </section>
      )}
    </>
  );
}

function PorticoPrint({
  data,
  solved,
}: {
  data: Extract<PrintState, { kind: "portico" }>;
  solved: ReturnType<typeof solvePortico>;
}) {
  const active = data.envMode === "servicio" ? solved.slsD : solved.uls;
  return (
    <>
      <section className="print-card mt-5 rounded border border-gray-300 p-4">
        <h2 className="text-lg font-bold">Datos de entrada y cálculo</h2>
        <p className="mt-2 text-sm">
          {data.state.nodes.length} nudos · {data.state.bars.length} barras ·{" "}
          {data.state.supports.length} apoyos · {data.state.loads.length} cargas
        </p>
        <p className="text-sm">
          Combinación:{" "}
          {data.envMode === "servicio"
            ? "Servicio — D y L por separado"
            : "U = 1.2·D + 1.6·L"}
        </p>
        {data.envMode === "servicio" ? (
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <PorticoReactions
              title="Servicio D (sin factor)"
              reactions={solved.slsD.reactions}
            />
            <PorticoReactions
              title="Servicio L (sin factor)"
              reactions={solved.slsL.reactions}
            />
          </div>
        ) : (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {active.reactions.map((reaction) => (
              <div
                key={reaction.supportId}
                className="rounded border border-gray-200 p-2"
              >
                <b>{reaction.supportId}</b>: Fx {reaction.Fx.toFixed(2)} kN · Fy{" "}
                {reaction.Fy.toFixed(2)} kN · Mz {reaction.Mz.toFixed(2)} kN·m
              </div>
            ))}
          </div>
        )}
      </section>
      {data.graphics.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-3 text-lg font-bold">Diagramas seleccionados</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {data.graphics.map((mode) => (
              <figure
                key={mode}
                className="print-card print-diagram rounded border border-gray-300 p-2"
              >
                <figcaption className="mb-1 text-center text-sm font-bold capitalize">
                  {mode}
                </figcaption>
                <PorticoDiagram
                  porticoState={data.state}
                  solved={active}
                  mode={mode as DiagramMode}
                  height={360}
                  printMode
                />
              </figure>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function PorticoReactions({
  title,
  reactions,
}: {
  title: string;
  reactions: PorticoReaction[];
}) {
  return (
    <div className="rounded border border-gray-200 p-2">
      <p className="font-bold">{title}</p>
      {reactions.map((reaction) => (
        <p key={reaction.supportId} className="mt-1">
          <b>{reaction.supportId}</b>: Fx {reaction.Fx.toFixed(2)} kN · Fy{" "}
          {reaction.Fy.toFixed(2)} kN · Mz {reaction.Mz.toFixed(2)} kN·m
        </p>
      ))}
    </div>
  );
}

function PrintError({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white p-6 text-black">
      <p className="max-w-lg text-center">{message}</p>
      <button type="button" className="bg-primary text-white" onClick={onBack}>
        Volver
      </button>
    </main>
  );
}
