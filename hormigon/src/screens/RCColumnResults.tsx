import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { MainLayout } from "@mascalculador/shared";
import { PrintButton } from "@mascalculador/shared";
import {
  designRCColumn,
  computeManualAst,
  proposeArmado,
} from "../lib/rc-column-calc";
import type { RCColumnState } from "./RCColumnForm";
import { ArmadoLayoutSVG } from "./RCColumnForm";
import { saveBeam, updateSave } from "../lib/storage";

/** Stepper control: +/- buttons with a label. */
function StepperInput({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  unit = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-text-muted">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-7 h-7 rounded bg-surface-alt border border-border text-text-muted hover:bg-surface hover:text-text text-sm font-bold flex items-center justify-center"
        >
          −
        </button>
        <span className="text-sm font-semibold text-text w-10 text-center tabular-nums">
          {value}
          {unit && (
            <span className="text-xs text-text-muted ml-0.5">{unit}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-7 h-7 rounded bg-surface-alt border border-border text-text-muted hover:bg-surface hover:text-text text-sm font-bold flex items-center justify-center"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function RCColumnResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as RCColumnState | null;

  if (!state) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-text-muted">No hay datos.</p>
          <button
            onClick={() => navigate("/rc-column")}
            className="bg-primary text-white hover:bg-primary-hover px-4 py-1.5 rounded-lg"
          >
            Volver
          </button>
        </div>
      </MainLayout>
    );
  }

  const {
    fc,
    fy,
    PD,
    PL,
    lu,
    MxSup,
    MxInf,
    MySup,
    MyInf,
    Cx,
    Cy,
    betaD,
    includeSelfWeight,
    contributedColumns,
    contributedBeams,
    loadedSaveId,
    loadedSaveName,
  } = state;

  // ─── Base result (auto-design, no manual armado) for initial proposal ───
  const resultBase = useMemo(
    () =>
      designRCColumn({
        fc,
        fy,
        PD,
        PL,
        lu,
        MxSup,
        MxInf,
        MySup,
        MyInf,
        Cx,
        Cy,
        betaD,
      }),
    [fc, fy, PD, PL, lu, MxSup, MxInf, MySup, MyInf, Cx, Cy, betaD],
  );

  // ─── Initial armado proposal ───
  const astNeeded = resultBase.Ast;

  const proposedArmado = useMemo(
    () => proposeArmado(astNeeded, resultBase.dirX, resultBase.dirY),
    [astNeeded, resultBase.dirX, resultBase.dirY],
  );

  // ─── Interactive armado state ───
  const [nEsquinas, setNEsquinas] = useState<number>(
    state.nEsquinas ?? proposedArmado.nEsquinas,
  );
  const [nCarasX, setNCarasX] = useState<number>(
    state.nCarasX ?? proposedArmado.nCarasX,
  );
  const [nCarasY, setNCarasY] = useState<number>(
    state.nCarasY ?? proposedArmado.nCarasY,
  );
  const [dbEsquinas, setDbEsquinas] = useState<number>(
    state.dbEsquinas ?? proposedArmado.dbEsquinas,
  );
  const [dbCarasX, setDbCarasX] = useState<number>(
    state.dbCarasX ?? proposedArmado.dbCarasX,
  );
  const [dbCarasY, setDbCarasY] = useState<number>(
    state.dbCarasY ?? proposedArmado.dbCarasY,
  );
  const [armaduraConfirmada, setArmaduraConfirmada] = useState(false);

  // Cualquier cambio en el armado invalida la confirmación previa:
  // obliga a volver a tocar "Confirmar armado" (y re-hide estribos).
  function updateArmado(setter: (v: number) => void, v: number) {
    setter(v);
    setArmaduraConfirmada(false);
  }

  // Identidad del guardado (arranca del router state, se actualiza al guardar)
  const [savedId, setSavedId] = useState<string | null>(loadedSaveId ?? null);
  const [savedName, setSavedName] = useState<string | null>(
    loadedSaveName ?? null,
  );

  // ─── Recompute on user changes ───
  const armaduraManual = useMemo(
    () =>
      computeManualAst(
        nEsquinas,
        nCarasX,
        nCarasY,
        dbEsquinas,
        dbCarasX,
        dbCarasY,
      ),
    [nEsquinas, nCarasX, nCarasY, dbEsquinas, dbCarasX, dbCarasY],
  );

  const resultRecalculado = useMemo(
    () =>
      designRCColumn({
        fc,
        fy,
        PD,
        PL,
        lu,
        MxSup,
        MxInf,
        MySup,
        MyInf,
        Cx,
        Cy,
        betaD,
        nEsquinas,
        nCarasX,
        nCarasY,
        dbEsquinas,
        dbCarasX,
        dbCarasY,
      }),
    [
      fc,
      fy,
      PD,
      PL,
      lu,
      MxSup,
      MxInf,
      MySup,
      MyInf,
      Cx,
      Cy,
      betaD,
      nEsquinas,
      nCarasX,
      nCarasY,
      dbEsquinas,
      dbCarasX,
      dbCarasY,
    ],
  );

  const result = resultRecalculado;
  const astProviso = armaduraManual.astTotal;
  const astVerifica = astProviso >= astNeeded;

  // Diameter options for select
  const DB_OPTIONS = [8, 10, 12, 16, 20, 25, 32];

  // ─── Guardar desde results ───
  function handleSaveFromResults() {
    const data: Record<string, unknown> = {
      fc,
      fy,
      PD,
      PL,
      lu,
      MxSup,
      MxInf,
      MySup,
      MyInf,
      Cx: result.Cx,
      Cy: result.Cy,
      betaD,
      includeSelfWeight,
      contributedColumns,
      contributedBeams,
      nEsquinas,
      nCarasX,
      nCarasY,
      dbEsquinas,
      dbCarasX,
      dbCarasY,
    };
    // Si venimos de una columna guardada, actualizamos la misma (mismo id/nombre)
    if (savedId) {
      updateSave(savedId, data);
      return;
    }
    const name = prompt("Nombre para guardar esta columna:");
    if (!name) return;
    try {
      const saved = saveBeam(name, "rc-columna", data);
      setSavedId(saved.id);
      setSavedName(name);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al guardar");
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
                d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM9 17l-2-2 2-2m6 4l2-2-2-2M12 15l-2-6"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text flex items-center gap-3">
              Columna
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
              f'<sub>c</sub> = {fc} MPa &middot; f<sub>y</sub> = {fy} MPa
              &middot; l<sub>u</sub> = {lu} m
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <PrintButton />
          <button
            type="button"
            onClick={handleSaveFromResults}
            className="text-sm bg-primary text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-hover transition-colors"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() =>
              navigate("/rc-column", {
                state: {
                  ...state,
                  loadedSaveId: savedId,
                  loadedSaveName: savedName,
                },
              })
            }
            className="text-sm bg-surface-alt border border-border hover:bg-surface text-text-muted px-4 py-1.5 rounded-lg"
          >
            ← Volver
          </button>
        </div>
      </header>

      {/* Datos de entrada */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Datos
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          <div>
            <span className="text-xs text-text-muted">
              Cargas P<sub>D</sub> / P<sub>L</sub> (kN)
            </span>
            <p className="font-semibold">
              {PD} / {PL}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">
              l<sub>u</sub> (m)
            </span>
            <p className="font-semibold">{lu}</p>
          </div>
          <div>
            <span className="text-xs text-text-muted">
              Momentos X sup/inf (kN·m)
            </span>
            <p className="font-semibold">
              {MxSup} / {MxInf}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">
              Momentos Y sup/inf (kN·m)
            </span>
            <p className="font-semibold">
              {MySup} / {MyInf}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">Sección Cx×Cy (cm)</span>
            <p className="font-semibold">
              {Cx}×{Cy}
            </p>
          </div>
          <div>
            <span className="text-xs text-text-muted">
              β<sub>d</sub>
            </span>
            <p className="font-semibold">{betaD}</p>
          </div>
        </div>
      </section>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            P<sub>u</sub>
          </span>
          <p className="text-2xl font-bold text-primary mt-1">
            {result.Pu.toFixed(1)} kN
          </p>
          <span className="text-xs text-text-muted">
            P<sub>D</sub>={PD} + P<sub>L</sub>={PL}
          </span>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            λ<sub>X</sub> / λ<sub>Y</sub>
          </span>
          <p
            className={`text-lg font-bold mt-1 ${result.lambdaOK ? "text-success" : "text-danger"}`}
          >
            {result.dirX.lambda.toFixed(1)} / {result.dirY.lambda.toFixed(1)}
          </p>
          <span className="text-xs text-text-muted">
            lim {result.dirX.lambdaLim.toFixed(1)} /{" "}
            {result.dirY.lambdaLim.toFixed(1)}
          </span>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            Tipo
          </span>
          <p
            className={`text-lg font-bold mt-1 ${result.columnType === "SHORT" ? "text-success" : "text-warning"}`}
          >
            {result.columnType === "SHORT" ? "Corta" : "Esbelta"}
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            ρ
          </span>
          <p className="text-2xl font-bold text-primary mt-1">
            {(result.rho * 100).toFixed(2)}%
          </p>
          <span className="text-xs text-text-muted">
            A<sub>st</sub> = {result.Ast.toFixed(1)} cm²
          </span>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <span className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            Armado
          </span>
          <p className="text-lg font-bold text-primary mt-1">
            {result.barLayout.totalBars} Ø{result.dbLong}
          </p>
          {armaduraConfirmada && (
            <span className="text-xs text-text-muted">
              e Ø{result.phiStirrup} c/{result.sStirrup.toFixed(0)} cm
            </span>
          )}
        </div>
      </div>

      {/* Pass/Fail indicator */}
      <div
        className={`p-4 rounded-xl border-2 text-center ${result.passes ? "bg-success/10 border-success" : "bg-danger/10 border-danger"}`}
      >
        <span className="text-xs uppercase tracking-wider font-semibold">
          Verificación
        </span>
        <p
          className={`text-3xl font-bold ${result.passes ? "text-success" : "text-danger"}`}
        >
          {result.passes ? "✓ VERIFICA" : "✗ NO VERIFICA"}
        </p>
        <span className="text-xs text-text-muted">
          {result.passes
            ? `A_st = ${result.Ast.toFixed(1)} cm² (ρ = ${(result.rho * 100).toFixed(2)}%)`
            : "Aumentar sección o modificar geometría"}
        </span>
      </div>

      {/* ─── Armado longitudinal INTERACTIVO ─── */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
          Armado longitudinal
        </h2>

        {/* Inputs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
          <StepperInput
            label="Esquinas"
            value={nEsquinas}
            onChange={(v) => updateArmado(setNEsquinas, v)}
            min={4}
            max={8}
            step={2}
          />
          <StepperInput
            label="Caras X"
            value={nCarasX}
            onChange={(v) => updateArmado(setNCarasX, v)}
            min={0}
            max={6}
          />
          <StepperInput
            label="Caras Y"
            value={nCarasY}
            onChange={(v) => updateArmado(setNCarasY, v)}
            min={0}
            max={6}
          />
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-text-muted">
              Ø<sub>esq</sub>
            </span>
            <select
              value={dbEsquinas}
              onChange={(e) =>
                updateArmado(setDbEsquinas, Number(e.target.value))
              }
              className="text-sm font-semibold"
            >
              {DB_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} mm
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-text-muted">
              Ø<sub>caras X</sub>
            </span>
            <select
              value={dbCarasX}
              onChange={(e) =>
                updateArmado(setDbCarasX, Number(e.target.value))
              }
              className="text-sm font-semibold"
            >
              {DB_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} mm
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-text-muted">
              Ø<sub>caras Y</sub>
            </span>
            <select
              value={dbCarasY}
              onChange={(e) =>
                updateArmado(setDbCarasY, Number(e.target.value))
              }
              className="text-sm font-semibold"
            >
              {DB_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} mm
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Ast display + verify */}
        <div
          className={`p-4 rounded-lg mb-4 text-center ${astVerifica ? "bg-success/5 border border-success/20" : "bg-danger/5 border border-danger/20"}`}
        >
          <div className="text-xs text-text-muted space-y-0.5 mb-2">
            <p>
              Esquinas: {nEsquinas} Ø{dbEsquinas} ={" "}
              {armaduraManual.astEsquinas.toFixed(2)} cm²
            </p>
            <p>
              Caras X: 2 × {nCarasX} Ø{dbCarasX} ={" "}
              {armaduraManual.astCarasX.toFixed(2)} cm²
            </p>
            <p>
              Caras Y: 2 × {nCarasY} Ø{dbCarasY} ={" "}
              {armaduraManual.astCarasY.toFixed(2)} cm²
            </p>
          </div>
          <p
            className={`text-2xl font-bold mt-1 ${astVerifica ? "text-primary" : "text-danger"}`}
          >
            Total: {astProviso.toFixed(2)} cm²{" "}
            <span className="text-base font-normal">
              ({armaduraManual.totalBars} barras)
            </span>
          </p>
          <span
            className={`text-sm font-semibold ${astVerifica ? "text-success" : "text-danger"}`}
          >
            {astVerifica
              ? `✓ Ast provisto ≥ Ast necesario (${astNeeded.toFixed(2)} cm²)`
              : `⚠ NO VERIFICA — se necesitan ${astNeeded.toFixed(2)} cm²`}
          </span>
          <p className="text-xs text-text-muted mt-1">
            {nEsquinas} esquinas + {2 * nCarasX} caras X + {2 * nCarasY} caras Y
            = {armaduraManual.totalBars} barras
          </p>
        </div>

        {/* SVG layout */}
        <div className="flex flex-col items-center mb-4">
          <ArmadoLayoutSVG
            Cx={result.Cx}
            Cy={result.Cy}
            nCarasX={nCarasX}
            nCarasY={nCarasY}
            dbEsquinas={dbEsquinas}
            dbCarasX={dbCarasX}
            dbCarasY={dbCarasY}
          />
          <span className="text-xs text-text-muted mt-2">
            ■ esquinas &nbsp;
            <span style={{ color: "#3b82f6" }}>●</span> caras X &nbsp;
            <span style={{ color: "#22c55e" }}>●</span> caras Y &nbsp;
            <span
              style={{
                borderBottom: "1px dashed var(--color-text-muted, #9ca3af)",
              }}
            >
              - -
            </span>{" "}
            estribo
          </span>
        </div>

        {/* Confirm button */}
        {!armaduraConfirmada ? (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setArmaduraConfirmada(true)}
              disabled={!astVerifica}
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                astVerifica
                  ? "bg-primary text-white hover:bg-primary-hover"
                  : "bg-surface-alt border border-border text-text-muted cursor-not-allowed"
              }`}
            >
              {astVerifica
                ? "Confirmar armado"
                : "Ajustar armado para confirmar"}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <span className="inline-block px-3 py-1 rounded-full bg-success/10 text-success text-xs font-semibold">
              ✓ Armado confirmado
            </span>
          </div>
        )}
      </section>

      {/* ─── Estribos (only after confirmation) ─── */}
      {armaduraConfirmada && (
        <section className="bg-surface rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
              Estribos
            </h2>
            <button
              type="button"
              onClick={() => setArmaduraConfirmada(false)}
              className="text-xs bg-surface-alt border border-border hover:bg-surface text-text-muted px-3 py-1.5 rounded-lg"
            >
              Volver al armado
            </button>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
            <p className="text-xl font-bold text-primary">
              Ø{result.phiStirrup} c/ {result.sStirrup.toFixed(0)} cm
            </p>
            <p className="text-xs text-text-muted mt-2">
              φ<sub>e</sub> = {result.phiStirrup} mm (φ<sub>L</sub> ={" "}
              {result.dbLong} {result.dbLong <= 16 ? "≤ 16 mm" : "> 16 mm"})
              &nbsp;|&nbsp; s = min(b, h, 12·φ<sub>L</sub>, 48·φ<sub>e</sub>)
            </p>
          </div>
        </section>
      )}

      {/* Direction X card */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Dirección X
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${result.dirX.columnType === "SHORT" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
          >
            {result.dirX.columnType === "SHORT" ? "Corta" : "Esbelta"}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${result.dirX.passes ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
          >
            {result.dirX.passes ? "✓ Verifica" : "✗ No verifica"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">
              M<sub>1u</sub>
            </span>
            <p className="text-lg font-bold text-primary">
              {result.dirX.M1u.toFixed(1)} kN·m
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">
              M<sub>2u</sub>
            </span>
            <p className="text-lg font-bold text-primary">
              {result.dirX.M2u.toFixed(1)} kN·m
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">λ</span>
            <p
              className={`text-lg font-bold ${result.dirX.lambda <= result.dirX.lambdaLim ? "text-success" : "text-warning"}`}
            >
              {result.dirX.lambda.toFixed(1)}
            </p>
            <span className="text-xs text-text-muted">
              lim {result.dirX.lambdaLim.toFixed(1)}
            </span>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">ρ</span>
            <p className="text-lg font-bold text-primary">
              {(result.dirX.rho * 100).toFixed(2)}%
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">
              M<sub>u</sub>
            </span>
            <p className="text-lg font-bold text-primary">
              {result.dirX.Mu.toFixed(1)} kN·m
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">ν*</span>
            <p className="text-base font-bold text-primary">
              {result.dirX.n_raw.toFixed(1)} kN/cm²
            </p>
            <span className="text-xs text-text-muted">
              sin f'<sub>c</sub>
            </span>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">μ*</span>
            <p className="text-base font-bold text-primary">
              {result.dirX.m_raw.toFixed(1)} kN·m/cm²
            </p>
            <span className="text-xs text-text-muted">
              sin f'<sub>c</sub>
            </span>
          </div>
        </div>
      </section>

      {/* Direction Y card */}
      <section className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Dirección Y
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${result.dirY.columnType === "SHORT" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
          >
            {result.dirY.columnType === "SHORT" ? "Corta" : "Esbelta"}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${result.dirY.passes ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
          >
            {result.dirY.passes ? "✓ Verifica" : "✗ No verifica"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">
              M<sub>1u</sub>
            </span>
            <p className="text-lg font-bold text-primary">
              {result.dirY.M1u.toFixed(1)} kN·m
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">
              M<sub>2u</sub>
            </span>
            <p className="text-lg font-bold text-primary">
              {result.dirY.M2u.toFixed(1)} kN·m
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">λ</span>
            <p
              className={`text-lg font-bold ${result.dirY.lambda <= result.dirY.lambdaLim ? "text-success" : "text-warning"}`}
            >
              {result.dirY.lambda.toFixed(1)}
            </p>
            <span className="text-xs text-text-muted">
              lim {result.dirY.lambdaLim.toFixed(1)}
            </span>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">ρ</span>
            <p className="text-lg font-bold text-primary">
              {(result.dirY.rho * 100).toFixed(2)}%
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">
              M<sub>u</sub>
            </span>
            <p className="text-lg font-bold text-primary">
              {result.dirY.Mu.toFixed(1)} kN·m
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">ν*</span>
            <p className="text-base font-bold text-primary">
              {result.dirY.n_raw.toFixed(1)} kN/cm²
            </p>
            <span className="text-xs text-text-muted">
              sin f'<sub>c</sub>
            </span>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <span className="text-xs text-text-muted">μ*</span>
            <p className="text-base font-bold text-primary">
              {result.dirY.m_raw.toFixed(1)} kN·m/cm²
            </p>
            <span className="text-xs text-text-muted">
              sin f'<sub>c</sub>
            </span>
          </div>
        </div>
      </section>

      {/* Second-order details (show if either is slender) */}
      {(result.dirX.columnType === "SLENDER" ||
        result.dirY.columnType === "SLENDER") && (
        <>
          {result.dirX.columnType === "SLENDER" && (
            <section className="bg-surface rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
                Efectos 2° orden — Dir X
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    M<sub>min</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirX.Mmin?.toFixed(1)} kN·m
                  </p>
                </div>
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    P<sub>c</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirX.Pc?.toFixed(1)} kN
                  </p>
                </div>
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    δ<sub>s</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirX.deltaS?.toFixed(3)}
                  </p>
                </div>
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    M<sub>c</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirX.Mc?.toFixed(1)} kN·m
                  </p>
                </div>
              </div>
            </section>
          )}
          {result.dirY.columnType === "SLENDER" && (
            <section className="bg-surface rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
                Efectos 2° orden — Dir Y
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    M<sub>min</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirY.Mmin?.toFixed(1)} kN·m
                  </p>
                </div>
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    P<sub>c</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirY.Pc?.toFixed(1)} kN
                  </p>
                </div>
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    δ<sub>s</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirY.deltaS?.toFixed(3)}
                  </p>
                </div>
                <div className="bg-surface-alt rounded-lg p-3">
                  <span className="text-xs text-text-muted">
                    M<sub>c</sub>
                  </span>
                  <p className="text-lg font-bold text-primary">
                    {result.dirY.Mc?.toFixed(1)} kN·m
                  </p>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Detailed steps */}
      <section className="no-print bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Cuentas completas
        </h2>
        <pre className="p-3 bg-surface-alt rounded-lg text-xs text-text-muted font-mono whitespace-pre-wrap overflow-x-auto max-h-[32rem] overflow-y-auto">
          {result.steps.join("\n")}
        </pre>
      </section>
    </MainLayout>
  );
}
