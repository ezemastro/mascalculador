import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Coordinates, Mafs, Plot, Polygon, Text } from "mafs";
import { MainLayout } from "@mascalculador/shared";
import { formatForce } from "@mascalculador/shared";
import { calculateBeamEnvelope } from "../lib/beam-envelope";
import type { VigaContinuaState } from "../lib/viga-continua";
import {
  saveVigaContinuaInput,
  updateVigaContinuaInput,
  getSavedVigasContinuas,
} from "../lib/storage";
import EnvToggle, { type EnvMode } from "../components/EnvToggle";
import PorticoResults from "./PorticoResults";
import PrintSelection, {
  type PrintSelectionValue,
} from "../components/PrintSelection";

type LocationState = VigaContinuaState | { mode: "portico" } | null;

function isPorticoLocationState(s: LocationState): s is { mode: "portico" } {
  return s !== null && typeof s === "object" && "mode" in s;
}

function peak(
  fn: (x: number) => number,
  pts: number[],
  x0: number,
  x1: number,
  steps = 300,
): { x: number; v: number } {
  let bx = x0;
  let bv = -Infinity;
  for (const x of pts) {
    if (x < x0 || x > x1) continue;
    const v = fn(x);
    if (v > bv) {
      bv = v;
      bx = x;
    }
  }
  for (let k = 0; k <= steps; k++) {
    const x = x0 + (k / steps) * (x1 - x0);
    const v = fn(x);
    if (v > bv) {
      bv = v;
      bx = x;
    }
  }
  return { x: bx, v: bv };
}

function supportTriangle(x: number, h: number, w: number): [number, number][] {
  return [
    [x, 0],
    [x - w, -h],
    [x + w, -h],
  ];
}

export default function VigaContinuaResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const raw = location.state as LocationState;

  // Toggle state — local, defaults to "envolvente" per R-beam-env-toggle.
  const [envMode, setEnvMode] = useState<EnvMode>("envolvente");
  const [showPrintSelection, setShowPrintSelection] = useState(false);

  // Save context seeded from location.state. Router state is intentionally
  // lossy across hard refreshes — spec scenario "Hard refresh resets save state"
  // accepts that limitation. We only seed when the state object actually
  // looks like a beam submission (carries `spans`).
  // [BasesForm-bug-free] BOTH fields are seeded together, never one without
  // the other. See design.md §11.
  const [loadedSaveId, setLoadedSaveId] = useState<string | null>(() => {
    if (!raw || isPorticoLocationState(raw)) return null;
    const v = (raw as VigaContinuaState).loadedSaveId;
    return typeof v === "string" ? v : null;
  });
  const [loadedSaveName, setLoadedSaveName] = useState<string | null>(() => {
    if (!raw || isPorticoLocationState(raw)) return null;
    const v = (raw as VigaContinuaState).loadedSaveName;
    return typeof v === "string" ? v : null;
  });

  // Compute envelopes ONLY when the location state carries a beam submission.
  // Pórtico mode reaches `raw === { mode: "portico" }` and gets `null` here so
  // the pórtico placeholder branch below renders without touching beam math.
  const beamState =
    raw && !isPorticoLocationState(raw) ? (raw as VigaContinuaState) : null;

  // Ultimate envelope. Self-weight is supplied separately by the caller when
  // the calculation includes it.
  const envelope = useMemo(
    () =>
      beamState
        ? calculateBeamEnvelope(
            beamState.spans,
            beamState.supportTypes,
            beamState.loads,
            0,
          )
        : null,
    [beamState],
  );

  const serviceResult = useMemo(
    () =>
      beamState
        ? calculateBeamEnvelope(
            beamState.spans,
            beamState.supportTypes,
            beamState.loads,
            0,
            "service",
          )
        : null,
    [beamState],
  );

  // [BasesForm-bug-free] handleSave: branches on loadedSaveId; the first-save
  // path sets BOTH loadedSaveId and loadedSaveName together. The re-save path
  // calls updateVigaContinuaInput silently. The envelope passed in the payload
  // is the value already memoized on screen at click time — no re-solve.
  // Empty prompt is a no-op. Duplicate-name throws surface via alert().
  function handleSave() {
    if (!beamState || !envelope) return;
    const input = {
      spans: beamState.spans,
      supportTypes: beamState.supportTypes,
      loads: beamState.loads,
    };

    if (loadedSaveId) {
      // [R-vc-save-re-save] Already editing a saved beam — overwrite the same
      // record silently with the current envelope snapshot. Do NOT re-prompt.
      try {
        updateVigaContinuaInput(loadedSaveId, { input, envelope });
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Error al guardar");
      }
      return;
    }

    const name = prompt("Nombre para guardar esta viga:");
    if (!name) return;
    try {
      const saved = saveVigaContinuaInput(name, { input, envelope });
      // [BasesForm-bug-free] both setters called together.
      setLoadedSaveId(saved.id);
      setLoadedSaveName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  function handlePrint(selection: PrintSelectionValue) {
    navigate("/viga-continua-print", {
      state: { ...selection, state: beamState },
    });
  }

  // Pórtico branch (R-routing-portico-routes). Delega en PorticoResults
  // para mantener la lógica de render separada.
  if (isPorticoLocationState(raw)) {
    return <PorticoResults />;
  }

  const s = beamState;

  if (!s || !envelope || !serviceResult)
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-text-muted">No hay datos.</p>
          <button
            onClick={() => navigate("/viga-continua")}
            className="bg-primary text-white hover:bg-primary-hover"
          >
            Volver
          </button>
        </div>
      </MainLayout>
    );

  const { spans, supportTypes } = s;
  const nSpans = spans.length;
  const L = spans.reduce((a, b) => a + b, 0);

  // [R-vc-save-number] Stable ordinal for the saved beam (1-based index in
  // the saved list). Recomputed each render so deletions/reorders of other
  // beams update this number correctly.
  const vigaNumber = loadedSaveId
    ? getSavedVigasContinuas().findIndex((s) => s.id === loadedSaveId) + 1
    : null;

  const supportPositions: number[] = [0];
  for (const sp of spans)
    supportPositions.push(supportPositions[supportPositions.length - 1] + sp);

  const displayResult = envMode === "envolvente" ? envelope : serviceResult;

  const {
    momentPos,
    momentNeg,
    shearPos,
    shearNeg,
    shearMax,
    criticalPoints,
    spanMuPos,
    spanVu,
    supportMuNeg,
    reactionsD,
    reactionsL,
  } = displayResult;

  // Mu− en apoyos no-libres con momento negativo: interiores y extremos
  // empotrados (p. ej. el apoyo de un voladizo).
  const supportMuNegIdx = supportPositions
    .map((_p, i) => i)
    .filter((i) => supportTypes[i] !== "free" && (supportMuNeg[i] ?? 0) > 1e-6);

  // ----- Globales de diagramas -----
  let globalMaxM = 0,
    globalMaxV = 0;
  for (let k = 0; k <= 500; k++) {
    const x = (k / 500) * L;
    globalMaxM = Math.max(globalMaxM, momentPos(x), momentNeg(x));
    globalMaxV = Math.max(globalMaxV, shearMax(x));
  }
  for (const x of criticalPoints) {
    globalMaxM = Math.max(globalMaxM, momentPos(x), momentNeg(x));
    globalMaxV = Math.max(globalMaxV, shearMax(x));
  }
  const globalMaxMomentAbs = Math.max(globalMaxM, 1);
  const xMin = -L * 0.08,
    xMax = L * 1.08;

  const eps = 0.001;
  const spanMpos = spans.map((_s, i) =>
    peak(
      momentPos,
      criticalPoints,
      supportPositions[i],
      supportPositions[i + 1],
    ),
  );
  const supportMneg = supportMuNegIdx.map((si) => ({
    x: supportPositions[si],
    v: supportMuNeg[si],
  }));
  const supportV = supportPositions.map((p, i) => ({
    x: p,
    vLeft: i > 0 && supportTypes[i] !== "free" ? shearNeg(p - eps) : null,
    vRight: i < nSpans && supportTypes[i] !== "free" ? shearPos(p + eps) : null,
  }));
  const clampX = (x: number) => Math.min(Math.max(x, L * 0.05), L * 0.95);
  const labelH = (x: number) => (x < L * 0.5 ? "e" : "w");

  const supports = supportPositions.map((position, i) => ({
    position,
    type: supportTypes[i],
  }));

  const supportLabel = (i: number) =>
    supportTypes.length === 2
      ? i === 0
        ? "Apoyo A"
        : "Apoyo B"
      : `Apoyo ${i + 1}`;

  return (
    <MainLayout>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Viga Continua</h1>
          <p className="text-sm text-text-muted">
            L={L.toFixed(2)} m &middot; {nSpans} tramo{nSpans > 1 ? "s" : ""}
            {vigaNumber != null && loadedSaveName
              ? ` · Viga #${vigaNumber} — ${loadedSaveName}`
              : " · Viga sin guardar"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/viga-continua")}
            className="text-sm bg-surface-alt border border-border hover:bg-surface text-text-muted px-3 py-1.5 rounded-lg"
          >
            ← Volver
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="bg-surface-alt border border-border text-text-muted font-semibold px-3 py-1.5 rounded-lg hover:bg-surface transition-colors"
          >
            {loadedSaveId ? "Guardar corrección" : "Guardar"}
          </button>
          <button
            type="button"
            className="bg-primary text-white"
            onClick={() => setShowPrintSelection(true)}
          >
            Imprimir
          </button>
        </div>
      </header>

      {/* Env toggle in its own row, separated from the header actions. */}
      <div className="flex flex-col items-center gap-1">
        <EnvToggle envMode={envMode} setEnvMode={setEnvMode} />
        <p className="text-xs text-text-muted">
          Envolvente: U = 1.2·D + 1.6·L con alternancia de cargas · Estado de
          servicio: D + L sin mayorar
        </p>
      </div>

      {/* Reacciones (sin factorar) */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
          Reacciones
        </h2>
        <p className="text-xs text-text-muted mb-3">
          Valores sin factorar: D y L por separado.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {supportPositions.map((_pos, i) => (
            <div
              key={i}
              className="bg-surface rounded-xl border border-border p-3"
            >
              <span className="text-xs text-text-muted">{supportLabel(i)}</span>
              {supportTypes[i] === "free" ? (
                <p className="text-sm font-bold text-primary">—</p>
              ) : (
                <div className="text-sm">
                  <p className="text-text-muted">
                    D:{" "}
                    <span className="font-semibold text-text">
                      {formatForce(reactionsD[i])}
                    </span>
                  </p>
                  <p className="text-text-muted">
                    L:{" "}
                    <span className="font-semibold text-text">
                      {formatForce(reactionsL[i])}
                    </span>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Efforts switch between the ultimate envelope and one service case. */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
          {envMode === "envolvente"
            ? "Esfuerzos factorados"
            : "Esfuerzos sin factorar"}
        </h2>
        <p className="text-xs text-text-muted mb-3">
          {envMode === "envolvente"
            ? "U = 1.2·D + 1.6·L"
            : "Servicio — D + L sin mayorar (sin envolvente)"}
        </p>
        <div className="flex flex-col gap-2">
          {spans.map((len, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-4 p-3 bg-surface-alt rounded-lg"
            >
              <span className="text-xs text-text-muted w-40">
                Tramo {i + 1} — {len.toFixed(2)} m
              </span>
              <span className="text-sm">
                <span className="text-xs text-text-muted">
                  V<sub>{envMode === "envolvente" ? "u" : "s"}</sub> ={" "}
                </span>
                <span className="font-semibold text-text">
                  {spanVu[i].toFixed(1)} kN
                </span>
              </span>
              <span className="text-sm">
                <span className="text-xs text-text-muted">
                  M<sub>{envMode === "envolvente" ? "u" : "s"}</sub>
                  <sup>+</sup> ={" "}
                </span>
                <span className="font-semibold text-text">
                  {spanMuPos[i].toFixed(1)} kN·m
                </span>
              </span>
            </div>
          ))}
          {supportMuNegIdx.map((si) => (
            <div
              key={`neg-${si}`}
              className="flex flex-wrap items-center gap-4 p-3 bg-surface-alt rounded-lg"
            >
              <span className="text-xs text-text-muted w-40">
                {supportLabel(si)}
              </span>
              <span className="text-sm">
                <span className="text-xs text-text-muted">
                  M<sub>{envMode === "envolvente" ? "u" : "s"}</sub>
                  <sup>−</sup> ={" "}
                </span>
                <span className="font-semibold text-text">
                  {supportMuNeg[si].toFixed(1)} kN·m
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Diagrams use the selected calculation result. */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
          Diagramas
        </h2>
        <p className="text-xs text-text-muted">
          {envMode === "envolvente"
            ? "Envolventes factoradas (U = 1.2·D + 1.6·L)."
            : "Servicio — D + L sin mayorar (sin envolvente)."}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              {envMode === "envolvente"
                ? "Corte (envolvente)"
                : "Corte (servicio)"}
            </h3>
          </div>
          <div className="p-1">
            <Mafs
              viewBox={{
                x: [xMin, xMax],
                y: [-globalMaxV * 1.3, globalMaxV * 1.3],
              }}
              height={220}
              preserveAspectRatio={false}
            >
              <Coordinates.Cartesian xAxis={{ lines: 4 }} yAxis={false} />
              <Plot.OfX y={() => 0} domain={[xMin, xMax]} color="#6b7280" />
              <Plot.OfX
                y={(t) => shearPos(t)}
                domain={[0, L]}
                color="#f87171"
              />
              <Plot.OfX
                y={(t) => shearNeg(t)}
                domain={[0, L]}
                color="#f87171"
              />
              {supports
                .filter((sp) => sp.type !== "free")
                .map((sp, i) => (
                  <Polygon
                    key={`vsup-${i}`}
                    points={supportTriangle(
                      sp.position,
                      globalMaxV * 0.09,
                      L * 0.02,
                    )}
                    color="#6b7280"
                    fillOpacity={1}
                    strokeOpacity={0}
                  />
                ))}
              {supportV.map(
                (sv, i) =>
                  sv.vRight != null && (
                    <Text
                      key={`vr-${i}`}
                      x={clampX(sv.x)}
                      y={sv.vRight + globalMaxV * 0.07}
                      attach={`n${labelH(sv.x)}`}
                      size={16}
                      color="#f87171"
                    >
                      V⁺ = {sv.vRight.toFixed(1)}
                    </Text>
                  ),
              )}
              {supportV.map(
                (sv, i) =>
                  sv.vLeft != null && (
                    <Text
                      key={`vl-${i}`}
                      x={clampX(sv.x)}
                      y={sv.vLeft - globalMaxV * 0.07}
                      attach={`s${labelH(sv.x)}`}
                      size={16}
                      color="#f87171"
                    >
                      V⁻ = {sv.vLeft.toFixed(1)}
                    </Text>
                  ),
              )}
            </Mafs>
          </div>
        </section>
        <section className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              {envMode === "envolvente"
                ? "Momento (envolvente)"
                : "Momento (servicio)"}
            </h3>
          </div>
          <div className="p-1">
            <Mafs
              viewBox={{
                x: [xMin, xMax],
                y: [-globalMaxMomentAbs * 1.3, globalMaxMomentAbs * 1.3],
              }}
              height={220}
              preserveAspectRatio={false}
            >
              <Coordinates.Cartesian xAxis={{ lines: 4 }} yAxis={false} />
              <Plot.OfX y={() => 0} domain={[xMin, xMax]} color="#6b7280" />
              <Plot.OfX
                y={(t) => -momentPos(t)}
                domain={[0, L]}
                color="#fbbf24"
              />
              <Plot.OfX
                y={(t) => momentNeg(t)}
                domain={[0, L]}
                color="#fbbf24"
              />
              {supports
                .filter((sp) => sp.type !== "free")
                .map((sp, i) => (
                  <Polygon
                    key={`msup-${i}`}
                    points={supportTriangle(
                      sp.position,
                      globalMaxMomentAbs * 0.09,
                      L * 0.02,
                    )}
                    color="#6b7280"
                    fillOpacity={1}
                    strokeOpacity={0}
                  />
                ))}
              {spanMpos.map((m, i) => (
                <Text
                  key={`mp-${i}`}
                  x={clampX(m.x)}
                  y={-m.v - globalMaxMomentAbs * 0.07}
                  attach={`s${labelH(m.x)}`}
                  size={16}
                  color="#fbbf24"
                >
                  {nSpans > 1 ? `M⁺ tramo ${i + 1}` : "M⁺"} = {m.v.toFixed(1)}
                </Text>
              ))}
              {supportMneg.map((m, si) => (
                <Text
                  key={`mn-${si}`}
                  x={clampX(m.x)}
                  y={m.v + globalMaxMomentAbs * 0.07}
                  attach={`n${labelH(m.x)}`}
                  size={16}
                  color="#fbbf24"
                >
                  M⁻ = {m.v.toFixed(1)}
                </Text>
              ))}
            </Mafs>
          </div>
        </section>
      </div>
      {showPrintSelection && (
        <PrintSelection
          kind="beam"
          defaultEnvMode={envMode}
          onPrint={handlePrint}
          onCancel={() => setShowPrintSelection(false)}
        />
      )}
    </MainLayout>
  );
}
